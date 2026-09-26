namespace SaveZonix.Models;

public class PlaylistLoadRequest
{
    public string Url { get; set; } = string.Empty;
    public string? QueueKey { get; set; }
    public int? Limit { get; set; }
    public int? Offset { get; set; }
    public string? LastVideoId { get; set; }
}

public class ImportTabQueueRequest
{
    public string Title { get; set; } = "YouTube Mix";
    public string Url { get; set; } = string.Empty;
    public string? Author { get; set; } = "YouTube";
    public List<ImportTabQueueItem> Items { get; set; } = new();
}

public class ImportTabQueueItem
{
    public int Index { get; set; }
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string Duration { get; set; } = "00:00";
    public string ThumbnailUrl { get; set; } = string.Empty;
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
    public int TotalKnownVideos { get; set; }
    public bool HasMore { get; set; }
    public bool IsMix { get; set; }
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
    public bool NumberPrefix { get; set; } = false;
    public int Concurrency { get; set; } = 6; // 1 to 12 parallel downloads
    public string? OutputFolder { get; set; }
}

public class PlaylistProbeRequest
{
    public string VideoId { get; set; } = string.Empty;
}

public class PlaylistItemDownloadState
{
    public string TaskId { get; set; } = Guid.NewGuid().ToString("N");
    public string VideoId { get; set; } = string.Empty;
    public int Index { get; set; }
    public string SubId { get; set; } = string.Empty; // e.g. "PL-01 #01"
    public string Title { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public string FormattedDuration { get; set; } = "00:00";
    public int DurationSeconds { get; set; }
    public string Quality { get; set; } = "Best";
    public string Format { get; set; } = "MP4";
    public bool NumberPrefix { get; set; } = true;
    public string OutputFileName { get; set; } = string.Empty;
    public string? OutputPath { get; set; }
    public double Percentage { get; set; }
    public double SpeedMBps { get; set; }
    public double PeakSpeedMBps { get; set; }
    public double AverageSpeedMBps { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public double DurationSecondsTaken { get; set; }
    public long BytesDownloaded { get; set; }
    public long TotalBytes { get; set; }
    public string Status { get; set; } = "Pending"; // Pending, Analyzing, Downloading, Muxing, Completed, Failed, Cancelled
    public string? ErrorMessage { get; set; }
    public int RetryCount { get; set; }
    public bool IsUserCancelled { get; set; } = false;

    [System.Text.Json.Serialization.JsonIgnore]
    public CancellationTokenSource? Cts { get; set; }
}

public class PlaylistBatchJobState
{
    public string JobId { get; set; } = string.Empty;
    public string PlaylistCode { get; set; } = "PL-01"; // e.g. "PL-01", "PL-02"
    public string PlaylistTitle { get; set; } = string.Empty;
    public string? PlaylistUrl { get; set; }
    public string? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
    public int TotalVideos { get; set; }
    public int QueuedCount { get; set; }
    public int ActiveCount { get; set; }
    public int CompletedCount { get; set; }
    public int FailedCount { get; set; }
    public double OverallPercentage { get; set; }
    public double OverallSpeedMBps { get; set; }
    public double PeakSpeedMBps { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public string Status { get; set; } = "Queued"; // Queued, Downloading, Completed, Cancelled, HasErrors
    public string OutputFolder { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsUserCancelled { get; set; } = false;
    public List<PlaylistItemDownloadState> Items { get; set; } = new();

    [System.Text.Json.Serialization.JsonIgnore]
    public CancellationTokenSource? Cts { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public long LastSampleTicks { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public long LastSampleTotalBytes { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public double SmoothedSpeedMBps { get; set; }
}

public class RetryPlaylistItemRequest
{
    public string JobId { get; set; } = string.Empty;
    public string VideoId { get; set; } = string.Empty;
    public string? TaskId { get; set; }
}

public class CancelPlaylistItemRequest
{
    public string JobId { get; set; } = string.Empty;
    public string VideoId { get; set; } = string.Empty;
}
