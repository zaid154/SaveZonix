using System;
using System.ComponentModel.DataAnnotations;

namespace StreamHelper.Data;

public class DownloadChunkRecord
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(128)]
    public string TaskId { get; set; } = string.Empty;

    public int ChunkIndex { get; set; }

    public long RangeStart { get; set; }

    public long RangeEnd { get; set; }

    public long BytesWritten { get; set; }

    public bool IsCompleted { get; set; }

    [MaxLength(512)]
    public string? LocalTempPath { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class MediaConversionTask
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [Required]
    [MaxLength(1024)]
    public string SourceFilePath { get; set; } = string.Empty;

    [Required]
    [MaxLength(1024)]
    public string TargetFilePath { get; set; } = string.Empty;

    [MaxLength(32)]
    public string TargetFormat { get; set; } = "mp3";

    [MaxLength(32)]
    public string Bitrate { get; set; } = "320k";

    [MaxLength(64)]
    public string Status { get; set; } = "Queued"; // Queued, Processing, Completed, Failed, Cancelled

    public double ProgressPercentage { get; set; }

    [MaxLength(2048)]
    public string? ErrorMessage { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? CompletedAt { get; set; }
}

public class AuditLog
{
    [Key]
    public int Id { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [Required]
    [MaxLength(128)]
    public string Action { get; set; } = string.Empty;

    [MaxLength(256)]
    public string? UserEmail { get; set; }

    [MaxLength(64)]
    public string? IpAddress { get; set; }

    [MaxLength(2048)]
    public string? Details { get; set; }

    [MaxLength(64)]
    public string Status { get; set; } = "Success";
}
