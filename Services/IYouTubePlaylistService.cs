using SaveZonix.Models;

namespace SaveZonix.Services;

public interface IYouTubePlaylistService
{
    string? ExtractPlaylistId(string urlOrId);
    Task<PlaylistInfoResult> LoadPlaylistAsync(string urlOrId, CancellationToken cancellationToken = default);
    Task<List<string>> GetAvailableResolutionsAsync(string videoId, CancellationToken cancellationToken = default);
}
