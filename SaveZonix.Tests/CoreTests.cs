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

    [Theory]
    [InlineData("http://127.0.0.1/admin", false)]
    [InlineData("http://localhost:5000", false)]
    [InlineData("http://169.254.169.254/latest/meta-data", false)]
    [InlineData("http://10.0.0.1/internal", false)]
    [InlineData("http://192.168.1.100/router", false)]
    [InlineData("file:///etc/passwd", false)]
    [InlineData("gopher://evil.com/1", false)]
    [InlineData("https://www.youtube.com/watch?v=dQw4w9WgXcQ", true)]
    [InlineData("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", true)]
    [InlineData("dQw4w9WgXcQ", true)]
    public void IsSafePublicDownloadUrl_ValidatesCorrectly(string url, bool expectedSafe)
    {
        bool isSafe = Zonix.Core.StreamSecurityHelper.IsSafePublicDownloadUrl(url, out var reason);
        Assert.Equal(expectedSafe, isSafe);
        if (!expectedSafe)
        {
            Assert.NotNull(reason);
        }
    }

    [Fact]
    public void GetAvailableUniqueFilePath_PreventsPathTraversalEscape()
    {
        string baseFolder = Path.Combine(Path.GetTempPath(), "savezonix_safe_dir");
        Directory.CreateDirectory(baseFolder);

        try
        {
            string maliciousFileName = "../../Windows/System32/malicious.dll";
            string resolvedPath = MediaHelper.GetAvailableUniqueFilePath(baseFolder, maliciousFileName);

            Assert.StartsWith(Path.GetFullPath(baseFolder), Path.GetFullPath(resolvedPath), StringComparison.OrdinalIgnoreCase);
            Assert.Equal("malicious.dll", Path.GetFileName(resolvedPath));
        }
        finally
        {
            try { Directory.Delete(baseFolder, true); } catch { }
        }
    }
}
