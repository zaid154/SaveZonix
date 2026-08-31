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
    public double PeakSpeedMBps { get; set; }
    public int ActiveThreads { get; set; }
    public string Status { get; set; } = "Downloading in Parallel...";
    public int DownloadedSegments { get; set; }
    public int TotalSegments { get; set; }
    public long TotalBytesDownloaded { get; set; }
    public long EstimatedTotalBytes { get; set; }
    public double ElapsedSeconds { get; set; }
    public double EstimatedSecondsRemaining { get; set; }
    public int Concurrency { get; set; }
    public bool IsMerging { get; set; }
    public bool IsCompleted { get; set; }
    public bool IsPaused { get; set; }
    public bool IsError { get; set; }
    public string? ErrorMessage { get; set; }
    public double MergeSeconds { get; set; }
    public string? OutputPath { get; set; }
    
    [System.Text.Json.Serialization.JsonIgnore]
    public CancellationTokenSource? Cts { get; set; }
}

public class AnalyzeRequest
{
    public string Url { get; set; } = string.Empty;
}

public class DownloadRequest
{
    public string StreamUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = "video.mp4";
    public int Concurrency { get; set; } = 64;
    public long EstimatedSizeBytes { get; set; } = 0;
    public bool IsDirectFile { get; set; } = false;
}

public class Program
{
    private static readonly ConcurrentDictionary<string, DownloadTaskState> _tasks = new();

    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        
        builder.Services.AddControllersWithViews();

        var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
        builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

        var app = builder.Build();

        if (!app.Environment.IsDevelopment())
        {
            app.UseExceptionHandler("/Home/Error");
            app.UseHsts();
        }

        app.UseStaticFiles();
        app.UseRouting();

        // 1. Analyze Stream / Webpage API with Generic Extraction
        app.MapPost("/api/analyze", async (AnalyzeRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.Url) || !Uri.TryCreate(req.Url, UriKind.Absolute, out _))
            {
                return Results.BadRequest(new { success = false, message = "Please provide a valid stream or webpage URL." });
            }

