using System.Collections.Concurrent;
using System.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using SaveZonix.Models;
using YoutubeExplode;
using YoutubeExplode.Common;
using YoutubeExplode.Videos.Streams;

namespace SaveZonix.Services;

public class PlaylistQueueManager : IPlaylistQueueManager
{
    private static readonly HttpClient _sharedHttpClient = new(new SocketsHttpHandler
    {
        AutomaticDecompression = System.Net.DecompressionMethods.All,
        MaxConnectionsPerServer = 500,
        EnableMultipleHttp2Connections = true,
        PooledConnectionLifetime = TimeSpan.FromMinutes(15),
        PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
        ConnectTimeout = TimeSpan.FromSeconds(15)
    })
    {
        Timeout = TimeSpan.FromHours(1)
    };

    private readonly ConcurrentDictionary<string, PlaylistBatchJobState> _jobs = new();
    private readonly YoutubeClient _youtubeClient = new(_sharedHttpClient);
    private static int _playlistCounter = 0;

    private static string FormatFriendlyError(string? rawError)
    {
        if (string.IsNullOrWhiteSpace(rawError)) return "Unknown download error";
        string err = rawError.ToLowerInvariant();
        if (err.Contains("no such host") || err.Contains("name resolution") || err.Contains("dns"))
            return "DNS Timeout: Server could not reach YouTube CDN";
        if (err.Contains("connection refused") || err.Contains("timed out") || err.Contains("timeout"))
            return "Connection Timeout: YouTube stream server timed out";
        if (err.Contains("forcibly closed") || err.Contains("transport connection") || err.Contains("connection reset"))
            return "Connection Closed: YouTube CDN reset network stream";
        if (err.Contains("private") || err.Contains("unavailable") || err.Contains("removed"))
            return "Video Unavailable: Video is private, age-restricted, or removed";
        if (err.Contains("geo") || err.Contains("country") || err.Contains("blocked"))
            return "Region Blocked: Video is blocked in your location";
        if (err.Contains("mux") || err.Contains("ffmpeg"))
            return "Muxing Error: FFmpeg failed to merge audio and video tracks";
        return rawError.Length > 90 ? rawError[..87] + "..." : rawError;
    }
    private readonly IServiceScopeFactory _scopeFactory;

