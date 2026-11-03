using System.Diagnostics;
using System.Net;

namespace Zonix.Core;

public class ParallelDownloader
{
    private readonly HttpClient _httpClient;

    public ParallelDownloader(HttpClient? httpClient = null)
    {
        _httpClient = httpClient ?? SaveZonix.Core.MediaHelper.CreateConfiguredHttpClient();
    }

    public async Task<List<SegmentItem>> DownloadSegmentsAsync(
        List<string> segmentUrls,
        string tempDirectory,
        int maxConcurrency = 64,
        IProgress<DownloadProgressReport>? progress = null,
        CancellationToken cancellationToken = default,
        long initialEstimatedBytes = 0)
    {
        if (!Directory.Exists(tempDirectory))
        {
            Directory.CreateDirectory(tempDirectory);
        }

        bool isFmp4 = segmentUrls.Any(u => u.Contains(".m4s", StringComparison.OrdinalIgnoreCase) || u.Contains("init-", StringComparison.OrdinalIgnoreCase));
        string defaultSegExt = isFmp4 ? ".m4s" : ".ts";

        var segments = segmentUrls.Select((url, index) => {
            // Only assign .mp4 extension if it's explicitly fMP4 or direct file, never when it's an HLS segment URL (which are MPEG-TS transport streams)
            string ext = isFmp4 ? ".m4s" : ".ts";
            return new SegmentItem
            {
                Index = index,
                Url = url,
                LocalTempPath = Path.Combine(tempDirectory, $"seg_{index:D6}{ext}"),
                IsDownloaded = false,
                SizeBytes = 0
            };
        }).ToList();

        int totalSegments = segments.Count;
        int downloadedCount = 0;
        long totalBytes = 0;
        double peakSpeedMBps = 0.0;

        var stopwatch = Stopwatch.StartNew();
        
        // ─── SMART SITE-ADAPTIVE CONCURRENCY PROFILER ──────────────
        string sampleUrl = segmentUrls.FirstOrDefault() ?? string.Empty;
        int initialConcurrency = GetOptimizedConcurrency(sampleUrl, maxConcurrency);
        int activeConcurrency = initialConcurrency;

        // ─── ROLLING SLIDING-WINDOW & EMA SPEED / ETA CALCULATOR ───────────
        var sampleQueue = new Queue<(long Ticks, long Bytes)>();
        double smoothedSpeedBytesPerSec = 0.0;

        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(200));
        var progressTask = Task.Run(async () =>
        {
            while (await timer.WaitForNextTickAsync(cancellationToken))
            {
                if (cancellationToken.IsCancellationRequested || downloadedCount >= totalSegments) break;

                long nowTicks = Stopwatch.GetTimestamp();
                long currentBytes = Interlocked.Read(ref totalBytes);
                int currentDownloaded = Interlocked.CompareExchange(ref downloadedCount, 0, 0);

                sampleQueue.Enqueue((nowTicks, currentBytes));

                long maxAgeTicks = (long)(3.0 * Stopwatch.Frequency);
                while (sampleQueue.Count > 3 && (nowTicks - sampleQueue.Peek().Ticks) > maxAgeTicks)
                {
                    sampleQueue.Dequeue();
                }

                double currentSpeedMBps = 0.0;
                TimeSpan eta = TimeSpan.FromSeconds(-1);

                if (sampleQueue.Count >= 2)
                {
                    var oldest = sampleQueue.Peek();
                    double windowSeconds = (double)(nowTicks - oldest.Ticks) / Stopwatch.Frequency;
                    long deltaBytes = currentBytes - oldest.Bytes;

                    if (windowSeconds >= 0.3 && deltaBytes >= 0)
                    {
                        double rawInstantSpeed = deltaBytes / windowSeconds;

                        smoothedSpeedBytesPerSec = (smoothedSpeedBytesPerSec <= 0) 
                            ? rawInstantSpeed 
                            : (0.35 * rawInstantSpeed + 0.65 * smoothedSpeedBytesPerSec);

                        currentSpeedMBps = smoothedSpeedBytesPerSec / (1024.0 * 1024.0);
                        if (currentSpeedMBps > peakSpeedMBps) peakSpeedMBps = currentSpeedMBps;
                    }
                }

                // Calculate Rock-Solid Genuine ETA & Accurate Total Size
                long estTotal = initialEstimatedBytes > 0 ? initialEstimatedBytes : 0;
                double elapsedSecs = Math.Max(0.5, stopwatch.Elapsed.TotalSeconds);
                double overallAverageSpeed = (double)currentBytes / elapsedSecs;

                // Dynamically refine estimate based on actual completed media segments (ignoring tiny init segments < 20KB)
                var completedMediaSegs = segments.Where(s => s.IsDownloaded && s.SizeBytes > 20480).ToList();
                if (completedMediaSegs.Count >= 2)
                {
                    double avgSeg = (double)completedMediaSegs.Sum(s => s.SizeBytes) / completedMediaSegs.Count;
                    long liveMeasuredTotal = (long)(avgSeg * totalSegments);

                    if (initialEstimatedBytes > 0)
                    {
                        // Weighted blend: 30% initial estimate + 70% actual measured segments
                        estTotal = (long)(initialEstimatedBytes * 0.30 + liveMeasuredTotal * 0.70);
                    }
                    else
                    {
                        estTotal = liveMeasuredTotal;
                    }
                }
                else if (initialEstimatedBytes > 0)
                {
                    estTotal = initialEstimatedBytes;
                }
                else if (currentBytes > 102400)
                {
                    estTotal = (long)(currentBytes * (totalSegments / Math.Max(1.0, (double)currentDownloaded + 0.5)));
                }

                long remainingBytes = (long)Math.Max(0, estTotal - currentBytes);

                if (remainingBytes <= 0 || currentDownloaded >= totalSegments)
                {
                    eta = TimeSpan.Zero;
                }
                else
                {
                    // Blended reliable speed: 65% recent smoothed speed + 35% overall average speed
                    double reliableSpeed = Math.Max(
                        smoothedSpeedBytesPerSec * 0.65 + overallAverageSpeed * 0.35, 
                        overallAverageSpeed * 0.6
                    );

                    if (reliableSpeed > 10240)
                    {
                        double rawEtaSeconds = (double)remainingBytes / reliableSpeed;
                        eta = TimeSpan.FromSeconds(Math.Min(1800, Math.Max(1.0, rawEtaSeconds)));
                    }
                }

                progress?.Report(new DownloadProgressReport
                {
                    TotalSegments = totalSegments,
                    DownloadedSegments = currentDownloaded,
                    TotalBytesDownloaded = currentBytes,
                    EstimatedTotalBytes = estTotal,
                    SpeedMBps = currentSpeedMBps,
                    PeakSpeedMBps = peakSpeedMBps,
                    ActiveThreads = activeConcurrency,
                    Elapsed = stopwatch.Elapsed,
                    EstimatedTimeRemaining = eta,
                    Status = $"Downloading in Parallel ({activeConcurrency} Threads)..."
                });
            }
        }, cancellationToken);

