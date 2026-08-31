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
