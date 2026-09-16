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
}

public class AdminSettingsService : IAdminSettingsService
{
    private readonly IMongoCollection<AdminSetting>? _collection;
    private readonly IRedisCacheService? _redis;
    private const string CacheKeyAll = "savezonix:settings:all";
    private const string CachePrefix = "savezonix:settings:";
    private static readonly ConcurrentDictionary<string, string> _memoryCache = new(StringComparer.OrdinalIgnoreCase);

    public AdminSettingsService(IMongoDatabase? mongoDb = null, IRedisCacheService? redis = null)
    {
        _collection = mongoDb?.GetCollection<AdminSetting>("adminsettings");
        _redis = redis;
    }

    public async Task<string> GetSettingAsync(string key, string defaultValue = "")
    {
        try
        {
            if (_memoryCache.TryGetValue(key, out var memVal)) return memVal;

            var all = await GetAllSettingsAsync();
            if (all.TryGetValue(key, out var val))
            {
                _memoryCache[key] = val;
                return val;
            }

            if (_collection != null)
            {
                var setting = await _collection.Find(s => s.Key == key).FirstOrDefaultAsync();
                if (setting != null)
                {
                    _memoryCache[key] = setting.Value;
                    return setting.Value;
                }
            }

            return defaultValue;
        }
        catch
        {
            return defaultValue;
        }
    }

    public async Task<bool> GetSettingBoolAsync(string key, bool defaultValue = false)
    {
        try
        {
            var val = await GetSettingAsync(key, defaultValue ? "true" : "false");
            if (bool.TryParse(val, out var res)) return res;
            return defaultValue;
        }
        catch
        {
            return defaultValue;
        }
    }

    public async Task<int> GetSettingIntAsync(string key, int defaultValue = 0)
    {
        try
        {
            var val = await GetSettingAsync(key, defaultValue.ToString());
            if (int.TryParse(val, out var res)) return res;
            return defaultValue;
        }
        catch
        {
            return defaultValue;
        }
    }

    public async Task<Dictionary<string, string>> GetAllSettingsAsync()
    {
        if (_redis != null)
        {
            var cached = await _redis.GetAsync<Dictionary<string, string>>(CacheKeyAll);
            if (cached != null && cached.Count > 0) return cached;
        }

        try
        {
            var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "RegistrationEnabled", "true" },
                { "EmailVerificationRequired", "false" },
                { "GoogleLoginEnabled", "true" },
                { "DefaultThreads", "64" },
                { "MaxThreads", "256" },
                { "MaintenanceMode", "false" },
                { "DatabaseProvider", "MongoDB" },
                { "MaxConcurrentDownloadsPerUser", "5" }
            };

            if (_collection != null)
            {
                var list = await _collection.Find(_ => true).ToListAsync();
                foreach (var item in list)
                {
                    dict[item.Key] = item.Value;
                    _memoryCache[item.Key] = item.Value;
                }
            }

            if (_redis != null && dict.Count > 0)
            {
                await _redis.SetAsync(CacheKeyAll, dict, TimeSpan.FromHours(2));
            }
            return dict;
        }
        catch
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "RegistrationEnabled", "true" },
                { "EmailVerificationRequired", "false" },
                { "GoogleLoginEnabled", "true" },
                { "DefaultThreads", "64" },
                { "MaxThreads", "256" },
                { "MaintenanceMode", "false" },
                { "DatabaseProvider", "MongoDB" },
                { "MaxConcurrentDownloadsPerUser", "5" }
            };
        }
    }

    public async Task UpdateSettingAsync(string key, string value, string? description = null, string? category = null)
    {
        _memoryCache[key] = value;

        if (_collection != null)
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

        if (_redis != null)
        {
            await _redis.RemoveByPrefixAsync(CachePrefix);
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
            await _redis.RemoveByPrefixAsync(CachePrefix);
        }
    }
}
