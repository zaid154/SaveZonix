using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Identity;

namespace StreamHelper.Data;

public class AppUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    public bool IsActive { get; set; } = true;
    public string? ProfileImageUrl { get; set; }

    public virtual ICollection<DownloadHistory> Downloads { get; set; } = new List<DownloadHistory>();
}