        // Adaptive Parallel Execution
        var parallelOptions = new ParallelOptions
        {
            MaxDegreeOfParallelism = activeConcurrency,
            CancellationToken = cancellationToken
        };

        await Parallel.ForEachAsync(segments, parallelOptions, async (seg, ct) =>
        {
            try
            {
                await DownloadSingleSegmentWithRetryAsync(seg, totalBytesRef: (delta) => Interlocked.Add(ref totalBytes, delta), ct);
                Interlocked.Increment(ref downloadedCount);
            }
            catch (Exception)
            {
                // Individual segment error handled by internal retry
            }
        });

        stopwatch.Stop();

        // Strict 100% segment download integrity check
        var missingSegments = segments
            .Where(s => !s.IsDownloaded || !File.Exists(s.LocalTempPath) || new FileInfo(s.LocalTempPath).Length == 0)
            .ToList();

        var downloadedSegments = segments.Where(s => s.IsDownloaded).ToList();
        Console.WriteLine($"[ParallelDownloader] Download complete: {downloadedSegments.Count}/{totalSegments} segments OK, {missingSegments.Count} failed/missing");
        if (downloadedSegments.Count > 0)
        {
            long totalDownloadedBytes = downloadedSegments.Sum(s => s.SizeBytes);
            Console.WriteLine($"[ParallelDownloader] Total downloaded bytes: {totalDownloadedBytes}, avg segment: {totalDownloadedBytes / downloadedSegments.Count} bytes");
            // Show first few segment sizes
            foreach (var s in downloadedSegments.Take(5))
            {
                Console.WriteLine($"[ParallelDownloader]   seg_{s.Index:D4}: {s.SizeBytes} bytes, path: {Path.GetFileName(s.LocalTempPath)}");
            }
        }

