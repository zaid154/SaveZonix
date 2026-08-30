using System.Collections.Concurrent;
using System.Diagnostics;
using Zonix.Core;

namespace Zonix;

public class DownloadTaskState
{
    public string TaskId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public double Percentage { get; set; }
    public double SpeedMBps { get; set; }
    public int DownloadedSegments { get; set; }
    public int TotalSegments { get; set; }
    public long TotalBytesDownloaded { get; set; }
    public double EstimatedSecondsRemaining { get; set; }
    public bool IsMerging { get; set; }
    public bool IsCompleted { get; set; }
    public bool IsError { get; set; }
    public string? ErrorMessage { get; set; }
    public double MergeSeconds { get; set; }
    public string? OutputPath { get; set; }
}

public class AnalyzeRequest
{
    public string Url { get; set; } = string.Empty;
}

public class DownloadRequest
{
    public string StreamUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = "video.mp4";
    public int Concurrency { get; set; } = 16;
}

public class Program
{
    private static readonly ConcurrentDictionary<string, DownloadTaskState> _tasks = new();

    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        
        builder.WebHost.UseUrls("http://localhost:5000");

        var app = builder.Build();

        app.UseDefaultFiles();
        app.UseStaticFiles();

        // 1. Analyze Stream API
        app.MapPost("/api/analyze", async (AnalyzeRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.Url) || !Uri.TryCreate(req.Url, UriKind.Absolute, out _))
            {
                return Results.BadRequest(new { success = false, message = "Invalid stream URL." });
            }

            try
            {
                using var httpClient = CreateConfiguredHttpClient();
                var parser = new M3U8Parser(httpClient);
                var (isMaster, qualities, segments) = await parser.ParseAsync(req.Url);

                int totalSegments = segments.Count;
                if (isMaster && qualities.Count > 0)
                {
                    try
                    {
                        var previewMedia = await parser.ParseAsync(qualities[0].Url);
                        totalSegments = previewMedia.SegmentUrls.Count;
                    }
                    catch { }
                }

                return Results.Ok(new
                {
                    success = true,
                    isMaster,
                    qualities,
                    totalSegments
                });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { success = false, message = $"Stream analysis failed: {ex.Message}" });
            }
        });

        // 2. Start Download API
        app.MapPost("/api/download", (DownloadRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.StreamUrl))
            {
                return Results.BadRequest(new { message = "Stream URL is required." });
            }

            var taskId = Guid.NewGuid().ToString("N");
            var state = new DownloadTaskState
            {
                TaskId = taskId,
                FileName = req.FileName
            };
            _tasks[taskId] = state;

            _ = Task.Run(async () =>
            {
                try
                {
                    using var httpClient = CreateConfiguredHttpClient();
                    var parser = new M3U8Parser(httpClient);
                    var (isMaster, qualities, segments) = await parser.ParseAsync(req.StreamUrl);

                    if (isMaster && qualities.Count > 0)
                    {
                        var media = await parser.ParseAsync(qualities[0].Url);
                        segments = media.SegmentUrls;
                    }

                    if (segments.Count == 0)
                    {
                        state.IsError = true;
                        state.ErrorMessage = "No segments found in the stream.";
                        return;
                    }

                    state.TotalSegments = segments.Count;

                    string downloadsFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Downloads");
                    if (!Directory.Exists(downloadsFolder))
                    {
                        Directory.CreateDirectory(downloadsFolder);
                    }

                    string outputFilePath = Path.Combine(downloadsFolder, req.FileName.EndsWith(".mp4") ? req.FileName : req.FileName + ".mp4");
                    string tempDirectory = Path.Combine(Path.GetTempPath(), "Zonix_" + taskId);

                    var progress = new Progress<DownloadProgressReport>(report =>
                    {
                        state.DownloadedSegments = report.DownloadedSegments;
                        state.TotalBytesDownloaded = report.TotalBytesDownloaded;
                        state.SpeedMBps = report.SpeedMBps;
                        state.Percentage = report.Percentage;
                        state.EstimatedSecondsRemaining = report.EstimatedTimeRemaining.TotalSeconds;
                    });

                    var downloader = new ParallelDownloader(httpClient);
                    int concurrency = Math.Clamp(req.Concurrency, 1, 64);
                    var downloaded = await downloader.DownloadSegmentsAsync(segments, tempDirectory, concurrency, progress);

                    state.IsMerging = true;
                    var mergeSw = Stopwatch.StartNew();
                    bool merged = await SegmentMerger.MergeSegmentsAsync(downloaded, outputFilePath, tempDirectory);
                    mergeSw.Stop();

                    if (merged && File.Exists(outputFilePath))
                    {
                        state.MergeSeconds = mergeSw.Elapsed.TotalSeconds;
                        state.OutputPath = outputFilePath;
                        state.IsCompleted = true;
                    }
                    else
                    {
                        state.IsError = true;
                        state.ErrorMessage = "Failed to merge video chunks.";
                    }
                }
                catch (Exception ex)
                {
                    state.IsError = true;
                    state.ErrorMessage = ex.Message;
                }
            });

            return Results.Ok(new { taskId });
        });

        // 3. Progress Polling API
        app.MapGet("/api/progress/{taskId}", (string taskId) =>
        {
            if (_tasks.TryGetValue(taskId, out var state))
            {
                return Results.Ok(state);
            }
            return Results.NotFound(new { message = "Task not found" });
        });

        // 4. Open Downloads Folder API
        app.MapPost("/api/open-folder", () =>
        {
            string downloadsFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Downloads");
            if (!Directory.Exists(downloadsFolder))
            {
                Directory.CreateDirectory(downloadsFolder);
            }

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

            return Results.Ok(new { success = true });
        });

        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("\n ⚡ ZONIX Web Server is LIVE at: http://localhost:5000");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine(" 🌐 Opening Web Dashboard in your browser...\n");
        Console.ResetColor();

        app.Run();
    }

    private static HttpClient CreateConfiguredHttpClient()
    {
        var handler = new SocketsHttpHandler
        {
            MaxConnectionsPerServer = 200,
            EnableMultipleHttp2Connections = true,
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            AutomaticDecompression = System.Net.DecompressionMethods.All
        };

        var client = new HttpClient(handler);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
        client.DefaultRequestHeaders.Add("Accept", "*/*");
        client.DefaultRequestHeaders.Add("Referer", "https://pixelflix.cc/");
        client.DefaultRequestHeaders.Add("Origin", "https://pixelflix.cc");
        return client;
    }
}
