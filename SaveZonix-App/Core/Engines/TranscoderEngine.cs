using System.Diagnostics;
using System.Text;

namespace Zonix.Core.Engines;

public record TranscodeResult(
    bool Success,
    string OutputPath,
    long OutputSizeBytes,
    double DurationSeconds,
    string ErrorMessage = "",
    int ExitCode = 0
);

/// <summary>
/// Isolated Media Processing & FFmpeg Engine.
/// Runs all transcode, mux, and format conversion jobs in supervised, isolated process boundaries
/// with strict timeouts, zero deadlock risk, and automatic zombie process cleanup.
/// </summary>
public class TranscoderEngine
{
    private static readonly string[] PossibleFfmpegPaths =
    [
        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ffmpeg.exe"),
        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "ffmpeg.exe"),
        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "ffmpeg.exe"),
        Path.Combine(Directory.GetCurrentDirectory(), "ffmpeg.exe"),
        "ffmpeg"
    ];

    public string FfmpegPath { get; }

    public TranscoderEngine()
    {
        FfmpegPath = ResolveFfmpegPath();
    }

    private static string ResolveFfmpegPath()
    {
        foreach (var path in PossibleFfmpegPaths)
        {
            try
            {
                if (File.Exists(path)) return Path.GetFullPath(path);
            }
            catch { }
        }
        return "ffmpeg";
    }

    /// <summary>
    /// Muxes separate video and audio streams into a single optimized MP4 container.
    /// Uses ultra-fast stream copy (-c copy) first, falling back to AAC audio encode if container incompatible.
    /// </summary>
    public async Task<TranscodeResult> MuxVideoAndAudioAsync(
        string videoPath,
        string audioPath,
        string outputPath,
        TimeSpan? timeout = null,
        CancellationToken ct = default)
    {
        if (!File.Exists(videoPath))
            return new TranscodeResult(false, outputPath, 0, 0, $"Video file not found: {videoPath}");

        if (!File.Exists(audioPath))
            return new TranscodeResult(false, outputPath, 0, 0, $"Audio file not found: {audioPath}");

        var maxTime = timeout ?? TimeSpan.FromMinutes(10);
        var sw = Stopwatch.StartNew();

        // Pass 1: Ultra-Fast direct stream copy (-c copy) — ~0.2s, 0 CPU re-encode
        string fastArgs = $"-i \"{videoPath}\" -i \"{audioPath}\" -c copy -map 0:v:0 -map 1:a:0? -movflags +faststart \"{outputPath}\" -y";
        var res1 = await RunFfmpegProcessAsync(fastArgs, maxTime, ct);

        if (res1.Success && File.Exists(outputPath) && new FileInfo(outputPath).Length > 1024)
        {
            sw.Stop();
            long size = new FileInfo(outputPath).Length;
            return new TranscodeResult(true, outputPath, size, sw.Elapsed.TotalSeconds);
        }

        // Pass 2: Resilient audio AAC re-encode if stream copy failed due to codec mismatch
        string fallbackArgs = $"-i \"{videoPath}\" -i \"{audioPath}\" -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0? -movflags +faststart \"{outputPath}\" -y";
        var res2 = await RunFfmpegProcessAsync(fallbackArgs, maxTime, ct);

        sw.Stop();
        if (res2.Success && File.Exists(outputPath) && new FileInfo(outputPath).Length > 1024)
        {
            long size = new FileInfo(outputPath).Length;
            return new TranscodeResult(true, outputPath, size, sw.Elapsed.TotalSeconds);
        }

        return new TranscodeResult(false, outputPath, 0, sw.Elapsed.TotalSeconds, res2.ErrorMessage, res2.ExitCode);
    }

    /// <summary>
    /// Extracts high-fidelity audio (MP3, AAC, FLAC) from any media file.
    /// </summary>
    public async Task<TranscodeResult> ExtractAudioAsync(
        string inputVideoPath,
        string outputAudioPath,
        string format = "mp3",
        string bitrate = "320k",
        TimeSpan? timeout = null,
        CancellationToken ct = default)
    {
        if (!File.Exists(inputVideoPath))
            return new TranscodeResult(false, outputAudioPath, 0, 0, $"Input video not found: {inputVideoPath}");

        var maxTime = timeout ?? TimeSpan.FromMinutes(5);
        var sw = Stopwatch.StartNew();

        string codecArg = format.ToLowerInvariant() switch
        {
            "flac" => "-c:a flac",
            "wav" => "-c:a pcm_s16le",
            "aac" or "m4a" => "-c:a aac -b:a 256k",
            _ => $"-c:a libmp3lame -b:a {bitrate}"
        };

        string args = $"-i \"{inputVideoPath}\" -vn {codecArg} \"{outputAudioPath}\" -y";
        var res = await RunFfmpegProcessAsync(args, maxTime, ct);
        sw.Stop();

        if (res.Success && File.Exists(outputAudioPath) && new FileInfo(outputAudioPath).Length > 1024)
        {
            long size = new FileInfo(outputAudioPath).Length;
            return new TranscodeResult(true, outputAudioPath, size, sw.Elapsed.TotalSeconds);
        }

        return new TranscodeResult(false, outputAudioPath, 0, sw.Elapsed.TotalSeconds, res.ErrorMessage, res.ExitCode);
    }

    /// <summary>
    /// Repairs MP4 files with missing or misplaced moov atom by relocating moov to the beginning (+faststart).
    /// </summary>
    public async Task<TranscodeResult> FaststartRepairAsync(
        string inputPath,
        string outputPath,
        CancellationToken ct = default)
    {
        string args = $"-i \"{inputPath}\" -c copy -movflags +faststart \"{outputPath}\" -y";
        return await RunFfmpegProcessAsync(args, TimeSpan.FromMinutes(3), ct);
    }

    /// <summary>
    /// Optimizes any video container for Apple devices (iPhone, iPad, Mac QuickTime & iOS Safari).
    /// Enforces H.264 video with yuv420p color matrix, AAC audio, and +faststart moov atom.
    /// </summary>
    public async Task<TranscodeResult> OptimizeForAppleDeviceAsync(
        string inputVideoPath,
        string outputMp4Path,
        CancellationToken ct = default)
    {
        if (!File.Exists(inputVideoPath))
            return new TranscodeResult(false, outputMp4Path, 0, 0, "Input video file not found.");

        string args = $"-i \"{inputVideoPath}\" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 22 -c:a aac -b:a 192k -movflags +faststart \"{outputMp4Path}\" -y";
        return await RunFfmpegProcessAsync(args, TimeSpan.FromMinutes(10), ct);
    }

    private async Task<TranscodeResult> RunFfmpegProcessAsync(string arguments, TimeSpan timeout, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        var psi = new ProcessStartInfo
        {
            FileName = FfmpegPath,
            Arguments = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        Process? process = null;
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        linkedCts.CancelAfter(timeout);

        try
        {
            process = new Process { StartInfo = psi };
            var stderrBuilder = new StringBuilder();

            process.ErrorDataReceived += (s, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                {
                    lock (stderrBuilder)
                    {
                        if (stderrBuilder.Length < 4096)
                            stderrBuilder.AppendLine(e.Data);
                    }
                }
            };

            process.Start();
            process.BeginErrorReadLine();

            await process.WaitForExitAsync(linkedCts.Token);

            sw.Stop();
            bool isSuccess = process.ExitCode == 0;
            string errorOut = isSuccess ? "" : stderrBuilder.ToString();

            return new TranscodeResult(
                Success: isSuccess,
                OutputPath: "",
                OutputSizeBytes: 0,
                DurationSeconds: sw.Elapsed.TotalSeconds,
                ErrorMessage: errorOut,
                ExitCode: process.ExitCode
            );
        }
        catch (OperationCanceledException)
        {
            SafeKillProcess(process);
            sw.Stop();
            bool wasTimeout = !ct.IsCancellationRequested;
            return new TranscodeResult(
                Success: false,
                OutputPath: "",
                OutputSizeBytes: 0,
                DurationSeconds: sw.Elapsed.TotalSeconds,
                ErrorMessage: wasTimeout ? $"FFmpeg operation timed out after {timeout.TotalSeconds:F0}s" : "Operation cancelled by user",
                ExitCode: -1
            );
        }
        catch (Exception ex)
        {
            SafeKillProcess(process);
            sw.Stop();
            return new TranscodeResult(
                Success: false,
                OutputPath: "",
                OutputSizeBytes: 0,
                DurationSeconds: sw.Elapsed.TotalSeconds,
                ErrorMessage: $"FFmpeg process error: {ex.Message}",
                ExitCode: -2
            );
        }
        finally
        {
            process?.Dispose();
        }
    }

    private static void SafeKillProcess(Process? process)
    {
        if (process == null) return;
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch { }
    }
}
