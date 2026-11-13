using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SaveZonix.Data;
using SaveZonix.Services;
using StreamHelper.Data;
using Xunit;

namespace SaveZonix.Tests;

public class SqlitePersistenceTests
{
    [Fact]
    public async Task SqliteHistoryService_PerformsFullLifecycle_Successfully()
    {
        string testDbPath = Path.Combine(Path.GetTempPath(), $"savezonix_test_{Guid.NewGuid():N}.db");

        var services = new ServiceCollection();
        services.AddDbContext<SaveZonixDbContext>(options =>
        {
            options.UseSqlite($"Data Source={testDbPath}");
        });
        services.AddScoped<SqliteDownloadHistoryService>();

        var provider = services.BuildServiceProvider();

        try
        {
            // Initialize Database
            using (var scope = provider.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<SaveZonixDbContext>();
                await db.Database.EnsureCreatedAsync();
            }

            var service = new SqliteDownloadHistoryService(provider);
            string taskId = "test_task_" + Guid.NewGuid().ToString("N");

            // 1. Create task
            var record = await service.CreateOrUpdateDownloadAsync(
                taskId, "user_123", "tester@savezonix.com", "Tester",
                "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                "Big Buck Bunny Sample", "BigBuckBunny.mp4", null,
                "Web Stream", "Video", "MP4", "1080p", "H.264",
                600, 10485760, 16, "Turbo Range");

            Assert.NotNull(record);
            Assert.Equal(taskId, record.Id);
            Assert.Equal(DownloadStatus.Downloading, record.Status);

            // 2. Update progress
            await service.UpdateProgressAsync(taskId, DownloadStatus.Downloading, 5242880, 18.5, 24.2, 0.5);
            var updated = await service.GetDownloadByIdAsync(taskId);
            Assert.NotNull(updated);
            Assert.Equal(5242880, updated.DownloadedBytes);
            Assert.Equal(18.5, updated.AverageSpeedMBps);

            // 3. Save chunks for pause / resume
            await service.SaveChunkProgressAsync(taskId, 0, 0, 2097151, 2097152, true, "chunk_000000.part");
            await service.SaveChunkProgressAsync(taskId, 1, 2097152, 4194303, 1048576, false, "chunk_000001.part");

            var chunks = await service.GetChunkRecordsAsync(taskId);
            Assert.Equal(2, chunks.Count);
            Assert.True(chunks[0].IsCompleted);
            Assert.False(chunks[1].IsCompleted);
            Assert.Equal(1048576, chunks[1].BytesWritten);

            // 4. Mark completed
            await service.MarkCompletedAsync(taskId, 10485760, 22.0, 28.5, 1.2);
            var completed = await service.GetDownloadByIdAsync(taskId);
            Assert.NotNull(completed);
            Assert.Equal(DownloadStatus.Completed, completed.Status);
            Assert.Equal(10485760, completed.FileSize);
        }
        finally
        {
            try { if (File.Exists(testDbPath)) File.Delete(testDbPath); } catch { }
        }
    }
}
