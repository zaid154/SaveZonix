using System;
using System.Collections.Generic;
using System.Threading;

namespace SaveZonix.Models;

public record PowerTrimRequest(string InputPath, double StartSeconds, double EndSeconds);
public record BulkBatchCreateRequest(List<string> Urls);
public record CookieImportRequest(string Content);

public class DownloadTaskState
{
    public string TaskId { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public string Quality { get; set; } = string.Empty;
    public double Percentage { get; set; }
    public double SpeedMBps { get; set; }
    public double PeakSpeedMBps { get; set; }
    public int ActiveThreads { get; set; }
    public string Status { get; set; } = "Downloading in Parallel...";
    public int DownloadedSegments { get; set; }
    public int TotalSegments { get; set; }
    public long TotalBytesDownloaded { get; set; }
    public long EstimatedTotalBytes { get; set; }
    public double ElapsedSeconds { get; set; }
    public double EstimatedSecondsRemaining { get; set; }
    public int Concurrency { get; set; }
    public bool IsMerging { get; set; }
    public bool IsCompleted { get; set; }
    public bool IsPaused { get; set; }
    public bool IsError { get; set; }
    public string? ErrorMessage { get; set; }
    public double MergeSeconds { get; set; }
    public string? OutputPath { get; set; }
    
    [System.Text.Json.Serialization.JsonIgnore]
    public CancellationTokenSource? Cts { get; set; }
}

public class CdnProbeResult
{
    public bool Success { get; set; } = true;
    public string Host { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string ResolvedIp { get; set; } = "Unknown";
    public string AsnOrganization { get; set; } = "Global Anycast";
    public string CdnProvider { get; set; } = string.Empty;
    public string PlatformType { get; set; } = string.Empty;
    public string StreamProtocol { get; set; } = string.Empty;
    public string RateLimitLevel { get; set; } = string.Empty;
    public int RecommendedThreads { get; set; }
    public int SafeCap { get; set; }
    public int MaxTurbo { get; set; }
    public string AntiHotlinkStrategy { get; set; } = string.Empty;
    public string BandwidthRating { get; set; } = string.Empty;
    public string RiskFactor { get; set; } = string.Empty;
    public long ResponseTimeMs { get; set; }
    public double TtfbMs { get; set; }
    public double LiveWireSpeedMBps { get; set; }
    public string ServerHeader { get; set; } = string.Empty;
    public bool ByteRangeSupported { get; set; }
    public Dictionary<string, string> DetectedHeaders { get; set; } = new();
    public bool IsCached { get; set; }
    public string CacheSource { get; set; } = "Live Probe";
}

public class AnalyzeRequest
{
    public string Url { get; set; } = string.Empty;
}

public class DownloadRequest
{
    public string StreamUrl { get; set; } = string.Empty;
    public string? OriginalPageUrl { get; set; }
    public string? Title { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? Platform { get; set; }
    public string? Quality { get; set; }
    public string? Format { get; set; }
    public string? AudioUrl { get; set; }
    public string FileName { get; set; } = "video.mp4";
    public int Concurrency { get; set; } = 64;
    public long EstimatedSizeBytes { get; set; } = 0;
    public bool IsDirectFile { get; set; } = false;
    public int DurationSeconds { get; set; } = 0;
    public string? ExpectedResolution { get; set; }
    public string? DestinationFolder { get; set; }
    public string? UserEmail { get; set; }
    public string? UserId { get; set; }
}

public class RegisterRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool RememberMe { get; set; } = true;
}

public class VerifyOtpRequest
{
    public string Email { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
}

public class ResendOtpRequest
{
    public string Email { get; set; } = string.Empty;
}

public class UserStatusRequest
{
    public string Email { get; set; } = string.Empty;
}

public class UserRoleRequest
{
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "User";
}

public class SilentUpdateRequest
{
    public string DownloadUrl { get; set; } = string.Empty;
    public string TargetVersion { get; set; } = string.Empty;
}

public class AppleOptimizeRequest
{
    public string? Path { get; set; }
    public string? Id { get; set; }
    public string? FileName { get; set; }
}
