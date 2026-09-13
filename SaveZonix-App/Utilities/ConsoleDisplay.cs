using Zonix.Core;

namespace Zonix.Utilities;

public static class ConsoleDisplay
{
    private static readonly object _consoleLock = new();

    public static void RenderBanner()
    {
        Console.Clear();
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine(@"
 ███████╗ ██████╗ ███╗   ██╗██╗██╗  ██╗
 ╚══███╔╝██╔═══██╗████╗  ██║██║╚██╗██╔╝
   ███╔╝ ██║   ██║██╔██╗ ██║██║ ╚███╔╝ 
  ███╔╝  ██║   ██║██║╚██╗██║██║ ██╔██╗ 
 ███████╗╚██████╔╝██║ ╚████║██║██╔╝ ██╗
 ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝");
        
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine(" ─────────────────────────────────────────────────────────");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine(" ⚡ ZONIX — Ultra High-Speed Multi-Threaded Video Engine");
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.WriteLine(" ─────────────────────────────────────────────────────────");
        Console.ResetColor();
        Console.WriteLine();
    }

    public static void RenderProgressBar(DownloadProgressReport report)
    {
        lock (_consoleLock)
        {
            int barWidth = 28;
            int progressBlocks = (int)(report.Percentage / 100.0 * barWidth);
            progressBlocks = Math.Clamp(progressBlocks, 0, barWidth);

            string bar = new string('█', progressBlocks) + new string('░', barWidth - progressBlocks);
            string downloadedSize = FormatBytes(report.TotalBytesDownloaded);
            string etaText = report.EstimatedTimeRemaining.TotalSeconds > 0 
                ? $"{report.EstimatedTimeRemaining:mm\\:ss}" 
                : "--:--";

            Console.CursorLeft = 0;
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.Write(" [");
            Console.ForegroundColor = ConsoleColor.Green;
            Console.Write(bar);
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.Write("] ");

            Console.ForegroundColor = ConsoleColor.White;
            Console.Write($"{report.Percentage,5:F1}% ");

            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.Write($"| {report.DownloadedSegments}/{report.TotalSegments} chunks ");

            Console.ForegroundColor = ConsoleColor.Magenta;
            Console.Write($"| ⚡ {report.SpeedMBps,5:F1} MB/s ");

            Console.ForegroundColor = ConsoleColor.Gray;
            Console.Write($"| {downloadedSize} ");

            Console.ForegroundColor = ConsoleColor.DarkCyan;
            Console.Write($"| ETA: {etaText}   ");
            Console.ResetColor();
        }
    }

    public static void LogInfo(string message)
    {
        Console.ForegroundColor = ConsoleColor.Blue;
        Console.Write(" [i] ");
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine(message);
        Console.ResetColor();
    }

    public static void LogSuccess(string message)
    {
        Console.ForegroundColor = ConsoleColor.Green;
        Console.Write(" [✓] ");
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine(message);
        Console.ResetColor();
    }

    public static void LogError(string message)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.Write(" [✗] ");
        Console.ForegroundColor = ConsoleColor.White;
        Console.WriteLine(message);
        Console.ResetColor();
    }

    public static string FormatBytes(long bytes)
    {
        string[] suffix = { "B", "KB", "MB", "GB", "TB" };
        int i;
        double dblSByte = bytes;
        for (i = 0; i < suffix.Length && bytes >= 1024; i++, bytes /= 1024)
        {
            dblSByte = bytes / 1024.0;
        }
        return $"{dblSByte:0.##} {suffix[i]}";
    }
}
