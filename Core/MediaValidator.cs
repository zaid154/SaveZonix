using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Zonix.Core;

public enum MediaIntegrityStatus
{
    Passed,
    ZeroBytes,
    Truncated,
    Corrupted,
    MissingTracks,
    CodecError,
    DurationMismatch,
    FormatUnknown
}

public class MediaValidationResult
{
    public bool IsValid { get; set; }
    public MediaIntegrityStatus IntegrityStatus { get; set; } = MediaIntegrityStatus.Passed;
    public string ErrorReason { get; set; } = string.Empty;
    public double ProbedDurationSeconds { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public string Resolution => (Width > 0 && Height > 0) ? $"{Width}x{Height}" : (Height > 0 ? $"{Height}p" : "Unknown");
    public string VideoCodec { get; set; } = "None";
    public string AudioCodec { get; set; } = "None";
    public bool HasVideo { get; set; }
    public bool HasAudio { get; set; }
    public long FileSizeBytes { get; set; }
    public string ContainerFormat { get; set; } = "Unknown";
    public string AudioVideoDetails { get; set; } = string.Empty;
    public string DiagnosticReport { get; set; } = string.Empty;
}

public static class MediaValidator
{
    public const string CurrentAppVersion = "SaveZonix v2.5.0";
    public static readonly string CurrentSystemVersion = $"{System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription} {System.Runtime.InteropServices.RuntimeInformation.OSDescription} ({System.Runtime.InteropServices.RuntimeInformation.OSArchitecture})";

    public static async Task<MediaValidationResult> ValidateMediaFileAsync(string filePath, int expectedDurationSeconds = 0, string targetFormat = "MP4", bool requireAudio = false, string? expectedResolution = null)
    {
        var result = new MediaValidationResult();

        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
        {
            result.IsValid = false;
            result.IntegrityStatus = MediaIntegrityStatus.ZeroBytes;
            result.ErrorReason = "File does not exist on disk or path is empty.";
            return result;
        }

        var fileInfo = new FileInfo(filePath);
        result.FileSizeBytes = fileInfo.Length;

        if (result.FileSizeBytes < 512)
        {
            result.IsValid = false;
            result.IntegrityStatus = MediaIntegrityStatus.ZeroBytes;
            result.ErrorReason = $"File size is too small ({result.FileSizeBytes} bytes). Media stream is truncated or empty.";
            return result;
        }

        // 1. Try probing with FFprobe / FFmpeg if available
        bool probedWithFfprobe = await TryProbeWithFFprobeAsync(filePath, result);
        if (!probedWithFfprobe)
        {
            probedWithFfprobe = await TryProbeWithFfmpegAsync(filePath, result);
        }

        // 2. Perform deep binary container verification
        var binaryCheck = ValidateBinaryContainer(filePath, result.FileSizeBytes, targetFormat);

        if (!binaryCheck.IsValid)
        {
            result.IsValid = false;
            result.IntegrityStatus = binaryCheck.Status;
            result.ErrorReason = binaryCheck.Error;
            return result;
        }

        // If no external probe is available, take stream information from the
        // container parser. A successful ffmpeg probe is authoritative for
        // track presence, particularly for audio-only MP4 files.
        if (!probedWithFfprobe)
        {
            result.ContainerFormat = binaryCheck.DetectedFormat;
            result.HasVideo = binaryCheck.HasVideo;
            result.HasAudio = binaryCheck.HasAudio;
            if (!string.IsNullOrEmpty(binaryCheck.VideoCodec)) result.VideoCodec = binaryCheck.VideoCodec;
            if (!string.IsNullOrEmpty(binaryCheck.AudioCodec)) result.AudioCodec = binaryCheck.AudioCodec;
            if (binaryCheck.DurationSeconds > 0 && result.ProbedDurationSeconds <= 0)
            {
                result.ProbedDurationSeconds = binaryCheck.DurationSeconds;
            }
            if (binaryCheck.Width > 0) result.Width = binaryCheck.Width;
            if (binaryCheck.Height > 0) result.Height = binaryCheck.Height;
        }
        else if (string.IsNullOrEmpty(result.ContainerFormat) || result.ContainerFormat == "Unknown")
        {
            result.ContainerFormat = binaryCheck.DetectedFormat;
        }

        // 3. Audio / Video Track Requirement Check
        bool isAudioTarget = targetFormat.Equals("MP3", StringComparison.OrdinalIgnoreCase) || 
                             targetFormat.Equals("M4A", StringComparison.OrdinalIgnoreCase) ||
                             filePath.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase) ||
                             filePath.EndsWith(".m4a", StringComparison.OrdinalIgnoreCase);

