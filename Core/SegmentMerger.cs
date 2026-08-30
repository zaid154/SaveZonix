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

        // Check if FFmpeg is available on system
        bool ffmpegAvailable = IsFFmpegAvailable();

        if (ffmpegAvailable)
        {
            bool success = await MergeWithFFmpegAsync(segments, outputFilePath, tempDirectory);
            if (success)
            {
                if (cleanUpTemp) CleanUp(tempDirectory);
                return true;
            }
        }

        // Fast Direct Binary Merge (Zero-dependency fallback - Ultra Fast)
        await DirectBinaryMergeAsync(segments, outputFilePath);

        if (cleanUpTemp)
        {
            CleanUp(tempDirectory);
        }

        return true;
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

            await process.WaitForExitAsync();
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
            process?.WaitForExit();
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
        catch
        {
            // Ignore cleanup locks
        }
    }
}
