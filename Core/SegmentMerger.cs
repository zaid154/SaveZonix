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

        // Check if segments are byte-range chunks of a single continuous stream (.part slices)
        bool isByteRangeChunks = validSegments.Any(s => s.LocalTempPath.EndsWith(".part", StringComparison.OrdinalIgnoreCase) || s.RangeEnd > 0);

        if (isByteRangeChunks)
        {
            // Direct byte-level concatenation preserves exact MP4 box hierarchy and all frames
            await DirectBinaryMergeAsync(validSegments, outputFilePath);
            if (cleanUpTemp) CleanUp(tempDirectory);
            return File.Exists(outputFilePath) && new FileInfo(outputFilePath).Length > 0;
        }

        // For separate standalone HLS segments, check if FFmpeg is available
        bool ffmpegAvailable = IsFFmpegAvailable();

        if (ffmpegAvailable)
        {
            bool success = await MergeWithFFmpegAsync(validSegments, outputFilePath, tempDirectory);
            if (success)
            {
                if (cleanUpTemp) CleanUp(tempDirectory);
                return true;
            }
        }

        // Direct Binary Concatenation (High-speed, zero external dependencies)
        await DirectBinaryMergeAsync(validSegments, outputFilePath);

        if (cleanUpTemp)
        {
            CleanUp(tempDirectory);
        }

        return File.Exists(outputFilePath) && new FileInfo(outputFilePath).Length > 0;
    }

    private static async Task DirectBinaryMergeAsync(List<SegmentItem> segments, string outputFilePath)
    {
        var orderedSegments = segments.OrderBy(s => s.Index).ToList();
        
        await using var outputStream = new FileStream(outputFilePath, FileMode.Create, FileAccess.Write, FileShare.None, 1048576, true);

        byte[] buffer = new byte[524288]; // 512KB buffer for ultra-fast I/O throughput
        foreach (var seg in orderedSegments)
        {
            if (File.Exists(seg.LocalTempPath))
            {
                var fileInfo = new FileInfo(seg.LocalTempPath);
                if (fileInfo.Length == 0) continue;

                await using var inputStream = new FileStream(seg.LocalTempPath, FileMode.Open, FileAccess.Read, FileShare.Read, 524288, true);
                int bytesRead;
                while ((bytesRead = await inputStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                {
                    await outputStream.WriteAsync(buffer, 0, bytesRead);
                }
            }
        }

        await outputStream.FlushAsync();
    }

    private static async Task<bool> MergeWithFFmpegAsync(List<SegmentItem> segments, string outputFilePath, string tempDirectory)
    {
        try
        {
            var listFilePath = Path.Combine(tempDirectory, "filelist.txt");
            var ordered = segments.OrderBy(s => s.Index).Select(s => $"file '{s.LocalTempPath.Replace("\\", "/")}'");
            await File.WriteAllLinesAsync(listFilePath, ordered);

            var startInfo = new ProcessStartInfo
            {
                FileName = "ffmpeg",
                Arguments = $"-y -f concat -safe 0 -i \"{listFilePath}\" -c copy \"{outputFilePath}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(startInfo);
            if (process == null) return false;

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            await process.WaitForExitAsync(cts.Token);
            return process.ExitCode == 0 && File.Exists(outputFilePath) && new FileInfo(outputFilePath).Length > 0;
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
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = "ffmpeg",
                Arguments = "-version",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            });
            process?.WaitForExit(1000);
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
