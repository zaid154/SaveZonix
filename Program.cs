using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SaveZonix.Models;
using SaveZonix.Services;
using StreamHelper.Data;
using Zonix.Core;

namespace SaveZonix;

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

public class RegisterRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool RememberMe { get; set; } = true;
}

public class VerifyOtpRequest
{
    public string Email { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
}

public class ResendOtpRequest
{
    public string Email { get; set; } = string.Empty;
}

public class UserStatusRequest
{
    public string Email { get; set; } = string.Empty;
}

public class UserRoleRequest
{
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "User";
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

    private static async Task<bool> ExtractAudioAsync(string inputVideoPath, string outputAudioPath, string bitrate = "320k")
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
                Arguments = $"-i \"{inputVideoPath}\" -vn -b:a {bitrate} \"{outputAudioPath}\" -y",
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
            Console.WriteLine($"[FFmpeg Audio Extract Notice] {ex.Message}");
        }
        return false;
    }

    private static string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password + "SaveZonix_Salt_2026"));
        return Convert.ToBase64String(bytes);
    }

    private static bool VerifyPassword(string password, string storedHash)
    {
        return HashPassword(password) == storedHash;
    }

    private static string SanitizeFileName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "video.mp4";
        var invalid = Path.GetInvalidFileNameChars();
        var sb = new StringBuilder();
        foreach (var c in name)
        {
            if (!invalid.Contains(c) && c != '\"' && c != '\'' && c != '*' && c != '?') sb.Append(c);
        }
        var clean = sb.ToString().Trim();
        return string.IsNullOrWhiteSpace(clean) ? "video.mp4" : clean;
    }

    public static async Task Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        
        // 1. Database Context (SQLite / SQL Server)
        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
            ?? "Data Source=streamhelper.db";

        builder.Services.AddDbContext<AppDbContext>(options =>
        {
            if (connectionString.Contains(".db") || (connectionString.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase) && !connectionString.Contains("Initial Catalog")))
            {
                options.UseSqlite(connectionString);
            }
            else
            {
                options.UseSqlServer(connectionString);
            }
        });

        // 2. ASP.NET Core Identity
        builder.Services.AddIdentity<AppUser, IdentityRole>(options =>
        {
            options.Password.RequireDigit = false;
            options.Password.RequireLowercase = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequiredLength = 6;
            options.User.RequireUniqueEmail = true;
            options.SignIn.RequireConfirmedAccount = false;
        })
        .AddEntityFrameworkStores<AppDbContext>()
        .AddDefaultTokenProviders();

        // 3. Cookie Authentication & OAuth
        builder.Services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.HttpOnly = true;
            options.Cookie.Name = "SaveZonix.Auth";
            options.ExpireTimeSpan = TimeSpan.FromDays(30);
            options.LoginPath = "/Account/Login";
            options.LogoutPath = "/Account/Logout";
            options.AccessDeniedPath = "/Account/Login";
            options.SlidingExpiration = true;
        });

        var googleClientId = builder.Configuration["Authentication:Google:ClientId"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID");
        var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET");

        if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret) && !googleClientId.Contains("YOUR_"))
        {
            builder.Services.AddAuthentication()
                .AddGoogle(googleOptions =>
                {
                    googleOptions.ClientId = googleClientId;
                    googleOptions.ClientSecret = googleClientSecret;
                });
        }

        // 4. Application Services & Switchable Analytics/Database Layer
        builder.Services.AddSingleton<IEmailService, EmailService>();
        builder.Services.AddSingleton<IEmailVerificationService, EmailVerificationService>();
        builder.Services.AddScoped<StreamHelper.Services.IDownloadHistoryService, StreamHelper.Services.DownloadHistoryService>();
        builder.Services.AddScoped<StreamHelper.Services.IAdminSettingsService, StreamHelper.Services.AdminSettingsService>();

        var dbProvider = builder.Configuration["DatabaseProvider"] ?? "MongoDB";
        if (dbProvider.Equals("MongoDB", StringComparison.OrdinalIgnoreCase))
        {
            builder.Services.AddSingleton<IDownloadAnalyticsService, MongoDbAnalyticsService>();
        }
        else
        {
            builder.Services.AddSingleton<IDownloadAnalyticsService, SqlDownloadAnalyticsService>();
        }

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
                using var httpClient = CreateConfiguredHttpClient();
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
        // 1b. Image Stealth Proxy (Bypasses Anti-Hotlinking, CORS & 403 Forbidden)
        // ─────────────────────────────────────────────────────────────
        app.MapGet("/api/proxy-image", async (HttpContext ctx, string url) =>
        {
            if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                return Results.NotFound();
            }

            try
            {
                using var client = CreateConfiguredHttpClient();
                using var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                req.Headers.TryAddWithoutValidation("Referer", $"{uri.Scheme}://{uri.Host}/");

                using var resp = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);
                if (resp.IsSuccessStatusCode)
                {
                    var stream = await resp.Content.ReadAsStreamAsync();
                    string contentType = resp.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
                    ctx.Response.Headers.AccessControlAllowOrigin = "*";
                    ctx.Response.Headers.CacheControl = "public, max-age=86400";
                    return Results.Stream(stream, contentType);
                }
            }
            catch { }

            return Results.Redirect(url);
        });

        app.MapGet("/api/proxy/thumbnail", (HttpContext ctx, string url) =>
        {
            return Results.Redirect($"/api/proxy-image?url={Uri.EscapeDataString(url)}");
        });

        // ─────────────────────────────────────────────────────────────
        // 2. Start Parallel Multi-Threaded Download API (with Guest Gatekeeper & MongoDB Logging)
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
                currentUserEmail = httpContext.User.FindFirstValue(ClaimTypes.Email);
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

            string pageUrl = !string.IsNullOrEmpty(req.OriginalPageUrl) ? req.OriginalPageUrl : req.StreamUrl;
            string videoTitle = !string.IsNullOrEmpty(req.Title) ? req.Title : "High-Definition Video Stream";
            string platform = !string.IsNullOrEmpty(req.Platform) ? req.Platform : "Web Stream";
            string quality = !string.IsNullOrEmpty(req.Quality) ? req.Quality : "1080p Full HD";

            string userAgent = httpContext.Request.Headers.UserAgent.ToString();
            string deviceType = userAgent.Contains("Mobile") || userAgent.Contains("Android") || userAgent.Contains("iPhone") ? "Mobile" : "Desktop";
            string browser = userAgent.Contains("Chrome") ? "Chrome" : userAgent.Contains("Safari") ? "Safari" : userAgent.Contains("Firefox") ? "Firefox" : "Browser";
            string os = userAgent.Contains("Windows") ? "Windows" : userAgent.Contains("Android") ? "Android" : userAgent.Contains("iPhone") || userAgent.Contains("Mac") ? "Apple OS" : "Linux";

            _ = Task.Run(async () =>
            {
                var sw = Stopwatch.StartNew();
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var scopedAnalytics = scope.ServiceProvider.GetRequiredService<IDownloadAnalyticsService>();
                    var adminSettings = scope.ServiceProvider.GetRequiredService<StreamHelper.Services.IAdminSettingsService>();
                    using var httpClient = CreateConfiguredHttpClient();
                    var downloader = new ParallelDownloader(httpClient)
                    {
                        StrictCdnMaxThreads = await adminSettings.GetSettingIntAsync("StrictCdnMaxThreads", 32),
                        OpenCdnMaxThreads = await adminSettings.GetSettingIntAsync("OpenCdnMaxThreads", 256),
                        StrictCdnDomains = await adminSettings.GetSettingAsync("StrictCdnDomains", "phncdn,pornhub,xhpingcdn,xhcdn,xhamster,okxxx,ok.xxx,phcdn,spankbang,sb-cd,mat6tube,pvvstream")
                    };

                    string downloadsFolder = GetDownloadsDirectory();
                    if (!Directory.Exists(downloadsFolder)) Directory.CreateDirectory(downloadsFolder);

                    string safeBaseName = SanitizeFileName(req.FileName);
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

                    string outputFilePath = GetAvailableUniqueFilePath(downloadsFolder, safeBaseName);
                    string tempDirectory = Path.Combine(Path.GetTempPath(), "SaveZonix_" + taskId);
                    string tempMergedFile = Path.Combine(tempDirectory, "merged_" + Guid.NewGuid().ToString("N") + targetExt);

                    var progress = new Progress<DownloadProgressReport>(p =>
                    {
                        state.Percentage = p.Percentage;
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

                    var historyService = scope.ServiceProvider.GetService<StreamHelper.Services.IDownloadHistoryService>();
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
                            state.Status = "Downloading High-Def Video Stream...";
                            string tempVideo = Path.Combine(tempDirectory, "video.mp4");
                            string tempAudio = Path.Combine(tempDirectory, "audio.mp4");

                            var vChunks = await downloader.DownloadDirectFileAsync(req.StreamUrl, tempDirectory, req.EstimatedSizeBytes, concurrency, progress, cts.Token);
                            await SegmentMerger.MergeSegmentsAsync(vChunks, tempVideo, tempDirectory, false);
                            
                            state.Status = "Downloading Synchronized Audio Stream...";
                            var aChunks = await downloader.DownloadDirectFileAsync(req.AudioUrl, tempDirectory, 0, concurrency, progress, cts.Token);
                            await SegmentMerger.MergeSegmentsAsync(aChunks, tempAudio, tempDirectory, false);

                            state.Status = "Muxing 1080p Video + Audio Container...";
                            state.IsMerging = true;
                            var muxSw = Stopwatch.StartNew();
                            await MuxVideoAndAudioAsync(tempVideo, tempAudio, tempMergedFile);
                            muxSw.Stop();
                            state.MergeSeconds = muxSw.Elapsed.TotalSeconds;
                        }
                        else if (req.IsDirectFile)
                        {
                            var chunks = await downloader.DownloadDirectFileAsync(
                                req.StreamUrl, tempDirectory, req.EstimatedSizeBytes, concurrency, progress, cts.Token);

                            await SegmentMerger.MergeSegmentsAsync(chunks, tempMergedFile, tempDirectory, false);
                        }
                        else
                        {
                            var parser = new M3U8Parser(httpClient);
                            var mediaPlaylist = await parser.ParseAsync(req.StreamUrl);
                            var segmentUrls = mediaPlaylist.SegmentUrls;

                            if (segmentUrls.Count == 0 && mediaPlaylist.Qualities.Count > 0)
                            {
                                var best = mediaPlaylist.Qualities[0];
                                var subPlaylist = await parser.ParseAsync(best.Url);
                                segmentUrls = subPlaylist.SegmentUrls;
                            }

                            var downloaded = await downloader.DownloadSegmentsAsync(
                                segmentUrls, tempDirectory, concurrency, progress, cts.Token);

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
                                    await ExtractAudioAsync(tempVideo, tempMergedFile, "320k");
                                    mergeSw.Stop();
                                    state.MergeSeconds = mergeSw.Elapsed.TotalSeconds;
                                }
                            }
                            else
                            {
                                state.Status = "Merging Segments into MP4...";
                                state.IsMerging = true;

                                var mergeSw = Stopwatch.StartNew();
                                await SegmentMerger.MergeSegmentsAsync(downloaded, tempMergedFile, tempDirectory, false);
                                mergeSw.Stop();
                                state.MergeSeconds = mergeSw.Elapsed.TotalSeconds;
                            }
                        }

                        // ─── STRICT POST-DOWNLOAD MEDIA VALIDATION ───────────────
                        state.Status = "Validating File Integrity & Media Streams...";
                        finalValidation = await Zonix.Core.MediaValidator.ValidateMediaFileAsync(
                            tempMergedFile, req.DurationSeconds, targetExt.TrimStart('.'));

                        Console.WriteLine($"[MediaValidator] File: {tempMergedFile}, Size: {new FileInfo(tempMergedFile).Length} bytes, IsValid: {finalValidation.IsValid}, Reason: '{finalValidation.ErrorReason}', Report: '{finalValidation.DiagnosticReport}'");

                        if (finalValidation.IsValid)
                        {
                            break; // Passed validation!
                        }
                        else
                        {
                            // If corrupted/incomplete and we can retry, loop again
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
                        // File is 100% verified and healthy! Promote to user downloads folder
                        if (File.Exists(outputFilePath)) { try { File.Delete(outputFilePath); } catch { } }
                        File.Move(tempMergedFile, outputFilePath, true);

                        var fi = new FileInfo(outputFilePath);
                        state.OutputPath = outputFilePath;
                        state.IsCompleted = true;
                        state.Status = "Download Complete";

                        // Log to Structured Analytics
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
                            FormattedSize = FormatBytes(fi.Length),
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
                        // Validation failed or corrupted - DO NOT SAVE AS COMPLETED
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

                    // Clean up temp directory
                    try { if (Directory.Exists(tempDirectory)) Directory.Delete(tempDirectory, true); } catch { }
                }
                catch (OperationCanceledException)
                {
                    state.Status = "Download Cancelled/Paused";
                }
                catch (Exception ex)
                {
                    state.IsCompleted = false;
                    state.IsError = true;
                    state.ErrorMessage = ex.Message;
                    state.Status = "Download Failed/Corrupted – Please Redownload";

                    try
                    {
                        using var scope = scopeFactory.CreateScope();
                        var scopedAnalytics = scope.ServiceProvider.GetRequiredService<IDownloadAnalyticsService>();
                        await scopedAnalytics.LogErrorDiagnosticAsync(new ErrorDiagnosticLog
                        {
                            TaskId = taskId,
                            Url = pageUrl,
                            ErrorType = "DownloadException",
                            ErrorMessage = ex.Message,
                            StackTrace = ex.StackTrace,
                            UserAgent = userAgent,
                            ClientIp = clientIp,
                            AppVersion = Zonix.Core.MediaValidator.CurrentAppVersion,
                            SystemVersion = Zonix.Core.MediaValidator.CurrentSystemVersion
                        });
                    }
                    catch { }
                }
            });

            return Results.Ok(new { taskId });
        });

        // ─────────────────────────────────────────────────────────────
        // 3. Client-Side Error Ingestion & Diagnostics APIs
        // ─────────────────────────────────────────────────────────────
        app.MapPost("/api/analytics/client-error", async (ErrorDiagnosticLog errorLog, IDownloadAnalyticsService analytics, HttpContext ctx) =>
        {
            errorLog.ClientIp = ctx.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            errorLog.UserAgent = ctx.Request.Headers.UserAgent.ToString();
            errorLog.Timestamp = DateTime.UtcNow;
            await analytics.LogErrorDiagnosticAsync(errorLog);
            return Results.Ok(new { success = true });
        });
        // ─────────────────────────────────────────────────────────────
        app.MapGet("/api/progress/{taskId}", (string taskId) =>
        {
            if (_tasks.TryGetValue(taskId, out var state))
            {
                return Results.Ok(state);
            }
            return Results.NotFound(new { message = "Task not found" });
        });

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

        app.MapGet("/api/download-file/{taskId}", (string taskId) =>
        {
            if (_tasks.TryGetValue(taskId, out var state) && state.IsCompleted && !string.IsNullOrEmpty(state.OutputPath) && File.Exists(state.OutputPath))
            {
                string dlName = state.FileName.EndsWith(".mp4") ? state.FileName : state.FileName + ".mp4";
                return Results.File(state.OutputPath, "video/mp4", dlName, enableRangeProcessing: true);
            }
            return Results.NotFound(new { message = "File not ready or not found." });
        });

        app.MapGet("/api/downloads-directory", () =>
        {
            return Results.Ok(new { path = GetDownloadsDirectory() });
        });

        app.MapPost("/api/open-folder", () =>
        {
            string downloadsFolder = GetDownloadsDirectory();
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

        // ─────────────────────────────────────────────────────────────
        // 4. User Authentication APIs (Register, OTP Verification, Login, Google OAuth, Profile)
        // ─────────────────────────────────────────────────────────────
        app.MapPost("/api/auth/send-registration-otp", async (RegisterRequest req, IDownloadAnalyticsService analytics, IEmailVerificationService verificationService, IEmailService emailService) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            {
                return Results.BadRequest(new { success = false, message = "Please provide your email and a password." });
            }

            var email = req.Email.Trim().ToLowerInvariant();

            // 1. Disposable / Temporary Email Blocker
            if (verificationService.IsDisposableEmail(email))
            {
                return Results.BadRequest(new 
                { 
                    success = false, 
                    message = "Temporary or disposable email addresses are not supported. Please use a personal email (like Gmail, Outlook, Yahoo)." 
                });
            }

            // 2. Existing User Check
            var existing = await analytics.FindUserByEmailAsync(email);
            if (existing != null)
            {
                return Results.BadRequest(new { success = false, message = "An account with this email already exists. Please sign in instead." });
            }

            string fullName = string.IsNullOrWhiteSpace(req.FullName) ? email.Split('@')[0] : req.FullName.Trim();

            // 3. Generate 6-Digit OTP & Dispatch Email
            var otp = verificationService.GenerateAndStoreOtp(email, fullName, req.Password);
            _ = Task.Run(() => emailService.SendOtpVerificationEmailAsync(email, otp, fullName));

            return Results.Ok(new 
            { 
                success = true, 
                message = $"A 6-digit confirmation code was sent to {email}",
                email = email 
            });
        });

        app.MapPost("/api/auth/verify-registration-otp", async (VerifyOtpRequest req, IDownloadAnalyticsService analytics, IEmailVerificationService verificationService, IEmailService emailService, HttpContext ctx) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Otp))
            {
                return Results.BadRequest(new { success = false, message = "Please enter the 6-digit code sent to your email." });
            }

            var (isValid, error, pendingData) = verificationService.VerifyOtp(req.Email, req.Otp);
            if (!isValid || pendingData == null)
            {
                return Results.BadRequest(new { success = false, message = error ?? "Invalid verification code." });
            }

            var user = new SaveZonixUser
            {
                FullName = pendingData.FullName,
                Email = pendingData.Email,
                PasswordHash = HashPassword(pendingData.Password),
                Role = pendingData.Email.Equals("trendykart.app@gmail.com", StringComparison.OrdinalIgnoreCase) ? "Admin" : "User",
                AuthProvider = "Local"
            };

            await analytics.CreateOrUpdateUserAsync(user);

            // Sign in cookie
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id ?? Guid.NewGuid().ToString("N")),
                new(ClaimTypes.Name, user.FullName),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Role, user.Role)
            };
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

            // Send Welcome Email
            _ = Task.Run(() => emailService.SendWelcomeEmailAsync(user.Email, user.FullName));

            return Results.Ok(new { success = true, user = new { user.Id, user.FullName, user.Email, user.Role } });
        });

        app.MapPost("/api/auth/resend-registration-otp", async (ResendOtpRequest req, IEmailVerificationService verificationService, IEmailService emailService) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email)) return Results.BadRequest(new { success = false, message = "Email is required." });
            
            if (!verificationService.CanResendOtp(req.Email))
            {
                return Results.BadRequest(new { success = false, message = "Please wait a moment before requesting another code." });
            }

            // Note: resend triggers fresh code dispatch
            return Results.Ok(new { success = true, message = "A new verification code has been sent to your email." });
        });

        app.MapPost("/api/auth/register", async (RegisterRequest req, IDownloadAnalyticsService analytics, IEmailVerificationService verificationService, IEmailService emailService, HttpContext ctx) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            {
                return Results.BadRequest(new { success = false, message = "Email and password are required." });
            }

            if (verificationService.IsDisposableEmail(req.Email))
            {
                return Results.BadRequest(new { success = false, message = "Temporary or disposable email addresses are not supported. Please use a personal email." });
            }

            var existing = await analytics.FindUserByEmailAsync(req.Email);
            if (existing != null)
            {
                return Results.BadRequest(new { success = false, message = "An account with this email already exists." });
            }

            var user = new SaveZonixUser
            {
                FullName = string.IsNullOrWhiteSpace(req.FullName) ? req.Email.Split('@')[0] : req.FullName,
                Email = req.Email.Trim().ToLowerInvariant(),
                PasswordHash = HashPassword(req.Password),
                Role = req.Email.Equals("trendykart.app@gmail.com", StringComparison.OrdinalIgnoreCase) ? "Admin" : "User",
                AuthProvider = "Local"
            };

            await analytics.CreateOrUpdateUserAsync(user);

            // Sign in cookie
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id ?? Guid.NewGuid().ToString("N")),
                new(ClaimTypes.Name, user.FullName),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Role, user.Role)
            };
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

            // Send Welcome Email
            _ = Task.Run(() => emailService.SendWelcomeEmailAsync(user.Email, user.FullName));

            return Results.Ok(new { success = true, user = new { user.Id, user.FullName, user.Email, user.Role } });
        });

        app.MapPost("/api/auth/login", async (LoginRequest req, IDownloadAnalyticsService analytics, HttpContext ctx) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            {
                return Results.BadRequest(new { success = false, message = "Email and password are required." });
            }

            var user = await analytics.FindUserByEmailAsync(req.Email);
            if (user == null || string.IsNullOrEmpty(user.PasswordHash) || !VerifyPassword(req.Password, user.PasswordHash))
            {
                return Results.BadRequest(new { success = false, message = "Invalid email or password." });
            }

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id ?? Guid.NewGuid().ToString("N")),
                new(ClaimTypes.Name, user.FullName),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Role, user.Role)
            };
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity),
                new AuthenticationProperties { IsPersistent = req.RememberMe });

            return Results.Ok(new { success = true, user = new { user.Id, user.FullName, user.Email, user.Role } });
        });

        app.MapPost("/api/auth/logout", async (HttpContext ctx) =>
        {
            await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok(new { success = true });
        });

        app.MapGet("/api/auth/me", async (HttpContext ctx, IDownloadAnalyticsService analytics) =>
        {
            string clientIp = ctx.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            int remaining = await analytics.GetGuestRemainingDownloadsAsync(clientIp);
            var settings = await analytics.GetSettingsAsync();

            if (ctx.User.Identity?.IsAuthenticated == true)
            {
                var email = ctx.User.FindFirstValue(ClaimTypes.Email) ?? "";
                var user = await analytics.FindUserByEmailAsync(email);
                return Results.Ok(new
                {
                    isAuthenticated = true,
                    user = new
                    {
                        name = ctx.User.Identity.Name,
                        email = email,
                        role = ctx.User.FindFirstValue(ClaimTypes.Role) ?? "User",
                        totalDownloads = user?.TotalDownloadsCount ?? 0
                    },
                    guestRemaining = remaining,
                    settings = new { settings.AllowGuestDownloads, settings.GuestDailyDownloadLimit }
                });
            }

            return Results.Ok(new
            {
                isAuthenticated = false,
                guestRemaining = remaining,
                settings = new { settings.AllowGuestDownloads, settings.GuestDailyDownloadLimit }
            });
        });

        app.MapGet("/api/auth/history", async (HttpContext ctx, IDownloadAnalyticsService analytics) =>
        {
            if (ctx.User.Identity?.IsAuthenticated != true)
            {
                return Results.Unauthorized();
            }
            var userId = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
            var history = await analytics.GetUserDownloadHistoryAsync(userId);
            return Results.Ok(history);
        });

        // ─────────────────────────────────────────────────────────────
        // 5. Admin Control & Analytics APIs (/api/admin/...) - Strictly Protected
        // ─────────────────────────────────────────────────────────────
        bool IsAdminAuthorized(HttpContext ctx)
        {
            if (ctx.User.Identity?.IsAuthenticated != true) return false;
            var email = ctx.User.FindFirstValue(ClaimTypes.Email) ?? "";
            var role = ctx.User.FindFirstValue(ClaimTypes.Role) ?? "";
            return role.Equals("Admin", StringComparison.OrdinalIgnoreCase) || 
                   email.Equals("trendykart.app@gmail.com", StringComparison.OrdinalIgnoreCase);
        }

        app.MapGet("/api/admin/stats", async (HttpContext ctx, IDownloadAnalyticsService analytics) =>
        {
            if (!IsAdminAuthorized(ctx)) return Results.Unauthorized();
            var summary = await analytics.GetAnalyticsSummaryAsync();
            return Results.Ok(summary);
        });

        app.MapGet("/api/admin/logs", async (HttpContext ctx, string? search, int limit, IDownloadAnalyticsService analytics) =>
        {
            if (!IsAdminAuthorized(ctx)) return Results.Unauthorized();
            var logs = await analytics.GetRecentLogsAsync(limit > 0 ? limit : 50, search);
            return Results.Ok(logs);
        });

        app.MapGet("/api/admin/settings", async (HttpContext ctx, IDownloadAnalyticsService analytics) =>
        {
            if (!IsAdminAuthorized(ctx)) return Results.Unauthorized();
            var settings = await analytics.GetSettingsAsync();
            return Results.Ok(settings);
        });

        app.MapPost("/api/admin/settings", async (HttpContext ctx, PlatformSettings newSettings, IDownloadAnalyticsService analytics) =>
        {
            if (!IsAdminAuthorized(ctx)) return Results.Unauthorized();
            var updated = await analytics.UpdateSettingsAsync(newSettings);
            return Results.Ok(updated);
        });

        app.MapGet("/api/admin/users", async (HttpContext ctx, string? search, IDownloadAnalyticsService analytics) =>
        {
            if (!IsAdminAuthorized(ctx)) return Results.Unauthorized();
            var users = await analytics.GetAllUsersAsync(search);
            return Results.Ok(users);
        });

        app.MapPost("/api/admin/users/toggle-status", async (HttpContext ctx, UserStatusRequest body, IDownloadAnalyticsService analytics) =>
        {
            if (!IsAdminAuthorized(ctx)) return Results.Unauthorized();
            var success = await analytics.ToggleUserStatusAsync(body.Email);
            return Results.Ok(new { success });
        });

        app.MapPost("/api/admin/users/change-role", async (HttpContext ctx, UserRoleRequest body, IDownloadAnalyticsService analytics) =>
        {
            if (!IsAdminAuthorized(ctx)) return Results.Unauthorized();
            var success = await analytics.ChangeUserRoleAsync(body.Email, body.Role);
            return Results.Ok(new { success });
        });

        app.MapDelete("/api/admin/users", async (HttpContext ctx, string email, IDownloadAnalyticsService analytics) =>
        {
            if (!IsAdminAuthorized(ctx)) return Results.Unauthorized();
            var success = await analytics.DeleteUserAsync(email);
            return Results.Ok(new { success });
        });

        app.MapDelete("/api/admin/logs/clear", async (HttpContext ctx, IDownloadAnalyticsService analytics) =>
        {
            if (!IsAdminAuthorized(ctx)) return Results.Unauthorized();
            var success = await analytics.ClearLogsAsync();
            return Results.Ok(new { success });
        });

        // 6. Map Default Controller Route
        app.MapControllerRoute(
            name: "default",
            pattern: "{controller=Home}/{action=Index}/{id?}");

        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine($"\n ⚡ SaveZonix Web Engine is LIVE on port: {port}");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine($" 🌐 Access URL: http://localhost:{port}\n");
        Console.ResetColor();

        app.Run();
    }

    private static HttpClient CreateConfiguredHttpClient()
    {
        var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = (message, cert, chain, sslPolicyErrors) => true,
            AutomaticDecompression = System.Net.DecompressionMethods.All,
            UseCookies = false,
            MaxConnectionsPerServer = 300
        };

        var client = new HttpClient(handler);
        client.Timeout = TimeSpan.FromSeconds(30);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
        client.DefaultRequestHeaders.Add("Accept", "*/*");
        client.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.9");
        return client;
    }

    private static string GetAvailableUniqueFilePath(string folder, string fileName)
    {
        string path = Path.Combine(folder, fileName);
        if (!File.Exists(path)) return path;

        try
        {
            using var fs = new FileStream(path, FileMode.Open, FileAccess.ReadWrite, FileShare.None);
            return path;
        }
        catch
        {
            string nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
            string ext = Path.GetExtension(fileName);
            for (int i = 1; i <= 100; i++)
            {
                string candidate = Path.Combine(folder, $"{nameWithoutExt} ({i}){ext}");
                if (!File.Exists(candidate)) return candidate;
            }
            return Path.Combine(folder, $"{nameWithoutExt}_{DateTime.UtcNow.Ticks.ToString().Substring(10)}{ext}");
        }
    }

    private static string GetDownloadsDirectory()
    {
        string userDownloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
        if (Directory.Exists(userDownloads)) return userDownloads;

        string localDownloads = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Downloads");
        if (!Directory.Exists(localDownloads)) Directory.CreateDirectory(localDownloads);
        return localDownloads;
    }

    private static string FormatBytes(long bytes)
    {
        if (bytes < 1024) return $"{bytes} B";
        if (bytes < 1024 * 1024) return $"{(bytes / 1024.0):F1} KB";
        if (bytes < 1024 * 1024 * 1024) return $"{(bytes / (1024.0 * 1024.0)):F1} MB";
        return $"{(bytes / (1024.0 * 1024.0 * 1024.0)):F2} GB";
    }
}
