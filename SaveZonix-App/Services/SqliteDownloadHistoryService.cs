using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SaveZonix.Data;
using StreamHelper.Data;
using StreamHelper.Services;

namespace SaveZonix.Services;

public class SqliteDownloadHistoryService : IDownloadHistoryService
{
    private readonly IServiceProvider _serviceProvider;
    private static readonly Lock _initLock = new();
    private static bool _migrationAttempted = false;

    public SqliteDownloadHistoryService(IServiceProvider serviceProvider, IConfiguration? config = null)
    {
        _serviceProvider = serviceProvider;
        EnsureDatabaseInitialized();
    }

    private void EnsureDatabaseInitialized()
    {
        if (_migrationAttempted) return;
        lock (_initLock)
        {
            if (_migrationAttempted) return;
            _migrationAttempted = true;

            try
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();
                db.Database.EnsureCreated();

                // If SQLite has 0 records, migrate legacy JSON history
                if (!db.Downloads.Any())
                {
                    string jsonPath = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "SaveZonix",
                        "downloads_history.json");

                    if (File.Exists(jsonPath))
                    {
                        try
                        {
                            string json = File.ReadAllText(jsonPath);
                            var options = new JsonSerializerOptions
                            {
                                PropertyNameCaseInsensitive = true,
                                NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals
                            };
                            var legacyList = JsonSerializer.Deserialize<List<DownloadHistory>>(json, options);
                            if (legacyList != null && legacyList.Count > 0)
                            {
                                foreach (var item in legacyList)
                                {
                                    if (string.IsNullOrEmpty(item.Id)) item.Id = Guid.NewGuid().ToString("N");
                                    if (double.IsNaN(item.AverageSpeedMBps) || double.IsInfinity(item.AverageSpeedMBps)) item.AverageSpeedMBps = 0;
                                    if (double.IsNaN(item.PeakSpeedMBps) || double.IsInfinity(item.PeakSpeedMBps)) item.PeakSpeedMBps = 0;
                                    db.Downloads.Add(item);
                                }
                                db.SaveChanges();
                                Console.WriteLine($"[SQLite Migration] ⚡ Successfully migrated {legacyList.Count} download record(s) from JSON to SQLite.");
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[SQLite JSON Import Notice] {ex.Message}");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SQLite Init Notice] {ex.Message}");
            }
        }
    }

    public async Task<DownloadHistory> CreateOrUpdateDownloadAsync(
        string taskId, string? userId, string? userEmail, string? userName,
        string originalUrl, string title, string fileName, string? thumbnailUrl,
        string platform, string mediaType, string format, string quality,
        string? codec, int durationSeconds, long estimatedBytes, int threads,
        string strategy)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var existing = await db.Downloads.FirstOrDefaultAsync(d => d.Id == taskId);
        if (existing == null)
        {
            existing = new DownloadHistory
            {
                Id = taskId,
                UserId = userId,
                UserEmail = userEmail,
                UserName = userName,
                OriginalUrl = SanitizeUrl(originalUrl),
                Title = title,
                FileName = fileName,
                ThumbnailUrl = thumbnailUrl,
                Platform = platform,
                MediaType = mediaType,
                Format = format,
                Quality = quality,
                Codec = codec ?? "H.264 / AAC",
                DurationSeconds = durationSeconds,
                FileSize = estimatedBytes,
                ThreadsUsed = threads,
                DownloadStrategy = strategy,
                Status = DownloadStatus.Downloading,
                StartTime = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            db.Downloads.Add(existing);
        }
        else
        {
            existing.Title = title;
            existing.FileName = fileName;
            existing.FileSize = estimatedBytes > 0 ? estimatedBytes : existing.FileSize;
            existing.ThreadsUsed = threads;
            existing.DownloadStrategy = strategy;
            existing.Status = DownloadStatus.Downloading;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return existing;
    }

    public async Task UpdateProgressAsync(string taskId, DownloadStatus status, long downloadedBytes, double avgSpeed, double peakSpeed, double elapsedSeconds)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var item = await db.Downloads.FirstOrDefaultAsync(d => d.Id == taskId);
        if (item != null)
        {
            item.Status = status;
            item.DownloadedBytes = downloadedBytes;
            item.AverageSpeedMBps = (double.IsNaN(avgSpeed) || double.IsInfinity(avgSpeed) || avgSpeed < 0) ? 0 : avgSpeed;
            item.PeakSpeedMBps = (double.IsNaN(peakSpeed) || double.IsInfinity(peakSpeed) || peakSpeed < 0) ? 0 : peakSpeed;
            item.DownloadDurationSeconds = elapsedSeconds;
            item.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    public async Task MarkCompletedAsync(string taskId, long finalSize, double avgSpeed, double peakSpeed, double totalSeconds)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var item = await db.Downloads.FirstOrDefaultAsync(d => d.Id == taskId);
        if (item != null)
        {
            item.Status = DownloadStatus.Completed;
            if (finalSize > 0)
            {
                item.FileSize = finalSize;
                item.DownloadedBytes = finalSize;
            }
            item.AverageSpeedMBps = (double.IsNaN(avgSpeed) || double.IsInfinity(avgSpeed) || avgSpeed < 0) ? 0 : avgSpeed;
            item.PeakSpeedMBps = (double.IsNaN(peakSpeed) || double.IsInfinity(peakSpeed) || peakSpeed < 0) ? 0 : peakSpeed;
            item.DownloadDurationSeconds = totalSeconds;
            item.CompletionTime = DateTime.UtcNow;
            item.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    public async Task MarkCompletedWithValidationAsync(string taskId, long finalSize, double avgSpeed, double peakSpeed, double totalSeconds, string validationStatus, string validationDetails, double probedDuration, string audioVideoDetails)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var item = await db.Downloads.FirstOrDefaultAsync(d => d.Id == taskId);
        if (item != null)
        {
            item.Status = DownloadStatus.Completed;
            if (finalSize > 0)
            {
                item.FileSize = finalSize;
                item.DownloadedBytes = finalSize;
            }
            item.AverageSpeedMBps = (double.IsNaN(avgSpeed) || double.IsInfinity(avgSpeed) || avgSpeed < 0) ? 0 : avgSpeed;
            item.PeakSpeedMBps = (double.IsNaN(peakSpeed) || double.IsInfinity(peakSpeed) || peakSpeed < 0) ? 0 : peakSpeed;
            item.DownloadDurationSeconds = totalSeconds;
            item.ValidationStatus = validationStatus;
            item.ValidationDetails = validationDetails;
            item.ProbedDurationSeconds = probedDuration;
            item.AudioVideoDetails = audioVideoDetails;
            item.CompletionTime = DateTime.UtcNow;
            item.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    public async Task MarkCorruptedAsync(string taskId, string errorReason, string validationStatus, string validationDetails, int retryCount)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var item = await db.Downloads.FirstOrDefaultAsync(d => d.Id == taskId);
        if (item != null)
        {
            item.Status = DownloadStatus.Corrupted;
            item.ErrorReason = errorReason;
            item.ValidationStatus = validationStatus;
            item.ValidationDetails = validationDetails;
            item.RetryCount = retryCount;
            item.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    public async Task MarkRetryingAsync(string taskId, int retryCount, string retryReason)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var item = await db.Downloads.FirstOrDefaultAsync(d => d.Id == taskId);
        if (item != null)
        {
            item.Status = DownloadStatus.Retrying;
            item.RetryCount = retryCount;
            item.ErrorReason = retryReason;
            item.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    public async Task MarkFailedAsync(string taskId, string errorReason)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var item = await db.Downloads.FirstOrDefaultAsync(d => d.Id == taskId);
        if (item != null)
        {
            item.Status = DownloadStatus.Failed;
            item.ErrorReason = errorReason;
            item.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    public async Task MarkCancelledAsync(string taskId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var item = await db.Downloads.FirstOrDefaultAsync(d => d.Id == taskId);
        if (item != null)
        {
            item.Status = DownloadStatus.Cancelled;
            item.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    public async Task<int> ReconcileOrphanedDownloadsAsync(ISet<string>? activeTaskIds = null)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var orphaned = await db.Downloads
            .Where(d => d.Status == DownloadStatus.Downloading || d.Status == DownloadStatus.Retrying || d.Status == DownloadStatus.Resolving)
            .ToListAsync();

        int count = 0;
        foreach (var item in orphaned)
        {
            if (activeTaskIds == null || !activeTaskIds.Contains(item.Id))
            {
                item.Status = DownloadStatus.Cancelled;
                item.ErrorReason = "Session interrupted on application restart";
                item.UpdatedAt = DateTime.UtcNow;
                count++;
            }
        }

        if (count > 0)
        {
            await db.SaveChangesAsync();
        }
        return count;
    }

    public async Task<(List<DownloadHistory> Items, int TotalCount)> GetUserDownloadsAsync(string userId, int page, int pageSize, string? search, string? status, string? platform)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var query = db.Downloads.Where(d => d.UserId == userId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(d => d.Title.Contains(search) || d.FileName.Contains(search) || d.OriginalUrl.Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<DownloadStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(d => d.Status == parsedStatus);
        }

        if (!string.IsNullOrWhiteSpace(platform))
        {
            query = query.Where(d => d.Platform.Equals(platform));
        }

        int total = await query.CountAsync();
        var items = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((Math.Max(1, page) - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task<(List<DownloadHistory> Items, int TotalCount)> GetAllDownloadsAsync(int page, int pageSize, string? search, string? status, string? platform, string? userEmail)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var query = db.Downloads.AsQueryable();

        if (!string.IsNullOrWhiteSpace(userEmail))
        {
            query = query.Where(d => d.UserEmail != null && d.UserEmail.Contains(userEmail));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(d => d.Title.Contains(search) || d.FileName.Contains(search) || d.OriginalUrl.Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<DownloadStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(d => d.Status == parsedStatus);
        }

        if (!string.IsNullOrWhiteSpace(platform))
        {
            query = query.Where(d => d.Platform.Equals(platform));
        }

        int total = await query.CountAsync();
        var items = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((Math.Max(1, page) - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task<DownloadHistory?> GetDownloadByIdAsync(string id)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();
        return await db.Downloads.FirstOrDefaultAsync(d => d.Id == id);
    }

    public async Task<bool> DeleteDownloadAsync(string id, string? userId = null)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var item = await db.Downloads.FirstOrDefaultAsync(d => d.Id == id);
        if (item == null) return false;

        if (!string.IsNullOrEmpty(userId) && item.UserId != userId) return false;

        db.Downloads.Remove(item);
        // Also remove any associated chunk records
        var chunks = await db.Chunks.Where(c => c.TaskId == id).ToListAsync();
        if (chunks.Count > 0) db.Chunks.RemoveRange(chunks);

        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ClearAllDownloadsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        db.Downloads.RemoveRange(db.Downloads);
        db.Chunks.RemoveRange(db.Chunks);
        await db.SaveChangesAsync();
        return true;
    }

    public string SanitizeUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return string.Empty;
        var qIdx = url.IndexOf('?');
        return qIdx > 0 ? url[..qIdx] : url;
    }

    // Chunk Level Persistence for Persistent Pause / Resume
    public async Task SaveChunkProgressAsync(string taskId, int chunkIndex, long rangeStart, long rangeEnd, long bytesWritten, bool isCompleted, string? localTempPath)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();

        var chunk = await db.Chunks.FirstOrDefaultAsync(c => c.TaskId == taskId && c.ChunkIndex == chunkIndex);
        if (chunk == null)
        {
            chunk = new DownloadChunkRecord
            {
                TaskId = taskId,
                ChunkIndex = chunkIndex,
                RangeStart = rangeStart,
                RangeEnd = rangeEnd,
                BytesWritten = bytesWritten,
                IsCompleted = isCompleted,
                LocalTempPath = localTempPath,
                UpdatedAt = DateTime.UtcNow
            };
            db.Chunks.Add(chunk);
        }
        else
        {
            chunk.BytesWritten = bytesWritten;
            chunk.IsCompleted = isCompleted;
            chunk.LocalTempPath = localTempPath ?? chunk.LocalTempPath;
            chunk.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
    }

    public async Task<List<DownloadChunkRecord>> GetChunkRecordsAsync(string taskId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();
        return await db.Chunks.Where(c => c.TaskId == taskId).OrderBy(c => c.ChunkIndex).ToListAsync();
    }
}
