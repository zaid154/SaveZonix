using System;
using System.Diagnostics;
using System.IO;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;
using SaveZonix.Models;
using SaveZonix.Services;

namespace Zonix.Controllers;

public class PlaylistController : Controller
{
    private readonly IYouTubePlaylistService _playlistService;
    private readonly IPlaylistQueueManager _queueManager;
    private readonly IMongoCollection<BsonDocument>? _usersCollection;

    public PlaylistController(IYouTubePlaylistService playlistService, IPlaylistQueueManager queueManager, IMongoDatabase? mongoDb = null)
    {
        _playlistService = playlistService;
        _queueManager = queueManager;
        _usersCollection = mongoDb?.GetCollection<BsonDocument>("users");
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

        var result = await _playlistService.LoadPlaylistAsync(req.Url, req.Limit, req.Offset, req.LastVideoId, ct);
        if (!result.Success)
        {
            return BadRequest(new { success = false, message = result.ErrorMessage ?? "Failed to load playlist." });
        }

        return Ok(result);
    }

    [HttpGet("/api/playlist/fetch")]
    public async Task<IActionResult> FetchPlaylist(
        [FromQuery] string url, 
        [FromQuery] int? startIndex, 
        [FromQuery] string? limit,
        [FromQuery] string? lastVideoId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return BadRequest(new { success = false, message = "Playlist URL is required." });
        }

        int offset = (startIndex.HasValue && startIndex.Value > 1) ? startIndex.Value - 1 : 0;
        int parsedLimit = 25;
        if (string.Equals(limit, "all", StringComparison.OrdinalIgnoreCase))
        {
            parsedLimit = 0; // 0 indicates load all
        }
        else if (int.TryParse(limit, out var numLimit))
        {
            parsedLimit = numLimit;
        }

        var result = await _playlistService.LoadPlaylistAsync(url, parsedLimit, offset, lastVideoId, ct);
        if (!result.Success)
        {
            return BadRequest(new { success = false, message = result.ErrorMessage ?? "Failed to fetch playlist items." });
        }

