using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using StreamHelper.Data;

namespace StreamHelper.Services;

public interface IDownloadHistoryService
{
    Task<DownloadHistory> CreateOrUpdateDownloadAsync(
        string taskId,
        string? userId,
        string? userEmail,
        string? userName,
        string originalUrl,
        string title,
        string fileName,
        string? thumbnailUrl,
        string platform,
        string mediaType,
        string format,
        string quality,
        string? codec,
        int durationSeconds,
        long estimatedBytes,
        int threads,
        string strategy);

    Task UpdateProgressAsync(string taskId, DownloadStatus status, long downloadedBytes, double avgSpeed, double peakSpeed, double elapsedSeconds);
    Task MarkCompletedAsync(string taskId, long finalSize, double avgSpeed, double peakSpeed, double totalSeconds);
    Task MarkCompletedWithValidationAsync(string taskId, long finalSize, double avgSpeed, double peakSpeed, double totalSeconds, string validationStatus, string validationDetails, double probedDuration, string audioVideoDetails);
    Task MarkCorruptedAsync(string taskId, string errorReason, string validationStatus, string validationDetails, int retryCount);
    Task MarkRetryingAsync(string taskId, int retryCount, string retryReason);
    Task MarkFailedAsync(string taskId, string errorReason);
    Task MarkCancelledAsync(string taskId);
    Task<int> ReconcileOrphanedDownloadsAsync(ISet<string>? activeTaskIds = null);
    Task<(List<DownloadHistory> Items, int TotalCount)> GetUserDownloadsAsync(string userId, int page, int pageSize, string? search, string? status, string? platform);
    Task<(List<DownloadHistory> Items, int TotalCount)> GetAllDownloadsAsync(int page, int pageSize, string? search, string? status, string? platform, string? userEmail);
    Task<DownloadHistory?> GetDownloadByIdAsync(string id);
    Task<bool> DeleteDownloadAsync(string id, string? userId = null);
    string SanitizeUrl(string url);
}

public class DownloadHistoryService : IDownloadHistoryService
{
    private readonly AppDbContext _context;

    public DownloadHistoryService(AppDbContext context)
    {
        _context = context;
    }