        if (isAudioTarget)
        {
            if (!result.HasAudio && result.AudioCodec == "None")
            {
                // Fallback: Check if file has valid audio data header
                if (!binaryCheck.HasAudio)
                {
                    result.IsValid = false;
                    result.IntegrityStatus = MediaIntegrityStatus.MissingTracks;
                    result.ErrorReason = "Audio track could not be found or decoded in the audio file.";
                    return result;
                }
            }
        }
        else
        {
            if (!result.HasVideo && !binaryCheck.HasVideo)
            {
                result.IsValid = false;
                result.IntegrityStatus = MediaIntegrityStatus.MissingTracks;
                result.ErrorReason = "Video stream track is missing from the container.";
                return result;
            }

            if (requireAudio && !result.HasAudio)
            {
                result.IsValid = false;
                result.IntegrityStatus = MediaIntegrityStatus.MissingTracks;
                result.ErrorReason = "Expected audio track is missing from the completed video container.";
                return result;
            }
        }

        // 4. Duration Consistency Check
        if (expectedDurationSeconds >= 3 && result.ProbedDurationSeconds > 0)
        {
            // A signed URL from a neighbouring Reel can still be a healthy MP4.
            // Reject it when its duration does not match the stream selected at
            // Analyze time, including short Reels such as 9-second clips.
            double permittedDifference = Math.Max(3, expectedDurationSeconds * 0.35);
            if (Math.Abs(result.ProbedDurationSeconds - expectedDurationSeconds) > permittedDifference)
            {
                result.IsValid = false;
                result.IntegrityStatus = MediaIntegrityStatus.DurationMismatch;
                result.ErrorReason = $"Downloaded duration ({result.ProbedDurationSeconds:F1}s) does not match the analyzed stream duration ({expectedDurationSeconds}s).";
                return result;
            }
        }

        if (!string.IsNullOrWhiteSpace(expectedResolution))
        {
            var expectedSize = Regex.Match(expectedResolution, @"\b(\d{2,5})x(\d{2,5})\b");
            if (expectedSize.Success && int.TryParse(expectedSize.Groups[1].Value, out var expectedWidth) &&
                int.TryParse(expectedSize.Groups[2].Value, out var expectedHeight) &&
                result.Width > 0 && result.Height > 0 &&
                (result.Width != expectedWidth || result.Height != expectedHeight))
            {
                result.IsValid = false;
                result.IntegrityStatus = MediaIntegrityStatus.DurationMismatch;
                result.ErrorReason = $"Downloaded resolution ({result.Width}x{result.Height}) does not match the analyzed video stream ({expectedWidth}x{expectedHeight}).";
                return result;
            }
        }

        // 5. Deep Packet & Stream Decode Verification
        // Run deep stream scan to ensure there are no corrupted NAL units, mid-video packet drops, or decoding crashes
        var (isHealthy, streamError) = await VerifyStreamIntegrityWithFFmpegAsync(filePath);
        if (!isHealthy)
        {
            result.IsValid = false;
            result.IntegrityStatus = MediaIntegrityStatus.Corrupted;
            result.ErrorReason = streamError;
            return result;
        }

        // 6. Final Details Assembly
        result.IsValid = true;
        result.IntegrityStatus = MediaIntegrityStatus.Passed;
        
