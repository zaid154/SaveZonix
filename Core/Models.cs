namespace Zonix.Core;

public class StreamQuality
{
    public string Resolution { get; set; } = "Unknown";
    public long Bandwidth { get; set; }
    public string Codecs { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public int DurationSeconds { get; set; }
    public bool IsDirectFile { get; set; } = false;

    public long EstimatedSizeBytes => 
        (DurationSeconds > 0 && Bandwidth > 0) 
            ? (long)((DurationSeconds * Bandwidth) / 8.0) 
            : 0;

    public string FormattedEstimatedSize
    {
        get
        {
            if (EstimatedSizeBytes <= 0) return string.Empty;
            double mb = EstimatedSizeBytes / (1024.0 * 1024.0);
            return mb >= 1024 
                ? $"~{(mb / 1024.0):F2} GB" 
                : $"~{mb:F0} MB";
        }
    }

    public string DisplayName
    {
        get
        {
            string resLabel = "Standard Quality";
            if (!string.IsNullOrEmpty(Resolution) && Resolution != "Unknown")
            {
                var height = GetHeight(Resolution);
                string tier = height >= 2160 ? "4K UHD" :
                              height >= 1440 ? "2K QHD" :
                              height >= 1080 ? "1080p Full HD" :
                              height >= 720 ? "720p HD" :
                              height >= 480 ? "480p SD" : $"{height}p";

                resLabel = $"{tier} ({Resolution})";
            }

            string bwText = Bandwidth > 0 ? $" • {(Bandwidth / 1000000.0):F1} Mbps" : string.Empty;
            string sizeText = !string.IsNullOrEmpty(FormattedEstimatedSize) ? $" • 📦 {FormattedEstimatedSize}" : string.Empty;
            string directTag = IsDirectFile ? " • Direct Stream" : string.Empty;

            return $"{resLabel}{bwText}{sizeText}{directTag}";
        }
    }

    private static int GetHeight(string resolution)
    {
        if (string.IsNullOrEmpty(resolution) || !resolution.Contains('x')) return 0;
        var parts = resolution.Split('x');
        return parts.Length > 1 && int.TryParse(parts[1], out var h) ? h : 0;
    }
}

public class StreamAnalysisResult
{
    public bool Success { get; set; } = true;
    public bool IsMaster { get; set; }
    public bool IsDirectMediaFile { get; set; } = false;
    public string Title { get; set; } = "High-Definition Video Stream";
    public string Description { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public int DurationSeconds { get; set; }
    public string FormattedDuration => DurationSeconds > 0 
        ? $"{(DurationSeconds / 60):D2}:{(DurationSeconds % 60):D2}" 
        : string.Empty;
    public string Platform { get; set; } = "Web Stream";
    public int TotalSegments { get; set; }
    public long ContentLengthBytes { get; set; } = 0;
    public List<StreamQuality> Qualities { get; set; } = new();
    public List<string> SegmentUrls { get; set; } = new();
    public string StatusMessage { get; set; } = string.Empty;
    public bool RequiresBrowserContext { get; set; } = false;
}

public class SegmentItem
{
    public int Index { get; set; }
    public string Url { get; set; } = string.Empty;
    public string LocalTempPath { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public bool IsDownloaded { get; set; }
    public long RangeStart { get; set; } = 0;
    public long RangeEnd { get; set; } = 0;
}

public class DownloadProgressReport
{
    public int TotalSegments { get; set; }
    public int DownloadedSegments { get; set; }
    public long TotalBytesDownloaded { get; set; }
    public long EstimatedTotalBytes { get; set; }
    public double SpeedMBps { get; set; }
    public double PeakSpeedMBps { get; set; }
    public int ActiveThreads { get; set; }
    public string Status { get; set; } = "Downloading in Parallel...";
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
