using System.Collections.Concurrent;
using SaveZonix.Models;

namespace SaveZonix.Services;

public class SqlDownloadAnalyticsService : IDownloadAnalyticsService
{
    private readonly IConfiguration _config;
    private readonly ILogger<SqlDownloadAnalyticsService> _logger;
    private static readonly ConcurrentDictionary<string, (int Count, DateTime Date)> _guestDailyCounters = new();
    private static PlatformSettings _cachedSettings = new();
    private static readonly List<DownloadRecord> _records = new();
    private static readonly List<SaveZonixUser> _users = new();

    public SqlDownloadAnalyticsService(IConfiguration config, ILogger<SqlDownloadAnalyticsService> logger)
    {
        _config = config;
        _logger = logger;
    }

    private static readonly List<ErrorDiagnosticLog> _errorLogs = new();

    public async Task LogDownloadAsync(DownloadRecord record)
    {
        record.CreatedAt = DateTime.UtcNow;
        if (string.IsNullOrEmpty(record.AppVersion)) record.AppVersion = Zonix.Core.MediaValidator.CurrentAppVersion;
        if (string.IsNullOrEmpty(record.SystemVersion)) record.SystemVersion = Zonix.Core.MediaValidator.CurrentSystemVersion;
        lock (_records)
        {
            _records.Insert(0, record);
            if (_records.Count > 1000) _records.RemoveAt(_records.Count - 1);
        }
        await Task.CompletedTask;
    }

    public Task LogErrorDiagnosticAsync(ErrorDiagnosticLog errorLog)
    {
        errorLog.Timestamp = DateTime.UtcNow;
        if (string.IsNullOrEmpty(errorLog.AppVersion)) errorLog.AppVersion = Zonix.Core.MediaValidator.CurrentAppVersion;
        if (string.IsNullOrEmpty(errorLog.SystemVersion)) errorLog.SystemVersion = Zonix.Core.MediaValidator.CurrentSystemVersion;
        lock (_errorLogs)
        {
            _errorLogs.Insert(0, errorLog);
            if (_errorLogs.Count > 1000) _errorLogs.RemoveAt(_errorLogs.Count - 1);
        }
        return Task.CompletedTask;
    }

