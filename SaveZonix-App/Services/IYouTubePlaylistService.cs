using SaveZonix.Models;

namespace SaveZonix.Services;

public interface IYouTubePlaylistService
{
    string? ExtractPlaylistId(string urlOrId);
    Task<PlaylistInfoResult> LoadPlaylistAsync(string urlOrId, int? limit = null, int? offset = null, string? lastVideoId = null, CancellationToken cancellationToken = default);
    Task<List<string>> GetAvailableResolutionsAsync(string videoId, CancellationToken cancellationToken = default);
    string SaveImportedQueue(ImportTabQueueRequest request);
    PlaylistInfoResult? GetImportedQueue(string key);
}
