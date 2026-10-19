using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Claims;
using System.Text.RegularExpressions;
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
using YoutubeExplode.Videos.Streams;
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

            string clientTaskId = req.TaskId?.Trim() ?? "";
            string taskId;
            using (var preScope = scopeFactory.CreateScope())
            {
                var preHistory = preScope.ServiceProvider.GetService<IDownloadHistoryService>();
                bool exists = false;
                if (!string.IsNullOrWhiteSpace(clientTaskId))
                {
                    if (DownloadTaskManager.GetTask(clientTaskId) != null)
                    {
                        exists = true;
                    }
                    else if (preHistory != null)
                    {
                        try { exists = (await preHistory.GetDownloadByIdAsync(clientTaskId)) != null; } catch { }
                    }
                }

                taskId = (!string.IsNullOrWhiteSpace(clientTaskId) && !exists)
                    ? clientTaskId
                    : ("dl_" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + "_" + Guid.NewGuid().ToString("N")[..8]);
            }
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
            videoTitle = MediaHelper.FormatEpisodeTitle(videoTitle, pageUrl);
            string platform = !string.IsNullOrEmpty(req.Platform) ? req.Platform : "Web Stream";
            string quality = !string.IsNullOrEmpty(req.Quality) ? req.Quality : "1080p Full HD";

            string safeBaseName = MediaHelper.SanitizeFileName(req.FileName);
            var (sea, ep, epTag) = MediaHelper.ExtractSeasonAndEpisode(pageUrl);
            if (!string.IsNullOrEmpty(epTag) && !safeBaseName.Contains(epTag, StringComparison.OrdinalIgnoreCase))
            {
                string ext = Path.GetExtension(safeBaseName);
                string baseNoExt = Path.GetFileNameWithoutExtension(safeBaseName);
                var qMatch = Regex.Match(baseNoExt, @"(?<name>.+?)(?<qual>_\d+p(?:_[\w]+)?)$", RegexOptions.IgnoreCase);
                if (qMatch.Success)
                {
                    safeBaseName = $"{qMatch.Groups["name"].Value}_{epTag}{qMatch.Groups["qual"].Value}{ext}";
                }
                else
                {
                    safeBaseName = $"{baseNoExt}_{epTag}{ext}";
                }
            }

            var state = new DownloadTaskState
            {
                TaskId = taskId,
                UserId = currentUserId,
                FileName = safeBaseName,
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
                        StrictCdnDomains = await adminSettings.GetSettingAsync("StrictCdnDomains", "phncdn,pornhub,xhpingcdn,xhcdn,xhamster,okxxx,ok.xxx,phcdn,spankbang,sb-cd,mat6tube,pvvstream,xnxx,xnxx-cdn,xvideos,xvideos-cdn,pixelflix,pron.click,freefuckvidz,freepornvideo,googlevideo,youtube")
                    };

                    string downloadsFolder = !string.IsNullOrWhiteSpace(req.DestinationFolder) && Directory.Exists(req.DestinationFolder)
                        ? req.DestinationFolder
                        : MediaHelper.GetDownloadsDirectory();
                    if (!Directory.Exists(downloadsFolder)) Directory.CreateDirectory(downloadsFolder);

                    string targetExt = (req.Format?.Equals("MP3", StringComparison.OrdinalIgnoreCase) == true || safeBaseName.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase)) ? ".mp3"
                        : safeBaseName.EndsWith(".m4a", StringComparison.OrdinalIgnoreCase) ? ".m4a"
                        : ".mp4";

                    if (string.IsNullOrWhiteSpace(safeBaseName) || safeBaseName == targetExt)
                        safeBaseName = "SaveZonix_" + DateTime.UtcNow.ToString("yyyyMMdd_HHmmss") + targetExt;
                    else if (!safeBaseName.EndsWith(targetExt, StringComparison.OrdinalIgnoreCase))
                        safeBaseName = Path.GetFileNameWithoutExtension(safeBaseName) + targetExt;

                    state.FileName = safeBaseName;
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

                    // Automatic Pixelflix Page URL Resolver Fallback:
                    // If a Pixelflix webpage URL was passed as StreamUrl, resolve it to the underlying DASH / direct stream
                    if (req.StreamUrl.Contains("pixelflix.cc", StringComparison.OrdinalIgnoreCase))
                    {
                        try
                        {
                            var pfParser = new M3U8Parser(httpClient);
                            var pfRes = await pfParser.ParseAsync(req.StreamUrl);
                            if (pfRes != null && pfRes.Qualities.Count > 0 && !pfRes.RequiresBrowserContext)
                            {
                                var matchedQuality = pfRes.Qualities.FirstOrDefault(q => !string.IsNullOrEmpty(req.Quality) && q.Resolution.Contains(req.Quality, StringComparison.OrdinalIgnoreCase))
                                                     ?? pfRes.Qualities[0];
                                req.StreamUrl = matchedQuality.Url;
                                req.IsDirectFile = matchedQuality.IsDirectFile;
                                if (req.DurationSeconds == 0 && pfRes.DurationSeconds > 0)
                                    req.DurationSeconds = pfRes.DurationSeconds;
                                if (string.IsNullOrEmpty(req.ThumbnailUrl) && !string.IsNullOrEmpty(pfRes.ThumbnailUrl))
                                    req.ThumbnailUrl = pfRes.ThumbnailUrl;
                            }
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
                            bool isYouTubeUrl = req.StreamUrl.Contains("youtube.com", StringComparison.OrdinalIgnoreCase) ||
                                                req.StreamUrl.Contains("youtu.be", StringComparison.OrdinalIgnoreCase) ||
                                                System.Text.RegularExpressions.Regex.IsMatch(req.StreamUrl.Trim(), @"^[a-zA-Z0-9_-]{11}$");

                            if (isYouTubeUrl)
                            {
                                state.Status = "Resolving YouTube Media Streams...";
                                var ytMatch = System.Text.RegularExpressions.Regex.Match(req.StreamUrl, @"(?:v=|youtu\.be\/|embed\/|shorts\/|^)([a-zA-Z0-9_-]{11})");
                                string videoId = ytMatch.Success ? ytMatch.Groups[1].Value : req.StreamUrl.Trim();

                                var ytClient = YouTubeClientFactory.SharedClient;
                                var manifest = await ytClient.Videos.Streams.GetManifestAsync(videoId, cts.Token);

                                bool isAudioRequest = targetExt == ".mp3" || targetExt == ".m4a" || string.Equals(req.Format, "MP3", StringComparison.OrdinalIgnoreCase);
                                if (isAudioRequest)
                                {
                                    state.Status = "Downloading YouTube Audio Track...";
                                    var audioStreams = manifest.GetAudioOnlyStreams().ToList();
                                    var bestAudio = targetExt == ".m4a"
                                        ? (audioStreams.FirstOrDefault(s => s.Container == Container.Mp4) ?? audioStreams.OrderByDescending(s => s.Bitrate).FirstOrDefault())
                                        : audioStreams.OrderByDescending(s => s.Bitrate).FirstOrDefault();

                                    if (bestAudio == null)
                                        throw new Exception("No audio stream found for YouTube video.");

                                    string tempRawAudio = Path.Combine(tempDirectory, "audio_raw.bin");
                                    string audioTempDir = Path.Combine(tempDirectory, "audio_chunks");
                                    var chunks = await downloader.DownloadDirectFileAsync(bestAudio.Url, audioTempDir, bestAudio.Size.Bytes, Math.Clamp(concurrency, 4, 16), progress, cts.Token);
                                    if (!await SegmentMerger.MergeSegmentsAsync(chunks, tempRawAudio, audioTempDir) || !File.Exists(tempRawAudio))
                                    {
                                        finalValidation = new MediaValidationResult { IsValid = false, IntegrityStatus = MediaIntegrityStatus.Corrupted, ErrorReason = "Failed to download audio stream." };
                                        break;
                                    }

                                    if (targetExt == ".mp3")
                                    {
                                        state.Status = "Extracting High-Quality MP3 (320 kbps)...";
                                        state.IsMerging = true;
                                        bool extracted = await MediaHelper.ExtractAudioAsync(tempRawAudio, tempMergedFile, "320k");
                                        if (!extracted || !File.Exists(tempMergedFile)) File.Move(tempRawAudio, tempMergedFile, true);
                                    }
                                    else
                                    {
                                        File.Move(tempRawAudio, tempMergedFile, true);
                                    }
                                }
                                else
                                {
                                    state.Status = "Analyzing YouTube Video Quality Streams...";
                                    var allVideoStreams = manifest.GetVideoStreams().ToList();
                                    IVideoStreamInfo? videoStream = null;

                                    if (!string.IsNullOrWhiteSpace(req.Quality) && !req.Quality.Equals("Best", StringComparison.OrdinalIgnoreCase))
                                    {
                                        string cleanQ = req.Quality.ToLowerInvariant().Replace("p", "").Trim();
                                        videoStream = allVideoStreams.FirstOrDefault(s => s.VideoQuality.Label.StartsWith(cleanQ, StringComparison.OrdinalIgnoreCase));
                                    }
                                    videoStream ??= allVideoStreams.OrderByDescending(s => s.VideoQuality).FirstOrDefault();

                                    if (videoStream == null)
                                        throw new Exception("No video stream found for YouTube video.");

                                    if (videoStream is MuxedStreamInfo muxed)
                                    {
                                        state.Status = $"Downloading YouTube {videoStream.VideoQuality.Label} Stream...";
                                        string muxTempDir = Path.Combine(tempDirectory, "muxed_chunks");
                                        var chunks = await downloader.DownloadDirectFileAsync(muxed.Url, muxTempDir, muxed.Size.Bytes, Math.Clamp(concurrency, 4, 16), progress, cts.Token);
                                        if (!await SegmentMerger.MergeSegmentsAsync(chunks, tempMergedFile, muxTempDir) || !File.Exists(tempMergedFile))
                                        {
                                            finalValidation = new MediaValidationResult { IsValid = false, IntegrityStatus = MediaIntegrityStatus.Corrupted, ErrorReason = "Failed to download YouTube stream." };
                                            break;
                                        }
                                    }
                                    else
                                    {
                                        var bestAudio = manifest.GetAudioOnlyStreams()
                                            .Where(s => s.Container == Container.Mp4)
                                            .OrderByDescending(s => s.Bitrate)
                                            .FirstOrDefault() ?? manifest.GetAudioOnlyStreams().OrderByDescending(s => s.Bitrate).FirstOrDefault();

                                        state.Status = $"Downloading YouTube {videoStream.VideoQuality.Label} + Audio (Parallel)...";
                                        string vidTempDir = Path.Combine(tempDirectory, "yt_vid_chunks");
                                        string audTempDir = Path.Combine(tempDirectory, "yt_aud_chunks");
                                        string tempYtVid = Path.Combine(tempDirectory, "yt_vid.mp4");
                                        string tempYtAud = Path.Combine(tempDirectory, "yt_aud.mp4");

                                        long vidSize = videoStream.Size.Bytes;
                                        long audSize = bestAudio?.Size.Bytes ?? 0;
                                        long totalYtBytes = vidSize + audSize;

                                        long vidDownloaded = 0, audDownloaded = 0;
                                        var vidProg = new Progress<DownloadProgressReport>(vp =>
                                        {
                                            Interlocked.Exchange(ref vidDownloaded, vp.TotalBytesDownloaded);
                                            long cur = Interlocked.Read(ref vidDownloaded) + Interlocked.Read(ref audDownloaded);
                                            state.Percentage = totalYtBytes > 0 ? Math.Min(100.0, Math.Round((double)cur / totalYtBytes * 100.0, 1)) : vp.Percentage;
                                            state.SpeedMBps = vp.SpeedMBps;
                                            state.PeakSpeedMBps = vp.PeakSpeedMBps;
                                            state.TotalBytesDownloaded = cur;
                                            state.EstimatedTotalBytes = totalYtBytes;
                                            state.Status = vp.Status;
                                        });
                                        var audProg = new Progress<DownloadProgressReport>(ap =>
                                        {
                                            Interlocked.Exchange(ref audDownloaded, ap.TotalBytesDownloaded);
                                        });

                                        var vTask = downloader.DownloadDirectFileAsync(videoStream.Url, vidTempDir, vidSize, Math.Clamp(concurrency, 4, 16), vidProg, cts.Token);
                                        var aTask = bestAudio != null
                                            ? downloader.DownloadDirectFileAsync(bestAudio.Url, audTempDir, audSize, 4, audProg, cts.Token)
                                            : Task.FromResult(new List<SegmentItem>());

                                        await Task.WhenAll(vTask, aTask);

                                        if (!await SegmentMerger.MergeSegmentsAsync(await vTask, tempYtVid, vidTempDir))
                                        {
                                            finalValidation = new MediaValidationResult { IsValid = false, IntegrityStatus = MediaIntegrityStatus.Corrupted, ErrorReason = "Failed to merge YouTube video stream." };
                                            break;
                                        }

                                        if (bestAudio != null && await SegmentMerger.MergeSegmentsAsync(await aTask, tempYtAud, audTempDir))
                                        {
                                            state.Status = "Muxing YouTube Video & Audio Container...";
                                            state.IsMerging = true;
                                            bool muxedOk = await MediaHelper.MuxVideoAndAudioAsync(tempYtVid, tempYtAud, tempMergedFile);
                                            if (!muxedOk || !File.Exists(tempMergedFile))
                                            {
                                                File.Move(tempYtVid, tempMergedFile, true);
                                            }
                                        }
                                        else
                                        {
                                            File.Move(tempYtVid, tempMergedFile, true);
                                        }
                                    }
                                }
                            }
                            else
                            {
                                bool isDirect = req.IsDirectFile && !req.StreamUrl.Contains(".m3u8", StringComparison.OrdinalIgnoreCase) && !req.StreamUrl.Contains(".mpd", StringComparison.OrdinalIgnoreCase);
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
                                else if (req.StreamUrl.Contains(".mpd", StringComparison.OrdinalIgnoreCase))
                                {
                                    state.Status = "Streaming Adaptive DASH Container via FFmpeg...";
                                    state.IsMerging = true;

                                    string mapArg = "-map 0:v:0? -map 0:a:0?";
                                    if (!string.IsNullOrEmpty(req.Quality) && req.Quality.Contains("720", StringComparison.OrdinalIgnoreCase))
                                        mapArg = "-map 0:v:1? -map 0:a:0?";
                                    else if (!string.IsNullOrEmpty(req.Quality) && req.Quality.Contains("480", StringComparison.OrdinalIgnoreCase))
                                        mapArg = "-map 0:v:2? -map 0:a:0?";
                                    else if (!string.IsNullOrEmpty(req.Quality) && req.Quality.Contains("360", StringComparison.OrdinalIgnoreCase))
                                        mapArg = "-map 0:v:3? -map 0:a:0?";

                                    string ffmpegArgs = $"-user_agent \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36\" -referer \"https://embed.reelsdownload.online/\" -i \"{req.StreamUrl.Trim()}\" {mapArg} -c copy -movflags +faststart \"{tempMergedFile}\" -y";

                                    var psi = new ProcessStartInfo
                                    {
                                        FileName = MediaHelper.GetFfmpegPath(),
                                        Arguments = ffmpegArgs,
                                        RedirectStandardError = true,
                                        UseShellExecute = false,
                                        CreateNoWindow = true
                                    };

                                    using var proc = Process.Start(psi);
                                    if (proc != null)
                                    {
                                        string? lastErrLine = null;
                                        var stderrTask = Task.Run(async () =>
                                        {
                                            try
                                            {
                                                using var reader = proc.StandardError;
                                                string? errLine;
                                                while ((errLine = await reader.ReadLineAsync()) != null)
                                                {
                                                    lastErrLine = errLine;
                                                    var tMatch = Regex.Match(errLine, @"time=(\d+):(\d+):(\d+\.\d+)");
                                                    if (tMatch.Success)
                                                    {
                                                        double hours = double.Parse(tMatch.Groups[1].Value, CultureInfo.InvariantCulture);
                                                        double mins = double.Parse(tMatch.Groups[2].Value, CultureInfo.InvariantCulture);
                                                        double secs = double.Parse(tMatch.Groups[3].Value, CultureInfo.InvariantCulture);
                                                        double currentSeconds = hours * 3600 + mins * 60 + secs;

                                                        double totalSeconds = req.DurationSeconds > 0 ? req.DurationSeconds : 7200;
                                                        double pct = Math.Min(99.0, Math.Round((currentSeconds / totalSeconds) * 100.0, 1));
                                                        state.Percentage = Math.Max(state.Percentage, pct);
                                                        state.ElapsedSeconds = sw.Elapsed.TotalSeconds;
                                                        state.Status = $"Downloading DASH Stream ({state.Percentage}%)...";
                                                    }
                                                }
                                            }
                                            catch { }
                                        });

                                        await proc.WaitForExitAsync(cts.Token);
                                        await stderrTask;

                                        if (proc.ExitCode == 0 && File.Exists(tempMergedFile) && new FileInfo(tempMergedFile).Length > 1024)
                                        {
                                            state.Percentage = 100.0;
                                        }
                                        else
                                        {
                                            Console.WriteLine($"[FFmpeg DASH Error] ExitCode: {proc.ExitCode}, LastErr: {lastErrLine}");
                                            finalValidation = new MediaValidationResult { IsValid = false, IntegrityStatus = MediaIntegrityStatus.Corrupted, ErrorReason = $"Failed to assemble DASH video stream into valid MP4. ({lastErrLine ?? "FFmpeg exit " + proc.ExitCode})" };
                                            break;
                                        }
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
                finally
                {
                    if (!state.IsCompleted && historyService != null)
                    {
                        try
                        {
                            if (cts.IsCancellationRequested || state.IsPaused)
                            {
                                await historyService.MarkCancelledAsync(taskId);
                            }
                            else if (state.IsError)
                            {
                                await historyService.MarkFailedAsync(taskId, state.ErrorMessage ?? "Download terminated unexpectedly");
                            }
                            else
                            {
                                await historyService.MarkCancelledAsync(taskId);
                            }
                        }
                        catch { }
                    }
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
