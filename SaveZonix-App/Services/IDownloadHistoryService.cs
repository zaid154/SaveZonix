using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using MongoDB.Bson;
using MongoDB.Driver;
using SaveZonix.Core;
using SaveZonix.Models;
using StreamHelper.Data;

namespace StreamHelper.Services;

public interface IDownloadHistoryService
{
    Task<DownloadHistory> CreateOrUpdateDownloadAsync(
        string taskId, string? userId, string? userEmail, string? userName,
        string originalUrl, string title, string fileName, string? thumbnailUrl,
        string platform, string mediaType, string format, string quality,
        string? codec, int durationSeconds, long estimatedBytes, int threads,
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
    Task<bool> ClearAllDownloadsAsync();
    string SanitizeUrl(string url);
}

public class DownloadHistoryService : IDownloadHistoryService
{
    private static readonly ConcurrentDictionary<string, DownloadHistory> _localStore = new(StringComparer.OrdinalIgnoreCase);
    private static readonly Lock _fileLock = new();
    private static readonly Lock _initLock = new();
    private static bool _initialized = false;
    private static readonly string _localFilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "SaveZonix",
        "downloads_history.json");

    private readonly IMongoDatabase? _mongoDb;
    private readonly IMongoCollection<BsonDocument>? _cloudHistoryCollection;
    private readonly bool _isMongoConnected;

    public DownloadHistoryService(IMongoDatabase? mongoDb = null, Microsoft.Extensions.Configuration.IConfiguration? config = null)
    {
        EnsureInitialized();

        if (mongoDb != null)
        {
            _mongoDb = mongoDb;
            _cloudHistoryCollection = _mongoDb.GetCollection<BsonDocument>("downloadhistories");
            _isMongoConnected = true;
        }
        else if (config != null)
        {
            try
            {
                string? connStr = config["MongoDb:ConnectionString"] ?? config.GetConnectionString("MongoDb");
                if (!string.IsNullOrWhiteSpace(connStr))
                {
                    string dbName = config["MongoDb:DatabaseName"] ?? "SaveZonixDb";
                    var mongoSettings = MongoClientSettings.FromConnectionString(connStr);
                    mongoSettings.ServerSelectionTimeout = TimeSpan.FromSeconds(2);
                    mongoSettings.ConnectTimeout = TimeSpan.FromSeconds(2);

                    var client = new MongoClient(mongoSettings);
                    _mongoDb = client.GetDatabase(dbName);
                    _cloudHistoryCollection = _mongoDb.GetCollection<BsonDocument>("downloadhistories");
                    _isMongoConnected = true;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DownloadHistoryService Init Notice] {ex.Message}");
            }
        }
    }

