using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using MongoDB.Bson;
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
    Task<bool> ClearAllDownloadsAsync();
    string SanitizeUrl(string url);
}

public class DownloadHistoryService : IDownloadHistoryService
{
    private readonly IMongoDatabase? _mongoDb;
    private readonly IMongoCollection<BsonDocument>? _cloudHistoryCollection;
    private readonly IMongoCollection<DownloadRecord>? _legacyDownloadsCollection;
    private readonly bool _isMongoConnected;

    public DownloadHistoryService(IMongoDatabase? mongoDb = null, Microsoft.Extensions.Configuration.IConfiguration? config = null)
    {
        if (mongoDb != null)
        {
            _mongoDb = mongoDb;
            _cloudHistoryCollection = _mongoDb.GetCollection<BsonDocument>("downloadhistories");
            _legacyDownloadsCollection = _mongoDb.GetCollection<DownloadRecord>("downloads");
            _isMongoConnected = true;
        }
        else if (config != null)
        {
            try
            {
                string connStr = config["MongoDb:ConnectionString"]
                    ?? config.GetConnectionString("MongoDb")
                    ?? "mongodb+srv://mohdzaid620268_db_user:1liyz6EzQSI8HeU8@cluster0.u2wwzoi.mongodb.net/SaveZonixDb?retryWrites=true&w=majority";
                string dbName = config["MongoDb:DatabaseName"] ?? "SaveZonixDb";

                var mongoSettings = MongoClientSettings.FromConnectionString(connStr);
                mongoSettings.ServerSelectionTimeout = TimeSpan.FromSeconds(5);
                mongoSettings.ConnectTimeout = TimeSpan.FromSeconds(5);

                var client = new MongoClient(mongoSettings);
                _mongoDb = client.GetDatabase(dbName);
                _cloudHistoryCollection = _mongoDb.GetCollection<BsonDocument>("downloadhistories");
                _legacyDownloadsCollection = _mongoDb.GetCollection<DownloadRecord>("downloads");
                _isMongoConnected = true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DownloadHistoryService Init Notice] {ex.Message}");
                _isMongoConnected = false;
            }
        }
    }

    private static DownloadHistory MapBsonToHistory(BsonDocument doc)
    {
        string taskId = doc.Contains("taskId") && !doc["taskId"].IsBsonNull ? doc["taskId"].AsString :
                       (doc.Contains("TaskId") && !doc["TaskId"].IsBsonNull ? doc["TaskId"].AsString :
                       (doc.Contains("_id") ? doc["_id"].ToString() ?? Guid.NewGuid().ToString("N") : Guid.NewGuid().ToString("N")));

        string title = doc.Contains("title") && !doc["title"].IsBsonNull ? doc["title"].AsString :
                      (doc.Contains("VideoTitle") && !doc["VideoTitle"].IsBsonNull ? doc["VideoTitle"].AsString :
                      (doc.Contains("Title") && !doc["Title"].IsBsonNull ? doc["Title"].AsString : "Video Stream"));

        string fileName = doc.Contains("fileName") && !doc["fileName"].IsBsonNull ? doc["fileName"].AsString :
                         (doc.Contains("FileName") && !doc["FileName"].IsBsonNull ? doc["FileName"].AsString : $"{title}.mp4");

        string originalUrl = doc.Contains("originalUrl") && !doc["originalUrl"].IsBsonNull ? doc["originalUrl"].AsString :
                            (doc.Contains("OriginalUrl") && !doc["OriginalUrl"].IsBsonNull ? doc["OriginalUrl"].AsString : "");

        string? thumbnailUrl = doc.Contains("thumbnailUrl") && !doc["thumbnailUrl"].IsBsonNull ? doc["thumbnailUrl"].AsString :
                              (doc.Contains("ThumbnailUrl") && !doc["ThumbnailUrl"].IsBsonNull ? doc["ThumbnailUrl"].AsString : null);

        string platform = doc.Contains("platform") && !doc["platform"].IsBsonNull ? doc["platform"].AsString :
                         (doc.Contains("Platform") && !doc["Platform"].IsBsonNull ? doc["Platform"].AsString : "Web Stream");

        string quality = doc.Contains("quality") && !doc["quality"].IsBsonNull ? doc["quality"].AsString :
                        (doc.Contains("Quality") && !doc["Quality"].IsBsonNull ? doc["Quality"].AsString : "1080p Full HD");

        string format = doc.Contains("format") && !doc["format"].IsBsonNull ? doc["format"].AsString :
                       (doc.Contains("Format") && !doc["Format"].IsBsonNull ? doc["Format"].AsString : "MP4");

        long fileSize = 0;
        if (doc.Contains("fileSize") && !doc["fileSize"].IsBsonNull) fileSize = doc["fileSize"].ToInt64();
        else if (doc.Contains("FileSizeBytes") && !doc["FileSizeBytes"].IsBsonNull) fileSize = doc["FileSizeBytes"].ToInt64();
        else if (doc.Contains("FileSize") && !doc["FileSize"].IsBsonNull) fileSize = doc["FileSize"].ToInt64();

        long downloadedBytes = fileSize;
        if (doc.Contains("downloadedBytes") && !doc["downloadedBytes"].IsBsonNull) downloadedBytes = doc["downloadedBytes"].ToInt64();
        else if (doc.Contains("DownloadedBytes") && !doc["DownloadedBytes"].IsBsonNull) downloadedBytes = doc["DownloadedBytes"].ToInt64();

        double avgSpeed = 0;
        if (doc.Contains("downloadSpeedMBps") && !doc["downloadSpeedMBps"].IsBsonNull) avgSpeed = doc["downloadSpeedMBps"].ToDouble();
        else if (doc.Contains("DownloadSpeedMBps") && !doc["DownloadSpeedMBps"].IsBsonNull) avgSpeed = doc["DownloadSpeedMBps"].ToDouble();
        else if (doc.Contains("AverageSpeedMBps") && !doc["AverageSpeedMBps"].IsBsonNull) avgSpeed = doc["AverageSpeedMBps"].ToDouble();

        double peakSpeed = avgSpeed;
        if (doc.Contains("peakSpeedMBps") && !doc["peakSpeedMBps"].IsBsonNull) peakSpeed = doc["peakSpeedMBps"].ToDouble();
        else if (doc.Contains("PeakSpeedMBps") && !doc["PeakSpeedMBps"].IsBsonNull) peakSpeed = doc["PeakSpeedMBps"].ToDouble();

        string statusStr = doc.Contains("status") && !doc["status"].IsBsonNull ? doc["status"].AsString :
                          (doc.Contains("Status") && !doc["Status"].IsBsonNull ? doc["Status"].AsString : "Completed");

        DownloadStatus parsedStatus = DownloadStatus.Completed;
        if (Enum.TryParse<DownloadStatus>(statusStr, true, out var st))
        {
            parsedStatus = st;
        }

        string? userId = doc.Contains("userId") && !doc["userId"].IsBsonNull ? doc["userId"].ToString() :
                        (doc.Contains("UserId") && !doc["UserId"].IsBsonNull ? doc["UserId"].ToString() : null);

        string? userEmail = doc.Contains("userEmail") && !doc["userEmail"].IsBsonNull ? doc["userEmail"].AsString :
                           (doc.Contains("UserEmail") && !doc["UserEmail"].IsBsonNull ? doc["UserEmail"].AsString : null);

        string? userName = doc.Contains("userName") && !doc["userName"].IsBsonNull ? doc["userName"].AsString :
                          (doc.Contains("UserName") && !doc["UserName"].IsBsonNull ? doc["UserName"].AsString : null);

        DateTime createdAt = DateTime.UtcNow;
        if (doc.Contains("createdAt") && !doc["createdAt"].IsBsonNull) createdAt = doc["createdAt"].ToUniversalTime();
        else if (doc.Contains("CreatedAt") && !doc["CreatedAt"].IsBsonNull) createdAt = doc["CreatedAt"].ToUniversalTime();

        DateTime startTime = createdAt;
        if (doc.Contains("startTime") && !doc["startTime"].IsBsonNull) startTime = doc["startTime"].ToUniversalTime();
        else if (doc.Contains("StartTime") && !doc["StartTime"].IsBsonNull) startTime = doc["StartTime"].ToUniversalTime();

        DateTime? completionTime = null;
        if (doc.Contains("completionTime") && !doc["completionTime"].IsBsonNull) completionTime = doc["completionTime"].ToUniversalTime();
        else if (doc.Contains("CompletionTime") && !doc["CompletionTime"].IsBsonNull) completionTime = doc["CompletionTime"].ToUniversalTime();

        double totalDuration = 0;
        if (doc.Contains("downloadDurationSeconds") && !doc["downloadDurationSeconds"].IsBsonNull) totalDuration = doc["downloadDurationSeconds"].ToDouble();
        else if (doc.Contains("timeTakenSeconds") && !doc["timeTakenSeconds"].IsBsonNull) totalDuration = doc["timeTakenSeconds"].ToDouble();
        else if (doc.Contains("TimeTakenSeconds") && !doc["TimeTakenSeconds"].IsBsonNull) totalDuration = doc["TimeTakenSeconds"].ToDouble();

        string strategy = doc.Contains("downloadStrategy") && !doc["downloadStrategy"].IsBsonNull ? doc["downloadStrategy"].AsString :
                         (doc.Contains("DownloadStrategy") && !doc["DownloadStrategy"].IsBsonNull ? doc["DownloadStrategy"].AsString : "HLS Multi-Thread");

        string validationStatus = doc.Contains("validationStatus") && !doc["validationStatus"].IsBsonNull ? doc["validationStatus"].AsString :
                                 (doc.Contains("ValidationStatus") && !doc["ValidationStatus"].IsBsonNull ? doc["ValidationStatus"].AsString : "Passed");

        string validationDetails = doc.Contains("validationDetails") && !doc["validationDetails"].IsBsonNull ? doc["validationDetails"].AsString :
                                  (doc.Contains("ValidationDetails") && !doc["ValidationDetails"].IsBsonNull ? doc["ValidationDetails"].AsString : "");

        string audioVideoDetails = doc.Contains("audioVideoDetails") && !doc["audioVideoDetails"].IsBsonNull ? doc["audioVideoDetails"].AsString :
                                  (doc.Contains("AudioVideoDetails") && !doc["AudioVideoDetails"].IsBsonNull ? doc["AudioVideoDetails"].AsString : "");

        string? errorReason = doc.Contains("errorReason") && !doc["errorReason"].IsBsonNull ? doc["errorReason"].AsString :
                             (doc.Contains("errorMessage") && !doc["errorMessage"].IsBsonNull ? doc["errorMessage"].AsString :
                             (doc.Contains("ErrorReason") && !doc["ErrorReason"].IsBsonNull ? doc["ErrorReason"].AsString : null));

        int durationSeconds = 0;
        if (doc.Contains("durationSeconds") && !doc["durationSeconds"].IsBsonNull) durationSeconds = doc["durationSeconds"].ToInt32();
        else if (doc.Contains("DurationSeconds") && !doc["DurationSeconds"].IsBsonNull) durationSeconds = doc["DurationSeconds"].ToInt32();

        int threadsUsed = 64;
        if (doc.Contains("threadsUsed") && !doc["threadsUsed"].IsBsonNull) threadsUsed = doc["threadsUsed"].ToInt32();
        else if (doc.Contains("ThreadsUsed") && !doc["ThreadsUsed"].IsBsonNull) threadsUsed = doc["ThreadsUsed"].ToInt32();

        return new DownloadHistory
        {
            Id = taskId,
            UserId = userId,
            UserEmail = userEmail,
            UserName = userName,
            Title = title,
            FileName = fileName,
            OriginalUrl = originalUrl,
            ThumbnailUrl = thumbnailUrl,
            Platform = platform,
            MediaType = "Video",
            Format = format,
            Quality = quality,
            DurationSeconds = durationSeconds,
            FileSize = fileSize,
            DownloadedBytes = downloadedBytes,
            AverageSpeedMBps = avgSpeed,
            PeakSpeedMBps = peakSpeed,
            DownloadDurationSeconds = totalDuration,
            Status = parsedStatus,
            StartTime = startTime,
            CompletionTime = completionTime,
            ThreadsUsed = threadsUsed,
            DownloadStrategy = strategy,
            ValidationStatus = validationStatus,
            ValidationDetails = validationDetails,
            AudioVideoDetails = audioVideoDetails,
            ErrorReason = errorReason,
            CreatedAt = createdAt,
            UpdatedAt = DateTime.UtcNow
        };
    }

    public string SanitizeUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return string.Empty;
        try
        {
            if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
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

        if (_cloudHistoryCollection != null)
        {
            try
            {
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
                    .Set("userId", userId ?? (object)BsonNull.Value)
                    .Set("userEmail", userEmail ?? "Guest")
                    .Set("userName", userName ?? "Guest")
                    .Set("ipAddress", "127.0.0.1")
                    .Set("downloadStrategy", strategy)
                    .Set("threadsUsed", threads)
                    .Set("durationSeconds", durationSeconds)
                    .Set("startTime", now)
                    .Set("updatedAt", now)
                    .SetOnInsert("createdAt", now);

                await _cloudHistoryCollection.UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MongoDB Cloud Download Record Error] {ex.Message}");
            }
        }

        if (_legacyDownloadsCollection != null)
        {
            try
            {
                var legacyRecord = new DownloadRecord
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
                    StartTime = now,
                    Status = "Downloading",
                    CreatedAt = now
                };
                await _legacyDownloadsCollection.ReplaceOneAsync(
                    x => x.TaskId == taskId,
                    legacyRecord,
                    new ReplaceOptions { IsUpsert = true });
            }
            catch { }
        }

        return download;
    }

    public async Task UpdateProgressAsync(string taskId, DownloadStatus status, long downloadedBytes, double avgSpeed, double peakSpeed, double elapsedSeconds)
    {
        if (_cloudHistoryCollection == null) return;

        try
        {
            var filter = Builders<BsonDocument>.Filter.Eq("taskId", taskId);
            var update = Builders<BsonDocument>.Update
                .Set("status", status.ToString())
                .Set("downloadedBytes", downloadedBytes)
                .Set("downloadSpeedMBps", avgSpeed)
                .Set("peakSpeedMBps", peakSpeed)
                .Set("downloadDurationSeconds", elapsedSeconds)
                .Set("updatedAt", DateTime.UtcNow);

            await _cloudHistoryCollection.UpdateOneAsync(filter, update);
        }
        catch { }
    }

    public async Task MarkCompletedAsync(string taskId, long finalSize, double avgSpeed, double peakSpeed, double totalSeconds)
    {
        await MarkCompletedWithValidationAsync(taskId, finalSize, avgSpeed, peakSpeed, totalSeconds, "Passed", "Verified media structure", 0, "Standard Container");
    }

    public async Task MarkCompletedWithValidationAsync(string taskId, long finalSize, double avgSpeed, double peakSpeed, double totalSeconds, string validationStatus, string validationDetails, double probedDuration, string audioVideoDetails)
    {
        DateTime now = DateTime.UtcNow;

        if (_cloudHistoryCollection != null)
        {
            try
            {
                var filter = Builders<BsonDocument>.Filter.Eq("taskId", taskId);
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

                await _cloudHistoryCollection.UpdateOneAsync(filter, update);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MongoDB MarkCompleted Error] {ex.Message}");
            }
        }

        if (_legacyDownloadsCollection != null)
        {
            try
            {
                var update = Builders<DownloadRecord>.Update
                    .Set(x => x.Status, "Completed")
                    .Set(x => x.FileSizeBytes, finalSize)
                    .Set(x => x.DownloadSpeedMBps, avgSpeed)
                    .Set(x => x.PeakSpeedMBps, peakSpeed)
                    .Set(x => x.TimeTakenSeconds, totalSeconds)
                    .Set(x => x.CompletionTime, now)
                    .Set(x => x.ValidationStatus, validationStatus)
                    .Set(x => x.ValidationDetails, validationDetails)
                    .Set(x => x.AudioVideoDetails, audioVideoDetails);

                await _legacyDownloadsCollection.UpdateOneAsync(x => x.TaskId == taskId, update);
            }
            catch { }
        }
    }

    public async Task MarkCorruptedAsync(string taskId, string errorReason, string validationStatus, string validationDetails, int retryCount)
    {
        if (_cloudHistoryCollection == null) return;

        try
        {
            var filter = Builders<BsonDocument>.Filter.Eq("taskId", taskId);
            var update = Builders<BsonDocument>.Update
                .Set("status", "Corrupted")
                .Set("errorReason", errorReason)
                .Set("validationStatus", validationStatus)
                .Set("validationDetails", validationDetails)
                .Set("retryCount", retryCount)
                .Set("completionTime", DateTime.UtcNow)
                .Set("updatedAt", DateTime.UtcNow);

            await _cloudHistoryCollection.UpdateOneAsync(filter, update);
        }
        catch { }
    }

    public async Task MarkRetryingAsync(string taskId, int retryCount, string retryReason)
    {
        if (_cloudHistoryCollection == null) return;

        try
        {
            var filter = Builders<BsonDocument>.Filter.Eq("taskId", taskId);
            var update = Builders<BsonDocument>.Update
                .Set("status", "Retrying")
                .Set("retryCount", retryCount)
                .Set("errorReason", $"Retry {retryCount}: {retryReason}")
                .Set("updatedAt", DateTime.UtcNow);

            await _cloudHistoryCollection.UpdateOneAsync(filter, update);
        }
        catch { }
    }

    public async Task MarkFailedAsync(string taskId, string errorReason)
    {
        DateTime now = DateTime.UtcNow;

        if (_cloudHistoryCollection != null)
        {
            try
            {
                var filter = Builders<BsonDocument>.Filter.Eq("taskId", taskId);
                var update = Builders<BsonDocument>.Update
                    .Set("status", "Failed")
                    .Set("errorReason", errorReason)
                    .Set("validationStatus", "Failed")
                    .Set("completionTime", now)
                    .Set("updatedAt", now);

                await _cloudHistoryCollection.UpdateOneAsync(filter, update);
            }
            catch { }
        }

        if (_legacyDownloadsCollection != null)
        {
            try
            {
                var update = Builders<DownloadRecord>.Update
                    .Set(x => x.Status, "Failed")
                    .Set(x => x.ErrorMessage, errorReason)
                    .Set(x => x.CompletionTime, now);

                await _legacyDownloadsCollection.UpdateOneAsync(x => x.TaskId == taskId, update);
            }
            catch { }
        }
    }

    public async Task MarkCancelledAsync(string taskId)
    {
        DateTime now = DateTime.UtcNow;

        if (_cloudHistoryCollection != null)
        {
            try
            {
                var filter = Builders<BsonDocument>.Filter.Eq("taskId", taskId);
                var update = Builders<BsonDocument>.Update
                    .Set("status", "Cancelled")
                    .Set("errorReason", "Download cancelled by user")
                    .Set("completionTime", now)
                    .Set("updatedAt", now);

                await _cloudHistoryCollection.UpdateOneAsync(filter, update);
            }
            catch { }
        }

        if (_legacyDownloadsCollection != null)
        {
            try
            {
                var update = Builders<DownloadRecord>.Update
                    .Set(x => x.Status, "Cancelled")
                    .Set(x => x.ErrorMessage, "Download cancelled by user")
                    .Set(x => x.CompletionTime, now);

                await _legacyDownloadsCollection.UpdateOneAsync(x => x.TaskId == taskId, update);
            }
            catch { }
        }
    }

    public async Task<int> ReconcileOrphanedDownloadsAsync(ISet<string>? activeTaskIds = null)
    {
        if (_cloudHistoryCollection == null) return 0;

        try
        {
            var fb = Builders<BsonDocument>.Filter;
            var filter = fb.In("status", new[] { "Downloading", "Retrying", "Resolving" });

            var activeDocs = await _cloudHistoryCollection.Find(filter).ToListAsync();
            int updated = 0;

            foreach (var doc in activeDocs)
            {
                string taskId = doc.Contains("taskId") && !doc["taskId"].IsBsonNull ? doc["taskId"].AsString :
                               (doc.Contains("_id") ? doc["_id"].ToString() ?? "" : "");

                if (string.IsNullOrEmpty(taskId) || activeTaskIds == null || !activeTaskIds.Contains(taskId))
                {
                    var update = Builders<BsonDocument>.Update
                        .Set("status", "Cancelled")
                        .Set("errorReason", "Download session ended or was interrupted")
                        .Set("completionTime", DateTime.UtcNow)
                        .Set("updatedAt", DateTime.UtcNow);

                    await _cloudHistoryCollection.UpdateOneAsync(fb.Eq("_id", doc["_id"]), update);
                    updated++;
                }
            }

            return updated;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ReconcileOrphanedDownloads Notice] {ex.Message}");
            return 0;
        }
    }

    public async Task<(List<DownloadHistory> Items, int TotalCount)> GetUserDownloadsAsync(string userId, int page, int pageSize, string? search, string? status, string? platform)
    {
        if (_cloudHistoryCollection == null) return (new List<DownloadHistory>(), 0);

        try
        {
            var fb = Builders<BsonDocument>.Filter;
            var filter = fb.Empty;

            if (!string.IsNullOrWhiteSpace(userId))
            {
                filter &= fb.Or(
                    fb.Eq("userId", userId),
                    fb.Eq("UserId", userId)
                );
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                var regex = new BsonRegularExpression(s, "i");
                filter &= fb.Or(
                    fb.Regex("title", regex),
                    fb.Regex("fileName", regex),
                    fb.Regex("originalUrl", regex),
                    fb.Regex("VideoTitle", regex)
                );
            }

            if (!string.IsNullOrWhiteSpace(status) && status != "All")
            {
                filter &= fb.Or(
                    fb.Eq("status", status),
                    fb.Eq("Status", status)
                );
            }

            if (!string.IsNullOrWhiteSpace(platform) && platform != "All")
            {
                filter &= fb.Or(
                    fb.Regex("platform", new BsonRegularExpression(platform, "i")),
                    fb.Regex("Platform", new BsonRegularExpression(platform, "i"))
                );
            }

            long totalCount = await _cloudHistoryCollection.CountDocumentsAsync(filter);
            var docs = await _cloudHistoryCollection.Find(filter)
                .Sort(Builders<BsonDocument>.Sort.Descending("createdAt"))
                .Skip((page - 1) * pageSize)
                .Limit(pageSize)
                .ToListAsync();

            var items = docs.Select(MapBsonToHistory).ToList();
            return (items, (int)totalCount);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetUserDownloadsAsync Notice] {ex.Message}");
            return (new List<DownloadHistory>(), 0);
        }
    }

    public async Task<(List<DownloadHistory> Items, int TotalCount)> GetAllDownloadsAsync(int page, int pageSize, string? search, string? status, string? platform, string? userEmail)
    {
        if (_cloudHistoryCollection == null) return (new List<DownloadHistory>(), 0);

        try
        {
            var fb = Builders<BsonDocument>.Filter;
            var filter = fb.Empty;

            if (!string.IsNullOrWhiteSpace(userEmail))
            {
                var emailRegex = new BsonRegularExpression(userEmail, "i");
                filter &= fb.Or(
                    fb.Regex("userEmail", emailRegex),
                    fb.Regex("UserEmail", emailRegex)
                );
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                var regex = new BsonRegularExpression(s, "i");
                filter &= fb.Or(
                    fb.Regex("title", regex),
                    fb.Regex("fileName", regex),
                    fb.Regex("originalUrl", regex),
                    fb.Regex("userEmail", regex),
                    fb.Regex("VideoTitle", regex)
                );
            }

            if (!string.IsNullOrWhiteSpace(status) && status != "All")
            {
                filter &= fb.Or(
                    fb.Eq("status", status),
                    fb.Eq("Status", status)
                );
            }

            if (!string.IsNullOrWhiteSpace(platform) && platform != "All")
            {
                filter &= fb.Or(
                    fb.Regex("platform", new BsonRegularExpression(platform, "i")),
                    fb.Regex("Platform", new BsonRegularExpression(platform, "i"))
                );
            }

            long totalCount = await _cloudHistoryCollection.CountDocumentsAsync(filter);
            var docs = await _cloudHistoryCollection.Find(filter)
                .Sort(Builders<BsonDocument>.Sort.Descending("createdAt"))
                .Skip((page - 1) * pageSize)
                .Limit(pageSize)
                .ToListAsync();

            var items = docs.Select(MapBsonToHistory).ToList();
            return (items, (int)totalCount);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetAllDownloadsAsync Notice] {ex.Message}");
            return (new List<DownloadHistory>(), 0);
        }
    }

    public async Task<DownloadHistory?> GetDownloadByIdAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id) || _cloudHistoryCollection == null) return null;

        try
        {
            var fb = Builders<BsonDocument>.Filter;
            var filters = new List<FilterDefinition<BsonDocument>>
            {
                fb.Eq("taskId", id),
                fb.Eq("TaskId", id)
            };

            if (ObjectId.TryParse(id, out var oid))
            {
                filters.Add(fb.Eq("_id", oid));
            }

            var doc = await _cloudHistoryCollection.Find(fb.Or(filters)).FirstOrDefaultAsync();
            return doc != null ? MapBsonToHistory(doc) : null;
        }
        catch
        {
            return null;
        }
    }

    public async Task<bool> DeleteDownloadAsync(string id, string? userId = null)
    {
        if (string.IsNullOrWhiteSpace(id)) return false;

        bool deleted = false;

        if (_cloudHistoryCollection != null)
        {
            try
            {
                var fb = Builders<BsonDocument>.Filter;
                var filters = new List<FilterDefinition<BsonDocument>>
                {
                    fb.Eq("taskId", id),
                    fb.Eq("title", id),
                    fb.Eq("fileName", id)
                };

                if (ObjectId.TryParse(id, out var oid))
                {
                    filters.Add(fb.Eq("_id", oid));
                }

                var filter = fb.Or(filters);
                if (!string.IsNullOrEmpty(userId))
                {
                    filter &= fb.Or(fb.Eq("userId", userId), fb.Eq("UserId", userId));
                }

                var res = await _cloudHistoryCollection.DeleteManyAsync(filter);
                deleted = res.DeletedCount > 0;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MongoDB Cloud Delete Error] {ex.Message}");
            }
        }

        if (_legacyDownloadsCollection != null)
        {
            try
            {
                var fb = Builders<DownloadRecord>.Filter;
                var filter = fb.Or(fb.Eq(x => x.TaskId, id), fb.Eq(x => x.VideoTitle, id));
                if (!string.IsNullOrEmpty(userId))
                {
                    filter &= fb.Eq(x => x.UserId, userId);
                }
                await _legacyDownloadsCollection.DeleteManyAsync(filter);
            }
            catch { }
        }

        return deleted;
    }

    public async Task<bool> ClearAllDownloadsAsync()
    {
        if (_cloudHistoryCollection != null)
        {
            try
            {
                await _cloudHistoryCollection.DeleteManyAsync(Builders<BsonDocument>.Filter.Empty);
            }
            catch { }
        }

        if (_legacyDownloadsCollection != null)
        {
            try
            {
                await _legacyDownloadsCollection.DeleteManyAsync(Builders<DownloadRecord>.Filter.Empty);
            }
            catch { }
        }

        return true;
    }
}
