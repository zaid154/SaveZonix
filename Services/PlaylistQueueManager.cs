using System.Collections.Concurrent;
using System.Diagnostics;
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
        MaxConnectionsPerServer = 200,
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

    public PlaylistBatchJobState? GetJobState(string jobId)
    {
        if (_jobs.TryGetValue(jobId, out var state))
        {
            return state;
        }
        return null;
    }

    public bool CancelBatchJob(string jobId)
    {
        if (_jobs.TryGetValue(jobId, out var job))
        {
            job.Cts?.Cancel();
            job.Status = "Cancelled";
            foreach (var item in job.Items)
            {
                if (item.Status == "Pending" || item.Status == "Analyzing" || item.Status.StartsWith("Downloading") || item.Status.StartsWith("Muxing"))
                {
                    item.Cts?.Cancel();
                    item.Status = "Cancelled";
                }
            }
            return true;
        }
        return false;
    }

    public bool CancelPlaylistItem(string jobId, string videoId)
    {
        if (_jobs.TryGetValue(jobId, out var job))
        {
            var item = job.Items.FirstOrDefault(i => i.VideoId == videoId);
            if (item != null)
            {
                item.Cts?.Cancel();
                item.Status = "Cancelled";
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
            await DownloadSingleItemAsync(item, job.OutputFolder, job.Cts?.Token ?? CancellationToken.None);
            UpdateJobStats(job);
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

        foreach (var item in failedItems)
        {
            item.Status = "Pending";
            item.Percentage = 0;
            item.SpeedMBps = 0;
            item.BytesDownloaded = 0;
            item.ErrorMessage = null;
            item.RetryCount++;
        }

        job.Status = "Downloading";
        UpdateJobStats(job);

        _ = Task.Run(async () =>
        {
            using var semaphore = new SemaphoreSlim(Math.Clamp(job.Items.Count > 2 ? 4 : 2, 1, 6));
            var tasks = failedItems.Select(async item =>
            {
                await semaphore.WaitAsync();
                try
                {
                    await DownloadSingleItemAsync(item, job.OutputFolder, job.Cts?.Token ?? CancellationToken.None);
                }
                finally
                {
                    semaphore.Release();
                    UpdateJobStats(job);
                }
            });

            await Task.WhenAll(tasks);
            UpdateJobStats(job);
        });

        return Task.FromResult(true);
    }

    public async Task<PlaylistBatchJobState> StartBatchDownloadAsync(PlaylistBatchDownloadRequest request, CancellationToken cancellationToken = default)
    {
        string jobId = Guid.NewGuid().ToString("N");
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
        int concurrency = Math.Clamp(request.Concurrency, 1, 8);

        var items = new List<PlaylistItemDownloadState>();
        if (request.Videos != null && request.Videos.Count > 0)
        {
            foreach (var v in request.Videos)
            {
                items.Add(new PlaylistItemDownloadState
                {
                    VideoId = v.VideoId,
                    Index = v.Index,
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
                    VideoId = vid,
                    Index = index++,
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
            PlaylistTitle = request.PlaylistTitle,
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
                    await DownloadSingleItemAsync(item, job.OutputFolder, cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    item.Status = "Cancelled";
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
            }, cancellationToken));
        }

        try
        {
            await Task.WhenAll(tasks);
        }
        catch { }

        UpdateJobStats(job);
        job.Status = job.FailedCount > 0 ? (job.CompletedCount > 0 ? "Completed with Errors" : "Failed") : "Completed";
    }

    private async Task DownloadSingleItemAsync(PlaylistItemDownloadState item, string targetFolder, CancellationToken batchToken)
    {
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(batchToken, item.Cts?.Token ?? CancellationToken.None);
        var ct = linkedCts.Token;

        item.Status = "Analyzing...";
        item.Percentage = 5;

        string tempDirectory = Path.Combine(Path.GetTempPath(), "SaveZonix_PL_" + Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(tempDirectory);

            var video = await _youtubeClient.Videos.GetAsync(item.VideoId, ct);
            item.Title = video.Title;
            item.ThumbnailUrl = video.Thumbnails.GetWithHighestResolution()?.Url ?? $"https://i.ytimg.com/vi/{video.Id}/hqdefault.jpg";
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

            string prefix = (item.NumberPrefix && item.Index > 0) ? $"{item.Index:D2} - " : "";
            string outFileName = $"{prefix}{safeTitle}{ext}";
            item.OutputFileName = outFileName;

            var manifest = await _youtubeClient.Videos.Streams.GetManifestAsync(item.VideoId, ct);

            bool isAudioOnly = item.Format.Equals("MP3", StringComparison.OrdinalIgnoreCase) ||
                               item.Format.Equals("M4A", StringComparison.OrdinalIgnoreCase) ||
                               item.Quality.Equals("AudioOnly", StringComparison.OrdinalIgnoreCase);

            string tempOutput = Path.Combine(tempDirectory, "out" + ext);

            var sw = Stopwatch.StartNew();
            long lastBytes = 0;
            double lastSeconds = 0;

            if (isAudioOnly)
            {
                item.Status = "Downloading Audio Track (Turbo)...";
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
                        lastSeconds = elapsed;
                        lastBytes = item.BytesDownloaded;
                    }
                });

                await DownloadStreamToDiskAsync(audioStream, tempAudioRaw, audioProgress, ct);

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

                var audioStream = manifest.GetAudioOnlyStreams().GetWithHighestBitrate();

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
                            lastSeconds = elapsed;
                            lastBytes = item.BytesDownloaded;
                        }
                    });

                    await DownloadStreamToDiskAsync(muxed, tempOutput, muxProgress, ct);
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

                    item.Status = $"Downloading {videoStream.VideoQuality.Label} + Audio (Parallel)...";

                    var videoTask = DownloadStreamToDiskAsync(videoStream, tempVideoRaw, videoProgress, ct);
                    var audioTask = audioStream != null
                        ? DownloadStreamToDiskAsync(audioStream, tempAudioRaw, audioProgress, ct)
                        : Task.CompletedTask;

                    await Task.WhenAll(videoTask, audioTask);

                    if (audioStream != null)
                    {
                        item.Status = "Muxing Video + Audio with FFmpeg...";
                        item.Percentage = 92;

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
        }
        catch (OperationCanceledException)
        {
            item.Status = "Cancelled";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Playlist Video Error] {item.VideoId}: {ex.Message}");
            item.Status = "Failed";
            item.ErrorMessage = ex.Message;
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
        using var fileStream = new FileStream(targetPath, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize: 262144, useAsync: true);

        byte[] buffer = new byte[262144]; // 256KB buffer for max I/O throughput
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

    private static string GetFfmpegPath()
    {
        string ffmpegPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ffmpeg.exe");
        if (!File.Exists(ffmpegPath)) ffmpegPath = Path.Combine(Directory.GetCurrentDirectory(), "ffmpeg.exe");
        if (!File.Exists(ffmpegPath)) ffmpegPath = "ffmpeg";
        return ffmpegPath;
    }

    private static async Task<bool> MuxVideoAndAudioAsync(string videoPath, string audioPath, string outputPath)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = GetFfmpegPath(),
                Arguments = $"-i \"{videoPath}\" -i \"{audioPath}\" -c:v copy -c:a aac -b:a 192k -threads 0 -map 0:v:0 -map 1:a:0? -movflags +faststart \"{outputPath}\" -y",
                RedirectStandardOutput = false,
                RedirectStandardError = false,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var proc = Process.Start(psi);
            if (proc != null)
            {
                await proc.WaitForExitAsync();
                return proc.ExitCode == 0 && File.Exists(outputPath);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FFmpeg Mux] {ex.Message}");
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
}
