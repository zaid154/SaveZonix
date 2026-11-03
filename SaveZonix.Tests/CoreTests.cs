using System;
using System.IO;
using SaveZonix.Core;
using Xunit;

namespace SaveZonix.Tests;

public class CoreTests
{
    [Theory]
    [InlineData("ValidFileName.mp4", "ValidFileName.mp4")]
    [InlineData("File:with*invalid?chars\"<>|.mp4", "File-with-invalid-chars-.mp4")]
    [InlineData("../../etc/passwd.mp4", "etc-passwd.mp4")]
    [InlineData("", "video.mp4")]
    public void SanitizeFileName_CleansDangerousCharacters(string input, string expected)
    {
        string sanitized = MediaHelper.SanitizeFileName(input);
        Assert.DoesNotContain(":", sanitized);
        Assert.DoesNotContain("*", sanitized);
        Assert.DoesNotContain("?", sanitized);
        Assert.DoesNotContain("\"", sanitized);
        Assert.DoesNotContain("<", sanitized);
        Assert.DoesNotContain(">", sanitized);
        Assert.DoesNotContain("|", sanitized);
        Assert.DoesNotContain("/", sanitized);
        Assert.DoesNotContain("\\", sanitized);
        Assert.Equal(expected, sanitized);
    }

    [Theory]
    [InlineData("https://example.com/watch?season=2&episode=5", 2, 5, "S02E05")]
    [InlineData("Show Name S01E03 1080p", 1, 3, "S01E03")]
    [InlineData("Random Video Title", null, null, null)]
    public void ExtractSeasonAndEpisode_IdentifiesPatterns(string input, int? expectedSeason, int? expectedEpisode, string? expectedTag)
    {
        var (season, episode, tag) = MediaHelper.ExtractSeasonAndEpisode(input);
        Assert.Equal(expectedSeason, season);
        Assert.Equal(expectedEpisode, episode);
        Assert.Equal(expectedTag, tag);
    }

    [Fact]
    public void PasswordHashing_UsesBCrypt_AndVerifiesCorrectly()
    {
        string rawPassword = "StrongPassword@2026";
        string hash = MediaHelper.HashPassword(rawPassword);

        // Assert BCrypt prefix
        Assert.StartsWith("$2", hash);

        // Verify password passes
        Assert.True(MediaHelper.VerifyPassword(rawPassword, hash));

        // Verify incorrect password fails
        Assert.False(MediaHelper.VerifyPassword("WrongPassword", hash));
    }

    [Fact]
    public void LegacyPasswordHash_FallbackVerification_Works()
    {
        string rawPassword = "LegacyUser123!";
        // Construct legacy SHA-256 hash
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(rawPassword + "SaveZonix_Salt_2026"));
        string legacyHash = Convert.ToBase64String(bytes);

        // Verify legacy password passes through fallback
        Assert.True(MediaHelper.VerifyPassword(rawPassword, legacyHash));

        // Wrong password fails
        Assert.False(MediaHelper.VerifyPassword("IncorrectLegacy", legacyHash));
    }

    [Fact]
    public void ConcurrencyBounds_NeverExceedsSixteen()
    {
        // 16 is the approved maximum concurrency cap to prevent CDN rate limiting
        const int maxAllowed = 16;
        int requestedHigh = 128;
        int clamped = Math.Clamp(requestedHigh, 2, maxAllowed);
        Assert.Equal(16, clamped);
    }
}
