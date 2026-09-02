using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace StreamHelper.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider serviceProvider, IConfiguration config)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();

        try 
        { 
            await context.Database.MigrateAsync(); 
        } 
        catch 
        { 
            await context.Database.EnsureCreatedAsync(); 
        }

        // Ensure newly added columns exist in SQLite schema without requiring manual SQL migration
        string[] newCols = {
            "ALTER TABLE DownloadHistories ADD COLUMN ValidationStatus TEXT DEFAULT 'Passed';",
            "ALTER TABLE DownloadHistories ADD COLUMN ValidationDetails TEXT;",
            "ALTER TABLE DownloadHistories ADD COLUMN ProbedDurationSeconds REAL DEFAULT 0;",
            "ALTER TABLE DownloadHistories ADD COLUMN AudioVideoDetails TEXT;",
            "ALTER TABLE DownloadHistories ADD COLUMN AppVersion TEXT DEFAULT 'SaveZonix v2.5.0';",
            "ALTER TABLE DownloadHistories ADD COLUMN SystemVersion TEXT DEFAULT '.NET 10.0 Windows';"
        };

        foreach (var sql in newCols)
        {
            try { await context.Database.ExecuteSqlRawAsync(sql); } catch { }
        }

        string[] roles = { "Admin", "User" };
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        var analyticsService = scope.ServiceProvider.GetService<SaveZonix.Services.IDownloadAnalyticsService>();

        // Remove old dummy users if present
        var oldEmails = new[] { "admin@streamhelper.com", "sarah@streamhelper.com", "alex@streamhelper.com" };
        foreach (var old in oldEmails)
        {
            var oldUser = await userManager.FindByEmailAsync(old);
            if (oldUser != null)
            {
                await userManager.DeleteAsync(oldUser);
                if (analyticsService != null) await analyticsService.DeleteUserAsync(old);
            }
        }

        // 1. Seed Super Admin (zaidm1323@gmail.com)
        string adminEmail = "zaidm1323@gmail.com";
        string adminPassword = "Zaid@SaveZonix#2026!";
        string adminName = "Zaid Khan";

        var existingAdmin = await userManager.FindByEmailAsync(adminEmail);
        if (existingAdmin == null)
        {
            var adminUser = new AppUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                FullName = adminName,
                EmailConfirmed = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow.AddDays(-7)
            };

            var result = await userManager.CreateAsync(adminUser, adminPassword);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(adminUser, "Admin");
                Console.WriteLine($"[Database Seed] Seeded Super Admin Account: {adminEmail}");
            }
        }
        else
        {
            if (!await userManager.IsInRoleAsync(existingAdmin, "Admin"))
            {
                await userManager.AddToRoleAsync(existingAdmin, "Admin");
            }
        }

        if (analyticsService != null)
        {
            await analyticsService.CreateOrUpdateUserAsync(new SaveZonix.Models.SaveZonixUser
            {
                Email = adminEmail,
                FullName = adminName,
                Role = "Admin",
                AuthProvider = "Local",
                IsActive = true,
                CreatedAt = DateTime.UtcNow.AddDays(-7)
            });
        }

        // 2. Seed Hadi & Dilshad (Exactly 2 Standard Users)
        var usersToSeed = new[]
        {
            new { Email = "hadi@savezonix.com", Name = "Hadi", Password = "Hadi@SaveZonix#2026!" },
            new { Email = "dilshad@savezonix.com", Name = "Dilshad", Password = "Dilshad@SaveZonix#2026!" }
        };

        foreach (var d in usersToSeed)
        {
            var existing = await userManager.FindByEmailAsync(d.Email);
            if (existing == null)
            {
                var user = new AppUser
                {
                    UserName = d.Email,
                    Email = d.Email,
                    FullName = d.Name,
                    EmailConfirmed = true,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow.AddDays(-3)
                };
                var createRes = await userManager.CreateAsync(user, d.Password);
                if (createRes.Succeeded)
                {
                    await userManager.AddToRoleAsync(user, "User");
                    Console.WriteLine($"[Database Seed] Seeded User Account: {d.Email}");
                }
            }

            if (analyticsService != null)
            {
                await analyticsService.CreateOrUpdateUserAsync(new SaveZonix.Models.SaveZonixUser
                {
                    Email = d.Email,
                    FullName = d.Name,
                    Role = "User",
                    AuthProvider = "Local",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow.AddDays(-3)
                });
            }
        }

        // Remove any unauthorized / old dummy users from database
        var allowedEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { adminEmail, "hadi@savezonix.com", "dilshad@savezonix.com" };
        var allDbUsers = await userManager.Users.ToListAsync();
        foreach (var u in allDbUsers)
        {
            if (!string.IsNullOrEmpty(u.Email) && !allowedEmails.Contains(u.Email))
            {
                await userManager.DeleteAsync(u);
                if (analyticsService != null) await analyticsService.DeleteUserAsync(u.Email);
            }
        }

        // 3. Initialize MongoDB collections
        if (analyticsService != null)
        {
            await analyticsService.SeedInitialCollectionsAsync();
        }

        // 4. Seed Validated Download Histories linked to Zaid, Hadi, Dilshad
        var adminDbUser = await userManager.FindByEmailAsync(adminEmail);
        var hadiDbUser = await userManager.FindByEmailAsync("hadi@savezonix.com");
        var dilshadDbUser = await userManager.FindByEmailAsync("dilshad@savezonix.com");

        // Clean out any old dummy downloads with invalid users
        var staleDownloads = await context.DownloadHistories
            .Where(d => d.UserEmail != null && !allowedEmails.Contains(d.UserEmail))
            .ToListAsync();
        if (staleDownloads.Count > 0)
        {
            context.DownloadHistories.RemoveRange(staleDownloads);
            await context.SaveChangesAsync();
        }

        if (!await context.DownloadHistories.AnyAsync())
        {
            var seedDownloads = new List<DownloadHistory>
            {
                new DownloadHistory
                {
                    Id = "dl_" + Guid.NewGuid().ToString("N")[..12],
                    UserId = adminDbUser?.Id,
                    UserEmail = adminDbUser?.Email,
                    UserName = adminDbUser?.FullName,
                    OriginalUrl = "https://www.youtube.com/watch?v=XqZsoesa55w",
                    Title = "Baby Shark Dance _ #babyshark Most Viewed Video _ Animal Songs",
                    FileName = "Baby_Shark_Dance_1080p.mp4",
                    ThumbnailUrl = "https://i.ytimg.com/vi/XqZsoesa55w/maxresdefault.jpg",
                    Platform = "YouTube",
                    MediaType = "Video",
                    Format = "MP4",
                    Quality = "1080p Full HD",
                    Codec = "AVC1 / AAC",
                    DurationSeconds = 136,
                    FileSize = 74448896,
                    DownloadedBytes = 74448896,
                    ThreadsUsed = 64,
                    Status = DownloadStatus.Completed,
                    AverageSpeedMBps = 18.5,
                    PeakSpeedMBps = 27.2,
                    DownloadDurationSeconds = 3.8,
                    ValidationStatus = "Passed",
                    ValidationDetails = "Validated OK: 74,448,896 bytes, Duration: 136.0s, Video: H.264 (1920x1080), Audio: AAC",
                    ProbedDurationSeconds = 136.0,
                    AudioVideoDetails = "Video: H.264 (1920x1080) • Audio: AAC • Container: MP4",
                    AppVersion = "SaveZonix v2.5.0",
                    SystemVersion = ".NET 10.0 Windows",
                    CreatedAt = DateTime.UtcNow.AddHours(-4),
                    CompletionTime = DateTime.UtcNow.AddHours(-4).AddSeconds(4)
                },
                new DownloadHistory
                {
                    Id = "dl_" + Guid.NewGuid().ToString("N")[..12],
                    UserId = hadiDbUser?.Id,
                    UserEmail = hadiDbUser?.Email,
                    UserName = hadiDbUser?.FullName,
                    OriginalUrl = "https://xhamster.com/videos/big-tits-big-ass-for-this-big-slut-who-loves-to-fuck-xhl0S0S",
                    Title = "Big Tits, Big Ass for This Big Slut Who Loves to Fuck!",
                    FileName = "Big Tits, Big Ass for This Big Slut Who Loves to Fuck!.mp4",
                    ThumbnailUrl = "https://icdn02.xhamster.com/hls/1080p/thumb.jpg",
                    Platform = "xHamster",
                    MediaType = "Video",
                    Format = "MP4",
                    Quality = "1080p Full HD",
                    Codec = "H.264 / AAC",
                    DurationSeconds = 1340,
                    FileSize = 479265369,
                    DownloadedBytes = 479265369,
                    ThreadsUsed = 32,
                    Status = DownloadStatus.Completed,
                    AverageSpeedMBps = 24.1,
                    PeakSpeedMBps = 38.6,
                    DownloadDurationSeconds = 19.5,
                    ValidationStatus = "Passed",
                    ValidationDetails = "Validated OK: 479,265,369 bytes, Duration: 1340.0s, Format: MPEG-TS/MP4, Video: H.264 (1920x1080), Audio: AAC",
                    ProbedDurationSeconds = 1340.0,
                    AudioVideoDetails = "Video: H.264 (1920x1080) • Audio: AAC • Container: MP4",
                    AppVersion = "SaveZonix v2.5.0",
                    SystemVersion = ".NET 10.0 Windows",
                    CreatedAt = DateTime.UtcNow.AddHours(-2),
                    CompletionTime = DateTime.UtcNow.AddHours(-2).AddSeconds(20)
                },
                new DownloadHistory
                {
                    Id = "dl_" + Guid.NewGuid().ToString("N")[..12],
                    UserId = dilshadDbUser?.Id,
                    UserEmail = dilshadDbUser?.Email,
                    UserName = dilshadDbUser?.FullName,
                    OriginalUrl = "https://mat6tube.com/watch/-165120769_456239730",
                    Title = "Adriana chechik, blonde with big tits performing anal it's s",
                    FileName = "Adriana chechik, blonde with big tits performing anal it's s.mp4",
                    ThumbnailUrl = "https://cdn2.pvvstream.pro/videos/-165120769/thumb.jpg",
                    Platform = "Mat6tube",
                    MediaType = "Video",
                    Format = "MP4",
                    Quality = "720p HD",
                    Codec = "H.264 / AAC",
                    DurationSeconds = 1820,
                    FileSize = 1109358970,
                    DownloadedBytes = 1109358970,
                    ThreadsUsed = 16,
                    Status = DownloadStatus.Completed,
                    AverageSpeedMBps = 32.4,
                    PeakSpeedMBps = 48.0,
                    DownloadDurationSeconds = 34.2,
                    ValidationStatus = "Passed",
                    ValidationDetails = "Validated OK: 1,109,358,970 bytes, Duration: 1820.0s, Video: H.264 (1280x720), Audio: AAC",
                    ProbedDurationSeconds = 1820.0,
                    AudioVideoDetails = "Video: H.264 (1280x720) • Audio: AAC • Container: MP4",
                    AppVersion = "SaveZonix v2.5.0",
                    SystemVersion = ".NET 10.0 Windows",
                    CreatedAt = DateTime.UtcNow.AddHours(-1),
                    CompletionTime = DateTime.UtcNow.AddHours(-1).AddSeconds(35)
                }
            };

            context.DownloadHistories.AddRange(seedDownloads);
            await context.SaveChangesAsync();

            // Also mirror to Analytics Service in-memory / MongoDB
            if (analyticsService != null)
            {
                foreach (var s in seedDownloads)
                {
                    await analyticsService.LogDownloadAsync(new SaveZonix.Models.DownloadRecord
                    {
                        TaskId = s.Id,
                        UserId = s.UserId,
                        UserEmail = s.UserEmail,
                        OriginalUrl = s.OriginalUrl,
                        VideoTitle = s.Title,
                        ThumbnailUrl = s.ThumbnailUrl,
                        Platform = s.Platform,
                        Quality = s.Quality,
                        DurationSeconds = s.DurationSeconds,
                        ProbedDurationSeconds = s.ProbedDurationSeconds,
                        FileSizeBytes = s.FileSize,
                        FormattedSize = s.FormattedFileSize,
                        DownloadSpeedMBps = s.AverageSpeedMBps,
                        PeakSpeedMBps = s.PeakSpeedMBps,
                        TimeTakenSeconds = s.DownloadDurationSeconds,
                        Status = s.Status.ToString(),
                        ValidationStatus = s.ValidationStatus,
                        ValidationDetails = s.ValidationDetails ?? "",
                        AudioVideoDetails = s.AudioVideoDetails ?? "",
                        AppVersion = s.AppVersion,
                        SystemVersion = s.SystemVersion,
                        CreatedAt = s.CreatedAt
                    });
                }
            }
        }

        var defaultSettings = new[]
        {
            new AdminSetting { Key = "RegistrationEnabled", Value = "true", Description = "Allow new user registrations", Category = "Security" },
            new AdminSetting { Key = "EmailVerificationRequired", Value = "false", Description = "Require email confirmation before login", Category = "Security" },
            new AdminSetting { Key = "GoogleLoginEnabled", Value = "true", Description = "Enable Continue with Google OAuth", Category = "Authentication" },
            new AdminSetting { Key = "DefaultThreads", Value = "64", Description = "Default worker threads for downloads", Category = "Downloader" },
            new AdminSetting { Key = "MaxThreads", Value = "256", Description = "Maximum allowed parallel worker threads", Category = "Downloader" },
            new AdminSetting { Key = "MaintenanceMode", Value = "false", Description = "Put the website in maintenance mode", Category = "System" },
            new AdminSetting { Key = "MaxConcurrentDownloadsPerUser", Value = "5", Description = "Maximum active downloads per user", Category = "Downloader" }
        };

        foreach (var setting in defaultSettings)
        {
            if (!await context.AdminSettings.AnyAsync(s => s.Key == setting.Key))
            {
                context.AdminSettings.Add(setting);
            }
        }

        await context.SaveChangesAsync();
    }
}
