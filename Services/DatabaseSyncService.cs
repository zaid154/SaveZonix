using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using SaveZonix.Models;
using StreamHelper.Data;

namespace SaveZonix.Services;

public interface IDatabaseSyncService
{
    Task<string> GetActiveProviderAsync();
    Task<bool> SetActiveProviderAsync(string provider);
    Task<(bool MongoConnected, bool SqlConnected, string MongoDbName, long MongoDownloadsCount, int SqlDownloadsCount, long MongoUsersCount, int SqlUsersCount)> GetStatusAsync();
    Task<(int UsersSynced, int DownloadsSynced, int SettingsSynced, string Message)> SyncAllDataAsync();
}

public class DatabaseSyncService : IDatabaseSyncService
{
    private readonly AppDbContext _context;
    private readonly UserManager<AppUser> _userManager;
    private readonly IConfiguration _config;
    private readonly ILogger<DatabaseSyncService> _logger;
    private readonly IMongoDatabase? _mongoDb;
    private readonly bool _isMongoConfigured;

    public DatabaseSyncService(
        AppDbContext context,
        UserManager<AppUser> userManager,
        IConfiguration config,
        ILogger<DatabaseSyncService> logger)
    {
        _context = context;
        _userManager = userManager;
        _config = config;
        _logger = logger;

        try
        {
            string connStr = config["MongoDb:ConnectionString"]
                ?? config.GetConnectionString("MongoDb")
                ?? "mongodb://127.0.0.1:27017";
            string dbName = config["MongoDb:DatabaseName"] ?? "SaveZonixDb";

            var mongoSettings = MongoClientSettings.FromConnectionString(connStr);
            mongoSettings.ServerSelectionTimeout = TimeSpan.FromSeconds(5);
            mongoSettings.ConnectTimeout = TimeSpan.FromSeconds(5);

            var client = new MongoClient(mongoSettings);
            _mongoDb = client.GetDatabase(dbName);
            _isMongoConfigured = true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("MongoDB connection initialization warning: {Message}", ex.Message);
            _isMongoConfigured = false;
        }
    }

    public async Task<string> GetActiveProviderAsync()
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

