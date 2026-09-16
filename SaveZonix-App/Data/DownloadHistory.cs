using System;
using System.ComponentModel.DataAnnotations;

namespace StreamHelper.Data;

public enum DownloadStatus
{
    Queued = 0,
    Resolving = 1,
    Downloading = 2,
    Paused = 3,
    Retrying = 4,
    Completed = 5,
    Failed = 6,
    Cancelled = 7,
    Corrupted = 8,
    Validating = 9
}

public class DownloadHistory
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    public string? UserId { get; set; }

    [MaxLength(256)]
    public string? UserEmail { get; set; }

    [MaxLength(128)]
    public string? UserName { get; set; }

    [Required]
    [MaxLength(2048)]
    public string OriginalUrl { get; set; } = string.Empty;

    [Required]
    [MaxLength(512)]
    public string Title { get; set; } = "High-Definition Video Stream";

    [Required]
    [MaxLength(260)]
    public string FileName { get; set; } = "video.mp4";

    [MaxLength(2048)]
    public string? ThumbnailUrl { get; set; }

    [MaxLength(64)]
    public string Platform { get; set; } = "Web Stream";

    [MaxLength(64)]
    public string MediaType { get; set; } = "Video";

    [MaxLength(32)]
    public string Format { get; set; } = "MP4";

    [MaxLength(64)]
    public string Quality { get; set; } = "1080p Full HD";

    [MaxLength(64)]
    public string? Codec { get; set; } = "H.264 / AAC";

    public int DurationSeconds { get; set; }

    public long FileSize { get; set; }

    public DownloadStatus Status { get; set; } = DownloadStatus.Queued;

    public DateTime StartTime { get; set; } = DateTime.UtcNow;

    public DateTime? CompletionTime { get; set; }

    public double DownloadDurationSeconds { get; set; }

    public long DownloadedBytes { get; set; }

    public double AverageSpeedMBps { get; set; }

    public double PeakSpeedMBps { get; set; }

    public int ThreadsUsed { get; set; } = 64;

    [MaxLength(64)]
    public string DownloadStrategy { get; set; } = "HLS Multi-Thread";

    public int RetryCount { get; set; } = 0;

    [MaxLength(2048)]
    public string? ErrorReason { get; set; }

    // Media Validation & System Diagnostics
    [MaxLength(64)]
    public string ValidationStatus { get; set; } = "Passed"; // Passed, Corrupted, Truncated, ZeroBytes, Failed

    [MaxLength(2048)]
    public string? ValidationDetails { get; set; }

    public double ProbedDurationSeconds { get; set; }

    [MaxLength(128)]
    public string? AudioVideoDetails { get; set; }

    [MaxLength(64)]
    public string AppVersion { get; set; } = "SaveZonix v2.5.2";

    [MaxLength(128)]
    public string SystemVersion { get; set; } = ".NET 10.0 Windows";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public string FormattedDuration => DurationSeconds > 0
        ? string.Format("{0:D2}:{1:D2}", DurationSeconds / 60, DurationSeconds % 60)
        : "--:--";

    public string FormattedFileSize
    {
        get
        {
            if (FileSize <= 0) return "Unknown";
            double mb = FileSize / (1024.0 * 1024.0);
            return mb >= 1024
                ? string.Format("{0:F2} GB", mb / 1024.0)
                : string.Format("{0:F1} MB", mb);
        }
    }
}
