using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
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

    public AdminSettingsService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<string> GetSettingAsync(string key, string defaultValue = "")
    {
        var setting = await _context.AdminSettings.FirstOrDefaultAsync(s => s.Key == key);
        return setting?.Value ?? defaultValue;
    }

    public async Task<bool> GetSettingBoolAsync(string key, bool defaultValue = false)
    {
        var val = await GetSettingAsync(key);
        if (bool.TryParse(val, out var res)) return res;
        return defaultValue;
    }

    public async Task<int> GetSettingIntAsync(string key, int defaultValue = 0)
    {
        var val = await GetSettingAsync(key);
        if (int.TryParse(val, out var res)) return res;
        return defaultValue;
    }

    public async Task<Dictionary<string, string>> GetAllSettingsAsync()
    {
        return await _context.AdminSettings.ToDictionaryAsync(s => s.Key, s => s.Value);
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
    }
}