    public PlaylistQueueManager(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    public PlaylistBatchJobState? GetJobState(string jobId)
    {
        if (_jobs.TryGetValue(jobId, out var state))
        {
            UpdateJobStats(state);
            return state;
        }
        return null;
    }

    public List<PlaylistBatchJobState> GetActiveJobs()
    {
        var list = _jobs.Values
            .Where(j => j.Status == "Running" || j.Status == "Downloading" || j.Status == "Queued" || (j.ActiveCount > 0 || j.QueuedCount > 0) || j.FailedCount > 0)
            .OrderByDescending(j => j.CreatedAt)
            .ToList();
        foreach (var job in list)
        {
            UpdateJobStats(job);
        }
        return list;
    }

    public bool CancelBatchJob(string jobId)
    {
        if (_jobs.TryGetValue(jobId, out var job))
        {
            try { job.Cts?.Cancel(); } catch { }
            job.Status = "Cancelled";
            foreach (var item in job.Items)
            {
                if (item.Status != "Completed")
                {
                    try { item.Cts?.Cancel(); } catch { }
                    item.Status = "Cancelled";
                    item.ErrorMessage = "Download cancelled by user";
                    using (var scope = _scopeFactory.CreateScope())
                    {
                        var historyService = scope.ServiceProvider.GetService<StreamHelper.Services.IDownloadHistoryService>();
                        historyService?.MarkCancelledAsync(item.TaskId).ConfigureAwait(false);
                    }
                }
            }
            UpdateJobStats(job);
            return true;
        }
        return false;
    }

    public bool CancelPlaylistItem(string jobId, string videoId)
    {
        if (_jobs.TryGetValue(jobId, out var job))
        {
            var item = job.Items.FirstOrDefault(i => i.VideoId == videoId || i.TaskId == videoId);
            if (item != null && item.Status != "Completed")
            {
                try { item.Cts?.Cancel(); } catch { }
                item.Status = "Cancelled";
                item.ErrorMessage = "Download cancelled by user";
                using (var scope = _scopeFactory.CreateScope())
                {
                    var historyService = scope.ServiceProvider.GetService<StreamHelper.Services.IDownloadHistoryService>();
                    historyService?.MarkCancelledAsync(item.TaskId).ConfigureAwait(false);
                }
                UpdateJobStats(job);
                return true;
            }
        }
        return false;
    }

    public bool CancelPlaylistItemByTaskId(string taskId)
    {
        foreach (var job in _jobs.Values)
        {
            var item = job.Items.FirstOrDefault(i => i.TaskId == taskId || i.VideoId == taskId);
            if (item != null && item.Status != "Completed")
            {
                try { item.Cts?.Cancel(); } catch { }
                item.Status = "Cancelled";
                item.ErrorMessage = "Download cancelled by user";
                using (var scope = _scopeFactory.CreateScope())
                {
                    var historyService = scope.ServiceProvider.GetService<StreamHelper.Services.IDownloadHistoryService>();
                    historyService?.MarkCancelledAsync(item.TaskId).ConfigureAwait(false);
                }
                UpdateJobStats(job);
                return true;
            }
        }
        return false;
    }

    public Task<bool> RetryPlaylistItemAsync(string jobId, string videoId)
    {
        if (!_jobs.TryGetValue(jobId, out var job))
        {
            return Task.FromResult(false);
        }

        var item = job.Items.FirstOrDefault(i => i.VideoId == videoId);
        if (item == null) return Task.FromResult(false);

        if (job.Cts == null || job.Cts.IsCancellationRequested)
        {
            job.Cts = new CancellationTokenSource();
        }
        item.Cts = new CancellationTokenSource();

        item.Status = "Pending";
        item.Percentage = 0;
        item.SpeedMBps = 0;
        item.BytesDownloaded = 0;
        item.ErrorMessage = null;
        item.RetryCount++;

        job.Status = "Downloading";
        UpdateJobStats(job);

        _ = Task.Run(async () =>
        {
            try
            {
                await DownloadSingleItemAsync(item, job, job.Cts?.Token ?? CancellationToken.None);
            }
            catch (Exception ex)
            {
                item.Status = "Failed";
                item.ErrorMessage = ex.Message;
            }
            finally
            {
                UpdateJobStats(job);
                job.Status = job.FailedCount > 0 ? (job.CompletedCount > 0 ? "Completed with Errors" : "Failed") : (job.ActiveCount > 0 ? "Downloading" : "Completed");
            }
        });

        return Task.FromResult(true);
    }

    public Task<bool> RetryAllFailedAsync(string jobId)
    {
        if (!_jobs.TryGetValue(jobId, out var job))
        {
            return Task.FromResult(false);
        }

        var failedItems = job.Items.Where(i => i.Status == "Failed" || i.Status == "Cancelled").ToList();
        if (failedItems.Count == 0) return Task.FromResult(false);

        if (job.Cts == null || job.Cts.IsCancellationRequested)
        {
            job.Cts = new CancellationTokenSource();
        }

        foreach (var item in failedItems)
        {
            item.Status = "Pending";
            item.Percentage = 0;
            item.SpeedMBps = 0;
            item.BytesDownloaded = 0;
            item.ErrorMessage = null;
            item.RetryCount++;
            item.Cts = new CancellationTokenSource();
        }

        job.Status = "Downloading";
        UpdateJobStats(job);

        _ = Task.Run(async () =>
        {
            using var semaphore = new SemaphoreSlim(Math.Clamp(job.Items.Count > 2 ? 4 : 2, 1, 6));
            var tasks = failedItems.Select(async (item, idx) =>
            {
                // Stagger starts by 250ms to protect local DNS/sockets
                await Task.Delay(idx * 250);
                await semaphore.WaitAsync();
                try
                {
                    await DownloadSingleItemAsync(item, job, job.Cts?.Token ?? CancellationToken.None);
                }
                catch (Exception ex)
                {
                    item.Status = "Failed";
                    item.ErrorMessage = ex.Message;
                }
                finally
                {
                    semaphore.Release();
                    UpdateJobStats(job);
                }
            });

            await Task.WhenAll(tasks);
            UpdateJobStats(job);
            job.Status = job.FailedCount > 0 ? (job.CompletedCount > 0 ? "Completed with Errors" : "Failed") : "Completed";
        });

        return Task.FromResult(true);
    }

    public async Task<bool> RetryFailedByGroupAsync(string groupIdentifier)
    {
        if (string.IsNullOrWhiteSpace(groupIdentifier)) return false;

        // 1. Direct JobId match
        if (_jobs.ContainsKey(groupIdentifier))
        {
            return await RetryAllFailedAsync(groupIdentifier);
        }

        // 2. Search in-memory active jobs by PlaylistCode or Title
        var matchingJob = _jobs.Values.FirstOrDefault(j =>
            string.Equals(j.JobId, groupIdentifier, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(j.PlaylistCode, groupIdentifier, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(j.PlaylistTitle, groupIdentifier, StringComparison.OrdinalIgnoreCase));

        if (matchingJob != null)
        {
            return await RetryAllFailedAsync(matchingJob.JobId);
        }

        // 3. Fallback: Query database DownloadHistories by groupStrategy or taskId
        using var scope = _scopeFactory.CreateScope();
        var historyService = scope.ServiceProvider.GetService<StreamHelper.Services.IDownloadHistoryService>();
        if (historyService == null) return false;

        var allRes = await historyService.GetAllDownloadsAsync(1, 500, null, null, null, null);
        var failedHistories = allRes.Items
            .Where(d => (d.Status == StreamHelper.Data.DownloadStatus.Failed || d.Status == StreamHelper.Data.DownloadStatus.Cancelled) &&
                        !string.IsNullOrEmpty(d.OriginalUrl) &&
                        ((d.DownloadStrategy != null && d.DownloadStrategy.Contains(groupIdentifier, StringComparison.OrdinalIgnoreCase)) ||
                         (d.Title != null && d.Title.Contains(groupIdentifier, StringComparison.OrdinalIgnoreCase))))
            .ToList();

        if (failedHistories.Count == 0) return false;

        // Create a new batch job on the fly for these failed items!
        string newJobId = Guid.NewGuid().ToString("N");
        string playlistCode = groupIdentifier.StartsWith("PL-", StringComparison.OrdinalIgnoreCase) ? groupIdentifier : "PL-RETRY";
        string title = failedHistories.First().DownloadStrategy?.Replace("Playlist:", "").Trim() ?? "Retry Playlist Items";

        var newJob = new PlaylistBatchJobState
        {
            JobId = newJobId,
            PlaylistCode = playlistCode,
            PlaylistTitle = title,
            UserId = failedHistories.First().UserId,
            UserEmail = failedHistories.First().UserEmail,
            UserName = failedHistories.First().UserName,
            TotalVideos = failedHistories.Count,
            QueuedCount = failedHistories.Count,
            Status = "Downloading",
            OutputFolder = GetDownloadsDirectory(),
            Cts = new CancellationTokenSource(),
            Items = failedHistories.Select((h, idx) =>
            {
                string vid = "";
                try
                {
                    var uri = new Uri(h.OriginalUrl);
                    var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
                    vid = query["v"] ?? "";
                }
                catch { }
                if (string.IsNullOrEmpty(vid)) vid = h.Id;

                return new PlaylistItemDownloadState
                {
                    TaskId = h.Id,
                    VideoId = vid,
                    Index = idx + 1,
                    SubId = $"{playlistCode} #{(idx + 1):D2}",
                    Title = h.Title,
                    ThumbnailUrl = h.ThumbnailUrl ?? "",
                    Quality = h.Quality,
                    Format = h.Format,
                    Status = "Pending",
                    Cts = new CancellationTokenSource()
                };
            }).ToList()
        };

        _jobs[newJobId] = newJob;

        _ = Task.Run(async () =>
        {
            using var semaphore = new SemaphoreSlim(Math.Clamp(newJob.Items.Count > 2 ? 4 : 2, 1, 6));
            var tasks = newJob.Items.Select(async (item, idx) =>
            {
                await Task.Delay(idx * 250);
                await semaphore.WaitAsync();
                try
                {
                    await DownloadSingleItemAsync(item, newJob, newJob.Cts?.Token ?? CancellationToken.None);
                }
                catch (Exception ex)
                {
                    item.Status = "Failed";
                    item.ErrorMessage = ex.Message;
                }
                finally
                {
                    semaphore.Release();
                    UpdateJobStats(newJob);
                }
            });

            await Task.WhenAll(tasks);
            UpdateJobStats(newJob);
            newJob.Status = newJob.FailedCount > 0 ? (newJob.CompletedCount > 0 ? "Completed with Errors" : "Failed") : "Completed";
        });

        return true;
    }

    public async Task<PlaylistBatchJobState> StartBatchDownloadAsync(PlaylistBatchDownloadRequest request, string? userId = null, string? userEmail = null, string? userName = null, CancellationToken cancellationToken = default)
    {
        string jobId = Guid.NewGuid().ToString("N");
        string playlistCode = $"PL-{Interlocked.Increment(ref _playlistCounter):D2}";

        string baseDownloads = !string.IsNullOrWhiteSpace(request.OutputFolder) && Directory.Exists(request.OutputFolder)
            ? request.OutputFolder
            : GetDownloadsDirectory();

        string safePlaylistTitle = SanitizeFileName(request.PlaylistTitle);
        string playlistFolder = Path.Combine(baseDownloads, safePlaylistTitle);
        if (!Directory.Exists(playlistFolder))
        {
            Directory.CreateDirectory(playlistFolder);
        }

        var cts = new CancellationTokenSource();
        int concurrency = Math.Clamp(request.Concurrency, 1, 12);

        var items = new List<PlaylistItemDownloadState>();
        if (request.Videos != null && request.Videos.Count > 0)
        {
            foreach (var v in request.Videos)
            {
                items.Add(new PlaylistItemDownloadState
                {
                    TaskId = Guid.NewGuid().ToString("N"),
                    VideoId = v.VideoId,
                    Index = v.Index,
                    SubId = $"{playlistCode} #{v.Index:D2}",
                    Title = v.Title,
                    ThumbnailUrl = v.ThumbnailUrl,
                    FormattedDuration = v.FormattedDuration,
                    Quality = request.Quality,
                    Format = request.Format,
                    NumberPrefix = request.NumberPrefix,
                    Status = "Pending",
                    Cts = new CancellationTokenSource()
                });
            }
        }
        else
        {
            int index = 1;
            foreach (var vid in request.VideoIds)
            {
                items.Add(new PlaylistItemDownloadState
                {
                    TaskId = Guid.NewGuid().ToString("N"),
                    VideoId = vid,
                    Index = index,
                    SubId = $"{playlistCode} #{index++:D2}",
                    Quality = request.Quality,
                    Format = request.Format,
                    NumberPrefix = request.NumberPrefix,
                    Status = "Pending",
                    Cts = new CancellationTokenSource()
                });
            }
        }

        var job = new PlaylistBatchJobState
        {
            JobId = jobId,
            PlaylistCode = playlistCode,
            PlaylistTitle = request.PlaylistTitle,
            PlaylistUrl = request.PlaylistUrl,
            UserId = userId,
            UserEmail = userEmail,
            UserName = userName,
            TotalVideos = items.Count,
            QueuedCount = items.Count,
            ActiveCount = 0,
            CompletedCount = 0,
            FailedCount = 0,
            Status = "Downloading",
            OutputFolder = playlistFolder,
            Items = items,
            Cts = cts
        };

        _jobs[jobId] = job;

        _ = Task.Run(async () =>
        {
            await ProcessBatchJobAsync(job, request, concurrency, cts.Token);
        });

        return job;
    }

    private async Task ProcessBatchJobAsync(PlaylistBatchJobState job, PlaylistBatchDownloadRequest request, int concurrency, CancellationToken cancellationToken)
    {
        using var semaphore = new SemaphoreSlim(concurrency);
        var tasks = new List<Task>();

        foreach (var item in job.Items)
        {
            if (cancellationToken.IsCancellationRequested) break;

            tasks.Add(Task.Run(async () =>
            {
                await semaphore.WaitAsync(cancellationToken);
                try
                {
                    if (cancellationToken.IsCancellationRequested || item.Status == "Cancelled") return;
                    await DownloadSingleItemAsync(item, job, cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    item.Status = "Cancelled";
                }
                catch (Exception ex)
                {
                    item.Status = "Failed";
                    item.ErrorMessage = ex.Message;
                    try { await Task.Delay(500, CancellationToken.None); } catch { }
                }
                finally
                {
                    semaphore.Release();
                    UpdateJobStats(job);
                }
            }, cancellationToken));
        }

        try
        {
            await Task.WhenAll(tasks);
        }
        catch { }

        UpdateJobStats(job);
        job.EndTime = DateTime.UtcNow;
        job.Status = job.FailedCount > 0 ? (job.CompletedCount > 0 ? "Completed with Errors" : "Failed") : "Completed";
    }

    private async Task DownloadSingleItemAsync(PlaylistItemDownloadState item, PlaylistBatchJobState job, CancellationToken batchToken)
    {
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(batchToken, item.Cts?.Token ?? CancellationToken.None);
        var ct = linkedCts.Token;
        string targetFolder = job.OutputFolder;

        item.StartTime = DateTime.UtcNow;
        if (job.StartTime == null) job.StartTime = DateTime.UtcNow;
        item.Status = "Analyzing...";
        item.Percentage = 5;

        var sw = Stopwatch.StartNew();
        string tempDirectory = Path.Combine(Path.GetTempPath(), "SaveZonix_PL_" + Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(tempDirectory);

            var video = await GetVideoMetadataWithRetryAsync(item.VideoId, ct);
            item.Title = video.Title;
            item.ThumbnailUrl = video.Thumbnails.GetWithHighestResolution()?.Url ?? $"https://i.ytimg.com/vi/{video.Id}/hqdefault.jpg";
            item.DurationSeconds = (int)(video.Duration?.TotalSeconds ?? 0);
            item.FormattedDuration = video.Duration.HasValue
                ? (video.Duration.Value.TotalHours >= 1 ? video.Duration.Value.ToString(@"hh\:mm\:ss") : video.Duration.Value.ToString(@"mm\:ss"))
                : "00:00";

            string safeTitle = SanitizeFileName(video.Title);
            string ext = item.Format.ToLowerInvariant() switch
            {
                "mp3" => ".mp3",
                "m4a" => ".m4a",
                "webm" => ".webm",
                _ => ".mp4"
            };

            // Always prefix index (01 - , 02 - ) for playlist items so File Explorer sorts cleanly
            string prefix = item.Index > 0 ? $"{item.Index:D2} - " : "";
            string outFileName = $"{prefix}{safeTitle}{ext}";
            item.OutputFileName = outFileName;

            bool isAudioOnly = item.Format.Equals("MP3", StringComparison.OrdinalIgnoreCase) ||
                               item.Format.Equals("M4A", StringComparison.OrdinalIgnoreCase) ||
                               item.Quality.Equals("AudioOnly", StringComparison.OrdinalIgnoreCase);

            // Log download start to database history
            using (var scope = _scopeFactory.CreateScope())
            {
                var historyService = scope.ServiceProvider.GetService<StreamHelper.Services.IDownloadHistoryService>();
                if (historyService != null)
                {
                    try
                    {
                        string pageUrl = $"https://www.youtube.com/watch?v={item.VideoId}";
                        string groupStrategy = $"Playlist: {job.PlaylistCode} • {job.PlaylistTitle}";
                        await historyService.CreateOrUpdateDownloadAsync(
                            item.TaskId, job.UserId, job.UserEmail, job.UserName ?? "Guest",
                            pageUrl, item.Title, outFileName, item.ThumbnailUrl,
                            "YouTube", isAudioOnly ? "Audio" : "Video",
                            item.Format.ToUpperInvariant(), item.Quality, "H.264 / AAC",
                            item.DurationSeconds, 0, 4, groupStrategy);
                    }
                    catch { }
                }
            }

            var manifest = await GetStreamManifestWithRetryAsync(item.VideoId, ct);

            string tempOutput = Path.Combine(tempDirectory, "out" + ext);

            sw.Restart();
            long lastBytes = 0;
            double lastSeconds = 0;

            if (isAudioOnly)
            {
                item.Status = "⚡ Turbo Downloading Audio Track...";
                var audioStream = manifest.GetAudioOnlyStreams().GetWithHighestBitrate();
                if (audioStream == null)
                {
                    throw new Exception("No audio stream available for this video.");
                }

                item.TotalBytes = audioStream.Size.Bytes;
                string tempAudioRaw = Path.Combine(tempDirectory, "audio_raw.bin");

                var audioProgress = new Progress<long>(readBytes =>
                {
                    item.BytesDownloaded = readBytes;
                    if (audioStream.Size.Bytes > 0)
                    {
                        item.Percentage = Math.Min(88.0, Math.Round((double)readBytes / audioStream.Size.Bytes * 85.0, 1));
                    }
                    double elapsed = sw.Elapsed.TotalSeconds;
                    if (elapsed - lastSeconds >= 0.4)
                    {
                        double diffMb = (item.BytesDownloaded - lastBytes) / (1024.0 * 1024.0);
                        item.SpeedMBps = Math.Max(0.1, Math.Round(diffMb / (elapsed - lastSeconds), 1));
                        if (item.SpeedMBps > item.PeakSpeedMBps) item.PeakSpeedMBps = item.SpeedMBps;
                        lastSeconds = elapsed;
                        lastBytes = item.BytesDownloaded;
                    }
                });

                await DownloadStreamParallelAsync(audioStream, tempAudioRaw, audioProgress, ct, turboChunks: 6);

                if (item.Format.Equals("MP3", StringComparison.OrdinalIgnoreCase))
                {
                    item.Status = "Converting to High-Quality MP3 (320 kbps)...";
                    item.Percentage = 90;
                    bool converted = await ExtractAudioAsync(tempAudioRaw, tempOutput, "320k");
                    if (!converted || !File.Exists(tempOutput))
                    {
                        File.Move(tempAudioRaw, tempOutput, true);
                    }
                }
                else
                {
                    item.Status = "Finalizing M4A...";
                    File.Move(tempAudioRaw, tempOutput, true);
                }
            }
            else
            {
                IVideoStreamInfo? videoStream = null;
                var allVideoStreams = manifest.GetVideoStreams().ToList();

                if (item.Quality.Equals("Best", StringComparison.OrdinalIgnoreCase))
                {
                    videoStream = manifest.GetVideoStreams().OrderByDescending(s => s.VideoQuality).FirstOrDefault();
                }
                else
                {
                    string targetLabel = item.Quality.ToLowerInvariant().Replace("p", "");
                    videoStream = allVideoStreams
                        .FirstOrDefault(s => s.VideoQuality.Label.StartsWith(targetLabel, StringComparison.OrdinalIgnoreCase))
                        ?? manifest.GetVideoStreams().OrderByDescending(s => s.VideoQuality).FirstOrDefault();
                }

                if (videoStream == null)
                {
                    throw new Exception("No suitable video stream found.");
                }

                var allAudioStreams = manifest.GetAudioOnlyStreams().ToList();
                var audioStream = allAudioStreams.Where(s => s.Container == Container.Mp4).GetWithHighestBitrate()
                    ?? allAudioStreams.GetWithHighestBitrate();

                if (videoStream is MuxedStreamInfo muxed)
                {
                    item.Status = $"Downloading {videoStream.VideoQuality.Label} Stream...";
                    item.TotalBytes = muxed.Size.Bytes;

                    var muxProgress = new Progress<long>(readBytes =>
                    {
                        item.BytesDownloaded = readBytes;
                        if (muxed.Size.Bytes > 0)
                        {
                            item.Percentage = Math.Min(95.0, Math.Round((double)readBytes / muxed.Size.Bytes * 95.0, 1));
                        }
                        double elapsed = sw.Elapsed.TotalSeconds;
                        if (elapsed - lastSeconds >= 0.4)
                        {
                            double diffMb = (item.BytesDownloaded - lastBytes) / (1024.0 * 1024.0);
                            item.SpeedMBps = Math.Max(0.1, Math.Round(diffMb / (elapsed - lastSeconds), 1));
                            if (item.SpeedMBps > item.PeakSpeedMBps) item.PeakSpeedMBps = item.SpeedMBps;
                            lastSeconds = elapsed;
                            lastBytes = item.BytesDownloaded;
                        }
                    });

                    await DownloadStreamParallelAsync(muxed, tempOutput, muxProgress, ct, turboChunks: 16);
                }
                else
                {
                    string tempVideoRaw = Path.Combine(tempDirectory, "video_track.mp4");
                    string tempAudioRaw = Path.Combine(tempDirectory, "audio_track.mp4");

                    long totalExpected = videoStream.Size.Bytes + (audioStream?.Size.Bytes ?? 0);
                    item.TotalBytes = totalExpected;

                    long videoRead = 0;
                    long audioRead = 0;

                    void UpdateCombinedProgress()
                    {
                        long current = Interlocked.Read(ref videoRead) + Interlocked.Read(ref audioRead);
                        item.BytesDownloaded = current;
                        if (totalExpected > 0)
                        {
                            item.Percentage = Math.Min(92.0, Math.Round((double)current / totalExpected * 90.0, 1));
                        }
                        double elapsed = sw.Elapsed.TotalSeconds;
                        if (elapsed - lastSeconds >= 0.4)
                        {
                            double diffMb = (current - lastBytes) / (1024.0 * 1024.0);
                            item.SpeedMBps = Math.Max(0.1, Math.Round(diffMb / (elapsed - lastSeconds), 1));
                            if (item.SpeedMBps > item.PeakSpeedMBps) item.PeakSpeedMBps = item.SpeedMBps;
                            lastSeconds = elapsed;
                            lastBytes = current;
                        }
                    }

                    var videoProgress = new Progress<long>(b =>
                    {
                        Interlocked.Exchange(ref videoRead, b);
                        UpdateCombinedProgress();
                    });

                    var audioProgress = new Progress<long>(b =>
                    {
                        Interlocked.Exchange(ref audioRead, b);
                        UpdateCombinedProgress();
                    });

                    item.Status = $"⚡ Turbo Downloading {videoStream.VideoQuality.Label} + Audio (Parallel Chunks)...";

                    var videoTask = DownloadStreamParallelAsync(videoStream, tempVideoRaw, videoProgress, ct, turboChunks: 16);
                    var audioTask = audioStream != null
                        ? DownloadStreamParallelAsync(audioStream, tempAudioRaw, audioProgress, ct, turboChunks: 4)
                        : Task.CompletedTask;

                    await Task.WhenAll(videoTask, audioTask);

                    if (audioStream != null)
                    {
                        item.Status = "⚡ Combining Video + Audio (Instant Stream Copy)...";
                        item.Percentage = 93;

                        bool muxSuccess = await MuxVideoAndAudioAsync(tempVideoRaw, tempAudioRaw, tempOutput);
                        if (!muxSuccess || !File.Exists(tempOutput))
                        {
                            File.Move(tempVideoRaw, tempOutput, true);
                        }
                    }
                    else
                    {
                        File.Move(tempVideoRaw, tempOutput, true);
                    }
                }
            }

            item.Status = "Validating File Integrity...";
            item.Percentage = 98;

            if (!File.Exists(tempOutput) || new FileInfo(tempOutput).Length < 1024)
            {
                throw new IOException("Generated output file is missing or corrupted (0 bytes).");
            }

            string finalDestination = GetAvailableUniqueFilePath(targetFolder, outFileName);
            File.Move(tempOutput, finalDestination, true);

            item.OutputPath = finalDestination;
            item.Percentage = 100;
            item.Status = "Completed";
            item.SpeedMBps = 0;
            item.EndTime = DateTime.UtcNow;

            long finalSize = File.Exists(finalDestination) ? new FileInfo(finalDestination).Length : item.TotalBytes;
            double totalSeconds = sw.Elapsed.TotalSeconds;
            double avgSpeed = totalSeconds > 0 ? Math.Round((finalSize / (1024.0 * 1024.0)) / totalSeconds, 2) : 0;
            item.DurationSecondsTaken = Math.Round(totalSeconds, 1);
            item.AverageSpeedMBps = avgSpeed;

            using (var scope = _scopeFactory.CreateScope())
            {
                var historyService = scope.ServiceProvider.GetService<StreamHelper.Services.IDownloadHistoryService>();
                if (historyService != null)
                {
                    try
                    {
                        await historyService.MarkCompletedWithValidationAsync(
                            item.TaskId, finalSize, avgSpeed, item.PeakSpeedMBps > 0 ? item.PeakSpeedMBps : avgSpeed, totalSeconds,
                            "Passed", $"{item.SubId} saved and verified on disk", item.DurationSeconds, $"{item.SubId} • {item.Quality} • {item.Format}");
                    }
                    catch { }
                }
            }
        }
        catch (Exception ex) when (ex is OperationCanceledException || ex.InnerException is OperationCanceledException || ct.IsCancellationRequested || batchToken.IsCancellationRequested || item.Cts?.IsCancellationRequested == true)
        {
            item.EndTime = DateTime.UtcNow;
            item.DurationSecondsTaken = Math.Round(sw.Elapsed.TotalSeconds, 1);
            item.Status = "Cancelled";
            item.ErrorMessage = "Download cancelled by user";
            using (var scope = _scopeFactory.CreateScope())
            {
                var historyService = scope.ServiceProvider.GetService<StreamHelper.Services.IDownloadHistoryService>();
                if (historyService != null)
                {
                    try { await historyService.MarkCancelledAsync(item.TaskId); } catch { }
                }
            }
        }
        catch (Exception ex)
        {
            item.EndTime = DateTime.UtcNow;
            item.DurationSecondsTaken = Math.Round(sw.Elapsed.TotalSeconds, 1);
            string friendlyReason = FormatFriendlyError(ex.Message);
            Console.WriteLine($"[Playlist Video Error] {item.SubId} ({item.VideoId}): {friendlyReason} (Raw: {ex.Message})");
            item.Status = "Failed";
            item.ErrorMessage = friendlyReason;
            using (var scope = _scopeFactory.CreateScope())
            {
                var historyService = scope.ServiceProvider.GetService<StreamHelper.Services.IDownloadHistoryService>();
                if (historyService != null)
                {
                    try { await historyService.MarkFailedAsync(item.TaskId, friendlyReason); } catch { }
                }
            }
        }
        finally
        {
            try { if (Directory.Exists(tempDirectory)) Directory.Delete(tempDirectory, true); } catch { }
        }
    }

    private void UpdateJobStats(PlaylistBatchJobState job)
    {
        int total = job.Items.Count;
        int completed = job.Items.Count(i => i.Status == "Completed");
        int failed = job.Items.Count(i => i.Status == "Failed" || i.Status == "Cancelled");
        int active = job.Items.Count(i => i.Status == "Analyzing..." || i.Status.StartsWith("Downloading") || i.Status.StartsWith("Muxing") || i.Status.StartsWith("Converting") || i.Status.StartsWith("Validating"));
        int queued = job.Items.Count(i => i.Status == "Pending");

        job.CompletedCount = completed;
        job.FailedCount = failed;
        job.ActiveCount = active;
        job.QueuedCount = queued;

        double sumPercent = job.Items.Sum(i => i.Percentage);
        job.OverallPercentage = total > 0 ? Math.Round(sumPercent / total, 1) : 0;

        double sumSpeed = job.Items.Where(i => i.SpeedMBps > 0).Sum(i => i.SpeedMBps);
        job.OverallSpeedMBps = Math.Round(sumSpeed, 1);
        if (job.OverallSpeedMBps > job.PeakSpeedMBps) job.PeakSpeedMBps = job.OverallSpeedMBps;
    }

    // ─────────────────────────────────────────────────────────────
    // Self-Contained Helper Utilities
    // ─────────────────────────────────────────────────────────────
    private static string GetDownloadsDirectory()
    {
        string userDownloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
        if (Directory.Exists(userDownloads)) return userDownloads;
        string localDownloads = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Downloads");
        if (!Directory.Exists(localDownloads)) Directory.CreateDirectory(localDownloads);
        return localDownloads;
    }

    private static string SanitizeFileName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "video.mp4";
        var invalid = Path.GetInvalidFileNameChars().ToHashSet();
        invalid.UnionWith(new[] { '|', ':', '*', '?', '"', '<', '>', '/', '\\' });
        var sb = new System.Text.StringBuilder();
        foreach (var c in name)
        {
            sb.Append(invalid.Contains(c) ? '-' : c);
        }
        string clean = System.Text.RegularExpressions.Regex.Replace(sb.ToString(), @"[-]{2,}", "-");
        clean = System.Text.RegularExpressions.Regex.Replace(clean, @"\s{2,}", " ").Trim(' ', '.', '-');
        return string.IsNullOrWhiteSpace(clean) ? "video.mp4" : clean;
    }

    private static string GetAvailableUniqueFilePath(string folder, string fileName)
    {
        string path = Path.Combine(folder, fileName);
        if (!File.Exists(path)) return path;
        string nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
        string ext = Path.GetExtension(fileName);
        for (int i = 1; i <= 500; i++)
        {
            string candidate = Path.Combine(folder, $"{nameWithoutExt} ({i}){ext}");
            if (!File.Exists(candidate)) return candidate;
        }
        return Path.Combine(folder, $"{nameWithoutExt}_{DateTime.UtcNow.Ticks.ToString().Substring(10)}{ext}");
    }

    private async Task DownloadStreamToDiskAsync(IStreamInfo streamInfo, string targetPath, IProgress<long>? progress, CancellationToken ct)
    {
        using var stream = await _youtubeClient.Videos.Streams.GetAsync(streamInfo, ct);
        using var fileStream = new FileStream(targetPath, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize: 524288, useAsync: true);

        byte[] buffer = new byte[524288]; // 512KB buffer for higher network throughput
        long totalRead = 0;
        int bytesRead;

        while ((bytesRead = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length), ct)) > 0)
        {
            await fileStream.WriteAsync(buffer.AsMemory(0, bytesRead), ct);
            totalRead += bytesRead;
            progress?.Report(totalRead);
        }
        await fileStream.FlushAsync(ct);
    }

    // ─────────────────────────────────────────────────────────────
    // ⚡ TURBO BURST ENGINE (VidMate / yt-dlp Style for YouTube GoogleVideo)
    // 1. Splits streams into fast 4MB chunks (sweet spot for YouTube GoogleVideo burst without throttling)
    // 2. Uses a pool of 6 parallel worker tasks to pull chunks concurrently
    // 3. Writes directly into the target file via RandomAccess.WriteAsync at exact byte offsets
    //    (ZERO temporary .part files, ZERO file merge latency, ZERO disk clutter!)
    // 4. Emulates authentic YouTube HTML5 player HTTP headers to bypass play-rate pacing
    // ─────────────────────────────────────────────────────────────
    private static void AddYouTubePlayerHeaders(HttpRequestMessage req)
    {
        req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
        req.Headers.TryAddWithoutValidation("Origin", "https://www.youtube.com");
        req.Headers.TryAddWithoutValidation("Referer", "https://www.youtube.com/");
        req.Headers.TryAddWithoutValidation("Accept", "*/*");
        req.Headers.TryAddWithoutValidation("Accept-Encoding", "identity;q=1, *;q=0");
        req.Headers.TryAddWithoutValidation("Sec-Fetch-Dest", "video");
        req.Headers.TryAddWithoutValidation("Sec-Fetch-Mode", "cors");
        req.Headers.TryAddWithoutValidation("Sec-Fetch-Site", "cross-site");
    }

    private async Task DownloadStreamParallelAsync(IStreamInfo streamInfo, string targetPath, IProgress<long>? progress, CancellationToken ct, int turboChunks = 32)
    {
        string directUrl = streamInfo.Url;
        long totalSize = streamInfo.Size.Bytes;

        // If stream is too small (<1MB) or no size info, fall back to single-stream
        if (totalSize < 1 * 1024 * 1024 || string.IsNullOrEmpty(directUrl))
        {
            await DownloadStreamToDiskAsync(streamInfo, targetPath, progress, ct);
            return;
        }

        // Verify HTTP Range support with a probe request
        bool supportsRange = false;
        try
        {
            using var probeReq = new HttpRequestMessage(HttpMethod.Get, directUrl);
            probeReq.Version = System.Net.HttpVersion.Version11;
            probeReq.VersionPolicy = HttpVersionPolicy.RequestVersionExact;
            AddYouTubePlayerHeaders(probeReq);
            probeReq.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0, 0);

            using var probeResp = await _sharedHttpClient.SendAsync(probeReq, HttpCompletionOption.ResponseHeadersRead, ct);
            supportsRange = probeResp.StatusCode == System.Net.HttpStatusCode.PartialContent;

            if (probeResp.Content.Headers.ContentRange?.Length.HasValue == true)
            {
                totalSize = probeResp.Content.Headers.ContentRange.Length.Value;
            }
        }
        catch
        {
            // Probe failed
        }

        if (!supportsRange)
        {
            await DownloadStreamToDiskAsync(streamInfo, targetPath, progress, ct);
            return;
        }

        // 2MB micro-burst chunk size: YouTube GoogleVideo serves 2MB in instant wire burst without triggering throttling
        const long CHUNK_SIZE = 2L * 1024 * 1024;
        var chunkRanges = new ConcurrentQueue<(int Index, long Start, long End)>();
        int chunkIdx = 0;
        for (long start = 0; start < totalSize; start += CHUNK_SIZE)
        {
            long end = Math.Min(start + CHUNK_SIZE - 1, totalSize - 1);
            chunkRanges.Enqueue((chunkIdx++, start, end));
        }

        try
        {
            if (File.Exists(targetPath)) File.Delete(targetPath);
            using var targetFileHandle = File.OpenHandle(targetPath, FileMode.Create, FileAccess.ReadWrite, FileShare.ReadWrite, FileOptions.Asynchronous, totalSize);
            RandomAccess.SetLength(targetFileHandle, totalSize);

            long totalBytesDownloaded = 0;
            // Multi-socket HTTP/1.1 burst workers (up to 16 parallel connections) fully saturates 300+ Mbps connections
            int workerCount = Math.Clamp(turboChunks, 6, 16);
            var workers = new List<Task>();

            for (int w = 0; w < workerCount; w++)
            {
                workers.Add(Task.Run(async () =>
                {
                    byte[] buffer = new byte[524288]; // 512KB read buffer for maximum pipe throughput
                    while (chunkRanges.TryDequeue(out var chunk) && !ct.IsCancellationRequested)
                    {
                        await DownloadSingleBurstChunkAsync(directUrl, targetFileHandle, chunk.Start, chunk.End, buffer,
                            bytesRead =>
                            {
                                Interlocked.Add(ref totalBytesDownloaded, bytesRead);
                                progress?.Report(Interlocked.Read(ref totalBytesDownloaded));
                            }, ct);
                    }
                }, ct));
            }

            await Task.WhenAll(workers);

            // Final verification
            if (!File.Exists(targetPath) || new FileInfo(targetPath).Length < Math.Min(totalSize, 1024))
            {
                throw new IOException("Parallel chunk download produced incomplete file.");
            }
        }
        catch (Exception chunkEx) when (!ct.IsCancellationRequested)
        {
            Console.WriteLine($"[Turbo Fallback] Parallel burst notice ({chunkEx.Message}). Using single-stream fallback...");
            try { if (File.Exists(targetPath)) File.Delete(targetPath); } catch { }
            await DownloadStreamToDiskAsync(streamInfo, targetPath, progress, ct);
        }
    }

