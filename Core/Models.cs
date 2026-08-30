namespace Zonix.Core;

public class StreamQuality
{
    public string Resolution { get; set; } = "Unknown";
    public long Bandwidth { get; set; }
    public string Codecs { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;

    public string DisplayName =>
        !string.IsNullOrEmpty(Resolution) && Resolution != "Unknown"
            ? $"{Resolution} ({(Bandwidth > 0 ? (Bandwidth / 1000) + " kbps" : "Auto")})"
            : $"Stream ({(Bandwidth > 0 ? (Bandwidth / 1000) + " kbps" : "Default")})";
}

public class SegmentItem
{
    public int Index { get; set; }
    public string Url { get; set; } = string.Empty;
    public string LocalTempPath { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public bool IsDownloaded { get; set; }
}

public class DownloadProgressReport
{
    public int TotalSegments { get; set; }
    public int DownloadedSegments { get; set; }
    public long TotalBytesDownloaded { get; set; }
    public double SpeedMBps { get; set; }
    public double Percentage => TotalSegments > 0 ? (double)DownloadedSegments / TotalSegments * 100.0 : 0.0;
    public TimeSpan Elapsed { get; set; }
    public TimeSpan EstimatedTimeRemaining { get; set; }
}

public class DownloadResult
{
    public bool Success { get; set; }
    public string OutputFilePath { get; set; } = string.Empty;
    public long TotalBytes { get; set; }
    public TimeSpan TotalTime { get; set; }
    public string? ErrorMessage { get; set; }
}
