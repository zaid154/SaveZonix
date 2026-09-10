using SaveZonix.Models;

namespace SaveZonix.Services;

public interface IPlaylistQueueManager
{
    Task<PlaylistBatchJobState> StartBatchDownloadAsync(PlaylistBatchDownloadRequest request, CancellationToken cancellationToken = default);
    PlaylistBatchJobState? GetJobState(string jobId);
    bool CancelBatchJob(string jobId);
    bool CancelPlaylistItem(string jobId, string videoId);
    Task<bool> RetryPlaylistItemAsync(string jobId, string videoId);
    Task<bool> RetryAllFailedAsync(string jobId);
}