    private async Task DownloadSingleBurstChunkAsync(string url, Microsoft.Win32.SafeHandles.SafeFileHandle fileHandle, long rangeStart, long rangeEnd, byte[] buffer, Action<int> onBytesRead, CancellationToken ct, int maxRetries = 4)
    {
        int attempt = 0;
        long expectedLength = rangeEnd - rangeStart + 1;

        while (attempt < maxRetries && !ct.IsCancellationRequested)
        {
            attempt++;
            long writtenThisAttempt = 0;
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(TimeSpan.FromSeconds(25)); // 25s timeout is plenty for 4MB

                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Version = System.Net.HttpVersion.Version11;
                request.VersionPolicy = HttpVersionPolicy.RequestVersionExact;
                AddYouTubePlayerHeaders(request);
                request.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(rangeStart, rangeEnd);

                using var response = await _sharedHttpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cts.Token);
                response.EnsureSuccessStatusCode();

                if (response.StatusCode == System.Net.HttpStatusCode.OK && rangeStart > 0)
                {
                    throw new InvalidOperationException("Server returned 200 OK instead of 206 Partial Content.");
                }

                await using var contentStream = await response.Content.ReadAsStreamAsync(cts.Token);
                long currentFileOffset = rangeStart;
                int bytesRead;

                while (writtenThisAttempt < expectedLength)
                {
                    int toRead = (int)Math.Min(buffer.Length, expectedLength - writtenThisAttempt);
                    bytesRead = await contentStream.ReadAsync(buffer.AsMemory(0, toRead), cts.Token);
                    if (bytesRead == 0) break;

                    await RandomAccess.WriteAsync(fileHandle, buffer.AsMemory(0, bytesRead), currentFileOffset, cts.Token);
                    currentFileOffset += bytesRead;
                    writtenThisAttempt += bytesRead;
                    onBytesRead(bytesRead);
                }

                if (writtenThisAttempt >= expectedLength)
                {
                    return; // Successfully downloaded and written chunk!
                }
            }
            catch (Exception) when (attempt < maxRetries && !ct.IsCancellationRequested)
            {
                if (writtenThisAttempt > 0)
                {
                    onBytesRead((int)-writtenThisAttempt);
                }
                await Task.Delay(200 * attempt, ct);
            }
        }
    }

    private static string GetFfmpegPath()
    {
        string ffmpegPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ffmpeg.exe");
        if (!File.Exists(ffmpegPath)) ffmpegPath = Path.Combine(Directory.GetCurrentDirectory(), "ffmpeg.exe");
        if (!File.Exists(ffmpegPath)) ffmpegPath = "ffmpeg";
        return ffmpegPath;
    }

    private static async Task<bool> MuxVideoAndAudioAsync(string videoPath, string audioPath, string outputPath)
    {
        // 1. Try instant lossless stream copy first (-c copy) - takes < 1 second!
        try
        {
            var psiFast = new ProcessStartInfo
            {
                FileName = GetFfmpegPath(),
                Arguments = $"-i \"{videoPath}\" -i \"{audioPath}\" -c copy -map 0:v:0 -map 1:a:0? -threads 0 \"{outputPath}\" -y",
                RedirectStandardOutput = false,
                RedirectStandardError = false,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var procFast = Process.Start(psiFast);
            if (procFast != null)
            {
                await procFast.WaitForExitAsync();
                if (procFast.ExitCode == 0 && File.Exists(outputPath) && new FileInfo(outputPath).Length > 1024)
                {
                    return true;
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FFmpeg Fast Mux] {ex.Message}");
        }

        // 2. Fallback: AAC encode if audio codec was incompatible with MP4 container
        try
        {
            if (File.Exists(outputPath)) File.Delete(outputPath);
            var psiFallback = new ProcessStartInfo
            {
                FileName = GetFfmpegPath(),
                Arguments = $"-i \"{videoPath}\" -i \"{audioPath}\" -c:v copy -c:a aac -b:a 192k -threads 0 -preset ultrafast -map 0:v:0 -map 1:a:0? \"{outputPath}\" -y",
                RedirectStandardOutput = false,
                RedirectStandardError = false,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var procFallback = Process.Start(psiFallback);
            if (procFallback != null)
            {
                await procFallback.WaitForExitAsync();
                return procFallback.ExitCode == 0 && File.Exists(outputPath);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FFmpeg Fallback Mux] {ex.Message}");
        }
        return false;
    }

    private static async Task<bool> ExtractAudioAsync(string inputVideoPath, string outputAudioPath, string bitrate = "320k")
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = GetFfmpegPath(),
                Arguments = $"-i \"{inputVideoPath}\" -vn -b:a {bitrate} -threads 0 \"{outputAudioPath}\" -y",
                RedirectStandardOutput = false,
                RedirectStandardError = false,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var proc = Process.Start(psi);
            if (proc != null)
            {
                await proc.WaitForExitAsync();
                return proc.ExitCode == 0 && File.Exists(outputAudioPath);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FFmpeg Audio Extract] {ex.Message}");
        }
        return false;
    }

    private async Task<YoutubeExplode.Videos.Video> GetVideoMetadataWithRetryAsync(string videoId, CancellationToken ct, int maxRetries = 4)
    {
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                return await _youtubeClient.Videos.GetAsync(videoId, ct);
            }
            catch (Exception ex) when (attempt < maxRetries && !ct.IsCancellationRequested)
            {
                Console.WriteLine($"[Metadata DNS/Network Retry] Video {videoId} attempt {attempt} failed ({ex.Message}). Retrying in {attempt * 1.5}s...");
                await Task.Delay(TimeSpan.FromSeconds(attempt * 1.5), ct);
            }
        }
        return await _youtubeClient.Videos.GetAsync(videoId, ct);
    }

    private async Task<YoutubeExplode.Videos.Streams.StreamManifest> GetStreamManifestWithRetryAsync(string videoId, CancellationToken ct, int maxRetries = 4)
    {
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                return await _youtubeClient.Videos.Streams.GetManifestAsync(videoId, ct);
            }
            catch (Exception ex) when (attempt < maxRetries && !ct.IsCancellationRequested)
            {
                Console.WriteLine($"[Manifest DNS/Network Retry] Video {videoId} attempt {attempt} failed ({ex.Message}). Retrying in {attempt * 1.5}s...");
                await Task.Delay(TimeSpan.FromSeconds(attempt * 1.5), ct);
            }
        }
        return await _youtubeClient.Videos.Streams.GetManifestAsync(videoId, ct);
    }
}