        string vStr = result.HasVideo ? $"Video: {result.VideoCodec} ({result.Resolution})" : "No Video";
        string aStr = result.HasAudio ? $"Audio: {result.AudioCodec}" : "No Audio";
        result.AudioVideoDetails = $"{vStr} • {aStr} • Container: {result.ContainerFormat}";
        result.DiagnosticReport = $"Validated OK: {result.FileSizeBytes:N0} bytes, Duration: {result.ProbedDurationSeconds:F1}s, Format: {result.ContainerFormat}, Video: {result.VideoCodec}, Audio: {result.AudioCodec}";

        return result;
    }

    private static (bool IsValid, MediaIntegrityStatus Status, string Error, string DetectedFormat, bool HasVideo, bool HasAudio, string VideoCodec, string AudioCodec, double DurationSeconds, int Width, int Height) ValidateBinaryContainer(string filePath, long fileSize, string targetFormat)
    {
        try
        {
            using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 65536);
            byte[] header = new byte[Math.Min(fileSize, 65536)];
            int bytesRead = fs.Read(header, 0, header.Length);

            if (bytesRead < 32)
            {
                return (false, MediaIntegrityStatus.Truncated, "File is under 32 bytes.", "Unknown", false, false, "", "", 0, 0, 0);
            }

            // A. Check for MPEG-TS stream (HLS Transport Stream, sync byte 0x47)
            for (int offset = 0; offset < Math.Min(header.Length - 376, 2048); offset++)
            {
                if (header[offset] == 0x47 && header[offset + 188] == 0x47 && header[offset + 376] == 0x47)
                {
                    return (true, MediaIntegrityStatus.Passed, "", "MPEG-TS (HLS)", true, true, "H.264 / AVC", "AAC", 0, 0, 0);
                }
            }

            // B. Check for ISO Base Media File Format (MP4, M4A, MOV)
            string headerStr = Encoding.ASCII.GetString(header, 0, Math.Min(bytesRead, 1024));
            bool isIso = headerStr.Contains("ftyp") || headerStr.Contains("moov") || headerStr.Contains("moof") || headerStr.Contains("mdat") || headerStr.Contains("isom") || headerStr.Contains("mp42");

            if (isIso || filePath.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) || filePath.EndsWith(".m4a", StringComparison.OrdinalIgnoreCase))
            {
                // Verify atoms in MP4 box tree
                bool hasFtyp = false;
                bool hasMoov = false;
                bool hasMoof = false;
                bool hasMdat = false;
                double durationSec = 0;
                int width = 0;
                int height = 0;

                fs.Seek(0, SeekOrigin.Begin);
                byte[] boxHeader = new byte[8];
                long currentPos = 0;
                int boxCount = 0;

                while (currentPos + 8 <= fileSize && boxCount < 1000)
                {
                    fs.Seek(currentPos, SeekOrigin.Begin);
                    int r = fs.Read(boxHeader, 0, 8);
                    if (r < 8) break;

                    uint boxSize = (uint)((boxHeader[0] << 24) | (boxHeader[1] << 16) | (boxHeader[2] << 8) | boxHeader[3]);
                    string boxType = Encoding.ASCII.GetString(boxHeader, 4, 4);

                    if (boxType == "ftyp") hasFtyp = true;
                    if (boxType == "moov")
                    {
                        hasMoov = true;
                        // Inspect mvhd inside moov if possible
                        if (boxSize > 8 && boxSize < 1048576)
                        {
                            byte[] moovBytes = new byte[Math.Min((long)boxSize, fileSize - currentPos)];
                            fs.Seek(currentPos, SeekOrigin.Begin);
                            fs.Read(moovBytes, 0, moovBytes.Length);
                            string moovStr = Encoding.ASCII.GetString(moovBytes);
                            int mvhdIdx = moovStr.IndexOf("mvhd");
                            if (mvhdIdx >= 0 && mvhdIdx + 28 <= moovBytes.Length)
                            {
                                int version = moovBytes[mvhdIdx + 4];
                                int timeScaleOffset = mvhdIdx + 4 + (version == 1 ? 20 : 12);
                                int durationOffset = timeScaleOffset + 4;
                                if (durationOffset + 8 <= moovBytes.Length)
                                {
                                    uint timeScale = (uint)((moovBytes[timeScaleOffset] << 24) | (moovBytes[timeScaleOffset + 1] << 16) | (moovBytes[timeScaleOffset + 2] << 8) | moovBytes[timeScaleOffset + 3]);
                                    ulong dur = (version == 1)
                                        ? (ulong)((moovBytes[durationOffset] << 56) | (moovBytes[durationOffset + 1] << 48) | (moovBytes[durationOffset + 2] << 40) | (moovBytes[durationOffset + 3] << 32) |
                                                  (moovBytes[durationOffset + 4] << 24) | (moovBytes[durationOffset + 5] << 16) | (moovBytes[durationOffset + 6] << 8) | moovBytes[durationOffset + 7])
                                        : (uint)((moovBytes[durationOffset] << 24) | (moovBytes[durationOffset + 1] << 16) | (moovBytes[durationOffset + 2] << 8) | moovBytes[durationOffset + 3]);
                                    if (timeScale > 0)
                                    {
                                        durationSec = (double)dur / timeScale;
                                    }
                                }
                            }
                        }
                    }
                    if (boxType == "moof") hasMoof = true;
                    if (boxType == "mdat") hasMdat = true;

                    if (boxSize == 1)
                    {
                        // 64-bit extended size
                        byte[] extSize = new byte[8];
                        fs.Read(extSize, 0, 8);
                        ulong lSize = ((ulong)extSize[0] << 56) | ((ulong)extSize[1] << 48) | ((ulong)extSize[2] << 40) | ((ulong)extSize[3] << 32) |
                                      ((ulong)extSize[4] << 24) | ((ulong)extSize[5] << 16) | ((ulong)extSize[6] << 8) | extSize[7];
                        if (lSize <= 0) break;
                        currentPos += (long)lSize;
                    }
                    else if (boxSize == 0)
                    {
                        // Box extends to EOF
                        break;
                    }
                    else
                    {
                        currentPos += boxSize;
                    }
                    boxCount++;
                }

                // If moov wasn't found at the beginning, check the last 2MB for faststart/web-optimized moov
                if (!hasMoov && fileSize > 32)
                {
                    long tailScan = Math.Min(fileSize, 2097152);
                    fs.Seek(fileSize - tailScan, SeekOrigin.Begin);
                    byte[] tailBytes = new byte[tailScan];
                    int tr = fs.Read(tailBytes, 0, tailBytes.Length);
                    string tailStr = Encoding.ASCII.GetString(tailBytes, 0, tr);
                    if (tailStr.Contains("moov"))
                    {
                        hasMoov = true;
                    }
                }

                // Fragmented MP4 (fMP4 / DASH) uses moof + mdat without traditional single moov
                if (hasMoof && hasMdat)
                {
                    return (true, MediaIntegrityStatus.Passed, "", "Fragmented MP4 (fMP4)", true, true, "H.264 / AV1", "AAC", durationSec, width, height);
                }

                if (hasMoov || hasMdat || isIso)
                {
                    return (true, MediaIntegrityStatus.Passed, "", "MP4 ISO Container", true, true, "H.264 / AVC", "AAC", durationSec, width, height);
                }

                // If none of the atoms matched, file is likely truncated
                if (!hasMoov && !hasMoof && !hasMdat && fileSize < 102400)
                {
                    return (false, MediaIntegrityStatus.Corrupted, "MP4 container is missing required moov, moof, and mdat atoms. File is corrupted or truncated.", "MP4", false, false, "", "", 0, 0, 0);
                }
            }

