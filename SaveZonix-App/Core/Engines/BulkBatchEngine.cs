using System.Collections.Concurrent;

namespace Zonix.Core.Engines;

public record BulkItemProgress(
    string ItemId,
    string Url,
    string Title,
    string Status,
    double Percentage,
    string? ErrorMessage = null,
    string? OutputFilePath = null
);

public record BulkBatchStatus(
    string BatchId,
    int TotalItems,
    int CompletedItems,
    int FailedItems,
    int InProgressItems,
    bool IsCompleted,
    List<BulkItemProgress> Items
);

/// <summary>
/// Universal Bulk Multi-URL Batch Downloader Engine.
/// Allows downloading 10-100+ separate URLs concurrently with per-item isolation,
/// automatic queue management, and comprehensive error resiliency.
/// </summary>
public class BulkBatchEngine
{
    private readonly ConcurrentDictionary<string, BulkBatchStatus> _batches = new();
    private readonly MediaAnalyzerEngine _analyzer;
    private readonly TurboDownloadEngine _downloader;
    private readonly ServiceHealthMonitor _monitor;

    public BulkBatchEngine(
        MediaAnalyzerEngine analyzer,
        TurboDownloadEngine downloader,
        ServiceHealthMonitor monitor)
    {
        _analyzer = analyzer;
        _downloader = downloader;
        _monitor = monitor;
    }

    public string CreateBatch(IEnumerable<string> urls)
    {
        string batchId = Guid.NewGuid().ToString("N")[..8];
        var cleanUrls = urls
            .Select(u => u.Trim())
            .Where(u => !string.IsNullOrWhiteSpace(u) && (u.StartsWith("http://") || u.StartsWith("https://")))
            .Distinct()
            .ToList();

        var items = cleanUrls.Select((u, idx) => new BulkItemProgress(
            ItemId: $"{batchId}_{idx + 1}",
            Url: u,
            Title: $"Queued Item #{idx + 1}",
            Status: "Queued",
            Percentage: 0
        )).ToList();

        var status = new BulkBatchStatus(
            BatchId: batchId,
            TotalItems: items.Count,
            CompletedItems: 0,
            FailedItems: 0,
            InProgressItems: 0,
            IsCompleted: false,
            Items: items
        );

        _batches[batchId] = status;
        return batchId;
    }

    public BulkBatchStatus? GetBatchStatus(string batchId)
    {
        _batches.TryGetValue(batchId, out var status);
        return status;
    }

    /// <summary>
    /// Executes the batch with bounded concurrency (3-5 simultaneous downloads).
    /// </summary>
    public void StartBatchBackground(string batchId, string downloadDir, int maxConcurrency = 3)
    {
        if (!_batches.TryGetValue(batchId, out var batch)) return;

        CrashGuard.RunBackground(async () =>
        {
            using var semaphore = new SemaphoreSlim(maxConcurrency, maxConcurrency);
            var tasks = batch.Items.Select(async item =>
            {
                await semaphore.WaitAsync();
                _monitor.RegisterActiveJob();
                try
                {
                    UpdateItem(batchId, item.ItemId, status: "Analyzing", pct: 10);

                    // 1. Analyze media stream
                    var meta = await _analyzer.AnalyzeUrlAsync(item.Url);
                    if (!meta.Success)
                    {
                        UpdateItem(batchId, item.ItemId, status: "Failed", pct: 0, error: meta.ErrorMessage);
                        return;
                    }

                    string safeTitle = string.Join("_", meta.Title.Split(Path.GetInvalidFileNameChars()));
                    if (string.IsNullOrWhiteSpace(safeTitle)) safeTitle = $"Media_{item.ItemId}";
                    string outPath = Path.Combine(downloadDir, $"{safeTitle}.mp4");

                    UpdateItem(batchId, item.ItemId, title: meta.Title, status: "Downloading", pct: 25);

                    // 2. Select stream
                    var stream = meta.VideoStreams.FirstOrDefault() ?? meta.AudioStreams.FirstOrDefault();
                    if (stream == null || string.IsNullOrEmpty(stream.Url))
                    {
                        UpdateItem(batchId, item.ItemId, status: "Failed", pct: 0, error: "No downloadable streams found.");
                        return;
                    }

                    // 3. Download
                    string tempDir = Path.Combine(Path.GetTempPath(), "Zonix_Bulk", item.ItemId);
                    bool ok = await _downloader.DownloadParallelFileAsync(
                        stream.Url,
                        outPath,
                        tempDir,
                        stream.SizeBytes,
                        requestedConcurrency: 16
                    );

                    if (ok && File.Exists(outPath))
                    {
                        UpdateItem(batchId, item.ItemId, status: "Completed", pct: 100, outPath: outPath);
                        _monitor.AddDownloadedBytes(new FileInfo(outPath).Length);
                    }
                    else
                    {
                        UpdateItem(batchId, item.ItemId, status: "Failed", pct: 0, error: "Download or chunk assembly failed.");
                    }
                }
                catch (Exception ex)
                {
                    CrashGuard.LogCrashEvent($"BulkItem_{item.ItemId}", ex);
                    UpdateItem(batchId, item.ItemId, status: "Failed", pct: 0, error: ex.Message);
                }
                finally
                {
                    _monitor.UnregisterActiveJob();
                    semaphore.Release();
                }
            });

            await Task.WhenAll(tasks);

            // Mark batch completed
            if (_batches.TryGetValue(batchId, out var current))
            {
                _batches[batchId] = current with { IsCompleted = true };
            }
        }, $"BulkBatch_{batchId}");
    }

    private void UpdateItem(
        string batchId,
        string itemId,
        string? title = null,
        string? status = null,
        double? pct = null,
        string? error = null,
        string? outPath = null)
    {
        if (!_batches.TryGetValue(batchId, out var current)) return;

        var updatedItems = current.Items.Select(i =>
        {
            if (i.ItemId != itemId) return i;
            return i with
            {
                Title = title ?? i.Title,
                Status = status ?? i.Status,
                Percentage = pct ?? i.Percentage,
                ErrorMessage = error ?? i.ErrorMessage,
                OutputFilePath = outPath ?? i.OutputFilePath
            };
        }).ToList();

        int completed = updatedItems.Count(i => i.Status == "Completed");
        int failed = updatedItems.Count(i => i.Status == "Failed");
        int inProg = updatedItems.Count(i => i.Status is "Downloading" or "Analyzing");

        _batches[batchId] = current with
        {
            CompletedItems = completed,
            FailedItems = failed,
            InProgressItems = inProg,
            Items = updatedItems
        };
    }
}
