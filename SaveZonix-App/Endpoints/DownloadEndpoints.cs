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
        // ─────────────────────────────────────────────────────────────
        // 1. Analyze Stream / Webpage API with 100% Ghost Stealth Shield
        // ─────────────────────────────────────────────────────────────
        app.MapPost("/api/analyze", async (AnalyzeRequest req, IDownloadAnalyticsService analyticsService) =>
        {
            if (string.IsNullOrWhiteSpace(req.Url) || !Uri.TryCreate(req.Url, UriKind.Absolute, out _))
            {
                return Results.BadRequest(new { success = false, message = "Please provide a valid stream or webpage URL." });
            }

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
                        
                        foreach (var q in result.Qualities)
                        {
                            q.DurationSeconds = result.DurationSeconds;
                        }
                    }
                    catch { }
                }

                // If thumbnail is available, provide proxied URL to avoid CORS/403 errors
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

        // ─────────────────────────────────────────────────────────────
        // 2. Start Parallel Multi-Threaded Download API (with Guest Gatekeeper & Logging)
        // ─────────────────────────────────────────────────────────────
        app.MapPost("/api/download", async (HttpContext httpContext, DownloadRequest req, IServiceScopeFactory scopeFactory, IDownloadAnalyticsService analyticsService) =>
        {
            if (string.IsNullOrWhiteSpace(req.StreamUrl))
            {
                return Results.BadRequest(new { message = "Stream URL is required." });
            }

            string clientIp = httpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            if (httpContext.Request.Headers.TryGetValue("X-Forwarded-For", out var fwd))
            {
                clientIp = fwd.ToString().Split(',')[0].Trim();
            }

            bool isAuthenticated = httpContext.User.Identity?.IsAuthenticated == true;

            // Guest Access Control & Rate Limiter
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

            string? currentUserId = null;
            string? currentUserEmail = null;

            if (isAuthenticated)
            {
                currentUserId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
                currentUserEmail = httpContext.User.FindFirstValue(ClaimTypes.Email) ?? httpContext.User.Identity?.Name;
            }

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
            string os = userAgent.Contains("Windows") ? "Windows" : userAgent.Contains("Android") ? "Android" : userAgent.Contains("iPhone") || userAgent.Contains("Mac") ? "Apple OS" : "Linux";

            _ = Task.Run(async () =>
            {
                var sw = Stopwatch.StartNew();
                using var scope = scopeFactory.CreateScope();
                var historyService = scope.ServiceProvider.GetService<StreamHelper.Services.IDownloadHistoryService>();
                var scopedAnalytics = scope.ServiceProvider.GetRequiredService<IDownloadAnalyticsService>();
                var adminSettings = scope.ServiceProvider.GetRequiredService<StreamHelper.Services.IAdminSettingsService>();
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
                    string targetExt = ".mp4";
                    if (req.Format?.Equals("MP3", StringComparison.OrdinalIgnoreCase) == true || safeBaseName.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase))
                    {
                        targetExt = ".mp3";
                    }
                    else if (safeBaseName.EndsWith(".m4a", StringComparison.OrdinalIgnoreCase))
                    {
                        targetExt = ".m4a";
                    }

                    if (string.IsNullOrWhiteSpace(safeBaseName) || safeBaseName == targetExt)
                    {
                        safeBaseName = "SaveZonix_" + DateTime.UtcNow.ToString("yyyyMMdd_HHmmss") + targetExt;
                    }
                    else if (!safeBaseName.EndsWith(targetExt, StringComparison.OrdinalIgnoreCase))
                    {
                        safeBaseName = Path.GetFileNameWithoutExtension(safeBaseName) + targetExt;
                    }

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
                    Zonix.Core.MediaValidationResult? finalValidation = null;

                    while (currentAttempt <= maxValidationRetries && !cts.Token.IsCancellationRequested)
                    {
                        currentAttempt++;
                        if (currentAttempt > 1)
                        {
                            state.Status = $"Retrying download (Attempt {currentAttempt}/{maxValidationRetries + 1})...";
                            if (historyService != null)
                            {
                                await historyService.MarkRetryingAsync(taskId, currentAttempt - 1, finalValidation?.ErrorReason ?? "Integrity check failed");
                            }
                        }

                        if (!Directory.Exists(tempDirectory)) Directory.CreateDirectory(tempDirectory);

                        if (!string.IsNullOrEmpty(req.AudioUrl) && req.IsDirectFile)
                        {
                            state.Status = "Downloading High-Def Video & Audio Streams (Parallel)...";
                            string videoTempDir = Path.Combine(tempDirectory, "video_stream");
                            string audioTempDir = Path.Combine(tempDirectory, "audio_stream");
                            if (!Directory.Exists(videoTempDir)) Directory.CreateDirectory(videoTempDir);
                            if (!Directory.Exists(audioTempDir)) Directory.CreateDirectory(audioTempDir);

                            string tempVideo = Path.Combine(tempDirectory, "video.mp4");
                            string tempAudio = Path.Combine(tempDirectory, "audio.mp4");

                            long videoBytesDownloaded = 0;
                            long audioBytesDownloaded = 0;
                            long confirmedVideoTotal = 0;
                            long confirmedAudioTotal = 0;
                            long targetCombinedBytes = req.EstimatedSizeBytes;

                            var audioProgress = new Progress<DownloadProgressReport>(ap =>
                            {
                                Interlocked.Exchange(ref audioBytesDownloaded, ap.TotalBytesDownloaded);
                                if (ap.EstimatedTotalBytes > 0) Interlocked.Exchange(ref confirmedAudioTotal, ap.EstimatedTotalBytes);
                            });

                            var combinedVideoProgress = new Progress<DownloadProgressReport>(vp =>
                            {
                                Interlocked.Exchange(ref videoBytesDownloaded, vp.TotalBytesDownloaded);
                                if (vp.EstimatedTotalBytes > 0) Interlocked.Exchange(ref confirmedVideoTotal, vp.EstimatedTotalBytes);

                                long curVid = Interlocked.Read(ref videoBytesDownloaded);
                                long curAud = Interlocked.Read(ref audioBytesDownloaded);
                                long totVid = Interlocked.Read(ref confirmedVideoTotal);
                                long totAud = Interlocked.Read(ref confirmedAudioTotal);

                                long totalTarget = (totVid > 0 && totAud > 0) ? (totVid + totAud) : targetCombinedBytes;
                                if (totalTarget <= 0) totalTarget = totVid > 0 ? totVid : vp.EstimatedTotalBytes;

                                long totalDownloaded = curVid + curAud;
                                double combinedPct = totalTarget > 0 ? Math.Min(100.0, Math.Round((double)totalDownloaded / totalTarget * 100.0, 1)) : vp.Percentage;

                                state.Percentage = combinedPct;
                                state.SpeedMBps = vp.SpeedMBps;
                                state.PeakSpeedMBps = vp.PeakSpeedMBps;
                                state.DownloadedSegments = vp.DownloadedSegments;
                                state.TotalSegments = vp.TotalSegments;
                                state.TotalBytesDownloaded = totalDownloaded;
                                state.EstimatedTotalBytes = totalTarget;
                                state.ElapsedSeconds = vp.Elapsed.TotalSeconds;
                                state.EstimatedSecondsRemaining = vp.EstimatedTimeRemaining.TotalSeconds;
                                state.ActiveThreads = vp.ActiveThreads;
                                state.Status = vp.Status;
                            });

                            var videoTask = downloader.DownloadDirectFileAsync(req.StreamUrl, videoTempDir, 0, concurrency, combinedVideoProgress, cts.Token);
                            var audioTask = downloader.DownloadDirectFileAsync(req.AudioUrl, audioTempDir, 0, Math.Clamp(concurrency / 2, 4, 32), audioProgress, cts.Token);

                            await Task.WhenAll(videoTask, audioTask);

                            var videoChunks = await videoTask;
                            var audioChunks = await audioTask;

                            bool videoOk = await SegmentMerger.MergeSegmentsAsync(videoChunks, tempVideo, videoTempDir);
                            bool audioOk = await SegmentMerger.MergeSegmentsAsync(audioChunks, tempAudio, audioTempDir);

                            if (!videoOk)
                            {
                                finalValidation = new Zonix.Core.MediaValidationResult
                                {
                                    IsValid = false,
                                    IntegrityStatus = Zonix.Core.MediaIntegrityStatus.Corrupted,
                                    ErrorReason = "Selected video stream failed to download or assemble."
                                };
                                break;
                            }

                            if (!audioOk)
                            {
                                finalValidation = new Zonix.Core.MediaValidationResult
                                {
                                    IsValid = false,
                                    IntegrityStatus = Zonix.Core.MediaIntegrityStatus.Corrupted,
                                    ErrorReason = "Selected audio stream failed to download or assemble."
                                };
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
                                finalValidation = new Zonix.Core.MediaValidationResult
                                {
                                    IsValid = false,
                                    IntegrityStatus = Zonix.Core.MediaIntegrityStatus.Corrupted,
                                    ErrorReason = "Unable to mux the selected video and audio streams."
                                };
                                break;
                            }
                        }
                        else
                        {
                            if (req.StreamUrl.Contains("youtube.com/watch", StringComparison.OrdinalIgnoreCase) ||
                                req.StreamUrl.Contains("youtu.be/", StringComparison.OrdinalIgnoreCase))
                            {
                                finalValidation = new Zonix.Core.MediaValidationResult
                                {
                                    IsValid = false,
                                    IntegrityStatus = Zonix.Core.MediaIntegrityStatus.Corrupted,
                                    ErrorReason = "Cannot download YouTube webpage directly. Please re-analyze the video with the updated engine or use the SaveZonix Chrome Extension."
                                };
                                break;
                            }

                            bool isDirectDownload = req.IsDirectFile;
                            if (isDirectDownload && req.StreamUrl.Contains(".m3u8", StringComparison.OrdinalIgnoreCase))
                            {
                                isDirectDownload = false;
                            }

                            if (isDirectDownload)
                            {
                                try
                                {
                                    using var probeHead = new HttpRequestMessage(HttpMethod.Get, req.StreamUrl);
                                    probeHead.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0, 1023);
                                    using var probeCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                                    var probeResp = await httpClient.SendAsync(probeHead, HttpCompletionOption.ResponseHeadersRead, probeCts.Token);
                                    if (probeResp.IsSuccessStatusCode)
                                    {
                                        var cType = probeResp.Content.Headers.ContentType?.MediaType ?? "";
                                        if (cType.Contains("mpegurl", StringComparison.OrdinalIgnoreCase) || cType.Contains("application/x-mpegURL", StringComparison.OrdinalIgnoreCase))
                                        {
                                            isDirectDownload = false;
                                        }
                                        else
                                        {
                                            var headerBytes = await probeResp.Content.ReadAsByteArrayAsync(probeCts.Token);
                                            if (headerBytes.Length > 7 && headerBytes[0] == '#' && headerBytes[1] == 'E' && headerBytes[2] == 'X' && headerBytes[3] == 'T' && headerBytes[4] == 'M' && headerBytes[5] == '3' && headerBytes[6] == 'U')
                                            {
                                                isDirectDownload = false;
                                            }
                                        }
                                    }
                                }
                                catch { }
                            }

                            if (isDirectDownload)
                            {
                                string directTempDir = Path.Combine(tempDirectory, "direct_chunks");
                                var directChunks = await downloader.DownloadDirectFileAsync(
                                    req.StreamUrl, directTempDir, req.EstimatedSizeBytes, concurrency, progress, cts.Token);

                                bool directDownloaded = await SegmentMerger.MergeSegmentsAsync(directChunks, tempMergedFile, directTempDir);

                                if (!directDownloaded || !File.Exists(tempMergedFile))
                                {
                                    finalValidation = new Zonix.Core.MediaValidationResult
                                    {
                                        IsValid = false,
                                        IntegrityStatus = Zonix.Core.MediaIntegrityStatus.Corrupted,
                                        ErrorReason = "Direct media stream failed to download completely."
                                    };
                                    break;
                                }
                            }
                            else
                            {
                                var parser = new M3U8Parser(httpClient);
                                var mediaPlaylist = await parser.ParseAsync(req.StreamUrl);

                                bool isPornHubOrAylo = req.StreamUrl.Contains("phncdn.com") || req.StreamUrl.Contains("pornhub") ||
                                                       req.StreamUrl.Contains("xhcdn") || req.StreamUrl.Contains("xhamster");

                                if (isPornHubOrAylo)
                                {
                                    state.Status = "Streaming Adaptive HLS Container...";
                                    string ffmpegPath = MediaHelper.GetFfmpegPath();
                                    string cleanInputUrl = req.StreamUrl.Trim();

                                    var psi = new ProcessStartInfo
                                    {
                                        FileName = ffmpegPath,
                                        Arguments = $"-headers \"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\\r\\nReferer: https://www.pornhub.com/\\r\\n\" -i \"{cleanInputUrl}\" -c copy -bsf:a aac_adtstoasc -movflags +faststart \"{tempMergedFile}\" -y",
                                        RedirectStandardOutput = false,
                                        RedirectStandardError = false,
                                        UseShellExecute = false,
                                        CreateNoWindow = true
                                    };

                                    using var proc = Process.Start(psi);
                                    if (proc != null)
                                    {
                                        await proc.WaitForExitAsync(cts.Token);
                                    }
                                }
                                else
                                {
                                    var segmentUrls = mediaPlaylist.SegmentUrls;

                                    if (segmentUrls.Count == 0 && mediaPlaylist.Qualities.Count > 0)
                                    {
                                        var best = mediaPlaylist.Qualities[0];
                                        if (best.Url != req.StreamUrl)
                                        {
                                            var subPlaylist = await parser.ParseAsync(best.Url);
                                            segmentUrls = subPlaylist.SegmentUrls;
                                        }
                                    }

                                    var downloaded = await downloader.DownloadSegmentsAsync(
                                        segmentUrls, tempDirectory, concurrency, progress, cts.Token, req.EstimatedSizeBytes);

                                    bool isAudioTarget = req.Format?.Equals("MP3", StringComparison.OrdinalIgnoreCase) == true || 
                                                         safeBaseName.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase) ||
                                                         safeBaseName.EndsWith(".m4a", StringComparison.OrdinalIgnoreCase);

                                    if (isAudioTarget)
                                    {
                                        state.Status = "Extracting High-Quality Audio Track...";
                                        state.IsMerging = true;

                                        var tempVideo = Path.Combine(tempDirectory, "full_temp.ts");
                                        var mergeSw = Stopwatch.StartNew();
                                        bool merged = await SegmentMerger.MergeSegmentsAsync(downloaded, tempVideo, tempDirectory, false);
                                        
                                        if (merged && File.Exists(tempVideo))
                                        {
                                            await MediaHelper.ExtractAudioAsync(tempVideo, tempMergedFile, "320k");
                                            mergeSw.Stop();
                                            state.MergeSeconds = mergeSw.Elapsed.TotalSeconds;
                                        }
                                    }
                                    else
                                    {
                                        state.Status = "Merging Segments into MP4...";
                                        state.IsMerging = true;

                                        var mergeSw = Stopwatch.StartNew();
                                        bool merged = await SegmentMerger.MergeSegmentsAsync(downloaded, tempMergedFile, tempDirectory, false);
                                        mergeSw.Stop();
                                        state.MergeSeconds = mergeSw.Elapsed.TotalSeconds;

                                        if (!merged || !File.Exists(tempMergedFile))
                                        {
                                            finalValidation = new Zonix.Core.MediaValidationResult
                                            {
                                                IsValid = false,
                                                IntegrityStatus = Zonix.Core.MediaIntegrityStatus.Corrupted,
                                                ErrorReason = "Stream remuxer failed to assemble video segments into a valid MP4 file."
                                            };
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        // ─── STRICT POST-DOWNLOAD MEDIA VALIDATION ───────────────
                        state.Status = "Validating File Integrity & Media Streams...";
                        bool requiresAudioTrack = targetExt == ".mp4" &&
                            (!string.IsNullOrWhiteSpace(req.AudioUrl) || platform.Contains("Instagram", StringComparison.OrdinalIgnoreCase));
                        finalValidation = await Zonix.Core.MediaValidator.ValidateMediaFileAsync(
                            tempMergedFile, req.DurationSeconds, targetExt.TrimStart('.'), requiresAudioTrack, req.ExpectedResolution);

                        if (finalValidation.IsValid)
                        {
                            break;
                        }
                        else
                        {
                            if (currentAttempt <= maxValidationRetries)
                            {
                                try { if (File.Exists(tempMergedFile)) File.Delete(tempMergedFile); } catch { }
                                continue;
                            }
                        }
                    }

                    sw.Stop();

                    if (finalValidation != null && finalValidation.IsValid && File.Exists(tempMergedFile))
                    {
                        outputFilePath = MediaHelper.GetAvailableUniqueFilePath(downloadsFolder, Path.GetFileName(outputFilePath));
                        bool moved = false;
                        for (int moveAttempt = 1; moveAttempt <= 10; moveAttempt++)
                        {
                            try
                            {
                                if (File.Exists(outputFilePath)) { try { File.Delete(outputFilePath); } catch { } }
                                File.Move(tempMergedFile, outputFilePath, true);
                                moved = true;
                                break;
                            }
                            catch
                            {
                                if (moveAttempt < 10) await Task.Delay(250 * moveAttempt);
                            }
                        }

                        if (!moved && File.Exists(tempMergedFile))
                        {
                            for (int copyAttempt = 1; copyAttempt <= 10; copyAttempt++)
                            {
                                try
                                {
                                    if (File.Exists(outputFilePath)) { try { File.Delete(outputFilePath); } catch { } }
                                    using (var sourceStream = new FileStream(tempMergedFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                                    using (var destStream = new FileStream(outputFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
                                    {
                                        await sourceStream.CopyToAsync(destStream);
                                    }
                                    moved = true;
                                    try { File.Delete(tempMergedFile); } catch { }
                                    break;
                                }
                                catch
                                {
                                    if (copyAttempt < 10) await Task.Delay(300 * copyAttempt);
                                }
                            }
                        }

                        if (!moved) throw new IOException($"Failed to move or copy completed download to destination: {outputFilePath}");

                        var fi = new FileInfo(outputFilePath);
                        state.OutputPath = outputFilePath;
                        state.IsCompleted = true;
                        state.Status = "Download Complete";

                        var record = new DownloadRecord
                        {
                            TaskId = taskId,
                            UserId = currentUserId,
                            UserEmail = currentUserEmail,
                            UserIp = clientIp,
                            DeviceType = deviceType,
                            OperatingSystem = os,
                            Browser = browser,
                            UserAgent = userAgent,
                            OriginalUrl = pageUrl,
                            VideoTitle = videoTitle,
                            ThumbnailUrl = req.ThumbnailUrl,
                            Platform = platform,
                            Quality = quality,
                            DurationSeconds = req.DurationSeconds,
                            ProbedDurationSeconds = finalValidation.ProbedDurationSeconds,
                            Resolution = finalValidation.Resolution,
                            AudioVideoDetails = finalValidation.AudioVideoDetails,
                            ValidationStatus = "Passed",
                            ValidationDetails = finalValidation.DiagnosticReport,
                            FileSizeBytes = fi.Length,
                            FormattedSize = MediaHelper.FormatBytes(fi.Length),
                            DownloadSpeedMBps = state.SpeedMBps,
                            PeakSpeedMBps = state.PeakSpeedMBps,
                            TimeTakenSeconds = sw.Elapsed.TotalSeconds,
                            DownloadSource = "Web Input",
                            Status = "Completed",
                            AppVersion = Zonix.Core.MediaValidator.CurrentAppVersion,
                            SystemVersion = Zonix.Core.MediaValidator.CurrentSystemVersion,
                            RetryCount = currentAttempt - 1
                        };

                        await scopedAnalytics.LogDownloadAsync(record);

                        // ⚡ Instant Cloud Sync to Render MongoDB (Background)
                        _ = Task.Run(async () =>
                        {
                            for (int retry = 0; retry < 2; retry++)
                            {
                                try
                                {
                                    using var cloudClient = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };
                                    var cloudPayload = new
                                    {
                                        taskId = taskId,
                                        title = videoTitle,
                                        thumbnailUrl = req.ThumbnailUrl ?? "",
                                        fileName = Path.GetFileName(outputFilePath),
                                        originalUrl = pageUrl,
                                        platform = platform,
                                        quality = quality,
                                        fileSize = fi.Length,
                                        downloadSpeedMBps = state.SpeedMBps,
                                        peakSpeedMBps = state.PeakSpeedMBps,
                                        format = targetExt.TrimStart('.'),
                                        status = "Completed",
                                        userEmail = effectiveEmail,
                                        userId = currentUserId,
                                        ipAddress = clientIp
                                    };
                                    var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(cloudPayload), System.Text.Encoding.UTF8, "application/json");
                                    var resp = await cloudClient.PostAsync("https://savezonix.onrender.com/api/admin/record-download", content);
                                    if (resp.IsSuccessStatusCode) break;
                                }
                                catch
                                {
                                    await Task.Delay(2000);
                                }
                            }
                        });

                        if (historyService != null)
                        {
                            await historyService.MarkCompletedWithValidationAsync(
                                taskId, fi.Length, state.SpeedMBps, state.PeakSpeedMBps, sw.Elapsed.TotalSeconds,
                                "Passed", finalValidation.DiagnosticReport, finalValidation.ProbedDurationSeconds, finalValidation.AudioVideoDetails);
                        }

                        if (!isAuthenticated)
                        {
                            await scopedAnalytics.RecordGuestDownloadAsync(clientIp);
                        }
                    }
                    else
                    {
                        state.IsCompleted = false;
                        state.IsError = true;
                        state.Status = "Download Failed/Corrupted – Please Redownload";
                        state.ErrorMessage = finalValidation?.ErrorReason ?? "Media validation failed. Stream was truncated or corrupted.";

                        try { if (File.Exists(tempMergedFile)) File.Delete(tempMergedFile); } catch { }

                        var failRecord = new DownloadRecord
                        {
                            TaskId = taskId,
                            UserId = currentUserId,
                            UserEmail = currentUserEmail,
                            UserIp = clientIp,
                            DeviceType = deviceType,
                            OperatingSystem = os,
                            Browser = browser,
                            UserAgent = userAgent,
                            OriginalUrl = pageUrl,
                            VideoTitle = videoTitle,
                            ThumbnailUrl = req.ThumbnailUrl,
                            Platform = platform,
                            Quality = quality,
                            DurationSeconds = req.DurationSeconds,
                            FileSizeBytes = 0,
                            FormattedSize = "0 MB",
                            DownloadSpeedMBps = state.SpeedMBps,
                            PeakSpeedMBps = state.PeakSpeedMBps,
                            TimeTakenSeconds = sw.Elapsed.TotalSeconds,
                            DownloadSource = "Web Input",
                            Status = "Corrupted",
                            ValidationStatus = finalValidation?.IntegrityStatus.ToString() ?? "Corrupted",
                            ValidationDetails = finalValidation?.ErrorReason ?? "Media validation failed",
                            CorruptionReason = finalValidation?.ErrorReason ?? "Media validation failed. Stream was truncated or missing required moov/mdat tracks.",
                            ErrorMessage = state.ErrorMessage,
                            AppVersion = Zonix.Core.MediaValidator.CurrentAppVersion,
                            SystemVersion = Zonix.Core.MediaValidator.CurrentSystemVersion,
                            RetryCount = currentAttempt - 1
                        };

                        await scopedAnalytics.LogDownloadAsync(failRecord);

                        if (historyService != null)
                        {
                            await historyService.MarkCorruptedAsync(
                                taskId, state.ErrorMessage, finalValidation?.IntegrityStatus.ToString() ?? "Corrupted",
                                finalValidation?.ErrorReason ?? "Truncated stream", currentAttempt - 1);
                        }
                    }

                    try { if (Directory.Exists(tempDirectory)) Directory.Delete(tempDirectory, true); } catch { }
                }
                catch (OperationCanceledException)
                {
                    state.Status = "Download Cancelled";
                    state.IsPaused = true;
                    if (historyService != null)
                    {
                        try { await historyService.MarkCancelledAsync(taskId); } catch { }
                    }
                }
                catch (HttpRequestException hEx) when (hEx.Message.Contains("401") || hEx.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    state.IsCompleted = false;
                    state.IsError = true;
                    state.ErrorMessage = "Video stream expired or access denied (401). This may happen with age-restricted YouTube videos or after 6+ hours. Please re-analyze the video to get fresh stream links.";
                    state.Status = "Stream Expired – Please Re-analyze";
                    
                    if (historyService != null)
                    {
                        try { await historyService.MarkFailedAsync(taskId, state.ErrorMessage); } catch { }
                    }
                }
                catch (Exception ex)
                {
                    state.IsCompleted = false;
                    state.IsError = true;
                    state.ErrorMessage = ex.Message;
                    state.Status = "Download Failed/Corrupted – Please Redownload";

                    if (historyService != null)
                    {
                        try { await historyService.MarkFailedAsync(taskId, ex.Message); } catch { }
                    }

                    try { if (Directory.Exists(tempDirectory)) Directory.Delete(tempDirectory, true); } catch { }
                }
            });

            return Results.Ok(new { taskId });
        });

        // ─────────────────────────────────────────────────────────────
        // Progress, Cancel, Active, File, Directory Endpoints
        // ─────────────────────────────────────────────────────────────
        app.MapGet("/api/progress/{taskId}", (string taskId) =>
        {
            var state = DownloadTaskManager.GetTask(taskId);
            if (state != null)
            {
                return Results.Ok(state);
            }
            return Results.NotFound(new { message = "Task not found" });
        });

        app.MapPost("/api/cancel/{taskId}", async (string taskId, IServiceProvider services) =>
        {
            DownloadTaskManager.CancelTask(taskId);
            try
            {
                var queueManager = services.GetService<SaveZonix.Services.IPlaylistQueueManager>();
                queueManager?.CancelPlaylistItemByTaskId(taskId);

                using var scope = services.CreateScope();
                var historyService = scope.ServiceProvider.GetService<StreamHelper.Services.IDownloadHistoryService>();
                if (historyService != null)
                {
                    await historyService.MarkCancelledAsync(taskId);
                }
            }
            catch { }
            return Results.Ok(new { success = true });
        });

        app.MapPost("/api/downloads/cancel-all", async (IServiceProvider services) =>
        {
            int cancelledTasks = 0;
            using var scope = services.CreateScope();
            var historyService = scope.ServiceProvider.GetService<StreamHelper.Services.IDownloadHistoryService>();

            foreach (var kvp in DownloadTaskManager.Tasks)
            {
                var state = kvp.Value;
                if (!state.IsCompleted && !state.IsError)
                {
                    try { state.Cts?.Cancel(); } catch { }
                    state.IsPaused = true;
                    state.Status = "Download Cancelled";
                    cancelledTasks++;

                    if (historyService != null)
                    {
                        try { await historyService.MarkCancelledAsync(state.TaskId); } catch { }
                    }
                }
            }

            try
            {
                var queueManager = services.GetService<SaveZonix.Services.IPlaylistQueueManager>();
                if (queueManager != null)
                {
                    var activeJobs = queueManager.GetActiveJobs();
                    foreach (var job in activeJobs)
                    {
                        queueManager.CancelBatchJob(job.JobId);
                    }
                }
            }
            catch { }

            return Results.Ok(new { success = true, cancelledCount = cancelledTasks });
        });

        app.MapGet("/api/downloads/active-all", (SaveZonix.Services.IPlaylistQueueManager queueManager) =>
        {
            var plJobs = queueManager?.GetActiveJobs() ?? new List<SaveZonix.Models.PlaylistBatchJobState>();
            var singleTasks = DownloadTaskManager.GetActiveSingleTasks();
            return Results.Ok(new
            {
                playlistJobs = plJobs,
                singleDownloads = singleTasks
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

        app.MapGet("/api/downloads-directory", () =>
        {
            return Results.Ok(new { path = MediaHelper.GetDownloadsDirectory() });
        });

        app.MapPost("/api/open-folder", () =>
        {
            string downloadsFolder = MediaHelper.GetDownloadsDirectory();
            if (!Directory.Exists(downloadsFolder)) Directory.CreateDirectory(downloadsFolder);
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    Arguments = $"\"{downloadsFolder}\"",
                    UseShellExecute = true
                });
            }
            catch { }
            return Results.Ok(new { success = true, path = downloadsFolder });
        });

        return app;
    }
}
