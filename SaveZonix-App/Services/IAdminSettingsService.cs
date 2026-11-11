using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using MongoDB.Driver;
using SaveZonix.Services;
using StreamHelper.Data;

namespace StreamHelper.Services;

public interface IAdminSettingsService
{
    Task<string> GetSettingAsync(string key, string defaultValue = "");
    Task<bool> GetSettingBoolAsync(string key, bool defaultValue = false);
    Task<int> GetSettingIntAsync(string key, int defaultValue = 0);
    Task<Dictionary<string, string>> GetAllSettingsAsync();
    Task UpdateSettingAsync(string key, string value, string? description = null, string? category = null);
    Task UpdateSettingsAsync(Dictionary<string, string> settings);

    // Thread & Engine Settings accessors
    Task<int> GetDefaultThreadsAsync();
    Task<int> GetMaxThreadsAsync();
    Task<int> GetStrictCdnMaxThreadsAsync();
    Task<bool> IsShieldEnabledByDefaultAsync();
}

public class AdminSettingsService : IAdminSettingsService
{
    private readonly IMongoCollection<AdminSetting>? _collection;
    private readonly IRedisCacheService? _redis;
    private const string CacheKeyAll = "savezonix:settings:all";
    private const string CachePrefix = "savezonix:settings:";

