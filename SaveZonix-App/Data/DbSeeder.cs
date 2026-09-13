using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace StreamHelper.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider serviceProvider, IConfiguration config, bool forceReset = false)
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

        // Guaranteed SQLite schema table initialization
        string[] tableCreationStatements = {
            @"CREATE TABLE IF NOT EXISTS ""AspNetRoles"" (
                ""Id"" TEXT NOT NULL CONSTRAINT ""PK_AspNetRoles"" PRIMARY KEY,
                ""Name"" TEXT NULL,
                ""NormalizedName"" TEXT NULL,
                ""ConcurrencyStamp"" TEXT NULL
            );",
            @"CREATE TABLE IF NOT EXISTS ""AspNetUsers"" (
                ""Id"" TEXT NOT NULL CONSTRAINT ""PK_AspNetUsers"" PRIMARY KEY,
                ""FullName"" TEXT NOT NULL,
                ""CreatedAt"" TEXT NOT NULL,
                ""LastLoginAt"" TEXT NULL,
                ""IsActive"" INTEGER NOT NULL DEFAULT 1,
                ""ProfileImageUrl"" TEXT NULL,
                ""TotalDownloads"" INTEGER NOT NULL DEFAULT 0,
                ""TotalBytesDownloaded"" INTEGER NOT NULL DEFAULT 0,
                ""UserName"" TEXT NULL,
                ""NormalizedUserName"" TEXT NULL,
                ""Email"" TEXT NULL,
                ""NormalizedEmail"" TEXT NULL,
                ""EmailConfirmed"" INTEGER NOT NULL DEFAULT 1,
                ""PasswordHash"" TEXT NULL,
                ""SecurityStamp"" TEXT NULL,
                ""ConcurrencyStamp"" TEXT NULL,
                ""PhoneNumber"" TEXT NULL,
                ""PhoneNumberConfirmed"" INTEGER NOT NULL DEFAULT 0,
                ""TwoFactorEnabled"" INTEGER NOT NULL DEFAULT 0,
                ""LockoutEnd"" TEXT NULL,
                ""LockoutEnabled"" INTEGER NOT NULL DEFAULT 1,
                ""AccessFailedCount"" INTEGER NOT NULL DEFAULT 0
            );",
            @"CREATE TABLE IF NOT EXISTS ""AspNetRoleClaims"" (
                ""Id"" INTEGER NOT NULL CONSTRAINT ""PK_AspNetRoleClaims"" PRIMARY KEY AUTOINCREMENT,
                ""RoleId"" TEXT NOT NULL,
                ""ClaimType"" TEXT NULL,
                ""ClaimValue"" TEXT NULL,
                CONSTRAINT ""FK_AspNetRoleClaims_AspNetRoles_RoleId"" FOREIGN KEY (""RoleId"") REFERENCES ""AspNetRoles"" (""Id"") ON DELETE CASCADE
            );",
            @"CREATE TABLE IF NOT EXISTS ""AspNetUserClaims"" (
                ""Id"" INTEGER NOT NULL CONSTRAINT ""PK_AspNetUserClaims"" PRIMARY KEY AUTOINCREMENT,
                ""UserId"" TEXT NOT NULL,
                ""ClaimType"" TEXT NULL,
                ""ClaimValue"" TEXT NULL,
                CONSTRAINT ""FK_AspNetUserClaims_AspNetUsers_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE CASCADE
            );",
            @"CREATE TABLE IF NOT EXISTS ""AspNetUserLogins"" (
                ""LoginProvider"" TEXT NOT NULL,
                ""ProviderKey"" TEXT NOT NULL,
                ""ProviderDisplayName"" TEXT NULL,
                ""UserId"" TEXT NOT NULL,
                CONSTRAINT ""PK_AspNetUserLogins"" PRIMARY KEY (""LoginProvider"", ""ProviderKey""),
                CONSTRAINT ""FK_AspNetUserLogins_AspNetUsers_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE CASCADE
            );",
            @"CREATE TABLE IF NOT EXISTS ""AspNetUserRoles"" (
                ""UserId"" TEXT NOT NULL,
                ""RoleId"" TEXT NOT NULL,
                CONSTRAINT ""PK_AspNetUserRoles"" PRIMARY KEY (""UserId"", ""RoleId""),
                CONSTRAINT ""FK_AspNetUserRoles_AspNetRoles_RoleId"" FOREIGN KEY (""RoleId"") REFERENCES ""AspNetRoles"" (""Id"") ON DELETE CASCADE,
                CONSTRAINT ""FK_AspNetUserRoles_AspNetUsers_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE CASCADE
            );",
            @"CREATE TABLE IF NOT EXISTS ""AspNetUserTokens"" (
                ""UserId"" TEXT NOT NULL,
                ""LoginProvider"" TEXT NOT NULL,
                ""Name"" TEXT NOT NULL,
                ""Value"" TEXT NULL,
                CONSTRAINT ""PK_AspNetUserTokens"" PRIMARY KEY (""UserId"", ""LoginProvider"", ""Name""),
                CONSTRAINT ""FK_AspNetUserTokens_AspNetUsers_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE CASCADE
            );",
            @"CREATE TABLE IF NOT EXISTS ""AdminSettings"" (
                ""Key"" TEXT NOT NULL CONSTRAINT ""PK_AdminSettings"" PRIMARY KEY,
                ""Value"" TEXT NOT NULL,
                ""Description"" TEXT NULL,
                ""Category"" TEXT NOT NULL,
                ""UpdatedAt"" TEXT NOT NULL
            );",
            @"CREATE TABLE IF NOT EXISTS ""DownloadHistories"" (
                ""Id"" TEXT NOT NULL CONSTRAINT ""PK_DownloadHistories"" PRIMARY KEY,
                ""UserId"" TEXT NULL,
                ""UserEmail"" TEXT NULL,
                ""UserName"" TEXT NULL,
                ""OriginalUrl"" TEXT NOT NULL,
                ""Title"" TEXT NOT NULL,
                ""FileName"" TEXT NOT NULL,
                ""ThumbnailUrl"" TEXT NULL,
                ""Platform"" TEXT NOT NULL,
                ""MediaType"" TEXT NOT NULL,
                ""Format"" TEXT NOT NULL,
                ""Quality"" TEXT NOT NULL,
                ""Codec"" TEXT NULL,
                ""DurationSeconds"" INTEGER NOT NULL DEFAULT 0,
                ""FileSize"" INTEGER NOT NULL DEFAULT 0,
                ""Status"" INTEGER NOT NULL DEFAULT 0,
                ""StartTime"" TEXT NOT NULL,
                ""CompletionTime"" TEXT NULL,
                ""DownloadDurationSeconds"" REAL NOT NULL DEFAULT 0,
                ""DownloadedBytes"" INTEGER NOT NULL DEFAULT 0,
                ""AverageSpeedMBps"" REAL NOT NULL DEFAULT 0,
                ""PeakSpeedMBps"" REAL NOT NULL DEFAULT 0,
                ""ThreadsUsed"" INTEGER NOT NULL DEFAULT 64,
                ""DownloadStrategy"" TEXT NOT NULL DEFAULT 'HLS Multi-Thread',
                ""RetryCount"" INTEGER NOT NULL DEFAULT 0,
                ""ErrorReason"" TEXT NULL,
                ""ValidationStatus"" TEXT DEFAULT 'Passed',
                ""ValidationDetails"" TEXT NULL,
                ""ProbedDurationSeconds"" REAL DEFAULT 0,
                ""AudioVideoDetails"" TEXT NULL,
                ""AppVersion"" TEXT DEFAULT 'SaveZonix v2.5.0',
                ""SystemVersion"" TEXT DEFAULT '.NET 10.0 Windows',
                ""CreatedAt"" TEXT NOT NULL,
                ""UpdatedAt"" TEXT NOT NULL,
                CONSTRAINT ""FK_DownloadHistories_AspNetUsers_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE SET NULL
            );"
        };

        foreach (var sql in tableCreationStatements)
        {
            try { await context.Database.ExecuteSqlRawAsync(sql); } catch { }
        }

        // Ensure newly added columns exist in SQLite schema without requiring manual SQL migration
        string[] newCols = {
            "ALTER TABLE AspNetUsers ADD COLUMN ProfileImageUrl TEXT;",
            "ALTER TABLE DownloadHistories ADD COLUMN FileSize INTEGER NOT NULL DEFAULT 0;",
            "ALTER TABLE DownloadHistories ADD COLUMN StartTime TEXT;",
            "ALTER TABLE DownloadHistories ADD COLUMN CompletionTime TEXT;",
            "ALTER TABLE DownloadHistories ADD COLUMN DownloadDurationSeconds REAL NOT NULL DEFAULT 0;",
            "ALTER TABLE DownloadHistories ADD COLUMN PeakSpeedMBps REAL NOT NULL DEFAULT 0;",
            "ALTER TABLE DownloadHistories ADD COLUMN DownloadStrategy TEXT NOT NULL DEFAULT 'HLS Multi-Thread';",
            "ALTER TABLE DownloadHistories ADD COLUMN RetryCount INTEGER NOT NULL DEFAULT 0;",
            "ALTER TABLE DownloadHistories ADD COLUMN ValidationStatus TEXT DEFAULT 'Passed';",
            "ALTER TABLE DownloadHistories ADD COLUMN ValidationDetails TEXT;",
            "ALTER TABLE DownloadHistories ADD COLUMN ProbedDurationSeconds REAL DEFAULT 0;",
            "ALTER TABLE DownloadHistories ADD COLUMN AudioVideoDetails TEXT;",
            "ALTER TABLE DownloadHistories ADD COLUMN AppVersion TEXT DEFAULT 'SaveZonix v2.5.0';",
            "ALTER TABLE DownloadHistories ADD COLUMN SystemVersion TEXT DEFAULT '.NET 10.0 Windows';",
            "ALTER TABLE DownloadHistories ADD COLUMN UpdatedAt TEXT;"
        };

        foreach (var sql in newCols)
        {
            try { await context.Database.ExecuteSqlRawAsync(sql); } catch { }
        }

        var analyticsService = scope.ServiceProvider.GetService<SaveZonix.Services.IDownloadAnalyticsService>();

        if (forceReset)
        {
            Console.WriteLine("[Database Seeder] 🔄 Force Reset active: Wiping existing download records & settings for clean re-seed...");
            try
            {
                context.DownloadHistories.RemoveRange(context.DownloadHistories);
                context.AdminSettings.RemoveRange(context.AdminSettings);
                await context.SaveChangesAsync();
                if (analyticsService != null)
                {
                    await analyticsService.ClearLogsAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Database Seeder Reset Notice] {ex.Message}");
            }
        }

        string[] roles = { "Admin", "User" };
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

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
            existingAdmin.EmailConfirmed = true;
            existingAdmin.IsActive = true;
            existingAdmin.FullName = adminName;
            var token = await userManager.GeneratePasswordResetTokenAsync(existingAdmin);
            await userManager.ResetPasswordAsync(existingAdmin, token, adminPassword);
            await userManager.UpdateAsync(existingAdmin);

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

        // Clean out any old dummy downloads with invalid users or non-YouTube dummy URLs
        var staleDownloads = await context.DownloadHistories
            .Where(d => (d.UserEmail != null && !allowedEmails.Contains(d.UserEmail))
                     || d.OriginalUrl.Contains("xhamster")
                     || d.OriginalUrl.Contains("mat6tube")
                     || d.OriginalUrl.Contains("XqZsoesa55w"))
            .ToListAsync();
        if (staleDownloads.Count > 0)
        {
            context.DownloadHistories.RemoveRange(staleDownloads);
            await context.SaveChangesAsync();
            if (analyticsService != null)
            {
                await analyticsService.ClearLogsAsync();
            }
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
                    OriginalUrl = "https://www.youtube.com/watch?v=AA57UCfNiSY&list=PLHWkZlkvcf_daYtWE3pJyzj74EFT2A3qE&index=4",
                    Title = "Dil Hi Tou Hai Episode 63",
                    FileName = "Dil_Hi_Tou_Hai_Episode_63.mp4",
                    ThumbnailUrl = "https://i.ytimg.com/vi/AA57UCfNiSY/hqdefault.jpg",
                    Platform = "YouTube",
                    MediaType = "Video",
                    Format = "MP4",
                    Quality = "1080p Full HD",
                    Codec = "AVC1 / AAC",
                    DurationSeconds = 2340,
                    FileSize = 428901234,
                    DownloadedBytes = 428901234,
                    ThreadsUsed = 64,
                    Status = DownloadStatus.Completed,
                    AverageSpeedMBps = 22.4,
                    PeakSpeedMBps = 35.8,
                    DownloadDurationSeconds = 19.1,
                    ValidationStatus = "Passed",
                    ValidationDetails = "Validated OK: 428,901,234 bytes, Duration: 2340.0s, Video: H.264 (1920x1080), Audio: AAC",
                    ProbedDurationSeconds = 2340.0,
                    AudioVideoDetails = "Video: H.264 (1920x1080) • Audio: AAC • Container: MP4",
                    AppVersion = "SaveZonix v2.5.0",
                    SystemVersion = ".NET 10.0 Windows",
                    CreatedAt = DateTime.UtcNow.AddHours(-4),
                    CompletionTime = DateTime.UtcNow.AddHours(-4).AddSeconds(20)
                },
                new DownloadHistory
                {
                    Id = "dl_" + Guid.NewGuid().ToString("N")[..12],
                    UserId = hadiDbUser?.Id,
                    UserEmail = hadiDbUser?.Email,
                    UserName = hadiDbUser?.FullName,
                    OriginalUrl = "https://www.youtube.com/watch?v=0jwO-6ap2Wc&list=RD0jwO-6ap2Wc&start_radio=1",
                    Title = "SAJNA VE SAJNA (Flip): Shehnaaz Gill | Sunidhi Chauhan, Divya Kumar",
                    FileName = "SAJNA_VE_SAJNA_Shehnaaz_Gill.mp4",
                    ThumbnailUrl = "https://i.ytimg.com/vi/0jwO-6ap2Wc/hqdefault.jpg",
                    Platform = "YouTube",
                    MediaType = "Video",
                    Format = "MP4",
                    Quality = "1080p Full HD",
                    Codec = "AVC1 / AAC",
                    DurationSeconds = 195,
                    FileSize = 98745210,
                    DownloadedBytes = 98745210,
                    ThreadsUsed = 32,
                    Status = DownloadStatus.Completed,
                    AverageSpeedMBps = 25.6,
                    PeakSpeedMBps = 41.2,
                    DownloadDurationSeconds = 3.8,
                    ValidationStatus = "Passed",
                    ValidationDetails = "Validated OK: 98,745,210 bytes, Duration: 195.0s, Video: H.264 (1920x1080), Audio: AAC",
                    ProbedDurationSeconds = 195.0,
                    AudioVideoDetails = "Video: H.264 (1920x1080) • Audio: AAC • Container: MP4",
                    AppVersion = "SaveZonix v2.5.0",
                    SystemVersion = ".NET 10.0 Windows",
                    CreatedAt = DateTime.UtcNow.AddHours(-2),
                    CompletionTime = DateTime.UtcNow.AddHours(-2).AddSeconds(4)
                },
                new DownloadHistory
                {
                    Id = "dl_" + Guid.NewGuid().ToString("N")[..12],
                    UserId = dilshadDbUser?.Id,
                    UserEmail = dilshadDbUser?.Email,
                    UserName = dilshadDbUser?.FullName,
                    OriginalUrl = "https://www.youtube.com/watch?v=zfjYUqfx8_Y&list=RD0jwO-6ap2Wc&index=2",
                    Title = "Psycho Saiyaan: Saaho | Prabhas, Shraddha Kapoor | Dhvani Bhanushali",
                    FileName = "Psycho_Saiyaan_Saaho.mp4",
                    ThumbnailUrl = "https://i.ytimg.com/vi/zfjYUqfx8_Y/hqdefault.jpg",
                    Platform = "YouTube",
                    MediaType = "Video",
                    Format = "MP4",
                    Quality = "1080p Full HD",
                    Codec = "AVC1 / AAC",
                    DurationSeconds = 168,
                    FileSize = 89456123,
                    DownloadedBytes = 89456123,
                    ThreadsUsed = 32,
                    Status = DownloadStatus.Completed,
                    AverageSpeedMBps = 28.3,
                    PeakSpeedMBps = 44.5,
                    DownloadDurationSeconds = 3.1,
                    ValidationStatus = "Passed",
                    ValidationDetails = "Validated OK: 89,456,123 bytes, Duration: 168.0s, Video: H.264 (1920x1080), Audio: AAC",
                    ProbedDurationSeconds = 168.0,
                    AudioVideoDetails = "Video: H.264 (1920x1080) • Audio: AAC • Container: MP4",
                    AppVersion = "SaveZonix v2.5.0",
                    SystemVersion = ".NET 10.0 Windows",
                    CreatedAt = DateTime.UtcNow.AddHours(-1),
                    CompletionTime = DateTime.UtcNow.AddHours(-1).AddSeconds(4)
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