        if (missingSegments.Count > 0)
        {
            throw new InvalidOperationException($"Incomplete download: {missingSegments.Count} of {totalSegments} segments failed to download (Segment #{missingSegments[0].Index} missing). Merging was aborted to prevent corrupted playback.");
        }

        progress?.Report(new DownloadProgressReport
        {
            TotalSegments = totalSegments,
            DownloadedSegments = totalSegments,
            TotalBytesDownloaded = totalBytes,
            EstimatedTotalBytes = totalBytes,
            SpeedMBps = (totalBytes / 1024.0 / 1024.0) / Math.Max(0.1, stopwatch.Elapsed.TotalSeconds),
            PeakSpeedMBps = peakSpeedMBps,
            ActiveThreads = activeConcurrency,
            Elapsed = stopwatch.Elapsed,
            EstimatedTimeRemaining = TimeSpan.Zero,
            Status = "Download Complete"
        });

        return segments;
    }

    public async Task<List<SegmentItem>> DownloadDirectFileAsync(
        string fileUrl,
        string tempDirectory,
        long totalContentLength,
        int maxConcurrency = 32,
        IProgress<DownloadProgressReport>? progress = null,
        CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(tempDirectory))
        {
            Directory.CreateDirectory(tempDirectory);
        }

        bool supportsRange = false;
        long confirmedLength = totalContentLength;

        try
        {
            using var rangeReq = new HttpRequestMessage(HttpMethod.Get, fileUrl);
            if (fileUrl.Contains("googlevideo", StringComparison.OrdinalIgnoreCase) || fileUrl.Contains("youtube", StringComparison.OrdinalIgnoreCase))
            {
                rangeReq.Version = System.Net.HttpVersion.Version11;
                rangeReq.VersionPolicy = HttpVersionPolicy.RequestVersionExact;
                rangeReq.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");
                rangeReq.Headers.TryAddWithoutValidation("Referer", "https://www.youtube.com/");
                rangeReq.Headers.TryAddWithoutValidation("Accept", "*/*");
                rangeReq.Headers.TryAddWithoutValidation("Accept-Encoding", "identity");
            }
            else
            {
                rangeReq.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
            }
            rangeReq.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0, 0);
            var referers = StreamSecurityHelper.GetCandidateReferers(new Uri(fileUrl));
            if (referers.Count > 0 && !string.IsNullOrEmpty(referers[0]) && !rangeReq.Headers.Contains("Referer")) rangeReq.Headers.TryAddWithoutValidation("Referer", referers[0]);

            using var rangeRes = await _httpClient.SendAsync(rangeReq, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (rangeRes.StatusCode == HttpStatusCode.PartialContent)
            {
                supportsRange = true;
                if (rangeRes.Content.Headers.ContentRange?.Length.HasValue == true)
                {
                    confirmedLength = rangeRes.Content.Headers.ContentRange.Length.Value;
                }
            }
            else if (rangeRes.IsSuccessStatusCode && rangeRes.Content.Headers.ContentLength.HasValue)
            {
                confirmedLength = rangeRes.Content.Headers.ContentLength.Value;
            }
        }
        catch { }

        if (!supportsRange || confirmedLength <= 524288)
        {
            return await DownloadDirectSingleStreamAsync(fileUrl, tempDirectory, confirmedLength, progress, cancellationToken);
        }

        // ─── SMART SITE-ADAPTIVE CONCURRENCY & CHUNK SIZING ──────────────
        int optimizedConcurrency = GetOptimizedConcurrency(fileUrl, maxConcurrency);

        // Optimal chunk size is 4MB - 16MB so TCP congestion window ramps up to max bandwidth
        long minChunkSize = 4L * 1024 * 1024;
        int maxChunksByLength = (int)Math.Max(2, confirmedLength / minChunkSize);
        int numChunks = Math.Clamp(optimizedConcurrency, 2, Math.Min(maxChunksByLength, 16));
        long chunkSize = confirmedLength / numChunks;
        var chunks = new List<SegmentItem>();

        for (int i = 0; i < numChunks; i++)
        {
            long start = i * chunkSize;
            long end = (i == numChunks - 1) ? confirmedLength - 1 : (start + chunkSize - 1);

            chunks.Add(new SegmentItem
            {
                Index = i,
                Url = fileUrl,
                LocalTempPath = Path.Combine(tempDirectory, $"chunk_{i:D6}.part"),
                RangeStart = start,
                RangeEnd = end,
                SizeBytes = 0,
                IsDownloaded = false
            });
        }

        long totalBytes = 0;
        int completedChunks = 0;
        double peakSpeedMBps = 0.0;
        var stopwatch = Stopwatch.StartNew();

        var sampleQueue = new Queue<(long Ticks, long Bytes)>();
        double smoothedSpeed = 0.0;

        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(200));
        var progressTask = Task.Run(async () =>
        {
            while (await timer.WaitForNextTickAsync(cancellationToken))
            {
                if (cancellationToken.IsCancellationRequested || completedChunks >= chunks.Count) break;

                long nowTicks = Stopwatch.GetTimestamp();
                long currentBytes = Interlocked.Read(ref totalBytes);
                int done = Interlocked.CompareExchange(ref completedChunks, 0, 0);

                sampleQueue.Enqueue((nowTicks, currentBytes));
                long maxAgeTicks = (long)(3.0 * Stopwatch.Frequency);
                while (sampleQueue.Count > 3 && (nowTicks - sampleQueue.Peek().Ticks) > maxAgeTicks)
                {
                    sampleQueue.Dequeue();
                }

                double curSpeed = 0.0;
                TimeSpan eta = TimeSpan.FromSeconds(-1);

                if (sampleQueue.Count >= 2)
                {
                    var oldest = sampleQueue.Peek();
                    double winSec = (double)(nowTicks - oldest.Ticks) / Stopwatch.Frequency;
                    long dBytes = currentBytes - oldest.Bytes;

                    if (winSec >= 0.3 && dBytes >= 0)
                    {
                        double rawSpeed = dBytes / winSec;
                        smoothedSpeed = (smoothedSpeed <= 0) ? rawSpeed : (0.35 * rawSpeed + 0.65 * smoothedSpeed);
                        curSpeed = smoothedSpeed / (1024.0 * 1024.0);
                        if (curSpeed > peakSpeedMBps) peakSpeedMBps = curSpeed;
                    }
                }

                if (confirmedLength > 0 && smoothedSpeed > 10240)
                {
                    long remBytes = Math.Max(0, confirmedLength - currentBytes);
                    eta = TimeSpan.FromSeconds(Math.Max(1.0, (double)remBytes / smoothedSpeed));
                }

                progress?.Report(new DownloadProgressReport
                {
                    TotalSegments = chunks.Count,
                    DownloadedSegments = done,
                    TotalBytesDownloaded = currentBytes,
                    EstimatedTotalBytes = confirmedLength,
                    SpeedMBps = curSpeed,
                    PeakSpeedMBps = peakSpeedMBps,
                    ActiveThreads = numChunks,
                    Elapsed = stopwatch.Elapsed,
                    EstimatedTimeRemaining = eta,
                    Status = $"Downloading Direct File ({numChunks} Turbo Range Slices)..."
                });
            }
        }, cancellationToken);

        var parallelOptions = new ParallelOptions
        {
            MaxDegreeOfParallelism = numChunks,
            CancellationToken = cancellationToken
        };

        try
        {
            await Parallel.ForEachAsync(chunks, parallelOptions, async (chunk, ct) =>
            {
                await DownloadRangeChunkWithRetryAsync(chunk, delta => Interlocked.Add(ref totalBytes, delta), ct);
                if (chunk.IsDownloaded)
                {
                    Interlocked.Increment(ref completedChunks);
                }
            });
        }
        catch
        {
            return await DownloadDirectSingleStreamAsync(fileUrl, tempDirectory, confirmedLength, progress, cancellationToken);
        }

        if (chunks.Any(c => !c.IsDownloaded || !File.Exists(c.LocalTempPath) || new FileInfo(c.LocalTempPath).Length == 0))
        {
            Console.WriteLine("[Downloader] Range chunks incomplete or blocked by CDN — falling back to single progressive stream.");
            return await DownloadDirectSingleStreamAsync(fileUrl, tempDirectory, confirmedLength, progress, cancellationToken);
        }

        stopwatch.Stop();

        progress?.Report(new DownloadProgressReport
        {
            TotalSegments = chunks.Count,
            DownloadedSegments = chunks.Count,
            TotalBytesDownloaded = totalBytes,
            EstimatedTotalBytes = totalBytes,
            SpeedMBps = (totalBytes / 1024.0 / 1024.0) / Math.Max(0.1, stopwatch.Elapsed.TotalSeconds),
            PeakSpeedMBps = peakSpeedMBps,
            ActiveThreads = numChunks,
            Elapsed = stopwatch.Elapsed,
            EstimatedTimeRemaining = TimeSpan.Zero,
            Status = "Download Complete"
        });

        return chunks;
    }

    private async Task<List<SegmentItem>> DownloadDirectSingleStreamAsync(
        string fileUrl,
        string tempDirectory,
        long totalLength,
        IProgress<DownloadProgressReport>? progress,
        CancellationToken ct)
    {
        var singleChunk = new SegmentItem
        {
            Index = 0,
            Url = fileUrl,
            LocalTempPath = Path.Combine(tempDirectory, "single_stream.mp4"),
            SizeBytes = 0,
            IsDownloaded = false
        };

        var uri = new Uri(fileUrl);
        var referers = StreamSecurityHelper.GetCandidateReferers(uri);
        string referer = referers.Count > 0 ? referers[0] : "";
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, fileUrl);
            req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
            if (!string.IsNullOrEmpty(referer)) req.Headers.TryAddWithoutValidation("Referer", referer);

            using var res = await _httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
            res.EnsureSuccessStatusCode();

            long reportedLen = res.Content.Headers.ContentLength ?? totalLength;
            await using var contentStream = await res.Content.ReadAsStreamAsync(ct);
            await using var fileStream = new FileStream(singleChunk.LocalTempPath, FileMode.Create, FileAccess.Write, FileShare.None, 262144, true);

            byte[] buffer = System.Buffers.ArrayPool<byte>.Shared.Rent(131072);
            int bytesRead;
            long totalBytes = 0;
            var sw = Stopwatch.StartNew();

            try
            {
                while ((bytesRead = await contentStream.ReadAsync(buffer, 0, 131072, ct)) > 0)
                {
                    await fileStream.WriteAsync(buffer, 0, bytesRead, ct);
                    totalBytes += bytesRead;

                    double spd = (totalBytes / (1024.0 * 1024.0)) / Math.Max(0.1, sw.Elapsed.TotalSeconds);
                    TimeSpan eta = reportedLen > 0 && spd > 0.01 
                        ? TimeSpan.FromSeconds((reportedLen - totalBytes) / (spd * 1024.0 * 1024.0)) 
                        : TimeSpan.Zero;

                    progress?.Report(new DownloadProgressReport
                    {
                        TotalSegments = 1,
                        DownloadedSegments = (totalBytes >= reportedLen && reportedLen > 0) ? 1 : 0,
                        TotalBytesDownloaded = totalBytes,
                        EstimatedTotalBytes = reportedLen,
                        SpeedMBps = spd,
                        PeakSpeedMBps = spd,
                        ActiveThreads = 1,
                        Elapsed = sw.Elapsed,
                        EstimatedTimeRemaining = eta,
                        Status = "Downloading Single Stream..."
                    });
                }
            }
            finally
            {
                System.Buffers.ArrayPool<byte>.Shared.Return(buffer);
            }

            singleChunk.SizeBytes = totalBytes;
            singleChunk.IsDownloaded = true;
            return new List<SegmentItem> { singleChunk };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ParallelDownloader] Single-stream HttpClient failed ({ex.Message}), falling back to curl stealth downloader: {fileUrl}");
            try { if (File.Exists(singleChunk.LocalTempPath)) File.Delete(singleChunk.LocalTempPath); } catch { }

            foreach (var refCandidate in referers)
            {
                if (await DownloadSegmentWithCurlAsync(fileUrl, singleChunk.LocalTempPath, refCandidate, ct))
                {
                    var fi = new FileInfo(singleChunk.LocalTempPath);
                    if (fi.Length > 1024)
                    {
                        singleChunk.SizeBytes = fi.Length;
                        singleChunk.IsDownloaded = true;
                        progress?.Report(new DownloadProgressReport
                        {
                            TotalSegments = 1,
                            DownloadedSegments = 1,
                            TotalBytesDownloaded = fi.Length,
                            EstimatedTotalBytes = fi.Length,
                            SpeedMBps = 8.5,
                            ActiveThreads = 1,
                            Status = "Downloaded via Secure Stealth Stream"
                        });
                        return new List<SegmentItem> { singleChunk };
                    }
                }
            }

            throw;
        }
    }

    private async Task DownloadRangeChunkWithRetryAsync(SegmentItem chunk, Action<int> totalBytesRef, CancellationToken ct, int maxRetries = 8)
    {
        int attempt = 0;
        var uri = new Uri(chunk.Url);
        var referers = StreamSecurityHelper.GetCandidateReferers(uri);
        long expectedTotalBytes = chunk.RangeEnd - chunk.RangeStart + 1;

        while (attempt < maxRetries && !ct.IsCancellationRequested)
        {
            attempt++;
            long existingBytes = 0;
            if (File.Exists(chunk.LocalTempPath))
            {
                try { existingBytes = new FileInfo(chunk.LocalTempPath).Length; } catch { existingBytes = 0; }
            }

            if (existingBytes >= expectedTotalBytes && expectedTotalBytes > 0)
            {
                chunk.SizeBytes = existingBytes;
                chunk.IsDownloaded = true;
                return;
            }

            long rangeReqStart = chunk.RangeStart + existingBytes;
            long rangeReqEnd = chunk.RangeEnd;

            try
            {
                string referer = referers[(attempt - 1) % referers.Count];

                using var attemptCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                attemptCts.CancelAfter(TimeSpan.FromSeconds(45)); // 45s socket/read timeout for heavy CDNs

                using var request = new HttpRequestMessage(HttpMethod.Get, chunk.Url);
                if (uri.Host.Contains("googlevideo", StringComparison.OrdinalIgnoreCase) || uri.Host.Contains("youtube", StringComparison.OrdinalIgnoreCase))
                {
                    request.Version = System.Net.HttpVersion.Version11;
                    request.VersionPolicy = HttpVersionPolicy.RequestVersionExact;
                    request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");
                    request.Headers.TryAddWithoutValidation("Referer", "https://www.youtube.com/");
                    request.Headers.TryAddWithoutValidation("Accept", "*/*");
                    request.Headers.TryAddWithoutValidation("Accept-Encoding", "identity");
                }
                else
                {
                    request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                    if (!string.IsNullOrEmpty(referer))
                    {
                        request.Headers.TryAddWithoutValidation("Referer", referer);
                        if (Uri.TryCreate(referer, UriKind.Absolute, out var rUri))
                        {
                            request.Headers.TryAddWithoutValidation("Origin", $"{rUri.Scheme}://{rUri.Host}");
                        }
                    }
                }
                request.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(rangeReqStart, rangeReqEnd);

                using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, attemptCts.Token);
                response.EnsureSuccessStatusCode();

                if (response.StatusCode == HttpStatusCode.OK && rangeReqStart > 0)
                {
                    throw new InvalidOperationException("Server returned 200 OK instead of 206 Partial Content for byte range.");
                }

                await using var contentStream = await response.Content.ReadAsStreamAsync(attemptCts.Token);
                var fileMode = existingBytes > 0 ? FileMode.Append : FileMode.Create;
                await using var fileStream = new FileStream(chunk.LocalTempPath, fileMode, FileAccess.Write, FileShare.None, 262144, FileOptions.Asynchronous | FileOptions.SequentialScan);

                byte[] buffer = System.Buffers.ArrayPool<byte>.Shared.Rent(262144);
                int bytesRead;

                try
                {
                    while (true)
                    {
                        attemptCts.CancelAfter(TimeSpan.FromSeconds(45));
                        bytesRead = await contentStream.ReadAsync(buffer, 0, 262144, attemptCts.Token);
                        if (bytesRead == 0) break;

                        await fileStream.WriteAsync(buffer, 0, bytesRead, attemptCts.Token);
                        existingBytes += bytesRead;
                        totalBytesRef(bytesRead);
                    }
                }
                finally
                {
                    System.Buffers.ArrayPool<byte>.Shared.Return(buffer);
                }

                await fileStream.FlushAsync(ct);

                if (expectedTotalBytes > 0 && existingBytes < expectedTotalBytes)
                {
                    throw new InvalidOperationException($"Incomplete chunk: expected {expectedTotalBytes} bytes, received {existingBytes} bytes so far.");
                }

                chunk.SizeBytes = existingBytes;
                chunk.IsDownloaded = true;
                return;
            }
            catch (Exception ex) when (attempt < maxRetries && !ct.IsCancellationRequested)
            {
                // Resume from existing bytes on next attempt — DO NOT subtract bytes, DO NOT delete partial file
                Console.WriteLine($"[ParallelDownloader] Chunk #{chunk.Index} attempt {attempt} retry notice: {ex.Message} (Resuming from {existingBytes}/{expectedTotalBytes} bytes)");
                await Task.Delay(200 * attempt, ct);
            }
        }

        // If all retries exhausted, check if we got the full chunk anyway
        if (File.Exists(chunk.LocalTempPath))
        {
            long fiLen = new FileInfo(chunk.LocalTempPath).Length;
            if (fiLen >= expectedTotalBytes)
            {
                chunk.SizeBytes = fiLen;
                chunk.IsDownloaded = true;
            }
        }
    }

    private async Task DownloadSingleSegmentWithRetryAsync(SegmentItem segment, Action<int> totalBytesRef, CancellationToken ct, int maxRetries = 8)
    {
        int attempt = 0;
        string rawUrl = segment.Url;
        long rangeStart = -1;
        long rangeEnd = -1;

        if (rawUrl.Contains("#range="))
        {
            var rangeMatch = System.Text.RegularExpressions.Regex.Match(rawUrl, @"#range=(\d+)-(\d+)");
            if (rangeMatch.Success && long.TryParse(rangeMatch.Groups[1].Value, out var s) && long.TryParse(rangeMatch.Groups[2].Value, out var e))
            {
                rangeStart = s;
                rangeEnd = e;
            }
            rawUrl = rawUrl.Split('#')[0];
        }

        var uri = new Uri(rawUrl);
        var referers = StreamSecurityHelper.GetCandidateReferers(uri);

        while (attempt < maxRetries)
        {
            try
            {
                attempt++;
                string referer = referers[(attempt - 1) % referers.Count];

                using var attemptCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                attemptCts.CancelAfter(TimeSpan.FromSeconds(90)); // 90s per segment to prevent premature socket cancellation on large HD segments

                using var request = new HttpRequestMessage(HttpMethod.Get, rawUrl);
                request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                request.Headers.TryAddWithoutValidation("Accept", "*/*");
                request.Headers.TryAddWithoutValidation("Sec-Fetch-Dest", "empty");
                request.Headers.TryAddWithoutValidation("Sec-Fetch-Mode", "cors");

                if (rangeStart >= 0 && rangeEnd >= rangeStart)
                {
                    request.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(rangeStart, rangeEnd);
                }

                if (!string.IsNullOrEmpty(referer))
                {
                    request.Headers.TryAddWithoutValidation("Referer", referer);
                    if (Uri.TryCreate(referer, UriKind.Absolute, out var rUri))
                    {
                        request.Headers.TryAddWithoutValidation("Origin", $"{rUri.Scheme}://{rUri.Host}");
                    }
                }

                using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseContentRead, attemptCts.Token);
                response.EnsureSuccessStatusCode();

                byte[] rawBytes = await response.Content.ReadAsByteArrayAsync(attemptCts.Token);
                if (rawBytes.Length > 0)
                {
                    byte[] cleanBytes = UnmaskEncapsulation(rawBytes);
                    await File.WriteAllBytesAsync(segment.LocalTempPath, cleanBytes, ct);
                    segment.SizeBytes = cleanBytes.Length;
                    segment.IsDownloaded = true;
                    totalBytesRef(cleanBytes.Length);
                    return;
                }
                else
                {
                    Console.WriteLine($"[ParallelDownloader] Seg #{segment.Index} attempt {attempt}: 0 bytes from {uri.Host}");
                }
            }
            catch (Exception ex) when (attempt < maxRetries && !ct.IsCancellationRequested)
            {
                Console.WriteLine($"[ParallelDownloader] Seg #{segment.Index} attempt {attempt} failed: {ex.GetType().Name}: {ex.Message.Substring(0, Math.Min(120, ex.Message.Length))}");
                try { if (File.Exists(segment.LocalTempPath)) File.Delete(segment.LocalTempPath); } catch { }

                string referer = referers.Count > 0 ? referers[0] : "";
                if (await DownloadSegmentWithCurlAsync(rawUrl, segment.LocalTempPath, referer, ct))
                {
                    var fi = new FileInfo(segment.LocalTempPath);
                    if (fi.Length > 500) // Minimum valid video segment size (prevents 1-byte or error-page files)
                    {
                        segment.SizeBytes = fi.Length;
                        segment.IsDownloaded = true;
                        totalBytesRef((int)fi.Length);
                        return;
                    }
                    else
                    {
                        try { if (File.Exists(segment.LocalTempPath)) File.Delete(segment.LocalTempPath); } catch { }
                    }
                }

                await Task.Delay(100 * attempt, ct);
            }
        }
        Console.WriteLine($"[ParallelDownloader] Seg #{segment.Index} EXHAUSTED all {maxRetries} retries for: {rawUrl.Substring(0, Math.Min(80, rawUrl.Length))}...");
    }

    private static async Task<bool> DownloadSegmentWithCurlAsync(string url, string localPath, string referer, CancellationToken ct)
    {
        try
        {
            string executable = OperatingSystem.IsWindows()
                ? Path.Combine(Environment.SystemDirectory, "curl.exe")
                : "curl";
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = executable,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            psi.ArgumentList.Add("--silent");
            psi.ArgumentList.Add("--show-error");
            psi.ArgumentList.Add("--fail"); // Fail fast on HTTP 4xx/5xx (prevents writing 1-byte error responses)
            psi.ArgumentList.Add("--location");
            psi.ArgumentList.Add("--insecure");
            psi.ArgumentList.Add("--max-time");
            psi.ArgumentList.Add("90");
            psi.ArgumentList.Add("--retry");
            psi.ArgumentList.Add("2");
            psi.ArgumentList.Add("--retry-delay");
            psi.ArgumentList.Add("1");
            psi.ArgumentList.Add("--user-agent");
            psi.ArgumentList.Add("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36");
            if (!string.IsNullOrEmpty(referer))
            {
                psi.ArgumentList.Add("--referer");
                psi.ArgumentList.Add(referer);
                if (Uri.TryCreate(referer, UriKind.Absolute, out var rUri))
                {
                    psi.ArgumentList.Add("--header");
                    psi.ArgumentList.Add($"Origin: {rUri.Scheme}://{rUri.Host}");
                }
            }
            psi.ArgumentList.Add("--output");
            psi.ArgumentList.Add(localPath);
            psi.ArgumentList.Add(url);

            using var proc = System.Diagnostics.Process.Start(psi);
            if (proc == null) return false;
            await proc.WaitForExitAsync(ct);
            return File.Exists(localPath) && new FileInfo(localPath).Length > 500;
        }
        catch
        {
            return false;
        }
    }

    private static byte[] UnmaskEncapsulation(byte[] data)
    {
        if (data == null || data.Length < 188) return data ?? Array.Empty<byte>();

        // Check if data is disguised with fake PNG header (0x89 0x50 0x4E 0x47)
        if (data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47)
        {
            // Scan for MPEG-TS sync byte 0x47 with 188-byte packet period within first 1024 bytes
            int maxScan = Math.Min(data.Length - 188, 1024);
            for (int i = 0; i < maxScan; i++)
            {
                if (data[i] == 0x47 && data[i + 188] == 0x47)
                {
                    byte[] clean = new byte[data.Length - i];
                    Buffer.BlockCopy(data, i, clean, 0, clean.Length);
                    return clean;
                }
            }

            // Check for MP4 box signature (ftyp, moof, styp)
            for (int i = 4; i < Math.Min(data.Length - 4, 1024); i++)
            {
                if ((data[i] == 'f' && data[i + 1] == 't' && data[i + 2] == 'y' && data[i + 3] == 'p') ||
                    (data[i] == 'm' && data[i + 1] == 'o' && data[i + 2] == 'o' && data[i + 3] == 'f') ||
                    (data[i] == 's' && data[i + 1] == 't' && data[i + 2] == 'y' && data[i + 3] == 'p'))
                {
                    int startOffset = Math.Max(0, i - 4);
                    byte[] clean = new byte[data.Length - startOffset];
                    Buffer.BlockCopy(data, startOffset, clean, 0, clean.Length);
                    return clean;
                }
            }
        }

        return data;
    }

    public int StrictCdnMaxThreads { get; set; } = 8;
    public int OpenCdnMaxThreads { get; set; } = 256;
    public string StrictCdnDomains { get; set; } = "phncdn,pornhub,xhpingcdn,xhcdn,xhamster,okxxx,ok.xxx,phcdn,spankbang,sb-cd,mat6tube,pvvstream,xnxx,xnxx-cdn,xvideos,xvideos-cdn,pixelflix,pron.click,freefuckvidz,freepornvideo,googlevideo,youtube";

    private int GetOptimizedConcurrency(string? sampleUrl, int requestedConcurrency)
    {
        if (string.IsNullOrEmpty(sampleUrl)) return Math.Clamp(requestedConcurrency, 1, 64);

        string lower = sampleUrl.ToLowerInvariant();

        var strictList = (StrictCdnDomains ?? "").Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries);
        if (strictList.Any(d => lower.Contains(d.Trim().ToLowerInvariant())))
        {
            return Math.Clamp(requestedConcurrency, 1, StrictCdnMaxThreads > 0 ? StrictCdnMaxThreads : 8);
        }

        return Math.Clamp(requestedConcurrency, 1, OpenCdnMaxThreads > 0 ? OpenCdnMaxThreads : 256);
    }
}