    /// <summary>
    /// Default system configuration settings ensuring high-speed multi-threaded downloads,
    /// strict CDN safeguards, and universal crash protection out of the box.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> SystemDefaults = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        { "RegistrationEnabled", "true" },
        { "EmailVerificationRequired", "false" },
        { "GoogleLoginEnabled", "true" },
        { "DefaultThreads", "32" },
        { "MaxThreads", "256" },
        { "StrictCdnMaxThreads", "24" },
        { "ShieldEnabledByDefault", "true" },
        { "MaintenanceMode", "false" },
        { "DatabaseProvider", "MongoDB" },
        { "MaxConcurrentDownloadsPerUser", "5" }
    };

    private static readonly ConcurrentDictionary<string, string> _memoryCache = new(SystemDefaults, StringComparer.OrdinalIgnoreCase);

    public AdminSettingsService(IMongoDatabase? mongoDb = null, IRedisCacheService? redis = null)
    {
        try
        {
            _collection = mongoDb?.GetCollection<AdminSetting>("adminsettings");
        }
        catch
        {
            _collection = null;
        }
        _redis = redis;
    }

    // Static synchronous accessors for engine components running outside DI or async scopes
    public static string GetCachedSetting(string key, string defaultValue = "")
    {
        if (_memoryCache.TryGetValue(key, out var val) && !string.IsNullOrEmpty(val))
            return val;
        if (SystemDefaults.TryGetValue(key, out var defVal))
            return defVal;
        return defaultValue;
    }

    public static int GetCachedSettingInt(string key, int defaultValue = 0)
    {
        int fallback = defaultValue != 0
            ? defaultValue
            : (SystemDefaults.TryGetValue(key, out var sysDef) && int.TryParse(sysDef, out var parsed) ? parsed : defaultValue);

        if (_memoryCache.TryGetValue(key, out var val) && int.TryParse(val, out var res))
            return res;
        return fallback;
    }

    public static bool GetCachedSettingBool(string key, bool defaultValue = false)
    {
        bool fallback = defaultValue
            ? defaultValue
            : (SystemDefaults.TryGetValue(key, out var sysDef) && bool.TryParse(sysDef, out var parsed) ? parsed : defaultValue);

        if (_memoryCache.TryGetValue(key, out var val) && bool.TryParse(val, out var res))
            return res;
        return fallback;
    }

    public static int CachedDefaultThreads => GetCachedSettingInt("DefaultThreads", 32);
    public static int CachedMaxThreads => GetCachedSettingInt("MaxThreads", 256);
    public static int CachedStrictCdnMaxThreads => GetCachedSettingInt("StrictCdnMaxThreads", 24);
    public static bool CachedShieldEnabledByDefault => GetCachedSettingBool("ShieldEnabledByDefault", true);

    public async Task<string> GetSettingAsync(string key, string defaultValue = "")
    {
        try
        {
            if (_memoryCache.TryGetValue(key, out var memVal) && !string.IsNullOrEmpty(memVal))
                return memVal;

            var all = await GetAllSettingsAsync();
            if (all.TryGetValue(key, out var val))
            {
                _memoryCache[key] = val;
                return val;
            }

            if (_collection != null)
            {
                try
                {
                    var setting = await _collection.Find(s => s.Key == key).FirstOrDefaultAsync();
                    if (setting != null)
                    {
                        _memoryCache[key] = setting.Value;
                        return setting.Value;
                    }
                }
                catch
                {
                    // MongoDB offline or unreachable
                }
            }

            if (!string.IsNullOrEmpty(defaultValue)) return defaultValue;
            if (SystemDefaults.TryGetValue(key, out var sysDef)) return sysDef;
            return defaultValue;
        }
        catch
        {
            if (!string.IsNullOrEmpty(defaultValue)) return defaultValue;
            if (SystemDefaults.TryGetValue(key, out var sysDef)) return sysDef;
            return defaultValue;
        }
    }

    public async Task<bool> GetSettingBoolAsync(string key, bool defaultValue = false)
    {
        try
        {
            bool effectiveDefault = defaultValue
                ? defaultValue
                : (SystemDefaults.TryGetValue(key, out var sysDef) && bool.TryParse(sysDef, out var parsed) ? parsed : defaultValue);

            var val = await GetSettingAsync(key, effectiveDefault ? "true" : "false");
            if (bool.TryParse(val, out var res)) return res;
            return effectiveDefault;
        }
        catch
        {
            if (defaultValue) return defaultValue;
            if (SystemDefaults.TryGetValue(key, out var sysDef) && bool.TryParse(sysDef, out var parsed))
                return parsed;
            return defaultValue;
        }
    }

    public async Task<int> GetSettingIntAsync(string key, int defaultValue = 0)
    {
        try
        {
            int effectiveDefault = defaultValue != 0
                ? defaultValue
                : (SystemDefaults.TryGetValue(key, out var sysDef) && int.TryParse(sysDef, out var parsed) ? parsed : defaultValue);

            var val = await GetSettingAsync(key, effectiveDefault.ToString());
            if (int.TryParse(val, out var res)) return res;
            return effectiveDefault;
        }
        catch
        {
            if (defaultValue != 0) return defaultValue;
            if (SystemDefaults.TryGetValue(key, out var sysDef) && int.TryParse(sysDef, out var parsed))
                return parsed;
            return defaultValue;
        }
    }

    public async Task<Dictionary<string, string>> GetAllSettingsAsync()
    {
        var dict = new Dictionary<string, string>(SystemDefaults, StringComparer.OrdinalIgnoreCase);

        // Preload any current in-memory cached entries
        foreach (var kvp in _memoryCache)
        {
            dict[kvp.Key] = kvp.Value;
        }

        // 1. Try Redis cache first
        if (_redis != null)
        {
            try
            {
                var cached = await _redis.GetAsync<Dictionary<string, string>>(CacheKeyAll);
                if (cached != null && cached.Count > 0)
                {
                    foreach (var kvp in cached)
                    {
                        dict[kvp.Key] = kvp.Value;
                        _memoryCache[kvp.Key] = kvp.Value;
                    }
                    return dict;
                }
            }
            catch
            {
                // Redis offline or unreachable, fall back gracefully
            }
        }

        // 2. Try MongoDB database
        if (_collection != null)
        {
            try
            {
                var list = await _collection.Find(_ => true).ToListAsync();
                foreach (var item in list)
                {
                    dict[item.Key] = item.Value;
                    _memoryCache[item.Key] = item.Value;
                }
            }
            catch
            {
                // MongoDB offline or unreachable, fall back gracefully to memory + defaults
            }
        }

        // 3. Write refreshed cache to Redis if available
        if (_redis != null && dict.Count > 0)
        {
            try
            {
                await _redis.SetAsync(CacheKeyAll, dict, TimeSpan.FromHours(2));
            }
            catch
            {
                // Redis offline or unreachable
            }
        }

        return dict;
    }

    public async Task UpdateSettingAsync(string key, string value, string? description = null, string? category = null)
    {
        _memoryCache[key] = value;

        if (_collection != null)
        {
            try
            {
                var setting = new AdminSetting
                {
                    Key = key,
                    Value = value,
                    Description = description,
                    Category = category ?? "General",
                    UpdatedAt = DateTime.UtcNow
                };

                var options = new ReplaceOptions { IsUpsert = true };
                await _collection.ReplaceOneAsync(s => s.Key == key, setting, options);
            }
            catch
            {
                // MongoDB offline or unreachable; memory cache remains authoritative
            }
        }

        if (_redis != null)
        {
            try
            {
                await _redis.RemoveByPrefixAsync(CachePrefix);
            }
            catch
            {
                // Redis offline or unreachable
            }
        }
    }

    public async Task UpdateSettingsAsync(Dictionary<string, string> settings)
    {
        foreach (var kvp in settings)
        {
            await UpdateSettingAsync(kvp.Key, kvp.Value);
        }

        if (_redis != null)
        {
            try
            {
                await _redis.RemoveByPrefixAsync(CachePrefix);
            }
            catch
            {
                // Redis offline or unreachable
            }
        }
    }

    // Strongly-typed thread & engine settings accessors
    public Task<int> GetDefaultThreadsAsync() => GetSettingIntAsync("DefaultThreads", 32);
    public Task<int> GetMaxThreadsAsync() => GetSettingIntAsync("MaxThreads", 256);
    public Task<int> GetStrictCdnMaxThreadsAsync() => GetSettingIntAsync("StrictCdnMaxThreads", 24);
    public Task<bool> IsShieldEnabledByDefaultAsync() => GetSettingBoolAsync("ShieldEnabledByDefault", true);
}
