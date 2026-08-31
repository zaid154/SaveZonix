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

        string[] roles = { "Admin", "User" };
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        string adminEmail = config["AdminSettings:SeedAdminEmail"] ?? "admin@streamhelper.com";
        string adminPassword = config["AdminSettings:SeedAdminPassword"] ?? "Admin@123456";
        string adminName = config["AdminSettings:SeedAdminName"] ?? "System Administrator";

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
                CreatedAt = DateTime.UtcNow
            };

            var result = await userManager.CreateAsync(adminUser, adminPassword);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(adminUser, "Admin");
                Console.WriteLine(string.Format("[Database Seed] Seeded Admin Account: {0}", adminEmail));
            }
        }
        else
        {
            if (!await userManager.IsInRoleAsync(existingAdmin, "Admin"))
            {
                await userManager.AddToRoleAsync(existingAdmin, "Admin");
            }
        }

        // Seed 2 Demo Users
        var demoUsers = new[]
        {
            new { Email = "sarah@streamhelper.com", Name = "Sarah Connor", Password = "User@123456" },
            new { Email = "alex@streamhelper.com", Name = "Alex Vance", Password = "User@123456" }
        };

        foreach (var d in demoUsers)
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
                    CreatedAt = DateTime.UtcNow.AddDays(-2)
                };
                var createRes = await userManager.CreateAsync(user, d.Password);
                if (createRes.Succeeded)
                {
                    await userManager.AddToRoleAsync(user, "User");
                }
            }
        }

        // Seed Sample Download History if empty
        if (!await context.DownloadHistories.AnyAsync())
        {
            var user1 = await userManager.FindByEmailAsync("sarah@streamhelper.com");
            var user2 = await userManager.FindByEmailAsync("alex@streamhelper.com");

            var sampleDownloads = new List<DownloadHistory>
            {
                new DownloadHistory
                {
                    Id = Guid.NewGuid().ToString("N"),
                    UserId = user1?.Id,
                    UserEmail = user1?.Email,
                    UserName = user1?.FullName,
                    OriginalUrl = "https://example.com/stream/sample1",
                    Title = "Nature 4K Documentary Stream",
                    FileName = "Nature_4K_Documentary.mp4",
                    Platform = "YouTube",
                    MediaType = "Video",
                    Format = "MP4",
                    Quality = "1080p Full HD",
                    DurationSeconds = 480,
                    FileSize = 125829120,
                    DownloadedBytes = 125829120,
                    ThreadsUsed = 64,
                    Status = DownloadStatus.Completed,
                    AverageSpeedMBps = 14.8,
                    PeakSpeedMBps = 22.4,
                    DownloadDurationSeconds = 8.5,
                    CreatedAt = DateTime.UtcNow.AddHours(-3),
                    CompletionTime = DateTime.UtcNow.AddHours(-3).AddSeconds(8)
                },
                new DownloadHistory
                {
                    Id = Guid.NewGuid().ToString("N"),
                    UserId = user2?.Id,
                    UserEmail = user2?.Email,
                    UserName = user2?.FullName,
                    OriginalUrl = "https://example.com/stream/sample2",
                    Title = "Cyberpunk 2077 Night City Trailer",
                    FileName = "Cyberpunk_Night_City.mp4",
                    Platform = "Vimeo",
                    MediaType = "Video",
                    Format = "MP4",
                    Quality = "1440p 2K",
                    DurationSeconds = 210,
                    FileSize = 89128960,
                    DownloadedBytes = 89128960,
                    ThreadsUsed = 128,
                    Status = DownloadStatus.Completed,
                    AverageSpeedMBps = 21.2,
                    PeakSpeedMBps = 31.0,
                    DownloadDurationSeconds = 4.2,
                    CreatedAt = DateTime.UtcNow.AddHours(-1),
                    CompletionTime = DateTime.UtcNow.AddHours(-1).AddSeconds(4)
                }
            };

            context.DownloadHistories.AddRange(sampleDownloads);
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
