using System.Collections.Concurrent;
using System.Text.Json;
using MongoDB.Driver;
using SaveZonix.Models;

namespace SaveZonix.Services;

public class MongoDbAnalyticsService : IDownloadAnalyticsService
{
    private readonly IConfiguration _config;
    private readonly ILogger<MongoDbAnalyticsService> _logger;
    private readonly IMongoDatabase? _database;
    private readonly IMongoCollection<DownloadRecord>? _downloadsCollection;
    private readonly IMongoCollection<SaveZonixUser>? _usersCollection;
    private readonly IMongoCollection<PlatformSettings>? _settingsCollection;
    private readonly IMongoCollection<SiteRule>? _siteRulesCollection;
    private readonly IMongoCollection<SecurityLog>? _securityLogsCollection;
    private readonly IMongoCollection<PlatformInfo>? _platformsCollection;
    private readonly bool _isMongoConnected = false;

    private static readonly ConcurrentBag<DownloadRecord> _cachedLogs = new();
    private static readonly ConcurrentDictionary<string, SaveZonixUser> _cachedUsers = new();
    private static PlatformSettings _settings = new();
    private static readonly ConcurrentDictionary<string, (int Count, DateTime Date)> _guestQuotas = new();

    public MongoDbAnalyticsService(IConfiguration config, ILogger<MongoDbAnalyticsService> logger)
    {
        _config = config;
        _logger = logger;

        string? connStr = config["MongoDb:ConnectionString"] 
            ?? config.GetConnectionString("MongoDb")
            ?? Environment.GetEnvironmentVariable("MONGO_URI")
            ?? Environment.GetEnvironmentVariable("MONGODB_URI");

        if (!string.IsNullOrWhiteSpace(connStr))
        {
            try
            {
                string dbName = config["MongoDb:DatabaseName"] ?? "SaveZonixDb";

                var mongoSettings = MongoClientSettings.FromConnectionString(connStr);
                mongoSettings.ServerSelectionTimeout = TimeSpan.FromSeconds(8);
                mongoSettings.ConnectTimeout = TimeSpan.FromSeconds(8);

                var client = new MongoClient(mongoSettings);
                _database = client.GetDatabase(dbName);
                _downloadsCollection = _database.GetCollection<DownloadRecord>("downloads");
                _usersCollection = _database.GetCollection<SaveZonixUser>("users");
                _settingsCollection = _database.GetCollection<PlatformSettings>("settings");
                _siteRulesCollection = _database.GetCollection<SiteRule>("site_rules");
                _securityLogsCollection = _database.GetCollection<SecurityLog>("security_logs");
                _platformsCollection = _database.GetCollection<PlatformInfo>("platforms");
                _isMongoConnected = true;

                Console.WriteLine($"[MongoDB Driver] Connected to MongoDB: {dbName}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning("MongoDB Driver connection notice: {Message}", ex.Message);
            }
        }

        _ = LoadInitialDataFromMongoAsync();
    }

    private async Task LoadInitialDataFromMongoAsync()
    {
        if (!_isMongoConnected || _database == null) return;

        try
        {
            if (_settingsCollection != null)
            {
                var s = await _settingsCollection.Find(_ => true).FirstOrDefaultAsync();
                if (s != null) _settings = s;
            }

            if (_usersCollection != null)
            {
                var uList = await _usersCollection.Find(_ => true).ToListAsync();
                foreach (var u in uList)
                {
                    if (!string.IsNullOrEmpty(u.Email)) _cachedUsers[u.Email.ToLowerInvariant()] = u;
                }
            }

            if (_downloadsCollection != null)
            {
                var dList = await _downloadsCollection.Find(_ => true).SortByDescending(x => x.CreatedAt).Limit(200).ToListAsync();
                foreach (var d in dList.OrderBy(x => x.CreatedAt))
                {
                    _cachedLogs.Add(d);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Initial data sync from MongoDB notice: {Message}", ex.Message);
        }
    }

    public async Task LogDownloadAsync(DownloadRecord record)
    {
        _cachedLogs.Add(record);

        if (_isMongoConnected && _downloadsCollection != null)
        {
            try
            {
                await _downloadsCollection.InsertOneAsync(record);
                Console.WriteLine($"[MongoDB] Recorded download into SaveZonixDb.downloads: {record.VideoTitle}");
            }
            catch (Exception ex)
            {
                _logger.LogError("Error recording download to MongoDB: {Message}", ex.Message);
            }
        }
    }

    public async Task<List<DownloadRecord>> GetRecentLogsAsync(int limit = 50, string? search = null)
    {
        if (_isMongoConnected && _downloadsCollection != null)
        {
            try
            {
                var filterBuilder = Builders<DownloadRecord>.Filter;
                var filter = filterBuilder.Empty;

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var s = search.Trim();
                    filter = filterBuilder.Or(
                        filterBuilder.Regex(x => x.VideoTitle, new MongoDB.Bson.BsonRegularExpression(s, "i")),
                        filterBuilder.Regex(x => x.OriginalUrl, new MongoDB.Bson.BsonRegularExpression(s, "i")),
                        filterBuilder.Regex(x => x.UserIp, new MongoDB.Bson.BsonRegularExpression(s, "i")),
                        filterBuilder.Regex(x => x.Platform, new MongoDB.Bson.BsonRegularExpression(s, "i"))
                    );
                }

                return await _downloadsCollection.Find(filter)
                    .SortByDescending(x => x.CreatedAt)
                    .Limit(limit)
                    .ToListAsync();
            }
            catch { }
        }

        var query = _cachedLogs.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            search = search.Trim().ToLowerInvariant();
            query = query.Where(x => 
                (x.VideoTitle?.ToLowerInvariant().Contains(search) == true) ||
                (x.OriginalUrl?.ToLowerInvariant().Contains(search) == true) ||
                (x.UserIp?.Contains(search) == true) ||
                (x.Platform?.ToLowerInvariant().Contains(search) == true));
        }

        return query.OrderByDescending(x => x.CreatedAt).Take(limit).ToList();
    }

    private static readonly ConcurrentBag<ErrorDiagnosticLog> _cachedErrorLogs = new();

    public Task LogErrorDiagnosticAsync(ErrorDiagnosticLog errorLog)
    {
        errorLog.Timestamp = DateTime.UtcNow;
        if (string.IsNullOrEmpty(errorLog.AppVersion)) errorLog.AppVersion = Zonix.Core.MediaValidator.CurrentAppVersion;
        if (string.IsNullOrEmpty(errorLog.SystemVersion)) errorLog.SystemVersion = Zonix.Core.MediaValidator.CurrentSystemVersion;
        _cachedErrorLogs.Add(errorLog);
        return Task.CompletedTask;
    }

    public Task<List<ErrorDiagnosticLog>> GetRecentErrorDiagnosticsAsync(int limit = 50, string? search = null)
    {
        var query = _cachedErrorLogs.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(e => e.Url.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                                     e.ErrorMessage.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                                     e.ErrorType.Contains(search, StringComparison.OrdinalIgnoreCase));
        }
        return Task.FromResult(query.OrderByDescending(e => e.Timestamp).Take(limit).ToList());
    }