    public string SanitizeUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return string.Empty;
        try
        {
            if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                // Remove temporary signed tokens and auth query params
                var queryParams = System.Web.HttpUtility.ParseQueryString(uri.Query);
                string[] sensitiveKeys = { "token", "sig", "signature", "key", "auth", "expire", "expires", "access_token", "secret", "session", "pass" };
                
                foreach (var k in queryParams.AllKeys.Where(k => k != null))
                {
                    if (sensitiveKeys.Any(s => k!.IndexOf(s, StringComparison.OrdinalIgnoreCase) >= 0))
                    {
                        queryParams.Remove(k);
                    }
                }

                var ub = new UriBuilder(uri)
                {
                    Query = queryParams.ToString()
                };
                return ub.Uri.ToString();
            }
        }
        catch { }

        return url;
    }

    public async Task<DownloadHistory> CreateOrUpdateDownloadAsync(
        string taskId,
        string? userId,
        string? userEmail,
        string? userName,
        string originalUrl,
        string title,
        string fileName,
        string? thumbnailUrl,
        string platform,
        string mediaType,
        string format,
        string quality,
        string? codec,
        int durationSeconds,
        long estimatedBytes,
        int threads,
        string strategy)
    {
        string cleanUrl = SanitizeUrl(originalUrl);
        var existing = await _context.DownloadHistories.FirstOrDefaultAsync(d => d.Id == taskId);

        if (existing != null)
        {
            existing.Title = title;
            existing.FileName = fileName;
            existing.ThumbnailUrl = thumbnailUrl ?? existing.ThumbnailUrl;
            existing.Status = DownloadStatus.Downloading;
            existing.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return existing;
        }

        var download = new DownloadHistory
        {
            Id = taskId,
            UserId = userId,
            UserEmail = userEmail,
            UserName = userName,
            OriginalUrl = cleanUrl,
            Title = title,
            FileName = fileName,
            ThumbnailUrl = thumbnailUrl,
            Platform = platform,
            MediaType = mediaType,
            Format = format,
            Quality = quality,
            Codec = codec,
            DurationSeconds = durationSeconds,
            FileSize = estimatedBytes,
            Status = DownloadStatus.Downloading,
            StartTime = DateTime.UtcNow,
            ThreadsUsed = threads,
            DownloadStrategy = strategy,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.DownloadHistories.Add(download);
        await _context.SaveChangesAsync();
        return download;
    }

    public async Task UpdateProgressAsync(string taskId, DownloadStatus status, long downloadedBytes, double avgSpeed, double peakSpeed, double elapsedSeconds)
    {
        var record = await _context.DownloadHistories.FirstOrDefaultAsync(d => d.Id == taskId);
        if (record != null)
        {
            record.Status = status;
            record.DownloadedBytes = downloadedBytes;
            record.AverageSpeedMBps = avgSpeed;
            record.PeakSpeedMBps = Math.Max(record.PeakSpeedMBps, peakSpeed);
            record.DownloadDurationSeconds = elapsedSeconds;
            record.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task MarkCompletedAsync(string taskId, long finalSize, double avgSpeed, double peakSpeed, double totalSeconds)
    {
        await MarkCompletedWithValidationAsync(taskId, finalSize, avgSpeed, peakSpeed, totalSeconds, "Passed", "Verified media structure", 0, "Standard Container");
    }

    public async Task MarkCompletedWithValidationAsync(string taskId, long finalSize, double avgSpeed, double peakSpeed, double totalSeconds, string validationStatus, string validationDetails, double probedDuration, string audioVideoDetails)
    {
        var record = await _context.DownloadHistories.FirstOrDefaultAsync(d => d.Id == taskId);
        if (record != null)
        {
            record.Status = DownloadStatus.Completed;
            record.FileSize = finalSize > 0 ? finalSize : record.FileSize;
            record.DownloadedBytes = finalSize > 0 ? finalSize : record.DownloadedBytes;
            record.CompletionTime = DateTime.UtcNow;
            record.AverageSpeedMBps = avgSpeed;
            record.PeakSpeedMBps = Math.Max(record.PeakSpeedMBps, peakSpeed);
            record.DownloadDurationSeconds = totalSeconds;
            record.ValidationStatus = validationStatus;
            record.ValidationDetails = validationDetails;
            if (probedDuration > 0) record.ProbedDurationSeconds = probedDuration;
            if (!string.IsNullOrEmpty(audioVideoDetails)) record.AudioVideoDetails = audioVideoDetails;
            record.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task MarkCorruptedAsync(string taskId, string errorReason, string validationStatus, string validationDetails, int retryCount)
    {
        var record = await _context.DownloadHistories.FirstOrDefaultAsync(d => d.Id == taskId);
        if (record != null)
        {
            record.Status = DownloadStatus.Corrupted;
            record.ErrorReason = errorReason;
            record.ValidationStatus = validationStatus;
            record.ValidationDetails = validationDetails;
            record.RetryCount = retryCount;
            record.CompletionTime = DateTime.UtcNow;
            record.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task MarkRetryingAsync(string taskId, int retryCount, string retryReason)
    {
        var record = await _context.DownloadHistories.FirstOrDefaultAsync(d => d.Id == taskId);
        if (record != null)
        {
            record.Status = DownloadStatus.Retrying;
            record.RetryCount = retryCount;
            record.ErrorReason = $"Retry {retryCount}: {retryReason}";
            record.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task MarkFailedAsync(string taskId, string errorReason)
    {
        var record = await _context.DownloadHistories.FirstOrDefaultAsync(d => d.Id == taskId);
        if (record != null)
        {
            record.Status = DownloadStatus.Failed;
            record.ErrorReason = errorReason;
            record.ValidationStatus = "Failed";
            record.CompletionTime = DateTime.UtcNow;
            record.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task MarkCancelledAsync(string taskId)
    {
        var record = await _context.DownloadHistories.FirstOrDefaultAsync(d => d.Id == taskId);
        if (record != null)
        {
            record.Status = DownloadStatus.Cancelled;
            record.ErrorReason = "Download cancelled by user";
            record.CompletionTime = DateTime.UtcNow;
            record.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task<int> ReconcileOrphanedDownloadsAsync(ISet<string>? activeTaskIds = null)
    {
        var orphaned = await _context.DownloadHistories
            .Where(d => d.Status == DownloadStatus.Downloading || d.Status == DownloadStatus.Retrying || d.Status == DownloadStatus.Resolving)
            .ToListAsync();

        int updated = 0;
        foreach (var item in orphaned)
        {
            if (activeTaskIds == null || !activeTaskIds.Contains(item.Id))
            {
                item.Status = DownloadStatus.Cancelled;
                item.ErrorReason = string.IsNullOrEmpty(item.ErrorReason) ? "Download was interrupted or stopped" : item.ErrorReason;
                item.CompletionTime = DateTime.UtcNow;
                item.UpdatedAt = DateTime.UtcNow;
                updated++;
            }
        }

        if (updated > 0)
        {
            await _context.SaveChangesAsync();
        }
        return updated;
    }

    public async Task<(List<DownloadHistory> Items, int TotalCount)> GetUserDownloadsAsync(string userId, int page, int pageSize, string? search, string? status, string? platform)
    {
        var query = _context.DownloadHistories.Where(d => d.UserId == userId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(d => d.Title.Contains(search) || d.FileName.Contains(search) || d.OriginalUrl.Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<DownloadStatus>(status, true, out var st))
        {
            query = query.Where(d => d.Status == st);
        }

        if (!string.IsNullOrWhiteSpace(platform) && platform != "All")
        {
            query = query.Where(d => d.Platform == platform);
        }

        int totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<(List<DownloadHistory> Items, int TotalCount)> GetAllDownloadsAsync(int page, int pageSize, string? search, string? status, string? platform, string? userEmail)
    {
        var query = _context.DownloadHistories.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(d => d.Title.Contains(search) || d.FileName.Contains(search) || d.OriginalUrl.Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<DownloadStatus>(status, true, out var st))
        {
            query = query.Where(d => d.Status == st);
        }

        if (!string.IsNullOrWhiteSpace(platform) && platform != "All")
        {
            query = query.Where(d => d.Platform == platform);
        }

        if (!string.IsNullOrWhiteSpace(userEmail))
        {
            query = query.Where(d => d.UserEmail != null && d.UserEmail.Contains(userEmail));
        }

        int totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<DownloadHistory?> GetDownloadByIdAsync(string id)
    {
        return await _context.DownloadHistories.Include(d => d.User).FirstOrDefaultAsync(d => d.Id == id);
    }

    public async Task<bool> DeleteDownloadAsync(string id, string? userId = null)
    {
        var record = await _context.DownloadHistories.FirstOrDefaultAsync(d => d.Id == id);
        if (record == null) return false;

        // Ensure user can only delete their own download
        if (userId != null && record.UserId != userId) return false;

        _context.DownloadHistories.Remove(record);
        await _context.SaveChangesAsync();
        return true;
    }
}
