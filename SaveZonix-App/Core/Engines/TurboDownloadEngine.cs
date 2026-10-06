using System.Buffers;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;

namespace Zonix.Core.Engines;

public record TurboChunk(
    int Index,
    long StartByte,
    long EndByte,
    string TempFilePath,
    long DownloadedBytes = 0,
    bool IsCompleted = false
);

public record TurboDownloadProgress(
    string TaskId,
    double Percentage,
    double SpeedMBps,
    double PeakSpeedMBps,
    long DownloadedBytes,
    long TotalBytes,
    int ActiveThreads,
    TimeSpan Elapsed,
    TimeSpan EstimatedTimeRemaining,
    string Status
);

/// <summary>
/// Next-Generation Turbo Multi-Threaded Parallel Download Engine.
/// Features ArrayPool zero-allocation memory buffers, adaptive connection slicing,
/// per-chunk resilient retries, and high-throughput byte-range streaming.
/// </summary>
public class TurboDownloadEngine
{
    private readonly HttpClient _httpClient;
    private const int BufferSize = 128 * 1024; // 128 KB buffer for optimal TCP pipe throughput
    private const int MaxChunkRetries = 5;

    public TurboDownloadEngine(HttpClient? httpClient = null)
    {
        if (httpClient != null)
        {
            _httpClient = httpClient;
        }
        else
        {
            var handler = new SocketsHttpHandler
            {
                SslOptions = new System.Net.Security.SslClientAuthenticationOptions
                {
                    RemoteCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) => true
                },
                AutomaticDecompression = DecompressionMethods.All,
                UseCookies = false,
                MaxConnectionsPerServer = 500,
                EnableMultipleHttp2Connections = true,
                PooledConnectionLifetime = TimeSpan.FromMinutes(15),
                PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
                ConnectTimeout = TimeSpan.FromSeconds(10)
            };

            _httpClient = new HttpClient(handler)
            {
                Timeout = TimeSpan.FromHours(2)
            };
        }
    }

    /// <summary>
    /// Downloads a direct media file using multi-connection byte-range parallel chunking.
    /// Employs pooled memory buffers and independent chunk fault recovery.
    /// </summary>
    public async Task<bool> DownloadParallelFileAsync(
        string url,
        string destinationFilePath,
        string tempDirectory,
        long totalContentLength = 0,
        int requestedConcurrency = 32,
        IProgress<TurboDownloadProgress>? progress = null,
        string taskId = "",
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;
        if (!Directory.Exists(tempDirectory)) Directory.CreateDirectory(tempDirectory);

        // 1. Probe remote content length and byte-range support if not supplied
        bool supportsRange = false;
        long totalBytes = totalContentLength;

        if (totalBytes <= 0)
        {
            try
            {
                using var headReq = new HttpRequestMessage(HttpMethod.Head, url);
                headReq.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                using var headResp = await _httpClient.SendAsync(headReq, HttpCompletionOption.ResponseHeadersRead, ct);

                if (headResp.IsSuccessStatusCode)
                {
                    totalBytes = headResp.Content.Headers.ContentLength ?? 0;
                    supportsRange = headResp.Headers.AcceptRanges.Contains("bytes") || headResp.Content.Headers.ContentRange != null;
                }
            }
            catch { }

            // Fallback GET probe with 0-1 range to test byte-range support
            if (totalBytes <= 0)
            {
                try
                {
                    using var rangeProbe = new HttpRequestMessage(HttpMethod.Get, url);
                    rangeProbe.Headers.Range = new RangeHeaderValue(0, 1);
                    rangeProbe.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                    using var probeResp = await _httpClient.SendAsync(rangeProbe, HttpCompletionOption.ResponseHeadersRead, ct);

                    if (probeResp.StatusCode == HttpStatusCode.PartialContent)
                    {
                        supportsRange = true;
                        totalBytes = probeResp.Content.Headers.ContentRange?.Length ?? 0;
                    }
                    else if (probeResp.IsSuccessStatusCode)
                    {
                        totalBytes = probeResp.Content.Headers.ContentLength ?? 0;
                    }
                }
                catch { }
            }
        }
        else
        {
            supportsRange = true;
        }

        // 2. Single-stream fallback if server does not support byte ranges or file size is tiny (< 2 MB)
        if (!supportsRange || totalBytes < 2 * 1024 * 1024)
        {
            return await DownloadSingleStreamAsync(url, destinationFilePath, totalBytes, progress, taskId, ct);
        }

        // 3. Dynamic adaptive slicing: compute optimal chunk count
        int optimalConcurrency = CalculateOptimalConcurrency(totalBytes, requestedConcurrency);
        long chunkSize = totalBytes / optimalConcurrency;
        var chunks = new List<TurboChunk>();

        for (int i = 0; i < optimalConcurrency; i++)
        {
            long start = i * chunkSize;
            long end = (i == optimalConcurrency - 1) ? totalBytes - 1 : (start + chunkSize - 1);
            string chunkFile = Path.Combine(tempDirectory, $"turbo_chunk_{i:D4}.part");
            chunks.Add(new TurboChunk(i, start, end, chunkFile));
        }

        // 4. Thread-safe progress tracking
        long totalDownloadedBytes = 0;
        int activeThreads = 0;
        double peakSpeedMBps = 0.0;
        var sw = Stopwatch.StartNew();

        var sampleQueue = new Queue<(long Ticks, long Bytes)>();

        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(200));
        using var progressCts = CancellationTokenSource.CreateLinkedTokenSource(ct);

        var progressLoop = Task.Run(async () =>
        {
            while (await timer.WaitForNextTickAsync(progressCts.Token))
            {
                if (progressCts.Token.IsCancellationRequested) break;

                long nowTicks = Stopwatch.GetTimestamp();
                long currentBytes = Interlocked.Read(ref totalDownloadedBytes);

                sampleQueue.Enqueue((nowTicks, currentBytes));
                long maxAgeTicks = (long)(3.0 * Stopwatch.Frequency);
                while (sampleQueue.Count > 3 && (nowTicks - sampleQueue.Peek().Ticks) > maxAgeTicks)
                {
                    sampleQueue.Dequeue();
                }

                double curSpeedMBps = 0.0;
                if (sampleQueue.Count >= 2)
                {
                    var oldest = sampleQueue.Peek();
                    double elapsedSec = (double)(nowTicks - oldest.Ticks) / Stopwatch.Frequency;
                    if (elapsedSec > 0.1)
                    {
                        curSpeedMBps = Math.Round((currentBytes - oldest.Bytes) / (1024.0 * 1024.0) / elapsedSec, 2);
                    }
                }

                if (curSpeedMBps > peakSpeedMBps) peakSpeedMBps = curSpeedMBps;

                double pct = totalBytes > 0 ? Math.Min(100.0, Math.Round((double)currentBytes / totalBytes * 100.0, 1)) : 0.0;
                TimeSpan eta = (curSpeedMBps > 0.05 && totalBytes > currentBytes)
                    ? TimeSpan.FromSeconds((totalBytes - currentBytes) / (curSpeedMBps * 1024.0 * 1024.0))
                    : TimeSpan.Zero;

                progress?.Report(new TurboDownloadProgress(
                    TaskId: taskId,
                    Percentage: pct,
                    SpeedMBps: curSpeedMBps,
                    PeakSpeedMBps: peakSpeedMBps,
                    DownloadedBytes: currentBytes,
                    TotalBytes: totalBytes,
                    ActiveThreads: Volatile.Read(ref activeThreads),
                    Elapsed: sw.Elapsed,
                    EstimatedTimeRemaining: eta,
                    Status: $"Turbo Slicing ({optimalConcurrency} Chunks active)..."
                ));
            }
        }, progressCts.Token);

        // 5. Parallel download execution with Semaphore throttling
        using var semaphore = new SemaphoreSlim(optimalConcurrency, optimalConcurrency);
        var chunkTasks = chunks.Select(async chunk =>
        {
            await semaphore.WaitAsync(ct);
            Interlocked.Increment(ref activeThreads);
            try
            {
                return await DownloadChunkWithRetryAsync(url, chunk, b => Interlocked.Add(ref totalDownloadedBytes, b), ct);
            }
            finally
            {
                Interlocked.Decrement(ref activeThreads);
                semaphore.Release();
            }
        });

        var results = await Task.WhenAll(chunkTasks);
        progressCts.Cancel();
        try { await progressLoop; } catch { }

        if (results.Any(r => !r))
        {
            return false;
        }

        // 6. Assemble chunks into the target destination file with high-speed sequential streaming
        progress?.Report(new TurboDownloadProgress(
            TaskId: taskId,
            Percentage: 99.5,
            SpeedMBps: 0,
            PeakSpeedMBps: peakSpeedMBps,
            DownloadedBytes: totalBytes,
            TotalBytes: totalBytes,
            ActiveThreads: 0,
            Elapsed: sw.Elapsed,
            EstimatedTimeRemaining: TimeSpan.Zero,
            Status: "Assembling Chunks into Video Container..."
        ));

        await AssembleChunksAsync(chunks, destinationFilePath, ct);

        sw.Stop();
        progress?.Report(new TurboDownloadProgress(
            TaskId: taskId,
            Percentage: 100.0,
            SpeedMBps: 0,
            PeakSpeedMBps: peakSpeedMBps,
            DownloadedBytes: totalBytes,
            TotalBytes: totalBytes,
            ActiveThreads: 0,
            Elapsed: sw.Elapsed,
            EstimatedTimeRemaining: TimeSpan.Zero,
            Status: "Completed"
        ));

        return File.Exists(destinationFilePath) && new FileInfo(destinationFilePath).Length > 0;
    }

    private async Task<bool> DownloadChunkWithRetryAsync(
        string url,
        TurboChunk chunk,
        Action<long> onBytesRead,
        CancellationToken ct)
    {
        for (int attempt = 1; attempt <= MaxChunkRetries; attempt++)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.Range = new RangeHeaderValue(chunk.StartByte, chunk.EndByte);
                req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");

                using var resp = await _httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
                if (resp.StatusCode != HttpStatusCode.PartialContent && !resp.IsSuccessStatusCode)
                {
                    throw new HttpRequestException($"Chunk request returned status: {resp.StatusCode}");
                }

                await using var stream = await resp.Content.ReadAsStreamAsync(ct);
                await using var fileStream = new FileStream(
                    chunk.TempFilePath,
                    FileMode.Create,
                    FileAccess.Write,
                    FileShare.None,
                    BufferSize,
                    FileOptions.SequentialScan | FileOptions.Asynchronous);

                // Zero-allocation buffer pooling
                byte[] poolBuffer = ArrayPool<byte>.Shared.Rent(BufferSize);
                long chunkDownloaded = 0;

                try
                {
                    int bytesRead;
                    while ((bytesRead = await stream.ReadAsync(poolBuffer.AsMemory(0, BufferSize), ct)) > 0)
                    {
                        await fileStream.WriteAsync(poolBuffer.AsMemory(0, bytesRead), ct);
                        chunkDownloaded += bytesRead;
                        onBytesRead(bytesRead);
                    }
                }
                finally
                {
                    ArrayPool<byte>.Shared.Return(poolBuffer);
                }

                long expectedLength = (chunk.EndByte - chunk.StartByte) + 1;
                if (chunkDownloaded >= expectedLength || (fileStream.Length > 0 && Math.Abs(fileStream.Length - expectedLength) <= 2))
                {
                    return true;
                }
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                if (attempt == MaxChunkRetries)
                {
                    Console.WriteLine($"[TurboDownloadEngine] Chunk #{chunk.Index} failed permanently: {ex.Message}");
                    return false;
                }
                int jitterMs = Random.Shared.Next(200, 800) * attempt;
                await Task.Delay(jitterMs, ct);
            }
        }
        return false;
    }

    private static async Task AssembleChunksAsync(List<TurboChunk> chunks, string destinationPath, CancellationToken ct)
    {
        string? dir = Path.GetDirectoryName(destinationPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        await using var outStream = new FileStream(
            destinationPath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            BufferSize * 2,
            FileOptions.SequentialScan | FileOptions.Asynchronous);

        byte[] poolBuffer = ArrayPool<byte>.Shared.Rent(BufferSize * 2);
        try
        {
            foreach (var chunk in chunks.OrderBy(c => c.Index))
            {
                ct.ThrowIfCancellationRequested();
                if (File.Exists(chunk.TempFilePath))
                {
                    await using (var inStream = new FileStream(
                        chunk.TempFilePath,
                        FileMode.Open,
                        FileAccess.Read,
                        FileShare.Read,
                        BufferSize * 2,
                        FileOptions.SequentialScan | FileOptions.Asynchronous))
                    {
                        int bytesRead;
                        while ((bytesRead = await inStream.ReadAsync(poolBuffer.AsMemory(0, poolBuffer.Length), ct)) > 0)
                        {
                            await outStream.WriteAsync(poolBuffer.AsMemory(0, bytesRead), ct);
                        }
                    }

                    try { File.Delete(chunk.TempFilePath); } catch { }
                }
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(poolBuffer);
        }
    }

    private async Task<bool> DownloadSingleStreamAsync(
        string url,
        string destinationFilePath,
        long totalBytes,
        IProgress<TurboDownloadProgress>? progress,
        string taskId,
        CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");

        using var resp = await _httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        resp.EnsureSuccessStatusCode();

        long confirmedTotal = resp.Content.Headers.ContentLength ?? totalBytes;
        await using var stream = await resp.Content.ReadAsStreamAsync(ct);

        string? dir = Path.GetDirectoryName(destinationFilePath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);

        await using var fileStream = new FileStream(
            destinationFilePath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            BufferSize,
            FileOptions.SequentialScan | FileOptions.Asynchronous);

        byte[] buffer = ArrayPool<byte>.Shared.Rent(BufferSize);
        long downloaded = 0;
        var sw = Stopwatch.StartNew();

        try
        {
            int read;
            while ((read = await stream.ReadAsync(buffer.AsMemory(0, BufferSize), ct)) > 0)
            {
                await fileStream.WriteAsync(buffer.AsMemory(0, read), ct);
                downloaded += read;

                double sec = sw.Elapsed.TotalSeconds;
                double speedMBps = sec > 0.1 ? Math.Round((downloaded / (1024.0 * 1024.0)) / sec, 2) : 0;
                double pct = confirmedTotal > 0 ? Math.Min(100.0, Math.Round((double)downloaded / confirmedTotal * 100.0, 1)) : 0;

                progress?.Report(new TurboDownloadProgress(
                    TaskId: taskId,
                    Percentage: pct,
                    SpeedMBps: speedMBps,
                    PeakSpeedMBps: speedMBps,
                    DownloadedBytes: downloaded,
                    TotalBytes: confirmedTotal,
                    ActiveThreads: 1,
                    Elapsed: sw.Elapsed,
                    EstimatedTimeRemaining: TimeSpan.Zero,
                    Status: "Single-Stream Direct Download..."
                ));
            }
            return true;
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    private static int CalculateOptimalConcurrency(long totalBytes, int requested)
    {
        if (totalBytes <= 10 * 1024 * 1024) return Math.Clamp(requested, 4, 8);      // <= 10MB -> 4-8 chunks
        if (totalBytes <= 50 * 1024 * 1024) return Math.Clamp(requested, 8, 16);     // <= 50MB -> 8-16 chunks
        if (totalBytes <= 500 * 1024 * 1024) return Math.Clamp(requested, 16, 48);   // <= 500MB -> 16-48 chunks
        if (totalBytes <= 2L * 1024 * 1024 * 1024) return Math.Clamp(requested, 32, 64); // <= 2GB -> 32-64 chunks
        return Math.Clamp(requested, 48, 128);                                       // > 2GB (4K/8K) -> up to 128 chunks!
    }
}
