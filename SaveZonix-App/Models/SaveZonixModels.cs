using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System.Text.Json.Serialization;

namespace SaveZonix.Models;

[BsonIgnoreExtraElements]
public class DownloadRecord
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string TaskId { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string UserIp { get; set; } = "127.0.0.1";
    public string Country { get; set; } = "Unknown";
    public string City { get; set; } = "Unknown";
    public string DeviceType { get; set; } = "Desktop";
    public string OperatingSystem { get; set; } = "Unknown";
    public string Browser { get; set; } = "Unknown";
    public string UserAgent { get; set; } = string.Empty;

    public string OriginalUrl { get; set; } = string.Empty;
    public string VideoTitle { get; set; } = "Video";
    public string? ThumbnailUrl { get; set; }
    public string Platform { get; set; } = "Web Stream";
    public string Quality { get; set; } = "1080p Full HD";
    public int DurationSeconds { get; set; }
    public long FileSizeBytes { get; set; }
    public string FormattedSize { get; set; } = "0 MB";
    public double DownloadSpeedMBps { get; set; }
    public double PeakSpeedMBps { get; set; }
    public double TimeTakenSeconds { get; set; }
    public string DownloadSource { get; set; } = "Web Input";
    public string DownloadStrategy { get; set; } = "HLS Multi-Thread";
    public DateTime? StartTime { get; set; }
    public DateTime? CompletionTime { get; set; }
    public string Status { get; set; } = "Completed"; // Completed, Corrupted, Failed, Retrying, Cancelled
    public string? ErrorMessage { get; set; }
    
    // Media Integrity & Validation Diagnostics
    public string ValidationStatus { get; set; } = "Passed"; // Passed, Corrupted, Truncated, ZeroBytes, MissingTracks, Failed
    public string ValidationDetails { get; set; } = string.Empty;
    public double ProbedDurationSeconds { get; set; }
    public string Resolution { get; set; } = "Unknown";
    public string AudioVideoDetails { get; set; } = string.Empty;
    public string? CorruptionReason { get; set; }
    public int RetryCount { get; set; } = 0;
    public string AppVersion { get; set; } = "SaveZonix v2.5.2";
    public string SystemVersion { get; set; } = ".NET 10.0 Windows";
    public string? ClientErrorLogs { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[BsonIgnoreExtraElements]
public class PlatformSettings
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string SiteName { get; set; } = "SaveZonix";
    public bool AllowGuestDownloads { get; set; } = true;
    public int GuestDailyDownloadLimit { get; set; } = 10;
    public bool RequireEmailVerification { get; set; } = false;
    public string AdminEmail { get; set; } = "zaidm1323@gmail.com";
    public string DefaultDownloadQuality { get; set; } = "Highest"; // Highest, 1080p, 720p, 480p
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[BsonIgnoreExtraElements]
public class SaveZonixUser
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PasswordHash { get; set; }
    public string Role { get; set; } = "User"; // Admin, User
    public string AuthProvider { get; set; } = "Local"; // Local, Google
    public string? ProfilePicture { get; set; }
    public int TotalDownloadsCount { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    [BsonElement("isVip")]
    public bool IsVip { get; set; } = false;

    [BsonElement("vipPlan")]
    public string VipPlan { get; set; } = "free";

    [BsonElement("vipExpiresAt")]
    public DateTime? VipExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AnalyticsSummary
{
    public long TotalDownloads { get; set; }
    public long TotalPassedValidation { get; set; }
    public long TotalCorrupted { get; set; }
    public long TotalFailed { get; set; }
    public long TotalBandwidthBytes { get; set; }
    public string FormattedTotalBandwidth { get; set; } = "0 MB";
    public long TotalUsers { get; set; }
    public int TodayDownloads { get; set; }
    public string AppVersion { get; set; } = "SaveZonix v2.5.2";
    public string SystemVersion { get; set; } = ".NET 10.0 Windows";
    public Dictionary<string, int> PlatformBreakdown { get; set; } = new();
    public List<DownloadRecord> RecentLogs { get; set; } = new();
    public List<ErrorDiagnosticLog> RecentErrors { get; set; } = new();
    public PlatformSettings Settings { get; set; } = new();
}

[BsonIgnoreExtraElements]
public class ErrorDiagnosticLog
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string? TaskId { get; set; }
    public string Url { get; set; } = string.Empty;
    public string ErrorType { get; set; } = "DownloadError"; // DownloadError, ValidationError, ClientException, FfmpegError, ServerError
    public string ErrorMessage { get; set; } = string.Empty;
    public string? StackTrace { get; set; }
    public string UserAgent { get; set; } = string.Empty;
    public string ClientIp { get; set; } = "127.0.0.1";
    public string AppVersion { get; set; } = "SaveZonix v2.5.2";
    public string SystemVersion { get; set; } = ".NET 10.0 Windows";
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

[BsonIgnoreExtraElements]
public class SiteRule
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string Domain { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string RuleType { get; set; } = "Strict"; // Strict, Open
    public int MaxThreads { get; set; } = 24;
    public bool RequiresReferer { get; set; } = true;
    public string WafType { get; set; } = "Token-Signature";
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

[BsonIgnoreExtraElements]
public class SecurityLog
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string EventType { get; set; } = "AdminLogin"; // AdminLogin, UserLogin, RateLimitExceeded, IpBlocked
    public string UserEmail { get; set; } = string.Empty;
    public string IpAddress { get; set; } = "127.0.0.1";
    public string UserAgent { get; set; } = "Desktop Browser";
    public string Details { get; set; } = string.Empty;
    public string Status { get; set; } = "Success"; // Success, Warning, Blocked
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

[BsonIgnoreExtraElements]
public class PlatformInfo
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; } = ObjectId.GenerateNewId().ToString();
    public string Name { get; set; } = string.Empty;
    public string SupportedProtocols { get; set; } = "HLS, DASH, MP4";
    public string MaxQuality { get; set; } = "1080p 60fps / 4K";
    public string Status { get; set; } = "Operational";
    public string Icon { get; set; } = "⚡";
    public DateTime LastChecked { get; set; } = DateTime.UtcNow;
}
