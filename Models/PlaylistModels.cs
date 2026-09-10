namespace SaveZonix.Models;

public class PlaylistLoadRequest
{
    public string Url { get; set; } = string.Empty;
}

public class PlaylistInfoResult
{
    public bool Success { get; set; } = true;
    public string? ErrorMessage { get; set; }
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string AuthorUrl { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public int VideoCount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string FormattedTotalDuration { get; set; } = string.Empty;
    public List<PlaylistVideoDto> Videos { get; set; } = new();
}

public class PlaylistVideoDto
{
    public string VideoId { get; set; } = string.Empty;
    public int Index { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public int DurationSeconds { get; set; }
    public string FormattedDuration { get; set; } = "00:00";
    public string ThumbnailUrl { get; set; } = string.Empty;
    public bool IsAvailable { get; set; } = true;
    public string? StatusReason { get; set; }
    public List<string> AvailableQualities { get; set; } = new();
    public List<string> AvailableFormats { get; set; } = new() { "MP4", "WebM", "MP3", "M4A" };
}

public class BatchVideoItemRequest
{
    public string VideoId { get; set; } = string.Empty;
    public int Index { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public string FormattedDuration { get; set; } = string.Empty;
}

public class PlaylistBatchDownloadRequest
{
    public string PlaylistUrl { get; set; } = string.Empty;
    public string PlaylistTitle { get; set; } = "YouTube Playlist";
    public List<string> VideoIds { get; set; } = new();
    public List<BatchVideoItemRequest>? Videos { get; set; }
    public string Quality { get; set; } = "Best"; // Best, 2160p, 1440p, 1080p, 720p, 480p, 360p, AudioOnly
    public string Format { get; set; } = "MP4"; // MP4, WebM, MP3, M4A
    public bool NumberPrefix { get; set; } = true;
    public int Concurrency { get; set; } = 2; // 1 to 4 parallel downloads
    public string? OutputFolder { get; set; }
}

public class PlaylistProbeRequest
{
    public string VideoId { get; set; } = string.Empty;
}

public class PlaylistItemDownloadState
{
    public string VideoId { get; set; } = string.Empty;
    public int Index { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public string FormattedDuration { get; set; } = "00:00";
    public string Quality { get; set; } = "Best";
    public string Format { get; set; } = "MP4";
    public bool NumberPrefix { get; set; } = true;
    public string OutputFileName { get; set; } = string.Empty;
    public string? OutputPath { get; set; }
    public double Percentage { get; set; }
    public double SpeedMBps { get; set; }
    public long BytesDownloaded { get; set; }
    public long TotalBytes { get; set; }
    public string Status { get; set; } = "Pending"; // Pending, Analyzing, Downloading, Muxing, Completed, Failed, Cancelled
    public string? ErrorMessage { get; set; }
    public int RetryCount { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public CancellationTokenSource? Cts { get; set; }
}

public class PlaylistBatchJobState
{
    public string JobId { get; set; } = string.Empty;
    public string PlaylistTitle { get; set; } = string.Empty;
    public int TotalVideos { get; set; }
    public int QueuedCount { get; set; }
    public int ActiveCount { get; set; }
    public int CompletedCount { get; set; }
    public int FailedCount { get; set; }
    public double OverallPercentage { get; set; }
    public double OverallSpeedMBps { get; set; }
    public string Status { get; set; } = "Queued"; // Queued, Downloading, Completed, Cancelled, HasErrors
    public string OutputFolder { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<PlaylistItemDownloadState> Items { get; set; } = new();

    [System.Text.Json.Serialization.JsonIgnore]
    public CancellationTokenSource? Cts { get; set; }
}

public class RetryPlaylistItemRequest
{
    public string JobId { get; set; } = string.Empty;
    public string VideoId { get; set; } = string.Empty;
}

public class CancelPlaylistItemRequest
{
    public string JobId { get; set; } = string.Empty;
    public string VideoId { get; set; } = string.Empty;
}
