using System;
using System.Collections.Generic;
using StreamHelper.Data;

namespace StreamHelper.ViewModels;

public class AdminDashboardViewModel
{
    public int TotalUsers { get; set; }
    public int ActiveUsers { get; set; }
    public int VerifiedUsers { get; set; }
    public int NewUsersToday { get; set; }
    public int TotalDownloads { get; set; }
    public int CompletedDownloads { get; set; }
    public int FailedDownloads { get; set; }
    public long TotalDownloadedBytes { get; set; }
    public double AverageDownloadSpeedMBps { get; set; }
    public List<DownloadHistory> RecentDownloads { get; set; } = new();
    public Dictionary<string, int> TopPlatforms { get; set; } = new();

    public string FormattedTotalSize
    {
        get
        {
            if (TotalDownloadedBytes <= 0) return "0 MB";
            double mb = TotalDownloadedBytes / (1024.0 * 1024.0);
            return mb >= 1024
                ? string.Format("{0:F2} GB", mb / 1024.0)
                : string.Format("{0:F1} MB", mb);
        }
    }
}

public class AdminUsersViewModel
{
    public List<UserItemViewModel> Users { get; set; } = new();
    public string? SearchTerm { get; set; }
    public string? StatusFilter { get; set; }
    public int CurrentPage { get; set; } = 1;
    public int TotalPages { get; set; } = 1;
    public int TotalCount { get; set; } = 0;
    public int PageSize { get; set; } = 20;
}

public class UserItemViewModel
{
    public string Id { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool EmailConfirmed { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public IList<string> Roles { get; set; } = new List<string>();
    public int DownloadCount { get; set; }
}

public class AdminUserDetailsViewModel
{
    public AppUser User { get; set; } = null!;
    public IList<string> Roles { get; set; } = new List<string>();
    public List<DownloadHistory> RecentDownloads { get; set; } = new();
    public int TotalDownloads { get; set; }
    public int CompletedDownloads { get; set; }
    public long TotalDownloadedBytes { get; set; }
}

public class AdminDownloadsViewModel
{
    public List<DownloadHistory> Downloads { get; set; } = new();
    public string? SearchTerm { get; set; }
    public string? StatusFilter { get; set; }
    public string? PlatformFilter { get; set; }
    public string? UserFilter { get; set; }
    public int CurrentPage { get; set; } = 1;
    public int TotalPages { get; set; } = 1;
    public int TotalCount { get; set; } = 0;
    public int PageSize { get; set; } = 20;
}

public class AdminSettingsViewModel
{
    public Dictionary<string, string> Settings { get; set; } = new();
    public string? SuccessMessage { get; set; }
    public string? ErrorMessage { get; set; }
}
