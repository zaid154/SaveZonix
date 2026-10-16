using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using SaveZonix.Core;
using SaveZonix.Models;
using SaveZonix.Services;
using StreamHelper.Data;
using StreamHelper.Services;
using Zonix.Core;

namespace SaveZonix.Endpoints;

public static class DownloadEndpoints
{
    public static WebApplication MapDownloadEndpoints(this WebApplication app)
    {
        // 1. Analyze Stream / Webpage API
        app.MapPost("/api/analyze", async (AnalyzeRequest req, IDownloadAnalyticsService analyticsService) =>
        {
            if (string.IsNullOrWhiteSpace(req.Url) || !Uri.TryCreate(req.Url, UriKind.Absolute, out _))
                return Results.BadRequest(new { success = false, message = "Please provide a valid stream or webpage URL." });

            try
            {
                using var httpClient = MediaHelper.CreateConfiguredHttpClient();
                var parser = new M3U8Parser(httpClient);
                var result = await parser.ParseAsync(req.Url);
                var platformSettings = await analyticsService.GetSettingsAsync();

                if (result.IsMaster && result.Qualities.Count > 0 && result.TotalSegments == 0)
                {
                    try
                    {
                        var previewMedia = await parser.ParseAsync(result.Qualities[0].Url);
                        result.TotalSegments = previewMedia.TotalSegments;
                        if (result.DurationSeconds == 0) result.DurationSeconds = previewMedia.DurationSeconds;
                        foreach (var q in result.Qualities) q.DurationSeconds = result.DurationSeconds;
                    }
                    catch { }
                }

                string proxiedThumb = !string.IsNullOrEmpty(result.ThumbnailUrl)
                    ? $"/api/proxy-image?url={Uri.EscapeDataString(result.ThumbnailUrl)}"
                    : "";

                return Results.Ok(new
                {
                    success = true,
                    isMaster = result.IsMaster,
                    isDirectMediaFile = result.IsDirectMediaFile,
                    isLiveStream = result.IsLiveStream,
                    title = result.Title,
                    description = result.Description,
                    thumbnailUrl = proxiedThumb,
                    rawThumbnailUrl = result.ThumbnailUrl,
                    durationSeconds = result.DurationSeconds,
                    formattedDuration = result.FormattedDuration,
                    platform = result.Platform,
                    defaultQuality = platformSettings.DefaultDownloadQuality,
                    requiresBrowserContext = result.RequiresBrowserContext,
                    statusMessage = result.StatusMessage,
                    qualities = result.Qualities.Select(q => new
                    {
                        q.Resolution,
                        q.Bandwidth,
                        q.Codecs,
                        q.Url,
                        q.AudioUrl,
                        q.DisplayName,
                        q.EstimatedSizeBytes,
                        q.FormattedEstimatedSize,
                        q.IsDirectFile
                    }),
                    totalSegments = result.TotalSegments
                });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        });

        // 2. Start Parallel Multi-Threaded Download API
        app.MapPost("/api/download", async (HttpContext httpContext, DownloadRequest req, IServiceScopeFactory scopeFactory, IDownloadAnalyticsService analyticsService) =>
        {
            if (string.IsNullOrWhiteSpace(req.StreamUrl))
                return Results.BadRequest(new { message = "Stream URL is required." });

            string clientIp = httpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            if (httpContext.Request.Headers.TryGetValue("X-Forwarded-For", out var fwd))
                clientIp = fwd.ToString().Split(',')[0].Trim();

            bool isAuthenticated = httpContext.User.Identity?.IsAuthenticated == true;
            if (!isAuthenticated)
            {
                bool canDownload = await analyticsService.CanGuestDownloadAsync(clientIp);
                if (!canDownload)
                {
                    var settings = await analyticsService.GetSettingsAsync();
                    return Results.BadRequest(new
                    {
                        success = false,
                        requireAuth = true,
                        message = settings.AllowGuestDownloads
                            ? $"Daily guest download limit reached ({settings.GuestDailyDownloadLimit}/{settings.GuestDailyDownloadLimit}). Please sign in to continue unlimited high-speed downloads."
                            : "Guest downloads are currently disabled. Please sign in or create an account to download."
                    });
                }
            }

            var taskId = Guid.NewGuid().ToString("N");
            int concurrency = Math.Clamp(req.Concurrency, 1, 256);
            var cts = new CancellationTokenSource();

            string? currentUserId = isAuthenticated ? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier) : null;
            string? currentUserEmail = isAuthenticated ? (httpContext.User.FindFirstValue(ClaimTypes.Email) ?? httpContext.User.Identity?.Name) : null;

            if (string.IsNullOrEmpty(currentUserEmail) && !string.IsNullOrWhiteSpace(req.UserEmail) && req.UserEmail != "Guest" && req.UserEmail != "savezonix@gmail.com")
            {
                currentUserEmail = req.UserEmail.Trim();
                currentUserId = req.UserId?.Trim();
            }

            string effectiveEmail = !string.IsNullOrEmpty(currentUserEmail)
                ? currentUserEmail
                : (isAuthenticated ? (httpContext.User.Identity?.Name ?? "User") : $"Guest ({clientIp})");

            string pageUrl = !string.IsNullOrEmpty(req.OriginalPageUrl) ? req.OriginalPageUrl : req.StreamUrl;
            string videoTitle = !string.IsNullOrEmpty(req.Title) ? req.Title : (!string.IsNullOrEmpty(req.FileName) ? req.FileName : "High-Definition Video Stream");
            string platform = !string.IsNullOrEmpty(req.Platform) ? req.Platform : "Web Stream";
            string quality = !string.IsNullOrEmpty(req.Quality) ? req.Quality : "1080p Full HD";

            var state = new DownloadTaskState
            {
                TaskId = taskId,
                UserId = currentUserId,
                FileName = req.FileName,
                Title = videoTitle,
                ThumbnailUrl = req.ThumbnailUrl ?? "",
                Platform = platform,
                Quality = quality,
                Concurrency = concurrency,
                ActiveThreads = concurrency,
                EstimatedTotalBytes = req.EstimatedSizeBytes,
                Cts = cts
            };
            DownloadTaskManager.RegisterTask(taskId, state);

            string userAgent = httpContext.Request.Headers.UserAgent.ToString();
            string deviceType = userAgent.Contains("Mobile") || userAgent.Contains("Android") || userAgent.Contains("iPhone") ? "Mobile" : "Desktop";
            string browser = userAgent.Contains("Chrome") ? "Chrome" : userAgent.Contains("Safari") ? "Safari" : userAgent.Contains("Firefox") ? "Firefox" : "Browser";
            string os = userAgent.Contains("Windows") ? "Windows" : userAgent.Contains("Android") ? "Android" : (userAgent.Contains("iPhone") || userAgent.Contains("Mac")) ? "Apple OS" : "Linux";

            _ = Task.Run(async () =>
            {
                var sw = Stopwatch.StartNew();
                using var scope = scopeFactory.CreateScope();
                var historyService = scope.ServiceProvider.GetService<IDownloadHistoryService>();
                var scopedAnalytics = scope.ServiceProvider.GetRequiredService<IDownloadAnalyticsService>();
                var adminSettings = scope.ServiceProvider.GetRequiredService<IAdminSettingsService>();
                string tempDirectory = Path.Combine(Path.GetTempPath(), "SaveZonix_" + taskId);

                try
                {
                    using var httpClient = MediaHelper.CreateConfiguredHttpClient();
                    var downloader = new ParallelDownloader(httpClient)
                    {
                        StrictCdnMaxThreads = await adminSettings.GetSettingIntAsync("StrictCdnMaxThreads", 8),
                        OpenCdnMaxThreads = await adminSettings.GetSettingIntAsync("OpenCdnMaxThreads", 256),
                        StrictCdnDomains = await adminSettings.GetSettingAsync("StrictCdnDomains", "phncdn,pornhub,xhpingcdn,xhcdn,xhamster,okxxx,ok.xxx,phcdn,spankbang,sb-cd,mat6tube,pvvstream,xnxx,xnxx-cdn,xvideos,xvideos-cdn,pixelflix,pron.click,freefuckvidz,freepornvideo")
                    };

                    string downloadsFolder = !string.IsNullOrWhiteSpace(req.DestinationFolder) && Directory.Exists(req.DestinationFolder)
                        ? req.DestinationFolder
                        : MediaHelper.GetDownloadsDirectory();
                    if (!Directory.Exists(downloadsFolder)) Directory.CreateDirectory(downloadsFolder);

                    string safeBaseName = MediaHelper.SanitizeFileName(req.FileName);
                    string targetExt = (req.Format?.Equals("MP3", StringComparison.OrdinalIgnoreCase) == true || safeBaseName.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase)) ? ".mp3"
                        : safeBaseName.EndsWith(".m4a", StringComparison.OrdinalIgnoreCase) ? ".m4a"
                        : ".mp4";

                    if (string.IsNullOrWhiteSpace(safeBaseName) || safeBaseName == targetExt)
                        safeBaseName = "SaveZonix_" + DateTime.UtcNow.ToString("yyyyMMdd_HHmmss") + targetExt;
                    else if (!safeBaseName.EndsWith(targetExt, StringComparison.OrdinalIgnoreCase))
                        safeBaseName = Path.GetFileNameWithoutExtension(safeBaseName) + targetExt;

                    string outputFilePath = MediaHelper.GetAvailableUniqueFilePath(downloadsFolder, safeBaseName);
                    string tempMergedFile = Path.Combine(tempDirectory, "merged_" + Guid.NewGuid().ToString("N") + targetExt);

                    var progress = new Progress<DownloadProgressReport>(p =>
                    {
                        state.Percentage = Math.Max(state.Percentage, p.Percentage);
                        state.SpeedMBps = p.SpeedMBps;
                        state.PeakSpeedMBps = p.PeakSpeedMBps;
                        state.DownloadedSegments = p.DownloadedSegments;
                        state.TotalSegments = p.TotalSegments;
                        state.TotalBytesDownloaded = p.TotalBytesDownloaded;
                        state.EstimatedTotalBytes = p.EstimatedTotalBytes;
                        state.ElapsedSeconds = p.Elapsed.TotalSeconds;
                        state.EstimatedSecondsRemaining = p.EstimatedTimeRemaining.TotalSeconds;
                        state.ActiveThreads = p.ActiveThreads;
                        state.Status = p.Status;
                    });

                    if (historyService != null)
                    {
                        try
                        {
                            await historyService.CreateOrUpdateDownloadAsync(
                                taskId, currentUserId, currentUserEmail, currentUserEmail?.Split('@')[0] ?? "Anonymous",
                                pageUrl, videoTitle, safeBaseName, req.ThumbnailUrl, platform,
                                targetExt == ".mp3" ? "Audio" : "Video", targetExt.TrimStart('.').ToUpperInvariant(),
                                quality, "H.264 / AAC", req.DurationSeconds, req.EstimatedSizeBytes, concurrency, "Adaptive Parallel");
                        }
                        catch { }
                    }

                    int maxValidationRetries = 2;
                    int currentAttempt = 0;
                    MediaValidationResult? finalValidation = null;

                    while (currentAttempt <= maxValidationRetries && !cts.Token.IsCancellationRequested)
                    {
                        currentAttempt++;
                        if (currentAttempt > 1)
                        {
                            state.Status = $"Retrying download (Attempt {currentAttempt}/{maxValidationRetries + 1})...";
                            if (historyService != null)
                                await historyService.MarkRetryingAsync(taskId, currentAttempt - 1, finalValidation?.ErrorReason ?? "Integrity check failed");
                        }

                        if (!Directory.Exists(tempDirectory)) Directory.CreateDirectory(tempDirectory);

                        if (!string.IsNullOrEmpty(req.AudioUrl) && req.IsDirectFile)
                        {
                            state.Status = "Downloading High-Def Video & Audio Streams (Parallel)...";
                            string videoTempDir = Path.Combine(tempDirectory, "video_stream");
                            string audioTempDir = Path.Combine(tempDirectory, "audio_stream");
                            Directory.CreateDirectory(videoTempDir);
                            Directory.CreateDirectory(audioTempDir);

                            string tempVideo = Path.Combine(tempDirectory, "video.mp4");
                            string tempAudio = Path.Combine(tempDirectory, "audio.mp4");

                            long videoBytes = 0, audioBytes = 0, confVid = 0, confAud = 0;
                            var audioProgress = new Progress<DownloadProgressReport>(ap =>
                            {
                                Interlocked.Exchange(ref audioBytes, ap.TotalBytesDownloaded);
                                if (ap.EstimatedTotalBytes > 0) Interlocked.Exchange(ref confAud, ap.EstimatedTotalBytes);
                            });

                            var combinedVideoProgress = new Progress<DownloadProgressReport>(vp =>
                            {
                                Interlocked.Exchange(ref videoBytes, vp.TotalBytesDownloaded);
                                if (vp.EstimatedTotalBytes > 0) Interlocked.Exchange(ref confVid, vp.EstimatedTotalBytes);

                                long curTot = Interlocked.Read(ref videoBytes) + Interlocked.Read(ref audioBytes);
                                long totTgt = (confVid > 0 && confAud > 0) ? (confVid + confAud) : (req.EstimatedSizeBytes > 0 ? req.EstimatedSizeBytes : vp.EstimatedTotalBytes);

                                state.Percentage = totTgt > 0 ? Math.Min(100.0, Math.Round((double)curTot / totTgt * 100.0, 1)) : vp.Percentage;
                                state.SpeedMBps = vp.SpeedMBps;
                                state.PeakSpeedMBps = vp.PeakSpeedMBps;
                                state.DownloadedSegments = vp.DownloadedSegments;
                                state.TotalSegments = vp.TotalSegments;
                                state.TotalBytesDownloaded = curTot;
                                state.EstimatedTotalBytes = totTgt;
                                state.ElapsedSeconds = vp.Elapsed.TotalSeconds;
                                state.EstimatedSecondsRemaining = vp.EstimatedTimeRemaining.TotalSeconds;
                                state.ActiveThreads = vp.ActiveThreads;
                                state.Status = vp.Status;
                            });

                            var videoTask = downloader.DownloadDirectFileAsync(req.StreamUrl, videoTempDir, 0, concurrency, combinedVideoProgress, cts.Token);
                            var audioTask = downloader.DownloadDirectFileAsync(req.AudioUrl, audioTempDir, 0, Math.Clamp(concurrency / 2, 4, 32), audioProgress, cts.Token);
                            await Task.WhenAll(videoTask, audioTask);

                            if (!await SegmentMerger.MergeSegmentsAsync(await videoTask, tempVideo, videoTempDir) ||
                                !await SegmentMerger.MergeSegmentsAsync(await audioTask, tempAudio, audioTempDir))
                            {
                                finalValidation = new MediaValidationResult { IsValid = false, IntegrityStatus = MediaIntegrityStatus.Corrupted, ErrorReason = "Video or audio stream failed to download." };
                                break;
                            }

                            state.Status = "Muxing 1080p Video + Audio Container...";
                            state.IsMerging = true;
                            var muxSw = Stopwatch.StartNew();
                            bool muxed = await MediaHelper.MuxVideoAndAudioAsync(tempVideo, tempAudio, tempMergedFile);
                            muxSw.Stop();
                            state.MergeSeconds = muxSw.Elapsed.TotalSeconds;

                            if (!muxed || !File.Exists(tempMergedFile))
                            {
                                finalValidation = new MediaValidationResult { IsValid = false, IntegrityStatus = MediaIntegrityStatus.Corrupted, ErrorReason = "Unable to mux video and audio streams." };
                                break;
                            }
                        }
                        else
                        {
                            if (req.StreamUrl.Contains("youtube.com/watch", StringComparison.OrdinalIgnoreCase) || req.StreamUrl.Contains("youtu.be/", StringComparison.OrdinalIgnoreCase))
                            {
                                finalValidation = new MediaValidationResult { IsValid = false, IntegrityStatus = MediaIntegrityStatus.Corrupted, ErrorReason = "Cannot download YouTube webpage directly. Use SaveZonix Chrome Extension or re-analyze." };
                                break;
                            }

                            bool isDirect = req.IsDirectFile && !req.StreamUrl.Contains(".m3u8", StringComparison.OrdinalIgnoreCase);
                            if (isDirect) isDirect = await CheckIsDirectStreamAsync(httpClient, req.StreamUrl);

                            if (isDirect)
                            {
                                string directTempDir = Path.Combine(tempDirectory, "direct_chunks");
                                var chunks = await downloader.DownloadDirectFileAsync(req.StreamUrl, directTempDir, req.EstimatedSizeBytes, concurrency, progress, cts.Token);
                                if (!await SegmentMerger.MergeSegmentsAsync(chunks, tempMergedFile, directTempDir) || !File.Exists(tempMergedFile))
                                {
                                    finalValidation = new MediaValidationResult { IsValid = false, IntegrityStatus = MediaIntegrityStatus.Corrupted, ErrorReason = "Direct media stream failed to download completely." };
                                    break;
                                }
                            }
                            else
                            {
                                var parser = new M3U8Parser(httpClient);
                                var mediaPlaylist = await parser.ParseAsync(req.StreamUrl);

                                if (req.StreamUrl.Contains("phncdn.com") || req.StreamUrl.Contains("pornhub") || req.StreamUrl.Contains("xhcdn") || req.StreamUrl.Contains("xhamster"))
                                {
                                    state.Status = "Streaming Adaptive HLS Container...";
                                    using var proc = Process.Start(new ProcessStartInfo
                                    {
                                        FileName = MediaHelper.GetFfmpegPath(),
                                        Arguments = $"-headers \"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\\r\\nReferer: https://www.pornhub.com/\\r\\n\" -i \"{req.StreamUrl.Trim()}\" -c copy -bsf:a aac_adtstoasc -movflags +faststart \"{tempMergedFile}\" -y",
                                        UseShellExecute = false,
                                        CreateNoWindow = true
                                    });
                                    if (proc != null) await proc.WaitForExitAsync(cts.Token);
                                }
                                else
                                {
                                    var segmentUrls = mediaPlaylist.SegmentUrls;
                                    if (segmentUrls.Count == 0 && mediaPlaylist.Qualities.Count > 0 && mediaPlaylist.Qualities[0].Url != req.StreamUrl)
                                    {
                                        var sub = await parser.ParseAsync(mediaPlaylist.Qualities[0].Url);
                                        segmentUrls = sub.SegmentUrls;
                                    }

                                    var downloaded = await downloader.DownloadSegmentsAsync(segmentUrls, tempDirectory, concurrency, progress, cts.Token, req.EstimatedSizeBytes);
                                    bool isAudio = targetExt is ".mp3" or ".m4a";

                                    if (isAudio)
                                    {
                                        state.Status = "Extracting High-Quality Audio Track...";
                                        state.IsMerging = true;
                                        var tempVideo = Path.Combine(tempDirectory, "full_temp.ts");
                                        var mSw = Stopwatch.StartNew();
                                        if (await SegmentMerger.MergeSegmentsAsync(downloaded, tempVideo, tempDirectory, false) && File.Exists(tempVideo))
                                        {
                                            await MediaHelper.ExtractAudioAsync(tempVideo, tempMergedFile, "320k");
                                            mSw.Stop();
                                            state.MergeSeconds = mSw.Elapsed.TotalSeconds;
                                        }
                                    }
                                    else
                                    {
                                        state.Status = "Merging Segments into MP4...";
                                        state.IsMerging = true;
                                        var mSw = Stopwatch.StartNew();
                                        bool merged = await SegmentMerger.MergeSegmentsAsync(downloaded, tempMergedFile, tempDirectory, false);
                                        mSw.Stop();
                                        state.MergeSeconds = mSw.Elapsed.TotalSeconds;

                                        if (!merged || !File.Exists(tempMergedFile))
                                        {
                                            finalValidation = new MediaValidationResult { IsValid = false, IntegrityStatus = MediaIntegrityStatus.Corrupted, ErrorReason = "Failed to assemble video segments into valid MP4." };
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        // Validation
                        state.Status = "Validating File Integrity & Media Streams...";
                        bool requiresAudio = targetExt == ".mp4" && (!string.IsNullOrWhiteSpace(req.AudioUrl) || platform.Contains("Instagram", StringComparison.OrdinalIgnoreCase));
                        finalValidation = await MediaValidator.ValidateMediaFileAsync(tempMergedFile, req.DurationSeconds, targetExt.TrimStart('.'), requiresAudio, req.ExpectedResolution);

                        if (finalValidation.IsValid) break;
                        if (currentAttempt <= maxValidationRetries)
                        {
                            try { if (File.Exists(tempMergedFile)) File.Delete(tempMergedFile); } catch { }
                        }
                    }

                    sw.Stop();

                    if (finalValidation != null && finalValidation.IsValid && File.Exists(tempMergedFile))
                    {
                        outputFilePath = MediaHelper.GetAvailableUniqueFilePath(downloadsFolder, Path.GetFileName(outputFilePath));
                        await SafelyMoveFileAsync(tempMergedFile, outputFilePath);

                        var fi = new FileInfo(outputFilePath);
                        state.OutputPath = outputFilePath;
                        state.IsCompleted = true;
                        state.Status = "Download Complete";

                        var record = BuildDownloadRecord(taskId, currentUserId, currentUserEmail, clientIp, deviceType, os, browser, userAgent,
                            pageUrl, videoTitle, req.ThumbnailUrl, platform, quality, req.DurationSeconds, fi.Length, state.SpeedMBps, state.PeakSpeedMBps,
                            sw.Elapsed.TotalSeconds, "Completed", "Passed", finalValidation.DiagnosticReport, finalValidation.ProbedDurationSeconds,
                            finalValidation.Resolution, finalValidation.AudioVideoDetails, currentAttempt - 1);

                        await scopedAnalytics.LogDownloadAsync(record);
                        SyncToCloudAdminAsync(taskId, videoTitle, req.ThumbnailUrl ?? "", Path.GetFileName(outputFilePath), pageUrl, platform, quality, fi.Length, state.SpeedMBps, state.PeakSpeedMBps, targetExt.TrimStart('.'), effectiveEmail, currentUserId, clientIp);

                        if (historyService != null)
                        {
                            await historyService.MarkCompletedWithValidationAsync(
                                taskId, fi.Length, state.SpeedMBps, state.PeakSpeedMBps, sw.Elapsed.TotalSeconds,
                                "Passed", finalValidation.DiagnosticReport, finalValidation.ProbedDurationSeconds, finalValidation.AudioVideoDetails);
                        }

                        if (!isAuthenticated) await scopedAnalytics.RecordGuestDownloadAsync(clientIp);
                    }
                    else
                    {
                        state.IsCompleted = false;
                        state.IsError = true;
                        state.Status = "Download Failed/Corrupted – Please Redownload";
                        state.ErrorMessage = finalValidation?.ErrorReason ?? "Media validation failed. Stream was truncated or corrupted.";
                        try { if (File.Exists(tempMergedFile)) File.Delete(tempMergedFile); } catch { }

                        var failRecord = BuildDownloadRecord(taskId, currentUserId, currentUserEmail, clientIp, deviceType, os, browser, userAgent,
                            pageUrl, videoTitle, req.ThumbnailUrl, platform, quality, req.DurationSeconds, 0, state.SpeedMBps, state.PeakSpeedMBps,
                            sw.Elapsed.TotalSeconds, "Corrupted", finalValidation?.IntegrityStatus.ToString() ?? "Corrupted", finalValidation?.ErrorReason ?? "Media validation failed",
                            0, "", "", currentAttempt - 1, state.ErrorMessage);

                        await scopedAnalytics.LogDownloadAsync(failRecord);
                        if (historyService != null)
                        {
                            await historyService.MarkCorruptedAsync(taskId, state.ErrorMessage, finalValidation?.IntegrityStatus.ToString() ?? "Corrupted", finalValidation?.ErrorReason ?? "Truncated stream", currentAttempt - 1);
                        }
                    }

                    try { if (Directory.Exists(tempDirectory)) Directory.Delete(tempDirectory, true); } catch { }
                }
                catch (OperationCanceledException)
                {
                    state.Status = "Download Cancelled";
                    state.IsPaused = true;
                    if (historyService != null) try { await historyService.MarkCancelledAsync(taskId); } catch { }
                }
                catch (HttpRequestException hEx) when (hEx.Message.Contains("401") || hEx.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    state.IsCompleted = false;
                    state.IsError = true;
                    state.ErrorMessage = "Video stream expired or access denied (401). Please re-analyze the video.";
                    state.Status = "Stream Expired – Please Re-analyze";
                    if (historyService != null) try { await historyService.MarkFailedAsync(taskId, state.ErrorMessage); } catch { }
                }
                catch (Exception ex)
                {
                    state.IsCompleted = false;
                    state.IsError = true;
                    state.ErrorMessage = ex.Message;
                    state.Status = "Download Failed/Corrupted – Please Redownload";
                    if (historyService != null) try { await historyService.MarkFailedAsync(taskId, ex.Message); } catch { }
                    try { if (Directory.Exists(tempDirectory)) Directory.Delete(tempDirectory, true); } catch { }
                }
            });

            return Results.Ok(new { taskId });
        });

        // 3. Operational APIs
        app.MapGet("/api/progress/{taskId}", (string taskId) =>
        {
            var state = DownloadTaskManager.GetTask(taskId);
            return state != null ? Results.Ok(state) : Results.NotFound(new { message = "Task not found" });
        });

        app.MapPost("/api/cancel/{taskId}", async (string taskId, IServiceProvider services) =>
        {
            DownloadTaskManager.CancelTask(taskId);
            try
            {
                services.GetService<IPlaylistQueueManager>()?.CancelPlaylistItemByTaskId(taskId);
                using var scope = services.CreateScope();
                var historyService = scope.ServiceProvider.GetService<IDownloadHistoryService>();
                if (historyService != null) await historyService.MarkCancelledAsync(taskId);
            }
            catch { }
            return Results.Ok(new { success = true });
        });

        app.MapPost("/api/downloads/cancel-all", async (IServiceProvider services) =>
        {
            int cancelledTasks = 0;
            using var scope = services.CreateScope();
            var historyService = scope.ServiceProvider.GetService<IDownloadHistoryService>();

            foreach (var kvp in DownloadTaskManager.Tasks)
            {
                var state = kvp.Value;
                if (!state.IsCompleted && !state.IsError)
                {
                    try { state.Cts?.Cancel(); } catch { }
                    state.IsPaused = true;
                    state.Status = "Download Cancelled";
                    cancelledTasks++;
                    if (historyService != null) try { await historyService.MarkCancelledAsync(state.TaskId); } catch { }
                }
            }

            try
            {
                var qm = services.GetService<IPlaylistQueueManager>();
                if (qm != null)
                {
                    foreach (var job in qm.GetActiveJobs()) qm.CancelBatchJob(job.JobId);
                }
            }
            catch { }

            return Results.Ok(new { success = true, cancelledCount = cancelledTasks });
        });

        app.MapGet("/api/downloads/active-all", (IPlaylistQueueManager queueManager) =>
        {
            return Results.Ok(new
            {
                playlistJobs = queueManager?.GetActiveJobs() ?? new List<PlaylistBatchJobState>(),
                singleDownloads = DownloadTaskManager.GetActiveSingleTasks()
            });
        });

        app.MapGet("/api/download-file/{taskId}", (string taskId) =>
        {
            var state = DownloadTaskManager.GetTask(taskId);
            if (state != null && state.IsCompleted && !string.IsNullOrEmpty(state.OutputPath) && File.Exists(state.OutputPath))
            {
                string dlName = state.FileName.EndsWith(".mp4") ? state.FileName : state.FileName + ".mp4";
                return Results.File(state.OutputPath, "video/mp4", dlName, enableRangeProcessing: true);
            }
            return Results.NotFound(new { message = "File not ready or not found." });
        });

        app.MapGet("/api/downloads-directory", () => Results.Ok(new { path = MediaHelper.GetDownloadsDirectory() }));

        app.MapPost("/api/open-folder", () =>
        {
            string downloadsFolder = MediaHelper.GetDownloadsDirectory();
            if (!Directory.Exists(downloadsFolder)) Directory.CreateDirectory(downloadsFolder);
            try
            {
                Process.Start(new ProcessStartInfo { FileName = "explorer.exe", Arguments = $"\"{downloadsFolder}\"", UseShellExecute = true });
            }
            catch { }
            return Results.Ok(new { success = true, path = downloadsFolder });
        });

        return app;
    }

    private static async Task<bool> CheckIsDirectStreamAsync(HttpClient client, string url)
    {
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0, 1023);
            req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
            var referers = StreamSecurityHelper.GetCandidateReferers(new Uri(url));
            if (referers.Count > 0 && !string.IsNullOrEmpty(referers[0]))
                req.Headers.TryAddWithoutValidation("Referer", referers[0]);

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            var resp = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cts.Token);
            if (resp.IsSuccessStatusCode)
            {
                string cType = resp.Content.Headers.ContentType?.MediaType ?? "";
                if (cType.Contains("mpegurl", StringComparison.OrdinalIgnoreCase) || cType.Contains("m3u", StringComparison.OrdinalIgnoreCase)) return false;
                var bytes = await resp.Content.ReadAsByteArrayAsync(cts.Token);
                if (bytes.Length > 7 && bytes[0] == '#' && bytes[1] == 'E' && bytes[2] == 'X' && bytes[3] == 'T') return false;
            }
        }
        catch { }
        return true;
    }

    private static async Task SafelyMoveFileAsync(string src, string dst)
    {
        for (int i = 1; i <= 10; i++)
        {
            try
            {
                if (File.Exists(dst)) File.Delete(dst);
                File.Move(src, dst, true);
                return;
            }
            catch
            {
                if (i < 10) await Task.Delay(250 * i);
            }
        }

        using (var inStream = new FileStream(src, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
        using (var outStream = new FileStream(dst, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await inStream.CopyToAsync(outStream);
        }
        try { File.Delete(src); } catch { }
    }

    private static DownloadRecord BuildDownloadRecord(
        string taskId, string? userId, string? userEmail, string clientIp, string deviceType, string os, string browser, string userAgent,
        string pageUrl, string videoTitle, string? thumbUrl, string platform, string quality, int durationSec, long fileSizeBytes,
        double avgSpeed, double peakSpeed, double elapsedSec, string status, string validationStatus, string validationDetails,
        double probedDuration = 0, string? resolution = null, string? avDetails = null, int retryCount = 0, string? errorMsg = null)
    {
        return new DownloadRecord
        {
            TaskId = taskId,
            UserId = userId,
            UserEmail = userEmail,
            UserIp = clientIp,
            DeviceType = deviceType,
            OperatingSystem = os,
            Browser = browser,
            UserAgent = userAgent,
            OriginalUrl = pageUrl,
            VideoTitle = videoTitle,
            ThumbnailUrl = thumbUrl,
            Platform = platform,
            Quality = quality,
            DurationSeconds = durationSec,
            ProbedDurationSeconds = probedDuration,
            Resolution = resolution ?? "",
            AudioVideoDetails = avDetails ?? "",
            ValidationStatus = validationStatus,
            ValidationDetails = validationDetails,
            FileSizeBytes = fileSizeBytes,
            FormattedSize = MediaHelper.FormatBytes(fileSizeBytes),
            DownloadSpeedMBps = avgSpeed,
            PeakSpeedMBps = peakSpeed,
            TimeTakenSeconds = elapsedSec,
            DownloadSource = "Web Input",
            Status = status,
            ErrorMessage = errorMsg,
            CorruptionReason = errorMsg,
            AppVersion = MediaValidator.CurrentAppVersion,
            SystemVersion = MediaValidator.CurrentSystemVersion,
            RetryCount = retryCount
        };
    }

    private static void SyncToCloudAdminAsync(
        string taskId, string title, string thumbUrl, string fileName, string originalUrl, string platform,
        string quality, long fileSize, double speed, double peakSpeed, string format, string effectiveEmail, string? userId, string ip)
    {
        _ = Task.Run(async () =>
        {
            for (int retry = 0; retry < 2; retry++)
            {
                try
                {
                    using var cloudClient = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };
                    var payload = new
                    {
                        taskId, title, thumbnailUrl = thumbUrl, fileName, originalUrl, platform, quality,
                        fileSize, downloadSpeedMBps = speed, peakSpeedMBps = peakSpeed, format, status = "Completed",
                        userEmail = effectiveEmail, userId, ipAddress = ip
                    };
                    var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
                    var resp = await cloudClient.PostAsync("https://savezonix.onrender.com/api/admin/record-download", content);
                    if (resp.IsSuccessStatusCode) break;
                }
                catch { await Task.Delay(2000); }
            }
        });
    }
}