    public Task<List<ErrorDiagnosticLog>> GetRecentErrorDiagnosticsAsync(int limit = 50, string? search = null)
    {
        lock (_errorLogs)
        {
            var query = _errorLogs.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(e => e.Url.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                                         e.ErrorMessage.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                                         e.ErrorType.Contains(search, StringComparison.OrdinalIgnoreCase));
            }
            return Task.FromResult(query.Take(limit).ToList());
        }
    }

    public Task<List<DownloadRecord>> GetDiagnosticDownloadRecordsAsync(int limit = 100, string? status = null, string? search = null)
    {
        lock (_records)
        {
            var query = _records.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(d => d.Status.Equals(status, StringComparison.OrdinalIgnoreCase) || d.ValidationStatus.Equals(status, StringComparison.OrdinalIgnoreCase));
            }
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(d => d.VideoTitle.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                                         d.OriginalUrl.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                                         d.Platform.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                                         (d.CorruptionReason != null && d.CorruptionReason.Contains(search, StringComparison.OrdinalIgnoreCase)));
            }
            return Task.FromResult(query.Take(limit).ToList());
        }
    }

    public async Task<List<DownloadRecord>> GetRecentLogsAsync(int limit = 50, string? search = null)
    {
        lock (_records)
        {
            var query = _records.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(d => d.VideoTitle.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                                         d.Platform.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                                         d.UserIp.Contains(search, StringComparison.OrdinalIgnoreCase));
            }
            return Task.FromResult(query.Take(limit).ToList()).Result;
        }
    }

    public async Task<AnalyticsSummary> GetAnalyticsSummaryAsync()
    {
        var summary = new AnalyticsSummary();
        summary.Settings = await GetSettingsAsync();
        summary.AppVersion = Zonix.Core.MediaValidator.CurrentAppVersion;
        summary.SystemVersion = Zonix.Core.MediaValidator.CurrentSystemVersion;

        lock (_records)
        {
            summary.TotalDownloads = _records.Count;
            summary.TotalPassedValidation = _records.Count(d => d.ValidationStatus == "Passed" || d.Status == "Completed");
            summary.TotalCorrupted = _records.Count(d => d.Status == "Corrupted" || d.ValidationStatus == "Corrupted" || d.ValidationStatus == "Truncated");
            summary.TotalFailed = _records.Count(d => d.Status == "Failed");
            summary.TodayDownloads = _records.Count(d => d.CreatedAt.Date == DateTime.UtcNow.Date);
            summary.TotalUsers = _users.Count;
            summary.RecentLogs = _records.Take(25).ToList();

            long totalBytes = 0;
            foreach (var log in _records)
            {
                totalBytes += log.FileSizeBytes;
                if (!summary.PlatformBreakdown.ContainsKey(log.Platform))
                {
                    summary.PlatformBreakdown[log.Platform] = 0;
                }
                summary.PlatformBreakdown[log.Platform]++;
            }
            summary.TotalBandwidthBytes = totalBytes;
            summary.FormattedTotalBandwidth = FormatBytes(totalBytes);
        }

        lock (_errorLogs)
        {
            summary.RecentErrors = _errorLogs.Take(25).ToList();
        }

        return summary;
    }

    public Task<PlatformSettings> GetSettingsAsync() => Task.FromResult(_cachedSettings);

    public Task<PlatformSettings> UpdateSettingsAsync(PlatformSettings settings)
    {
        settings.UpdatedAt = DateTime.UtcNow;
        _cachedSettings = settings;
        return Task.FromResult(settings);
    }

    public Task<bool> CanGuestDownloadAsync(string ipAddress)
    {
        if (!_cachedSettings.AllowGuestDownloads) return Task.FromResult(false);
        if (_cachedSettings.GuestDailyDownloadLimit <= 0) return Task.FromResult(true);

        var today = DateTime.UtcNow.Date;
        if (_guestDailyCounters.TryGetValue(ipAddress, out var entry))
        {
            if (entry.Date == today)
            {
                return Task.FromResult(entry.Count < _cachedSettings.GuestDailyDownloadLimit);
            }
        }
        return Task.FromResult(true);
    }

    public Task RecordGuestDownloadAsync(string ipAddress)
    {
        var today = DateTime.UtcNow.Date;
        _guestDailyCounters.AddOrUpdate(
            ipAddress,
            (1, today),
            (key, old) => old.Date == today ? (old.Count + 1, today) : (1, today)
        );
        return Task.CompletedTask;
    }

    public Task<int> GetGuestRemainingDownloadsAsync(string ipAddress)
    {
        if (!_cachedSettings.AllowGuestDownloads) return Task.FromResult(0);
        if (_cachedSettings.GuestDailyDownloadLimit <= 0) return Task.FromResult(9999);

        var today = DateTime.UtcNow.Date;
        int used = 0;
        if (_guestDailyCounters.TryGetValue(ipAddress, out var entry) && entry.Date == today)
        {
            used = entry.Count;
        }
        return Task.FromResult(Math.Max(0, _cachedSettings.GuestDailyDownloadLimit - used));
    }

    public Task<SaveZonixUser?> FindUserByEmailAsync(string email)
    {
        var clean = email.Trim().ToLowerInvariant();
        lock (_users)
        {
            return Task.FromResult(_users.FirstOrDefault(u => u.Email.Equals(clean, StringComparison.OrdinalIgnoreCase)));
        }
    }

    public Task<SaveZonixUser> CreateOrUpdateUserAsync(SaveZonixUser user)
    {
        user.Email = user.Email.Trim().ToLowerInvariant();
        lock (_users)
        {
            var idx = _users.FindIndex(u => u.Email.Equals(user.Email, StringComparison.OrdinalIgnoreCase));
            if (idx >= 0) _users[idx] = user;
            else
            {
                user.Id = Guid.NewGuid().ToString("N");
                _users.Add(user);
            }
        }
        return Task.FromResult(user);
    }

    public Task<bool> ClearLogsAsync()
    {
        lock (_records)
        {
            _records.Clear();
        }
        return Task.FromResult(true);
    }

    public Task<List<SaveZonixUser>> GetAllUsersAsync(string? search = null)
    {
        lock (_users)
        {
            var query = _users.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLowerInvariant();
                query = query.Where(u => u.FullName.ToLowerInvariant().Contains(s) || u.Email.ToLowerInvariant().Contains(s));
            }
            return Task.FromResult(query.OrderByDescending(u => u.CreatedAt).ToList());
        }
    }

    public Task<bool> ToggleUserStatusAsync(string email)
    {
        lock (_users)
        {
            var user = _users.FirstOrDefault(u => u.Email.Equals(email.Trim(), StringComparison.OrdinalIgnoreCase));
            if (user != null)
            {
                user.IsActive = !user.IsActive;
                return Task.FromResult(true);
            }
            return Task.FromResult(false);
        }
    }

    public Task<bool> ChangeUserRoleAsync(string email, string newRole)
    {
        lock (_users)
        {
            var user = _users.FirstOrDefault(u => u.Email.Equals(email.Trim(), StringComparison.OrdinalIgnoreCase));
            if (user != null)
            {
                user.Role = newRole;
                return Task.FromResult(true);
            }
            return Task.FromResult(false);
        }
    }

    public Task<bool> DeleteUserAsync(string email)
    {
        lock (_users)
        {
            var count = _users.RemoveAll(u => u.Email.Equals(email.Trim(), StringComparison.OrdinalIgnoreCase));
            return Task.FromResult(count > 0);
        }
    }

    public Task<List<DownloadRecord>> GetUserDownloadHistoryAsync(string userId, int limit = 50)
    {
        lock (_records)
        {
            return Task.FromResult(_records.Where(d => d.UserId == userId).Take(limit).ToList());
        }
    }

    public Task SeedInitialCollectionsAsync()
    {
        return Task.CompletedTask;
    }

    private static string FormatBytes(long bytes)
    {
        if (bytes < 1024) return $"{bytes} B";
        if (bytes < 1024 * 1024) return $"{(bytes / 1024.0):F1} KB";
        if (bytes < 1024 * 1024 * 1024) return $"{(bytes / (1024.0 * 1024.0)):F1} MB";
        return $"{(bytes / (1024.0 * 1024.0 * 1024.0)):F2} GB";
    }
}
