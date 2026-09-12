using System.Diagnostics;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using SaveZonix.Models;
using SaveZonix.Services;
using StreamHelper.Data;

namespace Zonix.Controllers;

public class PlaylistController : Controller
{
    private readonly IYouTubePlaylistService _playlistService;
    private readonly IPlaylistQueueManager _queueManager;
    private readonly UserManager<AppUser> _userManager;

    public PlaylistController(IYouTubePlaylistService playlistService, IPlaylistQueueManager queueManager, UserManager<AppUser> userManager)
    {
        _playlistService = playlistService;
        _queueManager = queueManager;
        _userManager = userManager;
    }

    [HttpGet("/playlist")]
    public IActionResult Index()
    {
        ViewData["Title"] = "YouTube Playlist Downloader — Studio Edition";
        ViewData["ActiveNav"] = "Playlist";
        return View();
    }

    [HttpPost("/api/playlist/load")]
    public async Task<IActionResult> LoadPlaylist([FromBody] PlaylistLoadRequest req, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(req?.QueueKey))
        {
            var imported = _playlistService.GetImportedQueue(req.QueueKey);
            if (imported != null)
            {
                return Ok(imported);
            }
        }

        if (string.IsNullOrWhiteSpace(req?.Url))
        {
            return BadRequest(new { success = false, message = "Playlist URL is required." });
        }

        var result = await _playlistService.LoadPlaylistAsync(req.Url, req.Limit, req.Offset, ct);
        if (!result.Success)
        {
            return BadRequest(new { success = false, message = result.ErrorMessage ?? "Failed to load playlist." });
        }

        return Ok(result);
    }

    [HttpPost("/api/playlist/import-tab-queue")]
    public IActionResult ImportTabQueue([FromBody] ImportTabQueueRequest req)
    {
        if (req?.Items == null || req.Items.Count == 0)
        {
            return BadRequest(new { success = false, message = "No items provided in tab queue." });
        }

        var queueKey = _playlistService.SaveImportedQueue(req);
        return Ok(new { success = true, queueKey, count = req.Items.Count });
    }

    [HttpGet("/api/playlist/get-imported-queue/{key}")]
    public IActionResult GetImportedQueue(string key)
    {
        var result = _playlistService.GetImportedQueue(key);
        if (result == null)
        {
            return NotFound(new { success = false, message = "Queue not found." });
        }
        return Ok(result);
    }

    [HttpPost("/api/playlist/probe")]
    public async Task<IActionResult> ProbeVideo([FromBody] PlaylistProbeRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req?.VideoId))
        {
            return BadRequest(new { success = false, message = "Video ID is required." });
        }

        var resolutions = await _playlistService.GetAvailableResolutionsAsync(req.VideoId, ct);
        return Ok(new { success = true, videoId = req.VideoId, resolutions });
    }

    [HttpPost("/api/playlist/download-batch")]
    public async Task<IActionResult> DownloadBatch([FromBody] PlaylistBatchDownloadRequest req)
    {
        if (req?.VideoIds == null || req.VideoIds.Count == 0)
        {
            return BadRequest(new { success = false, message = "Please select at least one video to download." });
        }

        var user = await _userManager.GetUserAsync(User);
        string? userId = user?.Id;
        string? userEmail = user?.Email;
        string? userName = user?.UserName ?? (user != null ? user.Email?.Split('@')[0] : "Guest");

        // Use CancellationToken.None — background downloads must survive browser page refresh/navigation.
        // Each job has its own CancellationTokenSource for explicit user-initiated cancellation.
        var job = await _queueManager.StartBatchDownloadAsync(req, userId, userEmail, userName, CancellationToken.None);
        return Ok(new
        {
            success = true,
            jobId = job.JobId,
            totalVideos = job.TotalVideos,
            message = $"Download queued for {job.TotalVideos} video(s)."
        });
    }

    [HttpGet("/api/playlist/active-jobs")]
    public IActionResult GetActiveJobs()
    {
        var jobs = _queueManager.GetActiveJobs();
        return Ok(jobs);
    }

    [HttpGet("/api/playlist/status/{jobId}")]
    public IActionResult GetStatus(string jobId)
    {
        var job = _queueManager.GetJobState(jobId);
        if (job == null)
        {
            return NotFound(new { success = false, message = "Job not found." });
        }

        return Ok(job);
    }

    [HttpPost("/api/playlist/cancel/{jobId}")]
    public IActionResult CancelBatch(string jobId)
    {
        bool cancelled = _queueManager.CancelBatchJob(jobId);
        return Ok(new { success = cancelled });
    }

    [HttpPost("/api/playlist/cancel-item")]
    public IActionResult CancelItem([FromBody] CancelPlaylistItemRequest req)
    {
        bool cancelled = _queueManager.CancelPlaylistItem(req.JobId, req.VideoId);
        return Ok(new { success = cancelled });
    }

    [HttpPost("/api/playlist/retry-item")]
    public async Task<IActionResult> RetryItem([FromBody] RetryPlaylistItemRequest req)
    {
        bool retried = await _queueManager.RetryPlaylistItemAsync(req.JobId, req.VideoId);
        return Ok(new { success = retried });
    }

    [HttpPost("/api/playlist/retry-all-failed/{jobId}")]
    public async Task<IActionResult> RetryAllFailed(string jobId)
    {
        bool retried = await _queueManager.RetryFailedByGroupAsync(jobId);
        return Ok(new { success = retried });
    }

    [HttpPost("/api/playlist/open-folder")]
    public IActionResult OpenFolder([FromBody] PlaylistBatchDownloadRequest? req)
    {
        string folder = !string.IsNullOrWhiteSpace(req?.OutputFolder) && Directory.Exists(req.OutputFolder)
            ? req.OutputFolder
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");

        if (!Directory.Exists(folder))
        {
            folder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Downloads");
            if (!Directory.Exists(folder)) Directory.CreateDirectory(folder);
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "explorer.exe",
                Arguments = $"\"{folder}\"",
                UseShellExecute = true
            });
        }
        catch { }

        return Ok(new { success = true, path = folder });
    }
}
