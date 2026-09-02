using System.Diagnostics;
using System.Net;

namespace Zonix.Core;

public class ParallelDownloader
{
    private readonly HttpClient _httpClient;

    public ParallelDownloader(HttpClient? httpClient = null)
    {
        if (httpClient != null)
        {
            _httpClient = httpClient;
        }
        else
        {
            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (message, cert, chain, sslPolicyErrors) => true,
                AutomaticDecompression = DecompressionMethods.All,
                UseCookies = false,
                MaxConnectionsPerServer = 300
            };

            _httpClient = new HttpClient(handler)
            {
                Timeout = TimeSpan.FromSeconds(30)
            };
        }
    }

    public async Task<List<SegmentItem>> DownloadSegmentsAsync(
        List<string> segmentUrls,
        string tempDirectory,
        int maxConcurrency = 64,
        IProgress<DownloadProgressReport>? progress = null,
        CancellationToken cancellationToken = default)
    {
        if (!Directory.Exists(tempDirectory))
        {
            Directory.CreateDirectory(tempDirectory);
        }

        var segments = segmentUrls.Select((url, index) => new SegmentItem
        {
            Index = index,
            Url = url,
            LocalTempPath = Path.Combine(tempDirectory, $"seg_{index:D6}.ts"),
            IsDownloaded = false,
            SizeBytes = 0
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

                // Calculate Rock-Solid Genuine ETA (Never Spike on Momentary Drops)
                long estTotal = 0;
                double elapsedSecs = Math.Max(0.5, stopwatch.Elapsed.TotalSeconds);
                double overallAverageSpeed = (double)currentBytes / elapsedSecs;

                if (currentBytes > 102400 && elapsedSecs >= 0.8)
                {
                    double estimatedTotalBytes = (currentDownloaded >= 2) 
                        ? ((double)currentBytes / currentDownloaded) * totalSegments 
                        : currentBytes * (totalSegments / Math.Max(1.0, (double)currentDownloaded + 0.5));

                    estTotal = (long)estimatedTotalBytes;
                    long remainingBytes = (long)Math.Max(0, estimatedTotalBytes - currentBytes);

                    if (remainingBytes <= 0 || currentDownloaded >= totalSegments)
                    {
                        eta = TimeSpan.Zero;
                    }
                    else
                    {
                        // Blended reliable speed: 65% recent smoothed speed + 35% overall average speed
                        // Prevents ETA from jumping to 45 mins when sockets are transitioning
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
            rangeReq.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
            rangeReq.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0, 0);
            var referers = StreamSecurityHelper.GetCandidateReferers(new Uri(fileUrl));
            if (referers.Count > 0 && !string.IsNullOrEmpty(referers[0])) rangeReq.Headers.TryAddWithoutValidation("Referer", referers[0]);

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

        int numChunks = Math.Clamp(maxConcurrency, 2, 256);
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
                    Status = $"Downloading Direct File ({numChunks} Range Threads)..."
                });
            }
        }, cancellationToken);

        var parallelOptions = new ParallelOptions
        {
            MaxDegreeOfParallelism = numChunks,
            CancellationToken = cancellationToken
        };

        await Parallel.ForEachAsync(chunks, parallelOptions, async (chunk, ct) =>
        {
            await DownloadRangeChunkWithRetryAsync(chunk, delta => Interlocked.Add(ref totalBytes, delta), ct);
            Interlocked.Increment(ref completedChunks);
        });

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
        using var req = new HttpRequestMessage(HttpMethod.Get, fileUrl);
        req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
        if (referers.Count > 0 && !string.IsNullOrEmpty(referers[0])) req.Headers.TryAddWithoutValidation("Referer", referers[0]);

        using var res = await _httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        res.EnsureSuccessStatusCode();

        long reportedLen = res.Content.Headers.ContentLength ?? totalLength;
        await using var contentStream = await res.Content.ReadAsStreamAsync(ct);
        await using var fileStream = new FileStream(singleChunk.LocalTempPath, FileMode.Create, FileAccess.Write, FileShare.None, 65536, true);

        byte[] buffer = new byte[32768];
        int bytesRead;
        long totalBytes = 0;
        var sw = Stopwatch.StartNew();

        while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length, ct)) > 0)
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

        singleChunk.SizeBytes = totalBytes;
        singleChunk.IsDownloaded = true;
        return new List<SegmentItem> { singleChunk };
    }

    private async Task DownloadRangeChunkWithRetryAsync(SegmentItem chunk, Action<int> totalBytesRef, CancellationToken ct, int maxRetries = 8)
    {
        int attempt = 0;
        var uri = new Uri(chunk.Url);
        var referers = StreamSecurityHelper.GetCandidateReferers(uri);

        while (attempt < maxRetries && !ct.IsCancellationRequested)
        {
            long attemptBytesRead = 0;
            try
            {
                attempt++;
                string referer = referers[(attempt - 1) % referers.Count];

                using var attemptCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                attemptCts.CancelAfter(TimeSpan.FromSeconds(15)); // 15s connection / header timeout

                using var request = new HttpRequestMessage(HttpMethod.Get, chunk.Url);
                request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                request.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(chunk.RangeStart, chunk.RangeEnd);

                if (!string.IsNullOrEmpty(referer))
                {
                    request.Headers.TryAddWithoutValidation("Referer", referer);
                }

                using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, attemptCts.Token);
                response.EnsureSuccessStatusCode();

                long expectedBytes = chunk.RangeEnd - chunk.RangeStart + 1;
                if (response.StatusCode == HttpStatusCode.OK && chunk.RangeStart > 0)
                {
                    throw new InvalidOperationException("Server returned 200 OK instead of 206 Partial Content for byte range.");
                }

                await using var contentStream = await response.Content.ReadAsStreamAsync(attemptCts.Token);
                await using var fileStream = new FileStream(chunk.LocalTempPath, FileMode.Create, FileAccess.Write, FileShare.None, 131072, FileOptions.Asynchronous | FileOptions.SequentialScan);
                if (expectedBytes > 0)
                {
                    fileStream.SetLength(expectedBytes);
                }

                byte[] buffer = new byte[131072];
                int bytesRead;
                long chunkTotal = 0;

                while (true)
                {
                    // Reset stall watchdog timeout on every read activity (12s per read chunk)
                    attemptCts.CancelAfter(TimeSpan.FromSeconds(12));
                    bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length, attemptCts.Token);
                    if (bytesRead <= 0) break;

                    await fileStream.WriteAsync(buffer, 0, bytesRead, ct);
                    chunkTotal += bytesRead;
                    attemptBytesRead += bytesRead;
                    totalBytesRef(bytesRead);
                }

                await fileStream.FlushAsync(ct);

                if (expectedBytes > 0 && chunkTotal != expectedBytes)
                {
                    throw new IOException($"Truncated chunk {chunk.Index}: expected {expectedBytes} bytes but received {chunkTotal} bytes.");
                }

                chunk.SizeBytes = chunkTotal;
                chunk.IsDownloaded = true;
                return;
            }
            catch (Exception) when (attempt < maxRetries && !ct.IsCancellationRequested)
            {
                if (attemptBytesRead > 0)
                {
                    totalBytesRef((int)-attemptBytesRead);
                }
                try { if (File.Exists(chunk.LocalTempPath)) File.Delete(chunk.LocalTempPath); } catch { }
                await Task.Delay(100 * attempt, ct);
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
                attemptCts.CancelAfter(TimeSpan.FromSeconds(15)); // 15s max per segment attempt

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
            }
            catch (Exception) when (attempt < maxRetries && !ct.IsCancellationRequested)
            {
                try { if (File.Exists(segment.LocalTempPath)) File.Delete(segment.LocalTempPath); } catch { }
                await Task.Delay(50 * attempt, ct);
            }
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

    public int StrictCdnMaxThreads { get; set; } = 32;
    public int OpenCdnMaxThreads { get; set; } = 256;
    public string StrictCdnDomains { get; set; } = "phncdn,pornhub,xhpingcdn,xhcdn,xhamster,okxxx,ok.xxx,phcdn,spankbang,sb-cd,mat6tube,pvvstream";

    private int GetOptimizedConcurrency(string? sampleUrl, int requestedConcurrency)
    {
        if (string.IsNullOrEmpty(sampleUrl)) return Math.Clamp(requestedConcurrency, 1, 64);

        string lower = sampleUrl.ToLowerInvariant();

        var strictList = (StrictCdnDomains ?? "").Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries);
        if (strictList.Any(d => lower.Contains(d.Trim().ToLowerInvariant())))
        {
            return Math.Clamp(requestedConcurrency, 1, StrictCdnMaxThreads > 0 ? StrictCdnMaxThreads : 32);
        }

        return Math.Clamp(requestedConcurrency, 1, OpenCdnMaxThreads > 0 ? OpenCdnMaxThreads : 256);
    }
}
