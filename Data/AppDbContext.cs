using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace StreamHelper.Data;

public class AppDbContext : IdentityDbContext<AppUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<DownloadHistory> DownloadHistories { get; set; } = null!;
    public DbSet<AdminSetting> AdminSettings { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<DownloadHistory>(entity =>
        {
            entity.ToTable("DownloadHistories");
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.Platform);

            entity.HasOne(e => e.User)
                .WithMany(u => u.Downloads)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<AdminSetting>(entity =>
        {
            entity.ToTable("AdminSettings");
            entity.HasKey(e => e.Key);
        });
    }
}