        return Ok(result);
    }

    [HttpPost("/api/playlist/fetch")]
    public async Task<IActionResult> FetchPlaylistPost(
        [FromBody] PlaylistLoadRequest req, 
        [FromQuery] int? startIndex, 
        [FromQuery] string? limit, 
        CancellationToken ct)
    {
        string? targetUrl = req?.Url;
        if (string.IsNullOrWhiteSpace(targetUrl))
        {
            return BadRequest(new { success = false, message = "Playlist URL is required." });
        }

        int offset = (startIndex.HasValue && startIndex.Value > 1) 
            ? startIndex.Value - 1 
            : (req?.Offset ?? 0);

        int parsedLimit = 25;
        if (string.Equals(limit, "all", StringComparison.OrdinalIgnoreCase))
        {
            parsedLimit = 0;
        }
        else if (int.TryParse(limit, out var numLimit))
        {
            parsedLimit = numLimit;
        }
        else if (req?.Limit.HasValue == true)
        {
            parsedLimit = req.Limit.Value;
        }

        var result = await _playlistService.LoadPlaylistAsync(targetUrl, parsedLimit, offset, req?.LastVideoId, ct);
        if (!result.Success)
        {
            return BadRequest(new { success = false, message = result.ErrorMessage ?? "Failed to fetch playlist items." });
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

        // Fetch real duration from YouTube for enrichment (fixes 00:00 from extension scrape)
        string formattedDuration = "";
        int durationSeconds = 0;
        try
        {
            var ytClient = Zonix.Core.YouTubeClientFactory.SharedClient;
            var video = await ytClient.Videos.GetAsync(req.VideoId, ct);
            if (video.Duration.HasValue)
            {
                durationSeconds = (int)video.Duration.Value.TotalSeconds;
                formattedDuration = video.Duration.Value.TotalHours >= 1
                    ? video.Duration.Value.ToString(@"hh\:mm\:ss")
                    : video.Duration.Value.ToString(@"mm\:ss");
            }
        }
        catch { }

        return Ok(new { success = true, videoId = req.VideoId, resolutions, formattedDuration, durationSeconds });
    }

    [HttpPost("/api/playlist/download-batch")]
    [HttpPost("/api/playlist/start-batch")]
    public async Task<IActionResult> DownloadBatch([FromBody] PlaylistBatchDownloadRequest req)
    {
        if (req?.VideoIds == null || req.VideoIds.Count == 0)
        {
            return BadRequest(new { success = false, message = "Please select at least one video to download." });
        }

        string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        string? userEmail = User.FindFirstValue(ClaimTypes.Email);
        string? userName = User.Identity?.Name ?? (userEmail != null ? userEmail.Split('@')[0] : "Guest");
        string? role = User.FindFirstValue(ClaimTypes.Role);

        // Strict VIP PRO enforcement for Batch Playlist Studio
        bool isVip = false;

        // 1. Direct Admin Bypass (Master Admin Email or Role or Admin Key Header)
        if (User.IsInRole("Admin") ||
            string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(userEmail, "zaidm1323@gmail.com", StringComparison.OrdinalIgnoreCase) ||
            Request.Headers["x-admin-key"] == "savezonix_admin_2026")
        {
            isVip = true;
        }
        else if (User.FindFirst("isVip")?.Value == "true")
        {
            isVip = true;
        }
        else if (!string.IsNullOrEmpty(userEmail) && _usersCollection != null)
        {
            try
            {
                var filter = Builders<BsonDocument>.Filter.Or(
                    Builders<BsonDocument>.Filter.Eq("email", userEmail.ToLowerInvariant()),
                    Builders<BsonDocument>.Filter.Eq("Email", userEmail.ToLowerInvariant())
                );
                var userDoc = await _usersCollection.Find(filter).FirstOrDefaultAsync();
                if (userDoc != null)
                {
                    string docRole = userDoc.Contains("role") ? userDoc["role"].AsString :
                                    (userDoc.Contains("Role") ? userDoc["Role"].AsString : "User");
                    if (string.Equals(docRole, "Admin", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(userEmail, "zaidm1323@gmail.com", StringComparison.OrdinalIgnoreCase))
                    {
                        isVip = true;
                    }
                    else if (userDoc.Contains("isVip") && !userDoc["isVip"].IsBsonNull && userDoc["isVip"].ToBoolean())
                    {
                        // Check if VIP expired
                        if (userDoc.Contains("vipExpiresAt") && !userDoc["vipExpiresAt"].IsBsonNull)
                        {
                            var expiry = userDoc["vipExpiresAt"].ToUniversalTime();
                            if (expiry >= DateTime.UtcNow)
                            {
                                isVip = true;
                            }
                        }
                        else
                        {
                            // Null expiry = Lifetime VIP
                            isVip = true;
                        }
                    }
                }
            }
            catch { }
        }

        if (!isVip)
        {
            return StatusCode(403, new
            {
                success = false,
                isVipRequired = true,
                message = "Batch Playlist Studio is an exclusive VIP PRO feature. Please upgrade to unlock unlimited 4K batch playlist downloads.",
                upgradeUrl = "https://save-zonix.vercel.app/#pricing"
            });
        }

        // Use CancellationToken.None — background downloads must survive browser page refresh/navigation.
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
        bool retried = await _queueManager.RetryPlaylistItemAsync(req.JobId, req.VideoId, req.TaskId);
        return Ok(new { success = retried });
    }

    [HttpPost("/api/playlist/retry-all-failed/{jobId}")]
    public async Task<IActionResult> RetryAllFailed(string jobId, [FromQuery] string? groupKey = null)
    {
        bool retried = await _queueManager.RetryFailedByGroupAsync(jobId, groupKey);
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