    public async Task<bool> SetActiveProviderAsync(string provider)
    {
        string normalized = provider.Equals("SQL", StringComparison.OrdinalIgnoreCase) || provider.Equals("SQLite", StringComparison.OrdinalIgnoreCase)
            ? "SQL"
            : "MongoDB";

        try
        {
            var setting = await _context.AdminSettings.FirstOrDefaultAsync(s => s.Key == "DatabaseProvider");
            if (setting == null)
            {
                _context.AdminSettings.Add(new AdminSetting
                {
                    Key = "DatabaseProvider",
                    Value = normalized,
                    Description = "Active Primary Database Provider (MongoDB / SQL)",
                    Category = "System",
                    UpdatedAt = DateTime.UtcNow
                });
            }
            else
            {
                setting.Value = normalized;
                setting.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("DatabaseProvider successfully changed to: {Provider}", normalized);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError("Failed to update DatabaseProvider: {Message}", ex.Message);
            return false;
        }
    }

    public async Task<(bool MongoConnected, bool SqlConnected, string MongoDbName, long MongoDownloadsCount, int SqlDownloadsCount, long MongoUsersCount, int SqlUsersCount)> GetStatusAsync()
    {
        bool sqlConnected = false;
        int sqlDownloadsCount = 0;
        int sqlUsersCount = 0;

        try
        {
            sqlConnected = await _context.Database.CanConnectAsync();
            if (sqlConnected)
            {
                sqlDownloadsCount = await _context.DownloadHistories.CountAsync();
                sqlUsersCount = await _userManager.Users.CountAsync();
            }
        }
        catch { }

        bool mongoConnected = false;
        long mongoDownloadsCount = 0;
        long mongoUsersCount = 0;
        string dbName = _config["MongoDb:DatabaseName"] ?? "SaveZonixDb";

        if (_isMongoConfigured && _mongoDb != null)
        {
            try
            {
                var pingDoc = await _mongoDb.RunCommandAsync((Command<BsonDocument>)"{ping:1}");
                mongoConnected = pingDoc != null;

                if (mongoConnected)
                {
                    var dlCollection = _mongoDb.GetCollection<DownloadRecord>("downloads");
                    mongoDownloadsCount = await dlCollection.CountDocumentsAsync(_ => true);

                    var usrCollection = _mongoDb.GetCollection<SaveZonixUser>("users");
                    mongoUsersCount = await usrCollection.CountDocumentsAsync(_ => true);
                }
            }
            catch { }
        }

        return (mongoConnected, sqlConnected, dbName, mongoDownloadsCount, sqlDownloadsCount, mongoUsersCount, sqlUsersCount);
    }

    public async Task<(int UsersSynced, int DownloadsSynced, int SettingsSynced, string Message)> SyncAllDataAsync()
    {
        if (!_isMongoConfigured || _mongoDb == null)
        {
            return (0, 0, 0, "MongoDB is not reachable or configured. Please check connection string.");
        }

        int usersSynced = 0;
        int downloadsSynced = 0;
        int settingsSynced = 0;

        try
        {
            var mongoUsersColl = _mongoDb.GetCollection<SaveZonixUser>("users");
            var mongoDownloadsColl = _mongoDb.GetCollection<DownloadRecord>("downloads");
            var mongoSettingsColl = _mongoDb.GetCollection<PlatformSettings>("settings");

            // ==========================================
            // 1. BI-DIRECTIONAL USERS & CREDENTIALS SYNC
            // ==========================================
            var sqlUsers = await _userManager.Users.ToListAsync();
            var mongoUsers = await mongoUsersColl.Find(_ => true).ToListAsync();

            var mongoUserByEmail = mongoUsers
                .Where(u => !string.IsNullOrEmpty(u.Email))
                .ToDictionary(u => u.Email.ToLowerInvariant(), u => u);

            var sqlUserByEmail = sqlUsers
                .Where(u => !string.IsNullOrEmpty(u.Email))
                .ToDictionary(u => u.Email.ToLowerInvariant(), u => u);

            // 1a. SQL -> MongoDB
            foreach (var sUser in sqlUsers)
            {
                if (string.IsNullOrEmpty(sUser.Email)) continue;
                string emailKey = sUser.Email.ToLowerInvariant();

                var roles = await _userManager.GetRolesAsync(sUser);
                string primaryRole = roles.FirstOrDefault() ?? "User";

                if (mongoUserByEmail.TryGetValue(emailKey, out var existingMUser))
                {
                    // Update credentials and metadata if changed
                    bool changed = false;
                    if (!string.IsNullOrEmpty(sUser.PasswordHash) && existingMUser.PasswordHash != sUser.PasswordHash)
                    {
                        existingMUser.PasswordHash = sUser.PasswordHash;
                        changed = true;
                    }
                    if (existingMUser.FullName != sUser.FullName && !string.IsNullOrEmpty(sUser.FullName))
                    {
                        existingMUser.FullName = sUser.FullName;
                        changed = true;
                    }
                    if (existingMUser.Role != primaryRole)
                    {
                        existingMUser.Role = primaryRole;
                        changed = true;
                    }

                    if (changed)
                    {
                        await mongoUsersColl.ReplaceOneAsync(u => u.Id == existingMUser.Id, existingMUser);
                        usersSynced++;
                    }
                }
                else
                {
                    // Insert into MongoDB
                    var newMUser = new SaveZonixUser
                    {
                        Email = sUser.Email,
                        FullName = string.IsNullOrEmpty(sUser.FullName) ? (sUser.UserName ?? sUser.Email) : sUser.FullName,
                        PasswordHash = sUser.PasswordHash,
                        Role = primaryRole,
                        IsActive = sUser.IsActive,
                        CreatedAt = sUser.CreatedAt
                    };
                    await mongoUsersColl.InsertOneAsync(newMUser);
                    mongoUserByEmail[emailKey] = newMUser;
                    usersSynced++;
                }
            }

            // 1b. MongoDB -> SQL
            foreach (var mUser in mongoUsers)
            {
                if (string.IsNullOrEmpty(mUser.Email)) continue;
                string emailKey = mUser.Email.ToLowerInvariant();

                if (!sqlUserByEmail.ContainsKey(emailKey))
                {
                    var newSqlUser = new AppUser
                    {
                        UserName = mUser.Email,
                        Email = mUser.Email,
                        FullName = mUser.FullName,
                        PasswordHash = mUser.PasswordHash,
                        EmailConfirmed = true,
                        IsActive = mUser.IsActive,
                        CreatedAt = mUser.CreatedAt,
                        SecurityStamp = Guid.NewGuid().ToString()
                    };

                    var createRes = await _userManager.CreateAsync(newSqlUser);
                    if (createRes.Succeeded)
                    {
                        string role = string.IsNullOrEmpty(mUser.Role) ? "User" : mUser.Role;
                        try { await _userManager.AddToRoleAsync(newSqlUser, role); } catch { }
                        sqlUserByEmail[emailKey] = newSqlUser;
                        usersSynced++;
                    }
                }
            }

            // ==========================================
            // 2. BI-DIRECTIONAL DOWNLOADS HISTORY SYNC
            // ==========================================
            var sqlDownloads = await _context.DownloadHistories.ToListAsync();
            var mongoDownloads = await mongoDownloadsColl.Find(_ => true).ToListAsync();

            var sqlDlById = sqlDownloads
                .Where(d => !string.IsNullOrEmpty(d.Id))
                .ToDictionary(d => d.Id, d => d);

            var mongoDlByTask = mongoDownloads
                .Where(d => !string.IsNullOrEmpty(d.TaskId) || !string.IsNullOrEmpty(d.Id))
                .ToDictionary(d => string.IsNullOrEmpty(d.TaskId) ? d.Id! : d.TaskId, d => d);

            // 2a. SQL -> MongoDB
            foreach (var sDl in sqlDownloads)
            {
                string key = sDl.Id;
                if (!mongoDlByTask.ContainsKey(key))
                {
                    var newMRecord = new DownloadRecord
                    {
                        TaskId = key,
                        UserId = sDl.UserId,
                        UserEmail = sDl.UserEmail,
                        VideoTitle = sDl.Title,
                        OriginalUrl = sDl.OriginalUrl,
                        ThumbnailUrl = sDl.ThumbnailUrl,
                        Platform = sDl.Platform,
                        Quality = sDl.Quality,
                        FileSizeBytes = sDl.FileSize,
                        FormattedSize = sDl.FormattedFileSize,
                        DurationSeconds = sDl.DurationSeconds,
                        DownloadSpeedMBps = sDl.AverageSpeedMBps,
                        PeakSpeedMBps = sDl.PeakSpeedMBps,
                        TimeTakenSeconds = sDl.DownloadDurationSeconds,
                        Status = sDl.Status.ToString(),
                        ValidationStatus = sDl.ValidationStatus,
                        ValidationDetails = sDl.ValidationDetails,
                        AudioVideoDetails = sDl.AudioVideoDetails,
                        CreatedAt = sDl.CreatedAt
                    };

                    await mongoDownloadsColl.InsertOneAsync(newMRecord);
                    mongoDlByTask[key] = newMRecord;
                    downloadsSynced++;
                }
            }

            // 2b. MongoDB -> SQL
            foreach (var mDl in mongoDownloads)
            {
                string key = string.IsNullOrEmpty(mDl.TaskId) ? (mDl.Id ?? Guid.NewGuid().ToString("N")) : mDl.TaskId;
                if (!sqlDlById.ContainsKey(key))
                {
                    DownloadStatus parsedStatus = DownloadStatus.Completed;
                    if (Enum.TryParse<DownloadStatus>(mDl.Status, true, out var st))
                    {
                        parsedStatus = st;
                    }

                    var newSDl = new DownloadHistory
                    {
                        Id = key,
                        UserId = mDl.UserId,
                        UserEmail = mDl.UserEmail,
                        Title = string.IsNullOrEmpty(mDl.VideoTitle) ? "Video" : mDl.VideoTitle,
                        FileName = "video.mp4",
                        OriginalUrl = mDl.OriginalUrl ?? "",
                        ThumbnailUrl = mDl.ThumbnailUrl,
                        Platform = string.IsNullOrEmpty(mDl.Platform) ? "Web Stream" : mDl.Platform,
                        MediaType = "Video",
                        Format = "MP4",
                        Quality = string.IsNullOrEmpty(mDl.Quality) ? "1080p Full HD" : mDl.Quality,
                        DurationSeconds = mDl.DurationSeconds,
                        FileSize = mDl.FileSizeBytes,
                        AverageSpeedMBps = mDl.DownloadSpeedMBps,
                        PeakSpeedMBps = mDl.PeakSpeedMBps,
                        DownloadDurationSeconds = mDl.TimeTakenSeconds,
                        Status = parsedStatus,
                        ValidationStatus = string.IsNullOrEmpty(mDl.ValidationStatus) ? "Passed" : mDl.ValidationStatus,
                        ValidationDetails = mDl.ValidationDetails ?? "",
                        AudioVideoDetails = mDl.AudioVideoDetails ?? "",
                        CreatedAt = mDl.CreatedAt,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _context.DownloadHistories.Add(newSDl);
                    sqlDlById[key] = newSDl;
                    downloadsSynced++;
                }
            }

            if (downloadsSynced > 0)
            {
                await _context.SaveChangesAsync();
            }

            // ==========================================
            // 3. SETTINGS SYNC
            // ==========================================
            var currentMongoSettings = await mongoSettingsColl.Find(_ => true).FirstOrDefaultAsync();
            if (currentMongoSettings == null)
            {
                currentMongoSettings = new PlatformSettings();
                await mongoSettingsColl.InsertOneAsync(currentMongoSettings);
                settingsSynced++;
            }

            return (usersSynced, downloadsSynced, settingsSynced, "Success");
        }
        catch (Exception ex)
        {
            _logger.LogError("Bi-directional sync failed: {Message}", ex.Message);
            return (usersSynced, downloadsSynced, settingsSynced, $"Error: {ex.Message}");
        }
    }
}
