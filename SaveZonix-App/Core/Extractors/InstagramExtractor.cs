using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Zonix.Core.Extractors;

public class InstagramExtractor : IVideoExtractor
{
    private readonly HttpClient _httpClient;

    public string Name => "Instagram";
    public int Priority => 90;

    public InstagramExtractor(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public bool CanHandle(Uri uri)
    {
        return uri.Host.Contains("instagram.com", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<StreamAnalysisResult> ExtractAsync(string url, int retryCount = 0)
    {
        var targetUri = new Uri(url);
        var result = new StreamAnalysisResult
        {
            Title = "Instagram Video",
            Platform = "Instagram"
        };

        // 1. Try public captioned embed extraction
        var embedResult = await ExtractFromPublicEmbedAsync(targetUri, url, result);
        if (embedResult != null)
        {
            return embedResult;
        }

        // 2. Try official oEmbed API fallback
        var oembedResult = await ExtractFromOEmbedFallbackAsync(url, result);
        if (oembedResult != null)
        {
            return oembedResult;
        }

        // 3. If neither worked, provide browser guidance result
        result.RequiresBrowserContext = true;
        result.StatusMessage = "Instagram protects direct reel streams. Please use the SaveZonix Browser Extension.";
        result.Qualities.Add(new StreamQuality
        {
            Resolution = "1080p Full HD (Instagram Reel)",
            Url = url,
            IsDirectFile = false,
            Bandwidth = 4500000
        });
        return result;
    }

    private async Task<StreamAnalysisResult?> ExtractFromPublicEmbedAsync(Uri targetUri, string originalUrl, StreamAnalysisResult result)
    {
        try
        {
            var parts = targetUri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            int mediaIndex = Array.FindIndex(parts, p =>
                p.Equals("reel", StringComparison.OrdinalIgnoreCase) ||
                p.Equals("reels", StringComparison.OrdinalIgnoreCase) ||
                p.Equals("p", StringComparison.OrdinalIgnoreCase));

            if (mediaIndex < 0 || mediaIndex + 1 >= parts.Length) return null;

            string shortcode = parts[mediaIndex + 1];
            if (string.IsNullOrWhiteSpace(shortcode)) return null;

            string embedUrl = $"https://www.instagram.com/reel/{Uri.EscapeDataString(shortcode)}/embed/captioned/";
            using var req = new HttpRequestMessage(HttpMethod.Get, embedUrl);
            req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
            req.Headers.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");

            using var resp = await _httpClient.SendAsync(req);
            if (!resp.IsSuccessStatusCode) return null;

            string embedHtml = await resp.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(embedHtml)) return null;

            return ExtractVideoFromHtml(originalUrl, embedHtml, result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Instagram Extractor] Public embed extraction failed: {ex.Message}");
            return null;
        }
    }

    private StreamAnalysisResult? ExtractVideoFromHtml(string url, string htmlContent, StreamAnalysisResult result)
    {
        try
        {
            // Try __NEXT_DATA__
            var nextDataMatch = Regex.Match(htmlContent, @"<script\s+id=[""']__NEXT_DATA__[""'][^>]*>([^<]+)</script>", RegexOptions.IgnoreCase);
            if (nextDataMatch.Success)
            {
                try
                {
                    using var doc = JsonDocument.Parse(nextDataMatch.Groups[1].Value);
                    var videoUrl = ExtractVideoUrlFromJson(doc.RootElement);
                    if (!string.IsNullOrEmpty(videoUrl))
                    {
                        result.Title = ExtractTitle(htmlContent) ?? "Instagram Video";
                        result.Platform = "Instagram";
                        result.IsDirectMediaFile = true;
                        result.Qualities.Add(new StreamQuality
                        {
                            Resolution = "1080p Full HD",
                            Url = videoUrl,
                            IsDirectFile = true,
                            Bandwidth = 4500000
                        });
                        return result;
                    }
                }
                catch { }
            }

            // Try meta og:video
            var ogVideoMatch = Regex.Match(htmlContent, @"<meta\s+property=[""']og:video[""']\s+content=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
            if (ogVideoMatch.Success)
            {
                string videoUrl = ogVideoMatch.Groups[1].Value;
                if (!string.IsNullOrEmpty(videoUrl) && (videoUrl.Contains(".mp4") || videoUrl.Contains("video")))
                {
                    result.Title = ExtractTitle(htmlContent) ?? "Instagram Video";
                    result.Platform = "Instagram";
                    result.IsDirectMediaFile = true;
                    result.Qualities.Add(new StreamQuality
                    {
                        Resolution = "1080p Full HD",
                        Url = videoUrl,
                        IsDirectFile = true,
                        Bandwidth = 4500000
                    });
                    return result;
                }
            }

            // Try embedded video_url regex
            var embeddedVideoMatch = Regex.Match(
                htmlContent,
                @"\\?[\x22']video_url\\?[\x22']\s*:\s*\\?[\x22']([^\x22']+)[\x22']|\\?[\x22']video_versions\\?[\x22'][^\]]*?\\?[\x22']url\\?[\x22']\s*:\s*\\?[\x22']([^\x22']+)[\x22']",
                RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (embeddedVideoMatch.Success)
            {
                string videoUrl = embeddedVideoMatch.Groups[1].Success
                    ? embeddedVideoMatch.Groups[1].Value
                    : embeddedVideoMatch.Groups[2].Value;
                videoUrl = NormalizeUrl(videoUrl);

                if (Uri.TryCreate(videoUrl, UriKind.Absolute, out var parsedUri) &&
                    (parsedUri.Scheme == Uri.UriSchemeHttp || parsedUri.Scheme == Uri.UriSchemeHttps))
                {
                    result.Title = ExtractTitle(htmlContent) ?? "Instagram Video";
                    result.Platform = "Instagram";
                    result.IsDirectMediaFile = true;
                    result.Qualities.Add(new StreamQuality
                    {
                        Resolution = "1080p Full HD",
                        Url = videoUrl,
                        IsDirectFile = true,
                        Bandwidth = 4500000
                    });
                    return result;
                }
            }
        }
        catch { }

        return null;
    }

    private async Task<StreamAnalysisResult?> ExtractFromOEmbedFallbackAsync(string originalUrl, StreamAnalysisResult result)
    {
        try
        {
            Console.WriteLine("[Instagram Extractor] Using Instagram oEmbed fallback method...");
            string normalizedUrl = Regex.Replace(originalUrl, @"/reels/", "/reel/", RegexOptions.IgnoreCase);
            string oembedUrl = $"https://www.instagram.com/api/v1/oembed/?url={Uri.EscapeDataString(normalizedUrl)}";

            using var req = new HttpRequestMessage(HttpMethod.Get, oembedUrl);
            req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");

            using var resp = await _httpClient.SendAsync(req);
            Console.WriteLine($"[Instagram Extractor] oEmbed status: {resp.StatusCode}");
            if (resp.IsSuccessStatusCode)
            {
                var oembedJson = await resp.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(oembedJson);

                if (doc.RootElement.TryGetProperty("title", out var titleProp))
                {
                    string t = titleProp.GetString() ?? string.Empty;
                    if (!string.IsNullOrWhiteSpace(t))
                    {
                        result.Title = t.Length > 100 ? t.Substring(0, 100) + "..." : t;
                    }
                }
                if (doc.RootElement.TryGetProperty("author_name", out var authorProp))
                {
                    result.Platform = $"Instagram • {authorProp.GetString()}";
                }
                if (doc.RootElement.TryGetProperty("thumbnail_url", out var thumbProp))
                {
                    result.ThumbnailUrl = thumbProp.GetString() ?? result.ThumbnailUrl;
                }

                result.Qualities.Add(new StreamQuality
                {
                    Resolution = "1080p Full HD (Instagram Reel)",
                    Url = originalUrl,
                    IsDirectFile = false,
                    Bandwidth = 4500000
                });

                result.RequiresBrowserContext = true;
                result.StatusMessage = "Instagram protects direct reel streams. Click Download or use the SaveZonix Browser Extension.";
                Console.WriteLine("[Instagram Extractor] oEmbed metadata fallback succeeded.");
                return result;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Instagram Extractor] oEmbed fallback error: {ex.Message}");
        }

        return null;
    }

    private static string NormalizeUrl(string value)
    {
        string url = WebUtility.HtmlDecode(value);
        for (int i = 0; i < 3; i++)
        {
            url = url
                .Replace("\\\\/", "/", StringComparison.Ordinal)
                .Replace("\\/", "/", StringComparison.Ordinal)
                .Replace("\\u0026", "&", StringComparison.OrdinalIgnoreCase)
                .Replace("\\u0025", "%", StringComparison.OrdinalIgnoreCase)
                .Replace("&amp;", "&", StringComparison.OrdinalIgnoreCase);
        }
        return url.Trim();
    }

    private static string? ExtractVideoUrlFromJson(JsonElement element)
    {
        try
        {
            if (element.TryGetProperty("video_url", out var videoUrl) && videoUrl.ValueKind == JsonValueKind.String)
            {
                string url = videoUrl.GetString() ?? string.Empty;
                if (!string.IsNullOrEmpty(url) && (url.StartsWith("http") || url.StartsWith("//")))
                {
                    return url.StartsWith("//") ? $"https:{url}" : url;
                }
            }

            if (element.TryGetProperty("video", out var video) && video.ValueKind == JsonValueKind.Object)
            {
                return ExtractVideoUrlFromJson(video);
            }

            if (element.TryGetProperty("media", out var media) && media.ValueKind == JsonValueKind.Object)
            {
                return ExtractVideoUrlFromJson(media);
            }

            if (element.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in element.EnumerateObject())
                {
                    if (prop.Name.Contains("video", StringComparison.OrdinalIgnoreCase) && prop.Value.ValueKind == JsonValueKind.String)
                    {
                        string url = prop.Value.GetString() ?? string.Empty;
                        if (!string.IsNullOrEmpty(url) && url.StartsWith("http"))
                        {
                            return url;
                        }
                    }

                    if (prop.Value.ValueKind == JsonValueKind.Object)
                    {
                        var result = ExtractVideoUrlFromJson(prop.Value);
                        if (!string.IsNullOrEmpty(result))
                        {
                            return result;
                        }
                    }
                }
            }
        }
        catch { }

        return null;
    }

    private static string? ExtractTitle(string html)
    {
        var titleMatch = Regex.Match(html, @"<meta\s+property=[""']og:title[""']\s+content=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (titleMatch.Success) return titleMatch.Groups[1].Value;

        var descMatch = Regex.Match(html, @"<meta\s+property=[""']og:description[""']\s+content=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (descMatch.Success) return descMatch.Groups[1].Value;

        return null;
    }
}
