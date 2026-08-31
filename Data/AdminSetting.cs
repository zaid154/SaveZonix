using System;
using System.ComponentModel.DataAnnotations;

namespace StreamHelper.Data;

public class AdminSetting
{
    [Key]
    [MaxLength(64)]
    public string Key { get; set; } = string.Empty;

    [Required]
    public string Value { get; set; } = string.Empty;

    [MaxLength(256)]
    public string? Description { get; set; }

    [MaxLength(64)]
    public string Category { get; set; } = "General";

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