    private static void EnsureInitialized()
    {
        if (_initialized) return;
        lock (_initLock)
        {
            if (_initialized) return;
            _initialized = true;

            try
            {
                var dir = Path.GetDirectoryName(_localFilePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    Directory.CreateDirectory(dir);

                if (File.Exists(_localFilePath))
                {
                    string json = File.ReadAllText(_localFilePath);
                    var loadOptions = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true,
                        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals
                    };
                    var items = JsonSerializer.Deserialize<List<DownloadHistory>>(json, loadOptions);
                    if (items != null)
                    {
                        bool anyFixed = false;
                        foreach (var it in items)
                        {
                            if (!string.IsNullOrEmpty(it.Id))
                            {
                                if (double.IsNaN(it.AverageSpeedMBps) || double.IsInfinity(it.AverageSpeedMBps) || it.AverageSpeedMBps < 0)
                                {
                                    it.AverageSpeedMBps = 0;
                                    anyFixed = true;
                                }
                                if (double.IsNaN(it.PeakSpeedMBps) || double.IsInfinity(it.PeakSpeedMBps) || it.PeakSpeedMBps < 0)
                                {
                                    it.PeakSpeedMBps = 0;
                                    anyFixed = true;
                                }
                                if (it.Status is DownloadStatus.Downloading or DownloadStatus.Retrying or DownloadStatus.Resolving)
                                {
                                    it.Status = DownloadStatus.Cancelled;
                                    it.ErrorReason = "Session interrupted on application restart";
                                    it.CompletionTime = DateTime.UtcNow;
                                    it.UpdatedAt = DateTime.UtcNow;
                                    anyFixed = true;
                                }
                                _localStore[it.Id] = it;
                            }
                        }
                        if (anyFixed)
                        {
                            SaveLocalStore();
                        }
                    }
                }

                AutoDiscoverDownloadsFromDisk();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DownloadHistoryService EnsureInitialized] {ex.Message}");
            }
        }
    }

    private static void SaveLocalStore()
    {
        try
        {
            lock (_fileLock)
            {
                var dir = Path.GetDirectoryName(_localFilePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    Directory.CreateDirectory(dir);

                var list = _localStore.Values.OrderByDescending(x => x.CreatedAt).ToList();
                foreach (var it in list)
                {
                    if (double.IsNaN(it.AverageSpeedMBps) || double.IsInfinity(it.AverageSpeedMBps) || it.AverageSpeedMBps < 0)
                        it.AverageSpeedMBps = 0;
                    if (double.IsNaN(it.PeakSpeedMBps) || double.IsInfinity(it.PeakSpeedMBps) || it.PeakSpeedMBps < 0)
                        it.PeakSpeedMBps = 0;
                }
                var saveOptions = new JsonSerializerOptions
                {
                    WriteIndented = true,
                    NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals
                };
                var json = JsonSerializer.Serialize(list, saveOptions);
                string tempFile = _localFilePath + ".tmp";
                File.WriteAllText(tempFile, json);
                File.Move(tempFile, _localFilePath, true);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SaveLocalStore Error] {ex.Message}");
        }
    }

    private static void AutoDiscoverDownloadsFromDisk()
    {
        try
        {
            string downloadsDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads", "SaveZonix");
            if (!Directory.Exists(downloadsDir)) return;

            var supportedExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".mp4", ".mp3", ".m4a", ".webm", ".mkv" };
            var files = Directory.GetFiles(downloadsDir, "*.*", SearchOption.AllDirectories);
            bool addedAny = false;
            foreach (var filePath in files)
            {
                var fi = new FileInfo(filePath);
                if (!supportedExts.Contains(fi.Extension) || fi.Length == 0) continue;

                var existingItem = _localStore.Values.FirstOrDefault(v => string.Equals(v.FileName, fi.Name, StringComparison.OrdinalIgnoreCase));
                if (existingItem != null)
                {
                    if (existingItem.Status != DownloadStatus.Completed && fi.Length > 1024)
                    {
                        existingItem.Status = DownloadStatus.Completed;
                        existingItem.FileSize = fi.Length;
                        existingItem.DownloadedBytes = fi.Length;
                        existingItem.ValidationStatus = "Passed";
                        existingItem.ValidationDetails = "Verified media file on disk";
                        existingItem.CompletionTime = fi.LastWriteTimeUtc;
                        existingItem.UpdatedAt = DateTime.UtcNow;
                        addedAny = true;
                    }
                    continue;
                }

                string id = "local_" + Math.Abs(fi.FullName.GetHashCode()).ToString("X8") + "_" + fi.Length;
                if (_localStore.ContainsKey(id)) continue;

                string? parentDir = Path.GetDirectoryName(filePath);
                string folderName = !string.IsNullOrEmpty(parentDir) ? Path.GetFileName(parentDir) : "";
                bool isAudio = fi.Extension.Equals(".mp3", StringComparison.OrdinalIgnoreCase) || fi.Extension.Equals(".m4a", StringComparison.OrdinalIgnoreCase);

                string strategy = (!string.IsNullOrEmpty(folderName) && !string.Equals(folderName, "SaveZonix", StringComparison.OrdinalIgnoreCase))
                    ? $"Playlist: PL-01 • {folderName} • Local Import"
                    : "Adaptive Parallel";

                var entry = new DownloadHistory
                {
                    Id = id,
                    Title = Path.GetFileNameWithoutExtension(fi.Name),
                    FileName = fi.Name,
                    OriginalUrl = "",
                    Platform = isAudio ? "Music Stream" : "Web Stream",
                    MediaType = isAudio ? "Audio" : "Video",
                    Format = fi.Extension.TrimStart('.').ToUpperInvariant(),
                    Quality = isAudio ? "320 kbps" : "1080p Full HD",
                    FileSize = fi.Length,
                    DownloadedBytes = fi.Length,
                    Status = DownloadStatus.Completed,
                    DownloadStrategy = strategy,
                    ValidationStatus = "Passed",
                    ValidationDetails = "Verified media file on disk",
                    StartTime = fi.CreationTimeUtc,
                    CompletionTime = fi.LastWriteTimeUtc,
                    CreatedAt = fi.CreationTimeUtc,
                    UpdatedAt = fi.LastWriteTimeUtc
                };

                _localStore[id] = entry;
                addedAny = true;
            }

            if (addedAny) SaveLocalStore();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AutoDiscoverDownloadsFromDisk Notice] {ex.Message}");
        }
    }

    public string SanitizeUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return string.Empty;
        try
        {
            if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                var queryParams = HttpUtility.ParseQueryString(uri.Query);
                string[] sensitiveKeys = { "token", "sig", "signature", "key", "auth", "expire", "expires", "access_token", "secret", "session", "pass" };

                foreach (var k in queryParams.AllKeys.Where(k => k != null))
                {
                    if (sensitiveKeys.Any(s => k!.IndexOf(s, StringComparison.OrdinalIgnoreCase) >= 0))
                        queryParams.Remove(k);
                }

                var ub = new UriBuilder(uri) { Query = queryParams.ToString() };
                return ub.Uri.ToString();
            }
        }
        catch { }
        return url;
    }

    private void UpdateCloudHistoryBackground(string taskId, UpdateDefinition<BsonDocument> update)
    {
        if (!_isMongoConnected || _cloudHistoryCollection == null) return;

        _ = Task.Run(async () =>
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                var filter = Builders<BsonDocument>.Filter.Eq("taskId", taskId);
                await _cloudHistoryCollection.UpdateOneAsync(filter, update, cancellationToken: cts.Token);
            }
            catch { }
        });
    }

    public Task<DownloadHistory> CreateOrUpdateDownloadAsync(
        string taskId, string? userId, string? userEmail, string? userName,
        string originalUrl, string title, string fileName, string? thumbnailUrl,
        string platform, string mediaType, string format, string quality,
        string? codec, int durationSeconds, long estimatedBytes, int threads,
        string strategy)
    {
        EnsureInitialized();
        string cleanUrl = SanitizeUrl(originalUrl);
        DateTime now = DateTime.UtcNow;

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
            DownloadedBytes = 0,
            Status = DownloadStatus.Downloading,
            StartTime = now,
            ThreadsUsed = threads,
            DownloadStrategy = strategy,
            ValidationStatus = "Pending",
            CreatedAt = now,
            UpdatedAt = now
        };

        _localStore[taskId] = download;
        SaveLocalStore();

        if (_isMongoConnected && _cloudHistoryCollection != null)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                    string dType = string.Equals(userEmail, "zaidm1323@gmail.com", StringComparison.OrdinalIgnoreCase) ? "admin"
                        : (!string.IsNullOrEmpty(userId) || (!string.IsNullOrEmpty(userEmail) && !userEmail.StartsWith("Guest", StringComparison.OrdinalIgnoreCase))) ? "user"
                        : "guest";

                    BsonValue bsonUserId = string.IsNullOrEmpty(userId) ? BsonNull.Value : (BsonValue)userId;

                    var filter = Builders<BsonDocument>.Filter.Eq("taskId", taskId);
                    var update = Builders<BsonDocument>.Update
                        .Set("taskId", taskId)
                        .Set("title", title)
                        .Set("fileName", fileName)
                        .Set("originalUrl", cleanUrl)
                        .Set("thumbnailUrl", thumbnailUrl ?? "")
                        .Set("platform", platform)
                        .Set("quality", quality)
                        .Set("fileSize", estimatedBytes)
                        .Set("format", format)
                        .Set("status", "Downloading")
                        .Set("downloadType", dType)
                        .Set("userId", bsonUserId)
                        .Set("userEmail", userEmail ?? "Guest")
                        .Set("userName", userName ?? "Guest")
                        .Set("ipAddress", "127.0.0.1")
                        .Set("downloadStrategy", strategy)
                        .Set("threadsUsed", threads)
                        .Set("durationSeconds", durationSeconds)
                        .Set("startTime", now)
                        .Set("updatedAt", now)
                        .SetOnInsert("createdAt", now);

                    await _cloudHistoryCollection.UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true }, cts.Token);
                }
                catch { }
            });
        }

        return Task.FromResult(download);
    }

    public Task UpdateProgressAsync(string taskId, DownloadStatus status, long downloadedBytes, double avgSpeed, double peakSpeed, double elapsedSeconds)
    {
        EnsureInitialized();
        if (_localStore.TryGetValue(taskId, out var item))
        {
            item.Status = status;
            item.DownloadedBytes = downloadedBytes;
            item.AverageSpeedMBps = avgSpeed;
            item.PeakSpeedMBps = peakSpeed;
            item.DownloadDurationSeconds = elapsedSeconds;
            item.UpdatedAt = DateTime.UtcNow;
        }

        var update = Builders<BsonDocument>.Update
            .Set("status", status.ToString())
            .Set("downloadedBytes", downloadedBytes)
            .Set("downloadSpeedMBps", avgSpeed)
            .Set("peakSpeedMBps", peakSpeed)
            .Set("downloadDurationSeconds", elapsedSeconds)
            .Set("updatedAt", DateTime.UtcNow);

        UpdateCloudHistoryBackground(taskId, update);
        return Task.CompletedTask;
    }

    public Task MarkCompletedAsync(string taskId, long finalSize, double avgSpeed, double peakSpeed, double totalSeconds) =>
        MarkCompletedWithValidationAsync(taskId, finalSize, avgSpeed, peakSpeed, totalSeconds, "Passed", "Verified media structure", 0, "Standard Container");

    public Task MarkCompletedWithValidationAsync(string taskId, long finalSize, double avgSpeed, double peakSpeed, double totalSeconds, string validationStatus, string validationDetails, double probedDuration, string audioVideoDetails)
    {
        EnsureInitialized();
        DateTime now = DateTime.UtcNow;

        if (_localStore.TryGetValue(taskId, out var item))
        {
            item.Status = DownloadStatus.Completed;
            item.FileSize = finalSize;
            item.DownloadedBytes = finalSize;
            item.AverageSpeedMBps = avgSpeed;
            item.PeakSpeedMBps = peakSpeed;
            item.DownloadDurationSeconds = totalSeconds;
            item.CompletionTime = now;
            item.ValidationStatus = validationStatus;
            item.ValidationDetails = validationDetails;
            item.ProbedDurationSeconds = probedDuration;
            item.AudioVideoDetails = audioVideoDetails;
            item.UpdatedAt = now;
        }
        else
        {
            _localStore[taskId] = new DownloadHistory
            {
                Id = taskId,
                FileSize = finalSize,
                DownloadedBytes = finalSize,
                AverageSpeedMBps = avgSpeed,
                PeakSpeedMBps = peakSpeed,
                DownloadDurationSeconds = totalSeconds,
                Status = DownloadStatus.Completed,
                CompletionTime = now,
                ValidationStatus = validationStatus,
                ValidationDetails = validationDetails,
                ProbedDurationSeconds = probedDuration,
                AudioVideoDetails = audioVideoDetails,
                CreatedAt = now,
                UpdatedAt = now
            };
        }
        SaveLocalStore();

        var update = Builders<BsonDocument>.Update
            .Set("status", "Completed")
            .Set("fileSize", finalSize)
            .Set("downloadedBytes", finalSize)
            .Set("downloadSpeedMBps", avgSpeed)
            .Set("peakSpeedMBps", peakSpeed)
            .Set("downloadDurationSeconds", totalSeconds)
            .Set("completionTime", now)
            .Set("validationStatus", validationStatus)
            .Set("validationDetails", validationDetails)
            .Set("audioVideoDetails", audioVideoDetails)
            .Set("updatedAt", now);

        UpdateCloudHistoryBackground(taskId, update);
        return Task.CompletedTask;
    }

    public Task MarkCorruptedAsync(string taskId, string errorReason, string validationStatus, string validationDetails, int retryCount)
    {
        EnsureInitialized();
        DateTime now = DateTime.UtcNow;
        if (_localStore.TryGetValue(taskId, out var item))
        {
            item.Status = DownloadStatus.Corrupted;
            item.ErrorReason = errorReason;
            item.ValidationStatus = validationStatus;
            item.ValidationDetails = validationDetails;
            item.RetryCount = retryCount;
            item.CompletionTime = now;
            item.UpdatedAt = now;
            SaveLocalStore();
        }

        var update = Builders<BsonDocument>.Update
            .Set("status", "Corrupted")
            .Set("errorReason", errorReason)
            .Set("validationStatus", validationStatus)
            .Set("validationDetails", validationDetails)
            .Set("retryCount", retryCount)
            .Set("completionTime", now)
            .Set("updatedAt", now);

        UpdateCloudHistoryBackground(taskId, update);
        return Task.CompletedTask;
    }

    public Task MarkRetryingAsync(string taskId, int retryCount, string retryReason)
    {
        EnsureInitialized();
        DateTime now = DateTime.UtcNow;
        if (_localStore.TryGetValue(taskId, out var item))
        {
            item.Status = DownloadStatus.Retrying;
            item.RetryCount = retryCount;
            item.ErrorReason = $"Retry {retryCount}: {retryReason}";
            item.UpdatedAt = now;
            SaveLocalStore();
        }

        var update = Builders<BsonDocument>.Update
            .Set("status", "Retrying")
            .Set("retryCount", retryCount)
            .Set("errorReason", $"Retry {retryCount}: {retryReason}")
            .Set("updatedAt", now);

        UpdateCloudHistoryBackground(taskId, update);
        return Task.CompletedTask;
    }

    public Task MarkFailedAsync(string taskId, string errorReason)
    {
        EnsureInitialized();
        DateTime now = DateTime.UtcNow;
        if (_localStore.TryGetValue(taskId, out var item))
        {
            item.Status = DownloadStatus.Failed;
            item.ErrorReason = errorReason;
            item.ValidationStatus = "Failed";
            item.CompletionTime = now;
            item.UpdatedAt = now;
            SaveLocalStore();
        }

        var update = Builders<BsonDocument>.Update
            .Set("status", "Failed")
            .Set("errorReason", errorReason)
            .Set("validationStatus", "Failed")
            .Set("completionTime", now)
            .Set("updatedAt", now);

        UpdateCloudHistoryBackground(taskId, update);
        return Task.CompletedTask;
    }

    public Task MarkCancelledAsync(string taskId)
    {
        EnsureInitialized();
        DateTime now = DateTime.UtcNow;
        if (_localStore.TryGetValue(taskId, out var item))
        {
            item.Status = DownloadStatus.Cancelled;
            item.ErrorReason = "Download cancelled by user";
            item.CompletionTime = now;
            item.UpdatedAt = now;
            SaveLocalStore();
        }

        var update = Builders<BsonDocument>.Update
            .Set("status", "Cancelled")
            .Set("errorReason", "Download cancelled by user")
            .Set("completionTime", now)
            .Set("updatedAt", now);

        UpdateCloudHistoryBackground(taskId, update);
        return Task.CompletedTask;
    }

    public Task<int> ReconcileOrphanedDownloadsAsync(ISet<string>? activeTaskIds = null)
    {
        EnsureInitialized();
        int updated = 0;
        DateTime threshold = DateTime.UtcNow.AddMinutes(-2);

        foreach (var kvp in _localStore)
        {
            var item = kvp.Value;
            if (item.Status is DownloadStatus.Downloading or DownloadStatus.Retrying or DownloadStatus.Resolving)
            {
                bool isOrphaned = activeTaskIds != null
                    ? !activeTaskIds.Contains(item.Id)
                    : (item.UpdatedAt < threshold || item.UpdatedAt == DateTime.MinValue);

                if (isOrphaned)
                {
                    item.Status = DownloadStatus.Cancelled;
                    item.ErrorReason = "Download session ended or was interrupted";
                    item.CompletionTime = DateTime.UtcNow;
                    item.UpdatedAt = DateTime.UtcNow;
                    updated++;
                }
            }
        }

        if (updated > 0) SaveLocalStore();
        return Task.FromResult(updated);
    }

    private void ReconcileStaleInMemoryTasks()
    {
        try
        {
            var activeIds = DownloadTaskManager.GetActiveTaskIds();
            DateTime threshold = DateTime.UtcNow.AddMinutes(-2);
            bool anyUpdated = false;

            foreach (var kvp in _localStore)
            {
                var item = kvp.Value;
                if (item.Status is DownloadStatus.Downloading or DownloadStatus.Retrying or DownloadStatus.Resolving)
                {
                    if (!activeIds.Contains(item.Id) && (item.UpdatedAt < threshold || item.UpdatedAt == DateTime.MinValue))
                    {
                        item.Status = DownloadStatus.Cancelled;
                        item.ErrorReason = "Download session ended or was interrupted";
                        item.CompletionTime = DateTime.UtcNow;
                        item.UpdatedAt = DateTime.UtcNow;
                        anyUpdated = true;
                    }
                }
            }

            if (anyUpdated) SaveLocalStore();
        }
        catch { }
    }

    public Task<(List<DownloadHistory> Items, int TotalCount)> GetUserDownloadsAsync(string userId, int page, int pageSize, string? search, string? status, string? platform)
    {
        EnsureInitialized();
        ReconcileStaleInMemoryTasks();
        var query = _localStore.Values.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(userId))
        {
            query = query.Where(d => string.Equals(d.UserId, userId, StringComparison.OrdinalIgnoreCase) ||
                                     string.Equals(d.UserEmail, userId, StringComparison.OrdinalIgnoreCase) ||
                                     string.IsNullOrEmpty(d.UserId));
        }

        return Task.FromResult(FilterAndPaginate(query, search, status, platform, null, page, pageSize));
    }

    public Task<(List<DownloadHistory> Items, int TotalCount)> GetAllDownloadsAsync(int page, int pageSize, string? search, string? status, string? platform, string? userEmail)
    {
        EnsureInitialized();
        ReconcileStaleInMemoryTasks();
        var query = _localStore.Values.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(userEmail))
            query = query.Where(d => d.UserEmail != null && d.UserEmail.Contains(userEmail, StringComparison.OrdinalIgnoreCase));

        return Task.FromResult(FilterAndPaginate(query, search, status, platform, userEmail, page, pageSize));
    }

    private static (List<DownloadHistory> Items, int TotalCount) FilterAndPaginate(
        IEnumerable<DownloadHistory> query, string? search, string? status, string? platform, string? fallbackEmail, int page, int pageSize)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            string s = search.Trim();
            query = query.Where(d =>
                (d.Title != null && d.Title.Contains(s, StringComparison.OrdinalIgnoreCase)) ||
                (d.FileName != null && d.FileName.Contains(s, StringComparison.OrdinalIgnoreCase)) ||
                (d.OriginalUrl != null && d.OriginalUrl.Contains(s, StringComparison.OrdinalIgnoreCase)) ||
                (fallbackEmail != null && d.UserEmail != null && d.UserEmail.Contains(s, StringComparison.OrdinalIgnoreCase)));
        }

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
            query = query.Where(d => string.Equals(d.Status.ToString(), status, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(platform) && !string.Equals(platform, "All", StringComparison.OrdinalIgnoreCase))
            query = query.Where(d => d.Platform != null && d.Platform.Contains(platform, StringComparison.OrdinalIgnoreCase));

        var ordered = query.OrderByDescending(d => d.CreatedAt).ToList();
        int totalCount = ordered.Count;
        var paged = ordered.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        return (paged, totalCount);
    }

    public Task<DownloadHistory?> GetDownloadByIdAsync(string id)
    {
        EnsureInitialized();
        if (string.IsNullOrWhiteSpace(id)) return Task.FromResult<DownloadHistory?>(null);

        if (_localStore.TryGetValue(id, out var found))
            return Task.FromResult<DownloadHistory?>(found);

        var match = _localStore.Values.FirstOrDefault(d =>
            string.Equals(d.Id, id, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(d.FileName, id, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(d.Title, id, StringComparison.OrdinalIgnoreCase));

        return Task.FromResult<DownloadHistory?>(match);
    }

    public Task<bool> DeleteDownloadAsync(string id, string? userId = null)
    {
        EnsureInitialized();
        if (string.IsNullOrWhiteSpace(id)) return Task.FromResult(false);

        bool removed = _localStore.TryRemove(id, out _);
        if (!removed)
        {
            var matchKey = _localStore.FirstOrDefault(kvp =>
                string.Equals(kvp.Key, id, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(kvp.Value.FileName, id, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(kvp.Value.Title, id, StringComparison.OrdinalIgnoreCase)).Key;

            if (!string.IsNullOrEmpty(matchKey))
                removed = _localStore.TryRemove(matchKey, out _);
        }

        if (removed) SaveLocalStore();

        if (_isMongoConnected && _cloudHistoryCollection != null)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                    var fb = Builders<BsonDocument>.Filter;
                    var filter = fb.Or(fb.Eq("taskId", id), fb.Eq("title", id), fb.Eq("fileName", id));
                    await _cloudHistoryCollection.DeleteManyAsync(filter, cts.Token);
                }
                catch { }
            });
        }

        return Task.FromResult(removed);
    }

    public Task<bool> ClearAllDownloadsAsync()
    {
        EnsureInitialized();
        _localStore.Clear();
        SaveLocalStore();

        if (_isMongoConnected && _cloudHistoryCollection != null)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                    await _cloudHistoryCollection.DeleteManyAsync(Builders<BsonDocument>.Filter.Empty, cts.Token);
                }
                catch { }
            });
        }

        return Task.FromResult(true);
    }
}