            try
            {
                using var httpClient = CreateConfiguredHttpClient();
                var parser = new M3U8Parser(httpClient);
                var result = await parser.ParseAsync(req.Url);

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

                return Results.Ok(new
                {
                    success = true,
                    isMaster = result.IsMaster,
                    isDirectMediaFile = result.IsDirectMediaFile,
                    title = result.Title,
                    description = result.Description,
                    thumbnailUrl = result.ThumbnailUrl,
                    durationSeconds = result.DurationSeconds,
                    formattedDuration = result.FormattedDuration,
                    platform = result.Platform,
                    requiresBrowserContext = result.RequiresBrowserContext,
                    statusMessage = result.StatusMessage,
                    qualities = result.Qualities.Select(q => new
                    {
                        q.Resolution,
                        q.Bandwidth,
                        q.Codecs,
                        q.Url,
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

        // 2. Start Parallel Multi-Threaded Download API (Adaptive Concurrency up to 256)
        app.MapPost("/api/download", (DownloadRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.StreamUrl))
            {
                return Results.BadRequest(new { message = "Stream URL is required." });
            }

            var taskId = Guid.NewGuid().ToString("N");
            int concurrency = Math.Clamp(req.Concurrency, 1, 256);
            var cts = new CancellationTokenSource();

            var state = new DownloadTaskState
            {
                TaskId = taskId,
                FileName = req.FileName,
                Concurrency = concurrency,
                ActiveThreads = concurrency,
                EstimatedTotalBytes = req.EstimatedSizeBytes,
                Cts = cts
            };
            _tasks[taskId] = state;

            _ = Task.Run(async () =>
            {
                try
                {
                    using var httpClient = CreateConfiguredHttpClient();
                    string downloadsFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Downloads");
                    if (!Directory.Exists(downloadsFolder)) Directory.CreateDirectory(downloadsFolder);

                    string outputFileName = req.FileName.EndsWith(".mp4") ? req.FileName : req.FileName + ".mp4";
                    string outputFilePath = Path.Combine(downloadsFolder, outputFileName);
                    string tempDirectory = Path.Combine(Path.GetTempPath(), "Zonix_" + taskId);

                    var progress = new Progress<DownloadProgressReport>(report =>
                    {
                        state.DownloadedSegments = report.DownloadedSegments;
                        state.TotalBytesDownloaded = report.TotalBytesDownloaded;
                        state.SpeedMBps = report.SpeedMBps;
                        state.PeakSpeedMBps = report.PeakSpeedMBps;
                        state.ActiveThreads = report.ActiveThreads;
                        state.Status = report.Status;
                        state.Percentage = report.Percentage;
                        state.ElapsedSeconds = report.Elapsed.TotalSeconds;
                        state.EstimatedSecondsRemaining = report.EstimatedTimeRemaining.TotalSeconds;

                        if (report.EstimatedTotalBytes > 0)
                        {
                            state.EstimatedTotalBytes = report.EstimatedTotalBytes;
                        }
                        else if (report.DownloadedSegments >= 2 && report.TotalSegments > 0)
                        {
                            double avg = (double)report.TotalBytesDownloaded / report.DownloadedSegments;
                            state.EstimatedTotalBytes = (long)(avg * report.TotalSegments);
                        }
                        else if (req.EstimatedSizeBytes > 0)
                        {
                            state.EstimatedTotalBytes = req.EstimatedSizeBytes;
                        }
                    });

                    var downloader = new ParallelDownloader(httpClient);

                    if (req.IsDirectFile || req.StreamUrl.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) || req.StreamUrl.EndsWith(".webm", StringComparison.OrdinalIgnoreCase))
                    {
                        state.TotalSegments = Math.Clamp(concurrency, 1, 64);
                        var chunks = await downloader.DownloadDirectFileAsync(req.StreamUrl, tempDirectory, req.EstimatedSizeBytes, concurrency, progress, cts.Token);
                        
                        state.IsMerging = true;
                        state.Status = "Finalizing video file...";
                        var mergeSw = Stopwatch.StartNew();
                        bool merged = await SegmentMerger.MergeSegmentsAsync(chunks, outputFilePath, tempDirectory);
                        mergeSw.Stop();

                        if (merged && File.Exists(outputFilePath))
                        {
                            state.MergeSeconds = mergeSw.Elapsed.TotalSeconds;
                            state.OutputPath = outputFilePath;
                            state.IsCompleted = true;
                            state.Status = "Download Complete";
                        }
                        else
                        {
                            state.IsError = true;
                            state.ErrorMessage = "Failed to assemble file.";
                        }
                    }
                    else
                    {
                        var parser = new M3U8Parser(httpClient);
                        var analysis = await parser.ParseAsync(req.StreamUrl);

                        var segments = analysis.SegmentUrls;
                        if (analysis.IsMaster && analysis.Qualities.Count > 0)
                        {
                            var media = await parser.ParseAsync(analysis.Qualities[0].Url);
                            segments = media.SegmentUrls;
                        }

                        if (segments.Count == 0)
                        {
                            state.IsError = true;
                            state.ErrorMessage = "No downloadable video segments found in this stream.";
                            return;
                        }

                        state.TotalSegments = segments.Count;
                        var downloaded = await downloader.DownloadSegmentsAsync(segments, tempDirectory, concurrency, progress, cts.Token);

                        state.IsMerging = true;
                        state.Status = "Merging Chunks into MP4 Container...";
                        var mergeSw = Stopwatch.StartNew();
                        bool merged = await SegmentMerger.MergeSegmentsAsync(downloaded, outputFilePath, tempDirectory);
                        mergeSw.Stop();

                        if (merged && File.Exists(outputFilePath))
                        {
                            state.MergeSeconds = mergeSw.Elapsed.TotalSeconds;
                            state.OutputPath = outputFilePath;
                            state.IsCompleted = true;
                            state.Status = "Download Complete";
                        }
                        else
                        {
                            state.IsError = true;
                            state.ErrorMessage = "Failed to merge video chunks into MP4 container.";
                        }
                    }
                }
                catch (OperationCanceledException)
                {
                    state.Status = "Download Cancelled/Paused";
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

        // 4. Pause / Cancel API
        app.MapPost("/api/cancel/{taskId}", (string taskId) =>
        {
            if (_tasks.TryGetValue(taskId, out var state))
            {
                state.Cts?.Cancel();
                state.IsPaused = true;
                return Results.Ok(new { success = true });
            }
            return Results.NotFound(new { message = "Task not found" });
        });

        // 5. Mobile & Browser File Download Stream API
        app.MapGet("/api/download-file/{taskId}", (string taskId) =>
        {
            if (_tasks.TryGetValue(taskId, out var state) && state.IsCompleted && !string.IsNullOrEmpty(state.OutputPath) && File.Exists(state.OutputPath))
            {
                string dlName = state.FileName.EndsWith(".mp4") ? state.FileName : state.FileName + ".mp4";
                return Results.File(state.OutputPath, "video/mp4", dlName, enableRangeProcessing: true);
            }
            return Results.NotFound(new { message = "File not ready or not found." });
        });

        // 6. Open Desktop Downloads Folder API
        app.MapPost("/api/open-folder", () =>
        {
            string downloadsFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Downloads");
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

            return Results.Ok(new { success = true });
        });

        // 7. Map Controller Routes
        app.MapControllerRoute(
            name: "default",
            pattern: "{controller=Home}/{action=Index}/{id?}");

        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine($"\n ⚡ ZONIX ASP.NET Core MVC Server is LIVE on port: {port}");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine($" 🌐 Access URL: http://localhost:{port}\n");
        Console.ResetColor();

        app.Run();
    }

    private static HttpClient CreateConfiguredHttpClient()
    {
        var handler = new SocketsHttpHandler
        {
            MaxConnectionsPerServer = 300,
            EnableMultipleHttp2Connections = true,
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            AutomaticDecompression = System.Net.DecompressionMethods.All,
            UseCookies = true,
            CookieContainer = new System.Net.CookieContainer()
        };

        var client = new HttpClient(handler);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
        client.DefaultRequestHeaders.Add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
        client.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.9");
        client.DefaultRequestHeaders.Add("Cookie", "platform=pc; bs=1; ss=1; accessAgeDisclaimerPH=1; age_verified=1");
        return client;
    }
}
