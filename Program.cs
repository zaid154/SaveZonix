using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using StreamHelper.Data;
using StreamHelper.Services;
using Zonix.Core;

namespace Zonix;

public class DownloadTaskState
{
    public string TaskId { get; set; } = string.Empty;
    public string? UserId { get; set; }
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
    public string? OriginalPageUrl { get; set; }
    public string? Title { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? Platform { get; set; }
    public string? Quality { get; set; }
    public string? Format { get; set; }
    public string? AudioUrl { get; set; }
    public string FileName { get; set; } = "video.mp4";
    public int Concurrency { get; set; } = 64;
    public long EstimatedSizeBytes { get; set; } = 0;
    public bool IsDirectFile { get; set; } = false;
    public int DurationSeconds { get; set; } = 0;
}

public class Program
{
    private static readonly ConcurrentDictionary<string, DownloadTaskState> _tasks = new();

    private static async Task<bool> MuxVideoAndAudioAsync(string videoPath, string audioPath, string outputPath)
    {
        string ffmpegPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ffmpeg.exe");
        if (!File.Exists(ffmpegPath))
        {
            ffmpegPath = Path.Combine(Directory.GetCurrentDirectory(), "ffmpeg.exe");
        }
        if (!File.Exists(ffmpegPath))
        {
            ffmpegPath = "ffmpeg";
        }

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = ffmpegPath,
                Arguments = $"-i \"{videoPath}\" -i \"{audioPath}\" -c copy -map 0:v:0 -map 1:a:0 -movflags +faststart \"{outputPath}\" -y",
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
            Console.WriteLine($"[FFmpeg Mux Notice] {ex.Message}");
        }
        return false;
    }

    public static async Task Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        
        // 1. Database Context (SQL Server)
        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
            ?? "Server=(localdb)\\mssqllocaldb;Database=StreamHelperDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True";

        builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(connectionString));

        // 2. ASP.NET Core Identity
        builder.Services.AddIdentity<AppUser, IdentityRole>(options =>
        {
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequiredLength = 6;

            options.User.RequireUniqueEmail = true;
            options.SignIn.RequireConfirmedAccount = false;

            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.AllowedForNewUsers = true;
        })
        .AddEntityFrameworkStores<AppDbContext>()
        .AddDefaultTokenProviders();

        // 3. Cookie Authentication & OAuth
        builder.Services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.HttpOnly = true;
            options.Cookie.Name = "StreamHelper.Auth";
            options.ExpireTimeSpan = TimeSpan.FromDays(30);
            options.LoginPath = "/Account/Login";
            options.LogoutPath = "/Account/Logout";
            options.AccessDeniedPath = "/Account/Login";
            options.SlidingExpiration = true;
        });

        var googleClientId = builder.Configuration["Authentication:Google:ClientId"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID");
        var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET");

        if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret))
        {
            builder.Services.AddAuthentication()
                .AddGoogle(googleOptions =>
                {
                    googleOptions.ClientId = googleClientId;
                    googleOptions.ClientSecret = googleClientSecret;
                });
        }

        // 4. Application Services
        builder.Services.AddScoped<IEmailService, EmailService>();
        builder.Services.AddScoped<IDownloadHistoryService, DownloadHistoryService>();
        builder.Services.AddScoped<IAdminSettingsService, AdminSettingsService>();

        builder.Services.AddControllersWithViews();

        var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
        builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

        var app = builder.Build();

        // 5. Database Auto-Migration & Seeder
        try
        {
            await DbSeeder.SeedAsync(app.Services, app.Configuration);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database Seeder Notice] {ex.Message}");
        }

        if (!app.Environment.IsDevelopment())
        {
            app.UseExceptionHandler("/Home/Error");
            app.UseHsts();
        }

        app.UseStaticFiles();
        app.UseRouting();

        app.UseAuthentication();
        app.UseAuthorization();

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

        // 2. Start Parallel Multi-Threaded Download API (Adaptive Concurrency up to 256)
        app.MapPost("/api/download", async (HttpContext httpContext, DownloadRequest req, IServiceProvider sp) =>
        {
            if (string.IsNullOrWhiteSpace(req.StreamUrl))
            {
                return Results.BadRequest(new { message = "Stream URL is required." });
            }

            var taskId = Guid.NewGuid().ToString("N");
            int concurrency = Math.Clamp(req.Concurrency, 1, 256);
            var cts = new CancellationTokenSource();

            // Extract authenticated user if present
            string? currentUserId = null;
            string? currentUserEmail = null;
            string? currentUserName = null;

            if (httpContext.User.Identity?.IsAuthenticated == true)
            {
                var userMgr = sp.GetRequiredService<UserManager<AppUser>>();
                var user = await userMgr.GetUserAsync(httpContext.User);
                if (user != null)
                {
                    currentUserId = user.Id;
                    currentUserEmail = user.Email;
                    currentUserName = user.FullName;
                }
            }

            var state = new DownloadTaskState
            {
                TaskId = taskId,
                UserId = currentUserId,
                FileName = req.FileName,
                Concurrency = concurrency,
                ActiveThreads = concurrency,
                EstimatedTotalBytes = req.EstimatedSizeBytes,
                Cts = cts
            };
            _tasks[taskId] = state;

            // Create or update database download history record
            string pageUrl = !string.IsNullOrEmpty(req.OriginalPageUrl) ? req.OriginalPageUrl : req.StreamUrl;
            string videoTitle = !string.IsNullOrEmpty(req.Title) ? req.Title : "High-Definition Video Stream";
            string platform = !string.IsNullOrEmpty(req.Platform) ? req.Platform : "Web Stream";
            string quality = !string.IsNullOrEmpty(req.Quality) ? req.Quality : "1080p Full HD";
            string format = !string.IsNullOrEmpty(req.Format) ? req.Format : "MP4";

            using (var scope = sp.CreateScope())
            {
                var dlHistoryService = scope.ServiceProvider.GetRequiredService<IDownloadHistoryService>();
                await dlHistoryService.CreateOrUpdateDownloadAsync(
                    taskId,
                    currentUserId,
                    currentUserEmail,
                    currentUserName,
                    pageUrl,
                    videoTitle,
                    req.FileName,
                    req.ThumbnailUrl,
                    platform,
                    "Video",
                    format,
                    quality,
                    "H.264 / AAC",
                    req.DurationSeconds,
                    req.EstimatedSizeBytes,
                    concurrency,
                    req.IsDirectFile ? "Parallel Byte-Range" : "HLS Multi-Thread");
            }

            _ = Task.Run(async () =>
            {
                using var scope = sp.CreateScope();
                var dlHistoryService = scope.ServiceProvider.GetRequiredService<IDownloadHistoryService>();

                try
                {
                    using var httpClient = CreateConfiguredHttpClient();
                    string userDownloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
                    string downloadsFolder = Directory.Exists(userDownloads) ? userDownloads : Path.Combine(Path.GetTempPath(), "StreamHelper_Downloads");
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
                        state.TotalSegments = Math.Clamp(concurrency, 1, 256);

                        if (!string.IsNullOrEmpty(req.AudioUrl))
                        {
                            // Download High-Res Video & Studio Audio simultaneously in parallel
                            state.Status = "⚡ Downloading Video + Audio Tracks in Parallel...";
                            string tempVideoFile = Path.Combine(tempDirectory, "raw_video.mp4");
                            string tempAudioFile = Path.Combine(tempDirectory, "raw_audio.m4a");

                            var videoTask = Task.Run(async () =>
                            {
                                var vChunks = await downloader.DownloadDirectFileAsync(req.StreamUrl, Path.Combine(tempDirectory, "v_chunks"), req.EstimatedSizeBytes, concurrency, progress, cts.Token);
                                await SegmentMerger.MergeSegmentsAsync(vChunks, tempVideoFile, Path.Combine(tempDirectory, "v_chunks"));
                            });

                            var audioTask = Task.Run(async () =>
                            {
                                var aChunks = await downloader.DownloadDirectFileAsync(req.AudioUrl, Path.Combine(tempDirectory, "a_chunks"), 0, Math.Clamp(concurrency / 2, 8, 64), null, cts.Token);
                                await SegmentMerger.MergeSegmentsAsync(aChunks, tempAudioFile, Path.Combine(tempDirectory, "a_chunks"));
                            });

                            await Task.WhenAll(videoTask, audioTask);

                            // Instant 0.1s Stream Copy Mux
                            state.IsMerging = true;
                            state.Percentage = 99.5;
                            state.Status = "⚡ Finalizing & Assembling Video Container (99%)...";
                            var mergeSw = Stopwatch.StartNew();
                            bool muxed = await MuxVideoAndAudioAsync(tempVideoFile, tempAudioFile, outputFilePath);
                            mergeSw.Stop();

                            if (muxed && File.Exists(outputFilePath))
                            {
                                state.MergeSeconds = mergeSw.Elapsed.TotalSeconds;
                                state.OutputPath = outputFilePath;
                                state.IsCompleted = true;
                                state.Status = "Download Complete (Video + Audio)";

                                var fi = new FileInfo(outputFilePath);
                                await dlHistoryService.MarkCompletedAsync(taskId, fi.Length, state.SpeedMBps, state.PeakSpeedMBps, state.ElapsedSeconds);
                            }
                            else
                            {
                                if (File.Exists(tempVideoFile))
                                {
                                    File.Copy(tempVideoFile, outputFilePath, true);
                                    state.OutputPath = outputFilePath;
                                    state.IsCompleted = true;
                                    state.Status = "Download Complete (Raw Video)";

                                    var fi = new FileInfo(outputFilePath);
                                    await dlHistoryService.MarkCompletedAsync(taskId, fi.Length, state.SpeedMBps, state.PeakSpeedMBps, state.ElapsedSeconds);
                                }
                                else
                                {
                                    state.IsError = true;
                                    state.ErrorMessage = "Failed to finalize video + audio streams.";
                                    await dlHistoryService.MarkFailedAsync(taskId, state.ErrorMessage);
                                }
                            }
                        }
                        else
                        {
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

                                var fi = new FileInfo(outputFilePath);
                                await dlHistoryService.MarkCompletedAsync(taskId, fi.Length, state.SpeedMBps, state.PeakSpeedMBps, state.ElapsedSeconds);
                            }
                            else
                            {
                                state.IsError = true;
                                state.ErrorMessage = "Failed to assemble file.";
                                await dlHistoryService.MarkFailedAsync(taskId, state.ErrorMessage);
                            }
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
                            await dlHistoryService.MarkFailedAsync(taskId, state.ErrorMessage);
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

                            var fi = new FileInfo(outputFilePath);
                            await dlHistoryService.MarkCompletedAsync(taskId, fi.Length, state.SpeedMBps, state.PeakSpeedMBps, state.ElapsedSeconds);
                        }
                        else
                        {
                            state.IsError = true;
                            state.ErrorMessage = "Failed to merge video chunks into MP4 container.";
                            await dlHistoryService.MarkFailedAsync(taskId, state.ErrorMessage);
                        }
                    }
                }
                catch (OperationCanceledException)
                {
                    state.Status = "Download Cancelled/Paused";
                    await dlHistoryService.MarkCancelledAsync(taskId);
                }
                catch (Exception ex)
                {
                    state.IsError = true;
                    state.ErrorMessage = ex.Message;
                    await dlHistoryService.MarkFailedAsync(taskId, ex.Message);
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
        var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator,
            AutomaticDecompression = System.Net.DecompressionMethods.All,
            UseCookies = true,
            CookieContainer = new System.Net.CookieContainer(),
            MaxConnectionsPerServer = 1000
        };

        var client = new HttpClient(handler);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
        client.DefaultRequestHeaders.Add("Accept", "*/*");
        client.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.9");
        client.DefaultRequestHeaders.Add("Cookie", "platform=pc; bs=1; ss=1; accessAgeDisclaimerPH=1; age_verified=1");
        return client;
    }
}
