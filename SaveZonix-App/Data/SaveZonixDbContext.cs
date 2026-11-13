using System;
using System.IO;
using Microsoft.EntityFrameworkCore;
using StreamHelper.Data;

namespace SaveZonix.Data;

public class SaveZonixDbContext : DbContext
{
    public DbSet<DownloadHistory> Downloads { get; set; } = null!;
    public DbSet<DownloadChunkRecord> Chunks { get; set; } = null!;
    public DbSet<MediaConversionTask> Conversions { get; set; } = null!;
    public DbSet<AdminSetting> AdminSettings { get; set; } = null!;
    public DbSet<AuditLog> AuditLogs { get; set; } = null!;

    public SaveZonixDbContext(DbContextOptions<SaveZonixDbContext> options) : base(options)
    {
    }

    public static string GetDatabasePath()
    {
        string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SaveZonix");
        if (!Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }
        return Path.Combine(dir, "savezonix.db");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<DownloadHistory>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.OriginalUrl);
        });

        modelBuilder.Entity<DownloadChunkRecord>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.TaskId, e.ChunkIndex }).IsUnique();
        });

        modelBuilder.Entity<MediaConversionTask>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
        });

        modelBuilder.Entity<AdminSetting>(entity =>
        {
            entity.HasKey(e => e.Key);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => e.Action);
        });
    }
}