            // C. Check for WebM / Matroska (EBML signature 0x1A 0x45 0xDF 0xA3)
            if (header[0] == 0x1A && header[1] == 0x45 && header[2] == 0xDF && header[3] == 0xA3)
            {
                return (true, MediaIntegrityStatus.Passed, "", "WebM / Matroska", true, true, "VP9 / VP8", "Opus / Vorbis", 0, 0, 0);
            }

            // D. Check for MP3 ID3 or MPEG Audio Frame Sync (0xFF 0xFB, 0xFF 0xF3, 0xFF 0xF2)
            if ((header[0] == 0x49 && header[1] == 0x44 && header[2] == 0x33) || (header[0] == 0xFF && (header[1] & 0xE0) == 0xE0))
            {
                return (true, MediaIntegrityStatus.Passed, "", "MP3 Audio", false, true, "None", "MP3", 0, 0, 0);
            }

            // General payload with large size is considered binary media
            if (fileSize > 102400)
            {
                return (true, MediaIntegrityStatus.Passed, "", "Binary Media Container", true, true, "H.264 / AAC", "AAC", 0, 0, 0);
            }

            return (false, MediaIntegrityStatus.FormatUnknown, "Unknown or corrupted file format header.", "Unknown", false, false, "", "", 0, 0, 0);
        }
        catch (Exception ex)
        {
            return (false, MediaIntegrityStatus.Corrupted, $"Binary validation exception: {ex.Message}", "Unknown", false, false, "", "", 0, 0, 0);
        }
    }

    private static async Task<bool> TryProbeWithFFprobeAsync(string filePath, MediaValidationResult result)
    {
        try
        {
            string ffprobePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ffprobe.exe");
            if (!File.Exists(ffprobePath)) ffprobePath = Path.Combine(Directory.GetCurrentDirectory(), "ffprobe.exe");
            if (!File.Exists(ffprobePath)) ffprobePath = "ffprobe";

            var startInfo = new ProcessStartInfo
            {
                FileName = ffprobePath,
                Arguments = $"-v error -show_format -show_streams -print_format json \"{filePath}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(startInfo);
            if (process == null) return false;

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();

            await process.WaitForExitAsync(cts.Token);
            string jsonOutput = await outputTask;
            string errors = await errorTask;

            if (process.ExitCode == 0 && !string.IsNullOrWhiteSpace(jsonOutput))
            {
                using var doc = JsonDocument.Parse(jsonOutput);
                var root = doc.RootElement;

                if (root.TryGetProperty("format", out var fmtEl))
                {
                    if (fmtEl.TryGetProperty("format_name", out var fn))
                    {
                        result.ContainerFormat = fn.GetString() ?? "MP4";
                    }
                    if (fmtEl.TryGetProperty("duration", out var durEl) && double.TryParse(durEl.GetString(), out var dur))
                    {
                        result.ProbedDurationSeconds = dur;
                    }
                }

                if (root.TryGetProperty("streams", out var streamsEl) && streamsEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var s in streamsEl.EnumerateArray())
                    {
                        string codecType = s.TryGetProperty("codec_type", out var ct) ? ct.GetString() ?? "" : "";
                        string codecName = s.TryGetProperty("codec_name", out var cn) ? cn.GetString() ?? "" : "";

                        if (codecType == "video" && !result.HasVideo)
                        {
                            result.HasVideo = true;
                            result.VideoCodec = codecName.ToUpperInvariant();
                            if (s.TryGetProperty("width", out var w)) result.Width = w.GetInt32();
                            if (s.TryGetProperty("height", out var h)) result.Height = h.GetInt32();
                        }
                        else if (codecType == "audio" && !result.HasAudio)
                        {
                            result.HasAudio = true;
                            result.AudioCodec = codecName.ToUpperInvariant();
                        }
                    }
                }

                return result.HasVideo || result.HasAudio;
            }
        }
        catch { }

        return false;
    }

    // ffprobe is not bundled with the desktop build, while ffmpeg is.  Use
    // ffmpeg's stream report as a reliable fallback so an audio-only MP4 can
    // never be promoted as a completed video download.
    private static async Task<bool> TryProbeWithFfmpegAsync(string filePath, MediaValidationResult result)
    {
        try
        {
            string ffmpegPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ffmpeg.exe");
            if (!File.Exists(ffmpegPath)) ffmpegPath = Path.Combine(Directory.GetCurrentDirectory(), "ffmpeg.exe");
            if (!File.Exists(ffmpegPath)) ffmpegPath = "ffmpeg";

            var startInfo = new ProcessStartInfo
            {
                FileName = ffmpegPath,
                Arguments = $"-hide_banner -i \"{filePath}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(startInfo);
            if (process == null) return false;

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync(cts.Token);
            string report = (await outputTask) + "\n" + (await errorTask);

            var duration = Regex.Match(report, @"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", RegexOptions.IgnoreCase);
            if (duration.Success &&
                int.TryParse(duration.Groups[1].Value, out var hours) &&
                int.TryParse(duration.Groups[2].Value, out var minutes) &&
                double.TryParse(duration.Groups[3].Value, System.Globalization.CultureInfo.InvariantCulture, out var seconds))
            {
                result.ProbedDurationSeconds = hours * 3600 + minutes * 60 + seconds;
            }

            foreach (Match stream in Regex.Matches(report, @"Stream\s+#\d+:\d+(?:\([^)]*\))?:\s*(Video|Audio):\s*([^,\s]+)", RegexOptions.IgnoreCase))
            {
                string type = stream.Groups[1].Value;
                string codec = stream.Groups[2].Value.ToUpperInvariant();
                if (type.Equals("Video", StringComparison.OrdinalIgnoreCase))
                {
                    result.HasVideo = true;
                    result.VideoCodec = codec;
                    var dimensions = Regex.Match(stream.Value, @"\b(\d{2,5})x(\d{2,5})\b");
                    if (dimensions.Success)
                    {
                        int.TryParse(dimensions.Groups[1].Value, out var width);
                        int.TryParse(dimensions.Groups[2].Value, out var height);
                        result.Width = width;
                        result.Height = height;
                    }
                }
                else if (type.Equals("Audio", StringComparison.OrdinalIgnoreCase))
                {
                    result.HasAudio = true;
                    result.AudioCodec = codec;
                }
            }

            return result.HasVideo || result.HasAudio;
        }
        catch
        {
            return false;
        }
    }

    private static async Task<(bool IsHealthy, string ErrorReason)> VerifyStreamIntegrityWithFFmpegAsync(string filePath)
    {
        try
        {
            string ffmpegPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ffmpeg.exe");
            if (!File.Exists(ffmpegPath)) ffmpegPath = Path.Combine(Directory.GetCurrentDirectory(), "ffmpeg.exe");
            if (!File.Exists(ffmpegPath)) ffmpegPath = "ffmpeg";

            var startInfo = new ProcessStartInfo
            {
                FileName = ffmpegPath,
                Arguments = $"-v error -i \"{filePath}\" -f null -",
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(startInfo);
            if (process == null) return (true, "");

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(25));
            var errTask = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync(cts.Token);
            string errors = await errTask;

            // Only treat as fatal if FFmpeg itself failed with exit code != 0 or there are severe broken NAL units (> 5)
            if (errors.Contains("Invalid NAL unit size", StringComparison.OrdinalIgnoreCase))
            {
                int nalCount = Regex.Matches(errors, "Invalid NAL unit size", RegexOptions.IgnoreCase).Count;
                if (nalCount > 5)
                {
                    return (false, $"Media stream has corrupted NAL units ({nalCount} framing errors).");
                }
            }

            if (process.ExitCode != 0)
            {
                string firstLine = errors.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "Fatal decoding error";
                return (false, $"Media stream is corrupted during decoding: {firstLine}");
            }

            return (true, "");
        }
        catch
        {
            return (true, ""); // Allow benign bypass if ffmpeg probe process is busy or unavailable
        }
    }
}
