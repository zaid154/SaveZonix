using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;
using SaveZonix.Models;
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
    private readonly Microsoft.Extensions.Configuration.IConfiguration _config;
    private readonly MongoDB.Driver.IMongoDatabase? _mongoDb;
    private readonly bool _isMongoConfigured;

    public DownloadHistoryService(AppDbContext context, Microsoft.Extensions.Configuration.IConfiguration config)
    {
        _context = context;
        _config = config;

        try
        {
            string connStr = config["MongoDb:ConnectionString"]
                ?? config.GetConnectionString("MongoDb")
                ?? "mongodb://127.0.0.1:27017";
            string dbName = config["MongoDb:DatabaseName"] ?? "SaveZonixDb";

            var mongoSettings = MongoDB.Driver.MongoClientSettings.FromConnectionString(connStr);
            mongoSettings.ServerSelectionTimeout = TimeSpan.FromSeconds(4);
            mongoSettings.ConnectTimeout = TimeSpan.FromSeconds(4);

            var client = new MongoDB.Driver.MongoClient(mongoSettings);
            _mongoDb = client.GetDatabase(dbName);
            _isMongoConfigured = true;
        }
        catch
        {
            _isMongoConfigured = false;
        }
    }

    private async Task<string> GetActiveProviderAsync()
    {
        try
        {
            var setting = await _context.AdminSettings.FirstOrDefaultAsync(s => s.Key == "DatabaseProvider");
            if (setting != null && !string.IsNullOrWhiteSpace(setting.Value))
            {
                return setting.Value.Trim();
            }
        }
        catch { }

        return _config["DatabaseProvider"] ?? "MongoDB";
    }

    private static DownloadHistory MapMongoRecordToHistory(SaveZonix.Models.DownloadRecord m)
    {
        DownloadStatus parsedStatus = DownloadStatus.Completed;
        if (Enum.TryParse<DownloadStatus>(m.Status, true, out var st)) parsedStatus = st;

        DateTime stTime = m.StartTime ?? m.CreatedAt;
        DateTime? compTime = m.CompletionTime ?? (m.TimeTakenSeconds > 0 ? stTime.AddSeconds(m.TimeTakenSeconds) : (DateTime?)null);

        return new DownloadHistory
        {
            Id = string.IsNullOrEmpty(m.TaskId) ? (m.Id ?? Guid.NewGuid().ToString("N")) : m.TaskId,
            UserId = m.UserId,
            UserEmail = m.UserEmail,
            Title = string.IsNullOrEmpty(m.VideoTitle) ? "Video" : m.VideoTitle,
            FileName = "video.mp4",
            OriginalUrl = m.OriginalUrl ?? "",
            ThumbnailUrl = m.ThumbnailUrl,
            Platform = string.IsNullOrEmpty(m.Platform) ? "Web Stream" : m.Platform,
            MediaType = "Video",
            Format = "MP4",
            Quality = string.IsNullOrEmpty(m.Quality) ? "1080p Full HD" : m.Quality,
            DurationSeconds = m.DurationSeconds,
            FileSize = m.FileSizeBytes,
            AverageSpeedMBps = m.DownloadSpeedMBps,
            PeakSpeedMBps = m.PeakSpeedMBps,
            DownloadDurationSeconds = m.TimeTakenSeconds,
            Status = parsedStatus,
            StartTime = stTime,
            CompletionTime = compTime,
            ValidationStatus = string.IsNullOrEmpty(m.ValidationStatus) ? "Passed" : m.ValidationStatus,
            ValidationDetails = m.ValidationDetails ?? "",
            AudioVideoDetails = m.AudioVideoDetails ?? "",
            DownloadStrategy = string.IsNullOrEmpty(m.DownloadStrategy) ? "HLS Multi-Thread" : m.DownloadStrategy,
            CreatedAt = m.CreatedAt,
            UpdatedAt = m.CreatedAt
        };
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
            if (!string.IsNullOrEmpty(strategy)) existing.DownloadStrategy = strategy;
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

        if (_isMongoConfigured && _mongoDb != null)
        {
            try
            {
                var coll = _mongoDb.GetCollection<SaveZonix.Models.DownloadRecord>("downloads");
                var mRecord = new SaveZonix.Models.DownloadRecord
                {
                    TaskId = taskId,
                    UserId = userId,
                    UserEmail = userEmail,
                    VideoTitle = title,
                    OriginalUrl = cleanUrl,
                    ThumbnailUrl = thumbnailUrl,
                    Platform = platform,
                    Quality = quality,
                    FileSizeBytes = estimatedBytes,
                    DurationSeconds = durationSeconds,
                    DownloadStrategy = strategy,
                    StartTime = DateTime.UtcNow,
                    Status = "Downloading",
                    CreatedAt = DateTime.UtcNow
                };
                await coll.InsertOneAsync(mRecord);
            }
            catch { }
        }

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

        if (_isMongoConfigured && _mongoDb != null)
        {
            try
            {
                var coll = _mongoDb.GetCollection<SaveZonix.Models.DownloadRecord>("downloads");
                var update = MongoDB.Driver.Builders<SaveZonix.Models.DownloadRecord>.Update
                    .Set(x => x.Status, "Completed")
                    .Set(x => x.FileSizeBytes, finalSize)
                    .Set(x => x.DownloadSpeedMBps, avgSpeed)
                    .Set(x => x.PeakSpeedMBps, peakSpeed)
                    .Set(x => x.TimeTakenSeconds, totalSeconds)
                    .Set(x => x.StartTime, record != null ? record.StartTime : DateTime.UtcNow.AddSeconds(-totalSeconds))
                    .Set(x => x.CompletionTime, DateTime.UtcNow)
                    .Set(x => x.ValidationStatus, validationStatus)
                    .Set(x => x.ValidationDetails, validationDetails)
                    .Set(x => x.AudioVideoDetails, audioVideoDetails);
                await coll.UpdateOneAsync(x => x.TaskId == taskId, update);
            }
            catch { }
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
        var provider = await GetActiveProviderAsync();
        if (provider.Equals("MongoDB", StringComparison.OrdinalIgnoreCase) && _isMongoConfigured && _mongoDb != null)
        {
            try
            {
                var coll = _mongoDb.GetCollection<SaveZonix.Models.DownloadRecord>("downloads");
                var filterBuilder = MongoDB.Driver.Builders<SaveZonix.Models.DownloadRecord>.Filter;
                var filter = filterBuilder.Empty;

                if (!string.IsNullOrEmpty(userId))
                {
                    filter &= filterBuilder.Eq(x => x.UserId, userId);
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var s = search.Trim();
                    filter &= filterBuilder.Or(
                        filterBuilder.Regex(x => x.VideoTitle, new MongoDB.Bson.BsonRegularExpression(s, "i")),
                        filterBuilder.Regex(x => x.OriginalUrl, new MongoDB.Bson.BsonRegularExpression(s, "i"))
                    );
                }

                if (!string.IsNullOrWhiteSpace(status))
                {
                    filter &= filterBuilder.Eq(x => x.Status, status);
                }

                if (!string.IsNullOrWhiteSpace(platform) && platform != "All")
                {
                    filter &= filterBuilder.Eq(x => x.Platform, platform);
                }

                long totalDocs = await coll.CountDocumentsAsync(filter);
                var mongoRecords = await coll.Find(filter)
                    .SortByDescending(x => x.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Limit(pageSize)
                    .ToListAsync();

                var mapped = mongoRecords.Select(MapMongoRecordToHistory).ToList();
                return (mapped, (int)totalDocs);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MongoDB User Downloads Notice] {ex.Message} — Falling back to SQL");
            }
        }

        // SQL Mode / Fallback:
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
        var provider = await GetActiveProviderAsync();
        if (provider.Equals("MongoDB", StringComparison.OrdinalIgnoreCase) && _isMongoConfigured && _mongoDb != null)
        {
            try
            {
                var coll = _mongoDb.GetCollection<SaveZonix.Models.DownloadRecord>("downloads");
                var filterBuilder = MongoDB.Driver.Builders<SaveZonix.Models.DownloadRecord>.Filter;
                var filter = filterBuilder.Empty;

                if (!string.IsNullOrWhiteSpace(userEmail))
                {
                    filter &= filterBuilder.Regex(x => x.UserEmail, new MongoDB.Bson.BsonRegularExpression(userEmail, "i"));
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var s = search.Trim();
                    filter &= filterBuilder.Or(
                        filterBuilder.Regex(x => x.VideoTitle, new MongoDB.Bson.BsonRegularExpression(s, "i")),
                        filterBuilder.Regex(x => x.OriginalUrl, new MongoDB.Bson.BsonRegularExpression(s, "i")),
                        filterBuilder.Regex(x => x.UserEmail, new MongoDB.Bson.BsonRegularExpression(s, "i"))
                    );
                }

                if (!string.IsNullOrWhiteSpace(status))
                {
                    filter &= filterBuilder.Eq(x => x.Status, status);
                }

                if (!string.IsNullOrWhiteSpace(platform) && platform != "All")
                {
                    filter &= filterBuilder.Eq(x => x.Platform, platform);
                }

                long totalDocs = await coll.CountDocumentsAsync(filter);
                var mongoRecords = await coll.Find(filter)
                    .SortByDescending(x => x.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Limit(pageSize)
                    .ToListAsync();

                var mapped = mongoRecords.Select(MapMongoRecordToHistory).ToList();
                return (mapped, (int)totalDocs);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MongoDB All Downloads Notice] {ex.Message} — Falling back to SQL");
            }
        }

        // SQL Mode:
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
        if (_isMongoConfigured && _mongoDb != null)
        {
            try
            {
                var coll = _mongoDb.GetCollection<SaveZonix.Models.DownloadRecord>("downloads");
                var filter = MongoDB.Driver.Builders<SaveZonix.Models.DownloadRecord>.Filter.Or(
                    MongoDB.Driver.Builders<SaveZonix.Models.DownloadRecord>.Filter.Eq(x => x.TaskId, id),
                    MongoDB.Driver.Builders<SaveZonix.Models.DownloadRecord>.Filter.Eq(x => x.Id, id)
                );
                if (userId != null)
                {
                    filter &= MongoDB.Driver.Builders<SaveZonix.Models.DownloadRecord>.Filter.Eq(x => x.UserId, userId);
                }
                await coll.DeleteOneAsync(filter);
            }
            catch { }
        }

        var record = await _context.DownloadHistories.FirstOrDefaultAsync(d => d.Id == id);
        if (record == null) return true;

        // Ensure user can only delete their own download
        if (userId != null && record.UserId != userId) return false;

        _context.DownloadHistories.Remove(record);
        await _context.SaveChangesAsync();
        return true;
    }
}
