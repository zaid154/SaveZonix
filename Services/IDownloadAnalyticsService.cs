using SaveZonix.Models;

namespace SaveZonix.Services;

public interface IDownloadAnalyticsService
{
    Task LogDownloadAsync(DownloadRecord record);
    Task<List<DownloadRecord>> GetRecentLogsAsync(int limit = 50, string? search = null);
    Task<List<DownloadRecord>> GetDiagnosticDownloadRecordsAsync(int limit = 100, string? status = null, string? search = null);
    Task LogErrorDiagnosticAsync(ErrorDiagnosticLog errorLog);
    Task<List<ErrorDiagnosticLog>> GetRecentErrorDiagnosticsAsync(int limit = 50, string? search = null);
    Task<AnalyticsSummary> GetAnalyticsSummaryAsync();
    Task<PlatformSettings> GetSettingsAsync();
    Task<PlatformSettings> UpdateSettingsAsync(PlatformSettings settings);
    Task<bool> CanGuestDownloadAsync(string ipAddress);
    Task RecordGuestDownloadAsync(string ipAddress);
    Task<int> GetGuestRemainingDownloadsAsync(string ipAddress);
    Task<bool> ClearLogsAsync();

    // User Operations
    Task<List<SaveZonixUser>> GetAllUsersAsync(string? search = null);
    Task<SaveZonixUser?> FindUserByEmailAsync(string email);
    Task<SaveZonixUser> CreateOrUpdateUserAsync(SaveZonixUser user);
    Task<bool> ToggleUserStatusAsync(string email);
    Task<bool> ChangeUserRoleAsync(string email, string newRole);
    Task<bool> DeleteUserAsync(string email);
    Task<List<DownloadRecord>> GetUserDownloadHistoryAsync(string userId, int limit = 50);
    Task SeedInitialCollectionsAsync();
}
