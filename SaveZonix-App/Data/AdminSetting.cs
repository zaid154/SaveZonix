using System;
using MongoDB.Bson.Serialization.Attributes;

namespace StreamHelper.Data;

[BsonIgnoreExtraElements]
public class AdminSetting
{
    [BsonId]
    public string Key { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string Category { get; set; } = "General";

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
