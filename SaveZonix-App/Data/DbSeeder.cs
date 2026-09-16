using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;
using MongoDB.Driver;
using SaveZonix.Models;
using SaveZonix.Services;
using StreamHelper.Services;

namespace StreamHelper.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider serviceProvider, IConfiguration config, bool forceReset = false)
    {
        using var scope = serviceProvider.CreateScope();
        var mongoDb = scope.ServiceProvider.GetService<IMongoDatabase>();
        var settingsService = scope.ServiceProvider.GetService<IAdminSettingsService>();
        var analyticsService = scope.ServiceProvider.GetService<IDownloadAnalyticsService>();

        if (mongoDb == null)
        {
            Console.WriteLine("[Database Seeder] MongoDB is not configured or unavailable. Skipping cloud seed.");
            return;
        }

        try
        {
            var usersColl = mongoDb.GetCollection<BsonDocument>("users");
            var historyColl = mongoDb.GetCollection<BsonDocument>("downloadhistories");
            var adminSettingsColl = mongoDb.GetCollection<AdminSetting>("adminsettings");

            // 1. Ensure Essential Indexes on MongoDB Collections
            try
            {
                var userIndexKeys = Builders<BsonDocument>.IndexKeys.Ascending("email");
                await usersColl.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(userIndexKeys, new CreateIndexOptions { Background = true }));

                var taskIdIndexKeys = Builders<BsonDocument>.IndexKeys.Ascending("taskId");
                await historyColl.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(taskIdIndexKeys, new CreateIndexOptions { Background = true }));

                var createdAtIndexKeys = Builders<BsonDocument>.IndexKeys.Descending("createdAt");
                await historyColl.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(createdAtIndexKeys, new CreateIndexOptions { Background = true }));
            }
            catch { }

            // 2. Default System Settings
            var defaultSettings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "RegistrationEnabled", "true" },
                { "EmailVerificationRequired", "false" },
                { "GoogleLoginEnabled", "true" },
                { "DefaultThreads", "64" },
                { "MaxThreads", "256" },
                { "MaintenanceMode", "false" },
                { "DatabaseProvider", "MongoDB" },
                { "MaxConcurrentDownloadsPerUser", "5" }
            };

            if (settingsService != null)
            {
                foreach (var kvp in defaultSettings)
                {
                    string current = await settingsService.GetSettingAsync(kvp.Key);
                    if (string.IsNullOrEmpty(current))
                    {
                        await settingsService.UpdateSettingAsync(kvp.Key, kvp.Value);
                    }
                }
            }

            // 3. Seed Super Admin (zaidm1323@gmail.com)
            string adminEmail = "zaidm1323@gmail.com";
            string adminPassword = "Zaid@SaveZonix#2026!";
            string adminName = "Zaid Khan";
            string adminHash = BCrypt.Net.BCrypt.HashPassword(adminPassword);

            var adminFilter = Builders<BsonDocument>.Filter.Or(
                Builders<BsonDocument>.Filter.Eq("email", adminEmail),
                Builders<BsonDocument>.Filter.Eq("Email", adminEmail)
            );

            var existingAdmin = await usersColl.Find(adminFilter).FirstOrDefaultAsync();
            if (existingAdmin == null)
            {
                var adminDoc = new BsonDocument
                {
                    { "name", adminName },
                    { "FullName", adminName },
                    { "email", adminEmail },
                    { "Email", adminEmail },
                    { "password", adminHash },
                    { "PasswordHash", adminHash },
                    { "role", "Admin" },
                    { "Role", "Admin" },
                    { "isVip", true },
                    { "isActive", true },
                    { "IsActive", true },
                    { "emailConfirmed", true },
                    { "createdAt", DateTime.UtcNow.AddDays(-7) },
                    { "updatedAt", DateTime.UtcNow }
                };
                await usersColl.InsertOneAsync(adminDoc);
                Console.WriteLine($"[Database Seeder] Seeded Master Super Admin: {adminEmail}");
            }
            else
            {
                var update = Builders<BsonDocument>.Update
                    .Set("password", adminHash)
                    .Set("PasswordHash", adminHash)
                    .Set("role", "Admin")
                    .Set("Role", "Admin")
                    .Set("isVip", true)
                    .Set("isActive", true)
                    .Set("IsActive", true)
                    .Set("FullName", adminName)
                    .Set("name", adminName)
                    .Set("updatedAt", DateTime.UtcNow);

                await usersColl.UpdateOneAsync(adminFilter, update);
            }

            // 4. Seed Standard Users (Hadi & Dilshad)
            var usersToSeed = new[]
            {
                new { Email = "hadi@gmail.com", Name = "Hadi", Password = "Hadi@SaveZonix#2026!", IsVip = true },
                new { Email = "dilshad@gmail.com", Name = "Dilshad", Password = "Dilshad@SaveZonix#2026!", IsVip = false }
            };

            foreach (var u in usersToSeed)
            {
                var uFilter = Builders<BsonDocument>.Filter.Or(
                    Builders<BsonDocument>.Filter.Eq("email", u.Email),
                    Builders<BsonDocument>.Filter.Eq("Email", u.Email)
                );

                var existing = await usersColl.Find(uFilter).FirstOrDefaultAsync();
                string hash = BCrypt.Net.BCrypt.HashPassword(u.Password);

                if (existing == null)
                {
                    var uDoc = new BsonDocument
                    {
                        { "name", u.Name },
                        { "FullName", u.Name },
                        { "email", u.Email },
                        { "Email", u.Email },
                        { "password", hash },
                        { "PasswordHash", hash },
                        { "role", "User" },
                        { "Role", "User" },
                        { "isVip", u.IsVip },
                        { "isActive", true },
                        { "IsActive", true },
                        { "emailConfirmed", true },
                        { "createdAt", DateTime.UtcNow.AddDays(-3) },
                        { "updatedAt", DateTime.UtcNow }
                    };
                    await usersColl.InsertOneAsync(uDoc);
                    Console.WriteLine($"[Database Seeder] Seeded User Account: {u.Email}");
                }
            }

            // 5. Initialize MongoDbAnalyticsService collections if active
            if (analyticsService != null)
            {
                await analyticsService.SeedInitialCollectionsAsync();
            }

            Console.WriteLine("[Database Seeder] MongoDB Cloud Data Seeder executed successfully.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database Seeder Notice] {ex.Message}");
        }
    }
}
