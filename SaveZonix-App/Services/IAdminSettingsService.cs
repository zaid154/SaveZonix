using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
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
    private readonly AppDbContext _context;
    private readonly IRedisCacheService? _redis;
    private const string CacheKeyAll = "savezonix:settings:all";
    private const string CachePrefix = "savezonix:settings:";

    public AdminSettingsService(AppDbContext context, IRedisCacheService? redis = null)
    {
        _context = context;
        _redis = redis;
    }

    public async Task<string> GetSettingAsync(string key, string defaultValue = "")
    {
        try
        {
            var all = await GetAllSettingsAsync();
            if (all.TryGetValue(key, out var val)) return val;

            var setting = await _context.AdminSettings.FirstOrDefaultAsync(s => s.Key == key);
            return setting?.Value ?? defaultValue;
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
            var dict = await _context.AdminSettings.ToDictionaryAsync(s => s.Key, s => s.Value);
            if (_redis != null && dict.Count > 0)
            {
                await _redis.SetAsync(CacheKeyAll, dict, TimeSpan.FromHours(2));
            }
            return dict;
        }
        catch
        {
            return new Dictionary<string, string>
            {
                { "RegistrationEnabled", "true" },
                { "EmailVerificationRequired", "false" },
                { "GoogleLoginEnabled", "true" },
                { "DefaultThreads", "64" },
                { "MaxThreads", "256" },
                { "MaintenanceMode", "false" }
            };
        }
    }

    public async Task UpdateSettingAsync(string key, string value, string? description = null, string? category = null)
    {
        var setting = await _context.AdminSettings.FirstOrDefaultAsync(s => s.Key == key);
        if (setting != null)
        {
            setting.Value = value;
            if (description != null) setting.Description = description;
            if (category != null) setting.Category = category;
            setting.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _context.AdminSettings.Add(new AdminSetting
            {
                Key = key,
                Value = value,
                Description = description,
                Category = category ?? "General",
                UpdatedAt = DateTime.UtcNow
            });
        }
        await _context.SaveChangesAsync();

        if (_redis != null)
        {
            await _redis.RemoveByPrefixAsync(CachePrefix);
        }
    }

    public async Task UpdateSettingsAsync(Dictionary<string, string> settings)
    {
        foreach (var kvp in settings)
        {
            var setting = await _context.AdminSettings.FirstOrDefaultAsync(s => s.Key == kvp.Key);
            if (setting != null)
            {
                setting.Value = kvp.Value;
                setting.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                _context.AdminSettings.Add(new AdminSetting
                {
                    Key = kvp.Key,
                    Value = kvp.Value,
                    UpdatedAt = DateTime.UtcNow
                });
            }
        }
        await _context.SaveChangesAsync();

        if (_redis != null)
        {
            await _redis.RemoveByPrefixAsync(CachePrefix);
        }
    }
}
