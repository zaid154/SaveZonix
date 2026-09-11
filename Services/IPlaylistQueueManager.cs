using SaveZonix.Models;

namespace SaveZonix.Services;

public interface IPlaylistQueueManager
{
    Task<PlaylistBatchJobState> StartBatchDownloadAsync(PlaylistBatchDownloadRequest request, string? userId = null, string? userEmail = null, string? userName = null, CancellationToken cancellationToken = default);
    PlaylistBatchJobState? GetJobState(string jobId);
    List<PlaylistBatchJobState> GetActiveJobs();
    bool CancelBatchJob(string jobId);
    bool CancelPlaylistItem(string jobId, string videoId);
    bool CancelPlaylistItemByTaskId(string taskId);
    Task<bool> RetryPlaylistItemAsync(string jobId, string videoId);
    Task<bool> RetryAllFailedAsync(string jobId);
    Task<bool> RetryFailedByGroupAsync(string groupIdentifier);
}
