using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using StreamHelper.Data;

namespace StreamHelper.ViewModels;

public class ProfileViewModel
{
    public string Id { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool EmailConfirmed { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public int TotalDownloads { get; set; }
    public int CompletedDownloads { get; set; }
    public long TotalDownloadedBytes { get; set; }

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

public class ChangePasswordViewModel
{
    [Required(ErrorMessage = "Current password is required")]
    [DataType(DataType.Password)]
    [Display(Name = "Current Password")]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "New password is required")]
    [StringLength(100, MinimumLength = 6, ErrorMessage = "New password must be at least 6 characters")]
    [DataType(DataType.Password)]
    [Display(Name = "New Password")]
    public string NewPassword { get; set; } = string.Empty;

    [DataType(DataType.Password)]
    [Display(Name = "Confirm New Password")]
    [Compare("NewPassword", ErrorMessage = "Passwords do not match")]
    public string ConfirmNewPassword { get; set; } = string.Empty;
}

public class UserDownloadsViewModel
{
    public List<DownloadHistory> Downloads { get; set; } = new();
    public string? SearchTerm { get; set; }
    public string? StatusFilter { get; set; }
    public string? PlatformFilter { get; set; }
    public int CurrentPage { get; set; } = 1;
    public int TotalPages { get; set; } = 1;
    public int TotalCount { get; set; } = 0;
    public int PageSize { get; set; } = 15;
}
