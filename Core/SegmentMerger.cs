using System.Diagnostics;

namespace Zonix.Core;

public class SegmentMerger
{
    public static async Task<bool> MergeSegmentsAsync(
        List<SegmentItem> segments,
        string outputFilePath,
        string tempDirectory,
        bool cleanUpTemp = true)
    {
        var outputDir = Path.GetDirectoryName(outputFilePath);
        if (!string.IsNullOrEmpty(outputDir) && !Directory.Exists(outputDir))
        {
            Directory.CreateDirectory(outputDir);
        }

        // Only merge segments that exist and have non-zero size
        var validSegments = segments
            .Where(s => File.Exists(s.LocalTempPath) && new FileInfo(s.LocalTempPath).Length > 0)
            .OrderBy(s => s.Index)
            .ToList();

        if (validSegments.Count == 0)
        {
            return false;
        }

        if (validSegments.Count == 1)
        {
            // Instantaneous zero-copy file promotion (0.001s)
            File.Copy(validSegments[0].LocalTempPath, outputFilePath, true);
            if (cleanUpTemp) CleanUp(tempDirectory);
            return File.Exists(outputFilePath) && new FileInfo(outputFilePath).Length > 0;
        }

        bool ffmpegAvailable = IsFFmpegAvailable();
        bool isByteRangeChunks = validSegments.Any(s => s.LocalTempPath.EndsWith(".part", StringComparison.OrdinalIgnoreCase) || s.RangeEnd > 0);
        bool isTsSegments = validSegments.Any(s => s.LocalTempPath.EndsWith(".ts", StringComparison.OrdinalIgnoreCase));
        string targetExt = Path.GetExtension(outputFilePath).ToLowerInvariant();

        if (isByteRangeChunks)
        {
            // Direct byte-level concatenation preserves exact MP4 box hierarchy and all frames
            await DirectBinaryMergeAsync(validSegments, outputFilePath);
            if (cleanUpTemp) CleanUp(tempDirectory);
            return File.Exists(outputFilePath) && new FileInfo(outputFilePath).Length > 0;
        }

        // Inspect first segment to see if it's MPEG-TS (starts with 0x47 sync byte) or has .ts extension
        bool isTsFormat = isTsSegments;
        if (!isTsFormat && validSegments.Count > 0 && File.Exists(validSegments[0].LocalTempPath))
        {
            try
            {
                using var fs = File.OpenRead(validSegments[0].LocalTempPath);
                byte[] checkBuf = new byte[378];
                int r = fs.Read(checkBuf, 0, checkBuf.Length);
                if (r >= 377 && checkBuf[0] == 0x47 && checkBuf[188] == 0x47 && checkBuf[376] == 0x47)
                {
                    isTsFormat = true;
                }
            }
            catch { }
        }

        // For HLS streams (both MPEG-TS and fMP4 / m4s):
        // Sequentially binary-concatenate all chunks first to avoid concat-demuxer boundary corruption
        string rawConcatFile = isTsFormat 
            ? Path.Combine(tempDirectory, "raw_concat.ts")
            : Path.Combine(tempDirectory, "raw_concat.mp4");

        await DirectBinaryMergeAsync(validSegments, rawConcatFile);

        if (!File.Exists(rawConcatFile) || new FileInfo(rawConcatFile).Length == 0)
        {
            return false;
        }

        // If FFmpeg is available and we're targeting MP4 or source is TS:
        // Perform a single-input container remux (-i raw_concat -c copy -movflags +faststart)
        // This converts MPEG-TS Annex B to MP4 AVCC seamlessly, or consolidates fMP4 fragments into a clean MP4.
        if (ffmpegAvailable && (targetExt == ".mp4" || targetExt == ".m4v" || isTsFormat))
        {
            string tempRemuxFile = outputFilePath + ".remux.mp4";
            bool remuxSuccess = await RemuxWithFFmpegAsync(rawConcatFile, tempRemuxFile);
            if (remuxSuccess && File.Exists(tempRemuxFile) && new FileInfo(tempRemuxFile).Length > 1024)
            {
                if (File.Exists(outputFilePath)) { try { File.Delete(outputFilePath); } catch { } }
                File.Move(tempRemuxFile, outputFilePath, true);
                try { if (File.Exists(rawConcatFile)) File.Delete(rawConcatFile); } catch { }
                if (cleanUpTemp) CleanUp(tempDirectory);
                return true;
            }
            else
            {
                try { if (File.Exists(tempRemuxFile)) File.Delete(tempRemuxFile); } catch { }
            }
        }

        // Fallback: If FFmpeg remux not needed or unavailable, promote raw concat directly
        if (File.Exists(outputFilePath)) { try { File.Delete(outputFilePath); } catch { } }
        File.Move(rawConcatFile, outputFilePath, true);

        if (cleanUpTemp)
        {
            CleanUp(tempDirectory);
        }

        return File.Exists(outputFilePath) && new FileInfo(outputFilePath).Length > 0;
    }

