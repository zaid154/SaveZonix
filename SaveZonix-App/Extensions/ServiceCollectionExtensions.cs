using System;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using SaveZonix.Services;
using StackExchange.Redis;
using StreamHelper.Services;
using Zonix.Core.Engines;

namespace SaveZonix.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddSaveZonixServices(this IServiceCollection services, IConfiguration configuration)
    {
        // 1. MongoDB Atlas Driver (Singleton Client & Database) - Zero hardcoded credentials
        string? mongoConnStr = configuration["MongoDb:ConnectionString"]
            ?? configuration.GetConnectionString("MongoDb")
            ?? Environment.GetEnvironmentVariable("MONGO_URI")
            ?? Environment.GetEnvironmentVariable("MONGODB_URI");
        string mongoDbName = configuration["MongoDb:DatabaseName"] ?? "SaveZonixDb";

        if (!string.IsNullOrWhiteSpace(mongoConnStr))
        {
            try
            {
                var mongoSettings = MongoClientSettings.FromConnectionString(mongoConnStr);
                mongoSettings.ServerSelectionTimeout = TimeSpan.FromSeconds(8);
                mongoSettings.ConnectTimeout = TimeSpan.FromSeconds(8);

                var mongoClient = new MongoClient(mongoSettings);
                var mongoDb = mongoClient.GetDatabase(mongoDbName);

                services.AddSingleton<IMongoClient>(mongoClient);
                services.AddSingleton<IMongoDatabase>(mongoDb);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MongoDB Driver Init Notice] {ex.Message}");
            }
        }

        // 2. Cookie Authentication & OAuth
        var authBuilder = services.AddAuthentication(options =>
        {
            options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            options.DefaultSignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            options.DefaultAuthenticateScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        })
        .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
        {
            options.Cookie.HttpOnly = true;
            options.Cookie.Name = "SaveZonix.Auth";
            options.ExpireTimeSpan = TimeSpan.FromDays(30);
            options.LoginPath = "/Account/Login";
            options.LogoutPath = "/Account/Logout";
            options.AccessDeniedPath = "/Account/Login";
            options.SlidingExpiration = true;
        });

        var googleClientId = configuration["Authentication:Google:ClientId"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID");
        var googleClientSecret = configuration["Authentication:Google:ClientSecret"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET");

        if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret) && !googleClientId.Contains("YOUR_"))
        {
            authBuilder.AddGoogle(googleOptions =>
            {
                googleOptions.ClientId = googleClientId;
                googleOptions.ClientSecret = googleClientSecret;
            });
        }

        // 3. Redis Distributed Cache & High-Performance Acceleration (Zero-Blocking)
        var explicitRedisConn = configuration["Redis:ConnectionString"] ?? Environment.GetEnvironmentVariable("REDIS_CONNECTION_STRING");
        if (!string.IsNullOrWhiteSpace(explicitRedisConn))
        {
            try
            {
                var multiplexer = ConnectionMultiplexer.Connect(explicitRedisConn);
                services.AddSingleton<IConnectionMultiplexer>(multiplexer);
                Console.WriteLine($"[Redis Bootstrap] ⚡ Initialized Redis connection to: {explicitRedisConn}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Redis Bootstrap Notice] Connection to '{explicitRedisConn}' failed: {ex.Message}. Running in High-Speed In-Memory Fallback Cache.");
            }
        }
        else
        {
            Console.WriteLine("[Redis Bootstrap] ⚡ Running in Zero-Latency High-Speed In-Memory Cache mode.");
        }
        services.AddSingleton<IRedisCacheService, RedisCacheService>();

        // 4. Application Services & Switchable Analytics/Database Layer
        services.AddSingleton<IEmailService, EmailService>();
        services.AddSingleton<IEmailVerificationService, EmailVerificationService>();
        services.AddScoped<IDownloadHistoryService, DownloadHistoryService>();
        services.AddScoped<IAdminSettingsService, AdminSettingsService>();
        services.AddHostedService<CloudSettingsSyncWorker>();

        services.AddSingleton<IDownloadAnalyticsService, MongoDbAnalyticsService>();

        // 5. Playlist Services
        services.AddSingleton<IYouTubePlaylistService, YouTubePlaylistService>();
        services.AddSingleton<IPlaylistQueueManager, PlaylistQueueManager>();

        // 6. Decoupled Core Super-Engines (Fault-Isolated Micro-Engines)
        services.AddSingleton<TranscoderEngine>();
        services.AddSingleton<TurboDownloadEngine>();
        services.AddSingleton<MediaAnalyzerEngine>();
        services.AddSingleton<ServiceHealthMonitor>();
        services.AddSingleton<PowerFeaturesEngine>();
        services.AddSingleton<BulkBatchEngine>();
        services.AddSingleton<CookieVaultEngine>();

        // 7. MVC Controllers & Views
        services.AddControllersWithViews();

        return services;
    }
}
