using System.Net;
using System.Text.RegularExpressions;

namespace Zonix.Core.Engines;

public record CookieVaultStatus(
    bool HasCookies,
    int CookieCount,
    DateTime? LastUpdated,
    bool HasYouTubeSession,
    string Summary
);

/// <summary>
/// Secure Browser Cookie Vault & Session Synchronizer.
/// Imports cookies from Chrome, Edge, Safari, or Netscape cookies.txt to unlock:
/// - 1080p Premium (high-bitrate streams)
/// - Age-restricted videos
/// - Members-only streams and private/unlisted media
/// - Bypass YouTube anti-bot rate-limiting
/// </summary>
public class CookieVaultEngine
{
    private readonly string _cookieFilePath;
    private readonly CookieContainer _cookieContainer = new();
    private bool _hasCookies = false;
    private DateTime? _lastUpdated = null;
    private int _cookieCount = 0;
    private bool _hasYouTubeSession = false;

    public CookieVaultEngine()
    {
        _cookieFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "cookies.txt");
        LoadExistingCookies();
    }

    public CookieVaultStatus GetStatus()
    {
        return new CookieVaultStatus(
            HasCookies: _hasCookies,
            CookieCount: _cookieCount,
            LastUpdated: _lastUpdated,
            HasYouTubeSession: _hasYouTubeSession,
            Summary: _hasCookies
                ? $"Active ({_cookieCount} cookies stored, YouTube session: {(_hasYouTubeSession ? "Authenticated" : "Guest")})"
                : "No cookies imported. Running in anonymous guest mode."
        );
    }

    public CookieContainer GetContainer() => _cookieContainer;

    public string? GetCookieHeaderForUri(Uri uri)
    {
        if (!_hasCookies) return null;
        try
        {
            var header = _cookieContainer.GetCookieHeader(uri);
            return string.IsNullOrEmpty(header) ? null : header;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Imports Netscape format or JSON format cookies.
    /// </summary>
    public bool ImportCookies(string rawContent)
    {
        if (string.IsNullOrWhiteSpace(rawContent)) return false;

        try
        {
            int count = 0;
            bool ytFound = false;

            // Check if JSON format
            if (rawContent.TrimStart().StartsWith("["))
            {
                count = ParseJsonCookies(rawContent, out ytFound);
            }
            else
            {
                count = ParseNetscapeCookies(rawContent, out ytFound);
            }

            if (count > 0)
            {
                File.WriteAllText(_cookieFilePath, rawContent);
                _hasCookies = true;
                _cookieCount = count;
                _hasYouTubeSession = ytFound;
                _lastUpdated = DateTime.UtcNow;
                CrashGuard.LogMessage($"CookieVault: Successfully imported {count} cookies (YouTube auth: {ytFound}).");
                return true;
            }

            return false;
        }
        catch (Exception ex)
        {
            CrashGuard.LogCrashEvent("CookieVaultEngine.ImportCookies", ex);
            return false;
        }
    }

    public void ClearCookies()
    {
        try
        {
            if (File.Exists(_cookieFilePath)) File.Delete(_cookieFilePath);
            _hasCookies = false;
            _cookieCount = 0;
            _hasYouTubeSession = false;
            _lastUpdated = null;
            CrashGuard.LogMessage("CookieVault: Cookies cleared.");
        }
        catch { }
    }

    private void LoadExistingCookies()
    {
        try
        {
            if (File.Exists(_cookieFilePath))
            {
                string content = File.ReadAllText(_cookieFilePath);
                ImportCookies(content);
            }
        }
        catch { }
    }

    private int ParseNetscapeCookies(string text, out bool ytFound)
    {
        int count = 0;
        ytFound = false;
        var lines = text.Split('\n');

        foreach (var line in lines)
        {
            var l = line.Trim();
            if (string.IsNullOrEmpty(l) || l.StartsWith("#")) continue;

            var parts = l.Split('\t');
            if (parts.Length < 7) continue;

            string domain = parts[0];
            string path = parts[2];
            string name = parts[5];
            string value = parts[6];

            if (domain.Contains("youtube.com")) ytFound = true;

            try
            {
                var cookie = new Cookie(name, value, path, domain.TrimStart('.'));
                _cookieContainer.Add(cookie);
                count++;
            }
            catch { }
        }

        return count;
    }

    private int ParseJsonCookies(string json, out bool ytFound)
    {
        int count = 0;
        ytFound = false;

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var el in doc.RootElement.EnumerateArray())
                {
                    string name = el.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                    string value = el.TryGetProperty("value", out var v) ? v.GetString() ?? "" : "";
                    string domain = el.TryGetProperty("domain", out var d) ? d.GetString() ?? "" : "";
                    string path = el.TryGetProperty("path", out var p) ? p.GetString() ?? "/" : "/";

                    if (!string.IsNullOrEmpty(name) && !string.IsNullOrEmpty(domain))
                    {
                        if (domain.Contains("youtube.com")) ytFound = true;
                        try
                        {
                            var cookie = new Cookie(name, value, path, domain.TrimStart('.'));
                            _cookieContainer.Add(cookie);
                            count++;
                        }
                        catch { }
                    }
                }
            }
        }
        catch { }

        return count;
    }
}