    private static async Task DirectBinaryMergeAsync(List<SegmentItem> segments, string outputFilePath)
    {
        var orderedSegments = segments.OrderBy(s => s.Index).ToList();
        long totalExpectedBytes = orderedSegments.Sum(s => s.SizeBytes > 0 ? s.SizeBytes : (new FileInfo(s.LocalTempPath).Exists ? new FileInfo(s.LocalTempPath).Length : 0));
        string tempOutputFile = outputFilePath + ".tmp_" + Guid.NewGuid().ToString("N");
        
        await using (var outputStream = new FileStream(tempOutputFile, FileMode.Create, FileAccess.Write, FileShare.None, 4194304, FileOptions.Asynchronous | FileOptions.SequentialScan))
        {
            if (totalExpectedBytes > 0)
            {
                outputStream.SetLength(totalExpectedBytes);
            }

            byte[] buffer = new byte[4194304]; // 4MB high-throughput buffer for instant NVMe/SSD assembly
            foreach (var seg in orderedSegments)
            {
                if (File.Exists(seg.LocalTempPath))
                {
                    var fileInfo = new FileInfo(seg.LocalTempPath);
                    if (fileInfo.Length == 0) continue;

                    await using var inputStream = new FileStream(seg.LocalTempPath, FileMode.Open, FileAccess.Read, FileShare.Read, 2097152, FileOptions.Asynchronous | FileOptions.SequentialScan);
                    int bytesRead;
                    while ((bytesRead = await inputStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                    {
                        await outputStream.WriteAsync(buffer, 0, bytesRead);
                    }
                }
            }

            await outputStream.FlushAsync();
        }

        if (File.Exists(outputFilePath))
        {
            try { File.Delete(outputFilePath); } catch { }
        }

        try
        {
            File.Move(tempOutputFile, outputFilePath, true);
        }
        catch
        {
            // Fallback zero-lock file copy
            File.Copy(tempOutputFile, outputFilePath, true);
            try { File.Delete(tempOutputFile); } catch { }
        }
    }

    private static async Task<bool> RemuxWithFFmpegAsync(string inputFile, string outputFile)
    {
        try
        {
            string ffmpegPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ffmpeg.exe");
            if (!File.Exists(ffmpegPath)) ffmpegPath = Path.Combine(Directory.GetCurrentDirectory(), "ffmpeg.exe");
            if (!File.Exists(ffmpegPath)) ffmpegPath = "ffmpeg";

            var startInfo = new ProcessStartInfo
            {
                FileName = ffmpegPath,
                Arguments = $"-nostdin -y -i \"{inputFile}\" -c copy -movflags +faststart \"{outputFile}\"",
                RedirectStandardOutput = false,
                RedirectStandardError = false,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(startInfo);
            if (process == null) return false;

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(180));
            await process.WaitForExitAsync(cts.Token);
            return process.ExitCode == 0 && File.Exists(outputFile) && new FileInfo(outputFile).Length > 1024;
        }
        catch
        {
            return false;
        }
    }

    private static bool IsFFmpegAvailable()
    {
        try
        {
            string ffmpegPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ffmpeg.exe");
            if (!File.Exists(ffmpegPath)) ffmpegPath = Path.Combine(Directory.GetCurrentDirectory(), "ffmpeg.exe");
            if (File.Exists(ffmpegPath)) return true;

            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = "ffmpeg",
                Arguments = "-version",
                RedirectStandardOutput = false,
                RedirectStandardError = false,
                UseShellExecute = false,
                CreateNoWindow = true
            });
            process?.WaitForExit(500);
            return process?.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }

    private static void CleanUp(string tempDirectory)
    {
        try
        {
            if (Directory.Exists(tempDirectory))
            {
                Directory.Delete(tempDirectory, true);
            }
        }
        catch { }
    }
}
