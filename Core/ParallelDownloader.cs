using System.Diagnostics;

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
            var handler = new SocketsHttpHandler
            {
                MaxConnectionsPerServer = 200,
                EnableMultipleHttp2Connections = true,
                PooledConnectionLifetime = TimeSpan.FromMinutes(5),
                ConnectTimeout = TimeSpan.FromSeconds(15),
                AutomaticDecompression = System.Net.DecompressionMethods.All
            };

            _httpClient = new HttpClient(handler);
        }
    }

    public async Task<List<SegmentItem>> DownloadSegmentsAsync(
        List<string> segmentUrls,
        string tempDirectory,
        int concurrency = 16,
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
            IsDownloaded = false
        }).ToList();

        int totalSegments = segments.Count;
        int downloadedCount = 0;
        long totalBytes = 0;

        var stopwatch = Stopwatch.StartNew();
        var speedStopwatch = Stopwatch.StartNew();
        long lastSpeedBytes = 0;
        double currentSpeedMBps = 0;

        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(300));
        var progressTask = Task.Run(async () =>
        {
            while (await timer.WaitForNextTickAsync(cancellationToken))
            {
                if (downloadedCount >= totalSegments) break;

                var elapsedSeconds = speedStopwatch.Elapsed.TotalSeconds;
                if (elapsedSeconds >= 0.3)
                {
                    long currentBytes = Interlocked.Read(ref totalBytes);
                    long bytesDiff = currentBytes - lastSpeedBytes;
                    currentSpeedMBps = (bytesDiff / 1024.0 / 1024.0) / elapsedSeconds;
                    lastSpeedBytes = currentBytes;
                    speedStopwatch.Restart();
                }

                var elapsed = stopwatch.Elapsed;
                int currentDone = downloadedCount;
                var eta = currentDone > 0 && currentSpeedMBps > 0
                    ? TimeSpan.FromSeconds(((totalSegments - currentDone) * ((double)totalBytes / currentDone)) / (currentSpeedMBps * 1024 * 1024))
                    : TimeSpan.Zero;

                progress?.Report(new DownloadProgressReport
                {
                    TotalSegments = totalSegments,
                    DownloadedSegments = currentDone,
                    TotalBytesDownloaded = Interlocked.Read(ref totalBytes),
                    SpeedMBps = Math.Max(0, currentSpeedMBps),
                    Elapsed = elapsed,
                    EstimatedTimeRemaining = eta
                });
            }
        }, cancellationToken);

        var parallelOptions = new ParallelOptions
        {
            MaxDegreeOfParallelism = concurrency,
            CancellationToken = cancellationToken
        };

        await Parallel.ForEachAsync(segments, parallelOptions, async (seg, ct) =>
        {
            await DownloadSingleSegmentWithRetryAsync(seg, ct);
            Interlocked.Increment(ref downloadedCount);
            Interlocked.Add(ref totalBytes, seg.SizeBytes);
        });

        stopwatch.Stop();

        progress?.Report(new DownloadProgressReport
        {
            TotalSegments = totalSegments,
            DownloadedSegments = totalSegments,
            TotalBytesDownloaded = totalBytes,
            SpeedMBps = (totalBytes / 1024.0 / 1024.0) / Math.Max(0.1, stopwatch.Elapsed.TotalSeconds),
            Elapsed = stopwatch.Elapsed,
            EstimatedTimeRemaining = TimeSpan.Zero
        });

        return segments;
    }

    private async Task DownloadSingleSegmentWithRetryAsync(SegmentItem segment, CancellationToken ct, int maxRetries = 4)
    {
        int attempt = 0;
        var uri = new Uri(segment.Url);
        var refererList = new[]
        {
            "https://pixelflix.cc/",
            $"{uri.Scheme}://{uri.Host}/",
            null
        };

        while (attempt < maxRetries)
        {
            try
            {
                attempt++;
                string? referer = refererList[(attempt - 1) % refererList.Length];

                using var request = new HttpRequestMessage(HttpMethod.Get, segment.Url);
                request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                request.Headers.Add("Accept", "*/*");
                request.Headers.Add("Sec-Fetch-Dest", "empty");
                request.Headers.Add("Sec-Fetch-Mode", "cors");

                if (!string.IsNullOrEmpty(referer))
                {
                    request.Headers.Add("Referer", referer);
                    request.Headers.Add("Origin", referer.TrimEnd('/'));
                }

                using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
                response.EnsureSuccessStatusCode();

                await using var contentStream = await response.Content.ReadAsStreamAsync(ct);
                await using var fileStream = new FileStream(segment.LocalTempPath, FileMode.Create, FileAccess.Write, FileShare.None, 65536, true);
                
                await contentStream.CopyToAsync(fileStream, ct);
                await fileStream.FlushAsync(ct);

                segment.SizeBytes = new FileInfo(segment.LocalTempPath).Length;
                segment.IsDownloaded = true;
                return;
            }
            catch when (attempt < maxRetries && !ct.IsCancellationRequested)
            {
                await Task.Delay(350 * attempt, ct);
            }
        }
    }
}