    public Task<List<DownloadRecord>> GetDiagnosticDownloadRecordsAsync(int limit = 100, string? status = null, string? search = null)
    {
        var query = _cachedLogs.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(d => d.Status.Equals(status, StringComparison.OrdinalIgnoreCase) || d.ValidationStatus.Equals(status, StringComparison.OrdinalIgnoreCase));
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(d => (d.VideoTitle != null && d.VideoTitle.Contains(search, StringComparison.OrdinalIgnoreCase)) ||
                                     (d.OriginalUrl != null && d.OriginalUrl.Contains(search, StringComparison.OrdinalIgnoreCase)) ||
                                     (d.Platform != null && d.Platform.Contains(search, StringComparison.OrdinalIgnoreCase)) ||
                                     (d.CorruptionReason != null && d.CorruptionReason.Contains(search, StringComparison.OrdinalIgnoreCase)));
        }
        return Task.FromResult(query.OrderByDescending(d => d.CreatedAt).Take(limit).ToList());
    }

    public async Task<AnalyticsSummary> GetAnalyticsSummaryAsync()
    {
        long totalDownloads = _cachedLogs.Count;
        long totalBytes = _cachedLogs.Sum(x => x.FileSizeBytes);
        var today = DateTime.UtcNow.Date;
        int todayCount = _cachedLogs.Count(x => x.CreatedAt.Date == today);
        long totalUsers = _cachedUsers.Count;

        if (_isMongoConnected && _downloadsCollection != null)
        {
            try
            {
                totalDownloads = await _downloadsCollection.CountDocumentsAsync(_ => true);
                var logs = await _downloadsCollection.Find(_ => true).SortByDescending(x => x.CreatedAt).Limit(100).ToListAsync();
                totalBytes = logs.Sum(x => x.FileSizeBytes);
                todayCount = (int)await _downloadsCollection.CountDocumentsAsync(Builders<DownloadRecord>.Filter.Gte(x => x.CreatedAt, today));

                if (_usersCollection != null)
                {
                    totalUsers = await _usersCollection.CountDocumentsAsync(_ => true);
                }

                var platformGroups = logs
                    .GroupBy(x => string.IsNullOrWhiteSpace(x.Platform) ? "Web Stream" : x.Platform)
                    .ToDictionary(g => g.Key, g => g.Count());

                return new AnalyticsSummary
                {
                    TotalDownloads = totalDownloads,
                    TotalBandwidthBytes = totalBytes,
                    FormattedTotalBandwidth = FormatBytes(totalBytes),
                    TotalUsers = totalUsers,
                    TodayDownloads = todayCount,
                    PlatformBreakdown = platformGroups,
                    RecentLogs = logs.Take(50).ToList(),
                    Settings = _settings
                };
            }
            catch { }
        }

        var fallbackLogs = _cachedLogs.OrderByDescending(x => x.CreatedAt).ToList();
        var pGroups = fallbackLogs
            .GroupBy(x => string.IsNullOrWhiteSpace(x.Platform) ? "Web Stream" : x.Platform)
            .ToDictionary(g => g.Key, g => g.Count());

        return new AnalyticsSummary
        {
            TotalDownloads = totalDownloads,
            TotalBandwidthBytes = totalBytes,
            FormattedTotalBandwidth = FormatBytes(totalBytes),
            TotalUsers = totalUsers,
            TodayDownloads = todayCount,
            PlatformBreakdown = pGroups,
            RecentLogs = fallbackLogs.Take(50).ToList(),
            Settings = _settings
        };
    }

    public Task<PlatformSettings> GetSettingsAsync()
    {
        return Task.FromResult(_settings);
    }

    public async Task<PlatformSettings> UpdateSettingsAsync(PlatformSettings settings)
    {
        settings.UpdatedAt = DateTime.UtcNow;
        _settings = settings;

        if (_isMongoConnected && _settingsCollection != null)
        {
            try
            {
                var existing = await _settingsCollection.Find(_ => true).FirstOrDefaultAsync();
                if (existing != null && !string.IsNullOrEmpty(existing.Id))
                {
                    settings.Id = existing.Id;
                }

                await _settingsCollection.ReplaceOneAsync(
                    _ => true,
                    settings,
                    new ReplaceOptions { IsUpsert = true });
            }
            catch (Exception ex)
            {
                _logger.LogError("Error saving settings to MongoDB: {Message}", ex.Message);
            }
        }

        return _settings;
    }

    public Task<bool> CanGuestDownloadAsync(string ipAddress)
    {
        if (!_settings.AllowGuestDownloads) return Task.FromResult(false);

        var today = DateTime.UtcNow.Date;
        if (_guestQuotas.TryGetValue(ipAddress, out var quota))
        {
            if (quota.Date.Date != today)
            {
                _guestQuotas[ipAddress] = (0, today);
                return Task.FromResult(true);
            }
            return Task.FromResult(quota.Count < _settings.GuestDailyDownloadLimit);
        }

        return Task.FromResult(true);
    }

    public Task RecordGuestDownloadAsync(string ipAddress)
    {
        var today = DateTime.UtcNow.Date;
        _guestQuotas.AddOrUpdate(ipAddress, 
            (1, today), 
            (k, old) => old.Date.Date == today ? (old.Count + 1, today) : (1, today));
        return Task.CompletedTask;
    }

    public Task<int> GetGuestRemainingDownloadsAsync(string ipAddress)
    {
        if (!_settings.AllowGuestDownloads) return Task.FromResult(0);
        var today = DateTime.UtcNow.Date;
        if (_guestQuotas.TryGetValue(ipAddress, out var quota) && quota.Date.Date == today)
        {
            return Task.FromResult(Math.Max(0, _settings.GuestDailyDownloadLimit - quota.Count));
        }
        return Task.FromResult(_settings.GuestDailyDownloadLimit);
    }

    public async Task<SaveZonixUser?> FindUserByEmailAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;
        string key = email.Trim().ToLowerInvariant();

        if (_isMongoConnected && _usersCollection != null)
        {
            try
            {
                var user = await _usersCollection.Find(u => u.Email.ToLower() == key).FirstOrDefaultAsync();
                if (user != null) return user;
            }
            catch { }
        }

        _cachedUsers.TryGetValue(key, out var uCached);
        return uCached;
    }

    public async Task<SaveZonixUser> CreateOrUpdateUserAsync(SaveZonixUser user)
    {
        if (string.IsNullOrEmpty(user.Email)) return user;
        _cachedUsers[user.Email.ToLowerInvariant()] = user;

        if (_isMongoConnected && _usersCollection != null)
        {
            try
            {
                var existing = await _usersCollection.Find(u => u.Email.ToLower() == user.Email.ToLower()).FirstOrDefaultAsync();
                if (existing != null && !string.IsNullOrEmpty(existing.Id))
                {
                    user.Id = existing.Id;
                }

                await _usersCollection.ReplaceOneAsync(
                    u => u.Email.ToLower() == user.Email.ToLower(),
                    user,
                    new ReplaceOptions { IsUpsert = true });
                Console.WriteLine($"[MongoDB] Saved/Updated user in SaveZonixDb.users: {user.Email}");
            }
            catch (Exception ex)
            {
                _logger.LogError("Error saving user to MongoDB: {Message}", ex.Message);
            }
        }

        return user;
    }

    public async Task<List<SaveZonixUser>> GetAllUsersAsync(string? search = null)
    {
        if (_isMongoConnected && _usersCollection != null)
        {
            try
            {
                var filter = Builders<SaveZonixUser>.Filter.Empty;
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var s = search.Trim();
                    filter = Builders<SaveZonixUser>.Filter.Or(
                        Builders<SaveZonixUser>.Filter.Regex(u => u.FullName, new MongoDB.Bson.BsonRegularExpression(s, "i")),
                        Builders<SaveZonixUser>.Filter.Regex(u => u.Email, new MongoDB.Bson.BsonRegularExpression(s, "i"))
                    );
                }

                return await _usersCollection.Find(filter).SortByDescending(u => u.CreatedAt).ToListAsync();
            }
            catch { }
        }

        var users = _cachedUsers.Values.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLowerInvariant();
            users = users.Where(u => u.FullName.ToLowerInvariant().Contains(s) || u.Email.ToLowerInvariant().Contains(s));
        }
        return users.OrderByDescending(u => u.CreatedAt).ToList();
    }

    public async Task<bool> ToggleUserStatusAsync(string email)
    {
        var key = email.Trim().ToLowerInvariant();
        var user = await FindUserByEmailAsync(key);
        if (user != null)
        {
            user.IsActive = !user.IsActive;
            await CreateOrUpdateUserAsync(user);
            return true;
        }
        return false;
    }

    public async Task<bool> ChangeUserRoleAsync(string email, string newRole)
    {
        var key = email.Trim().ToLowerInvariant();
        var user = await FindUserByEmailAsync(key);
        if (user != null)
        {
            user.Role = newRole;
            await CreateOrUpdateUserAsync(user);
            return true;
        }
        return false;
    }

    public async Task<bool> DeleteUserAsync(string email)
    {
        var key = email.Trim().ToLowerInvariant();
        _cachedUsers.TryRemove(key, out _);

        if (_isMongoConnected && _usersCollection != null)
        {
            try
            {
                var res = await _usersCollection.DeleteOneAsync(u => u.Email.ToLower() == key);
                return res.DeletedCount > 0;
            }
            catch { }
        }

        return true;
    }

    public async Task<bool> ClearLogsAsync()
    {
        _cachedLogs.Clear();
        if (_isMongoConnected && _downloadsCollection != null)
        {
            try
            {
                await _downloadsCollection.DeleteManyAsync(_ => true);
                return true;
            }
            catch { }
        }
        return true;
    }

    public async Task<List<DownloadRecord>> GetUserDownloadHistoryAsync(string userId, int limit = 50)
    {
        if (_isMongoConnected && _downloadsCollection != null)
        {
            try
            {
                return await _downloadsCollection
                    .Find(x => x.UserId == userId)
                    .SortByDescending(x => x.CreatedAt)
                    .Limit(limit)
                    .ToListAsync();
            }
            catch { }
        }

        return _cachedLogs
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(limit)
            .ToList();
    }

    public async Task SeedInitialCollectionsAsync()
    {
        if (!_isMongoConnected || _database == null) return;

        try
        {
            // 1. Seed Site Rules / Engine Profiles
            if (_siteRulesCollection != null && await _siteRulesCollection.CountDocumentsAsync(_ => true) == 0)
            {
                var initialRules = new List<SiteRule>
                {
                    new SiteRule { Domain = "pornhub.com", DisplayName = "PornHub / PHN CDN", RuleType = "Strict", MaxThreads = 24, WafType = "Signed-Query Token", RequiresReferer = true },
                    new SiteRule { Domain = "xhamster.com", DisplayName = "xHamster Network", RuleType = "Strict", MaxThreads = 24, WafType = "Rate-Limited HLS", RequiresReferer = true },
                    new SiteRule { Domain = "spankbang.com", DisplayName = "SpankBang Tube", RuleType = "Strict", MaxThreads = 32, WafType = "Byte-Chunk Throttle", RequiresReferer = true },
                    new SiteRule { Domain = "okxxx.com", DisplayName = "OKXXX Video", RuleType = "Strict", MaxThreads = 32, WafType = "Direct Stream", RequiresReferer = true },
                    new SiteRule { Domain = "youtube.com", DisplayName = "YouTube / GoogleVideo", RuleType = "Open", MaxThreads = 256, WafType = "None (High Bandwidth)", RequiresReferer = false },
                    new SiteRule { Domain = "pixelflix.cc", DisplayName = "PixelFlix / Reels", RuleType = "Open", MaxThreads = 256, WafType = "Direct Stream", RequiresReferer = false },
                    new SiteRule { Domain = "vimeo.com", DisplayName = "Vimeo Video", RuleType = "Open", MaxThreads = 128, WafType = "None", RequiresReferer = false }
                };
                await _siteRulesCollection.InsertManyAsync(initialRules);
                Console.WriteLine("[MongoDB Seed] Seeded SaveZonixDb.site_rules");
            }

            // 2. Seed Platforms Info
            if (_platformsCollection != null && await _platformsCollection.CountDocumentsAsync(_ => true) == 0)
            {
                var initialPlatforms = new List<PlatformInfo>
                {
                    new PlatformInfo { Name = "Pornhub", SupportedProtocols = "HLS, DASH, MP4", MaxQuality = "1080p 60fps / 4K", Status = "Operational", Icon = "🔥" },
                    new PlatformInfo { Name = "YouTube", SupportedProtocols = "Muxed MP4, Adaptive HLS, M4A", MaxQuality = "4K / 1080p / 720p", Status = "Operational", Icon = "▶️" },
                    new PlatformInfo { Name = "xHamster", SupportedProtocols = "HLS Stream, Direct MP4", MaxQuality = "1080p / 720p", Status = "Operational", Icon = "⚡" },
                    new PlatformInfo { Name = "SpankBang", SupportedProtocols = "Direct 4K MP4, 1080p, 720p", MaxQuality = "4K Ultra HD", Status = "Operational", Icon = "💎" },
                    new PlatformInfo { Name = "OKXXX", SupportedProtocols = "HTML5 Video, MP4", MaxQuality = "1080p Full HD", Status = "Operational", Icon = "🚀" },
                    new PlatformInfo { Name = "PixelFlix", SupportedProtocols = "HLS Master, CDN Stream", MaxQuality = "1080p Full HD", Status = "Operational", Icon = "🎬" }
                };
                await _platformsCollection.InsertManyAsync(initialPlatforms);
                Console.WriteLine("[MongoDB Seed] Seeded SaveZonixDb.platforms");
            }

            // 3. Seed Security Audit Logs
            if (_securityLogsCollection != null && await _securityLogsCollection.CountDocumentsAsync(_ => true) == 0)
            {
                var initialLogs = new List<SecurityLog>
                {
                    new SecurityLog { EventType = "SystemInit", UserEmail = "zaidm1323@gmail.com", IpAddress = "127.0.0.1", Details = "SaveZonix Engine Initialized with 256x Hyper-Engine & Ghost Stealth Shield", Status = "Success" },
                    new SecurityLog { EventType = "DatabaseReady", UserEmail = "zaidm1323@gmail.com", IpAddress = "127.0.0.1", Details = "MongoDB Cluster connected to database SaveZonixDb", Status = "Success" },
                    new SecurityLog { EventType = "AdminVerification", UserEmail = "zaidm1323@gmail.com", IpAddress = "127.0.0.1", Details = "Super Admin Role assigned to zaidm1323@gmail.com", Status = "Success" }
                };
                await _securityLogsCollection.InsertManyAsync(initialLogs);
                Console.WriteLine("[MongoDB Seed] Seeded SaveZonixDb.security_logs");
            }

            // 4. Seed Settings if empty
            if (_settingsCollection != null && await _settingsCollection.CountDocumentsAsync(_ => true) == 0)
            {
                var initSettings = new PlatformSettings
                {
                    SiteName = "SaveZonix",
                    AllowGuestDownloads = true,
                    GuestDailyDownloadLimit = 10,
                    RequireEmailVerification = false,
                    AdminEmail = "zaidm1323@gmail.com",
                    UpdatedAt = DateTime.UtcNow
                };
                await _settingsCollection.InsertOneAsync(initSettings);
                Console.WriteLine("[MongoDB Seed] Seeded SaveZonixDb.settings");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Seed collections notice: {Message}", ex.Message);
        }
    }

    private static string FormatBytes(long bytes)
    {
        if (bytes < 0) return "0 B";
        string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
        int counter = 0;
        decimal number = bytes;
        while (Math.Round(number / 1024) >= 1)
        {
            number /= 1024;
            counter++;
        }
        return $"{number:n1} {suffixes[counter]}";
    }
}
