using System.Net;
using System.Text.RegularExpressions;

namespace Zonix.Core;

public class M3U8Parser
{
    private readonly HttpClient _httpClient;

    public M3U8Parser(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<(bool IsMaster, List<StreamQuality> Qualities, List<string> SegmentUrls)> ParseAsync(string url)
    {
        var (content, finalUri) = await FetchPlaylistContentAsync(url);

        // If HTML webpage detected, sniff inner stream
        if (content.Contains("<!DOCTYPE html", StringComparison.OrdinalIgnoreCase) || 
            content.Contains("<html", StringComparison.OrdinalIgnoreCase) ||
            content.Contains("<head", StringComparison.OrdinalIgnoreCase))
        {
            var detectedStreamUrl = ExtractStreamFromHtml(content, finalUri);
            if (!string.IsNullOrEmpty(detectedStreamUrl))
            {
                return await ParseAsync(detectedStreamUrl);
            }
            else
            {
                throw new Exception("Webpage URL detected, but could not auto-extract the hidden video stream.");
            }
        }

        if (content.Contains("#EXT-X-STREAM-INF"))
        {
            var qualities = ParseMasterPlaylist(content, finalUri);
            return (true, qualities, new List<string>());
        }
        else
        {
            var segments = ParseMediaPlaylist(content, finalUri);
            return (false, new List<StreamQuality>(), segments);
        }
    }

    private async Task<(string Content, Uri FinalUri)> FetchPlaylistContentAsync(string url)
    {
        var targetUri = new Uri(url);

        // Try exact URL first (respecting relay/proxies), then try variations with browser-like headers
        var attempts = new List<Action<HttpRequestMessage>>
        {
            req => {
                req.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                req.Headers.Add("Accept", "*/*");
                req.Headers.Add("Referer", "https://pixelflix.cc/");
                req.Headers.Add("Origin", "https://pixelflix.cc");
            },
            req => {
                req.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                req.Headers.Add("Accept", "*/*");
                req.Headers.Add("Referer", $"{targetUri.Scheme}://{targetUri.Host}/");
            },
            req => {
                req.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                req.Headers.Add("Accept", "*/*");
            }
        };

        foreach (var configure in attempts)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                configure(request);

                using var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync();
                    if (!string.IsNullOrWhiteSpace(body))
                    {
                        return (body, response.RequestMessage?.RequestUri ?? targetUri);
                    }
                }
            }
            catch { }
        }

        // If direct attempts failed and it has a nested url=, try the raw relay as fallback
        using var finalReq = new HttpRequestMessage(HttpMethod.Get, url);
        finalReq.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
        using var finalRes = await _httpClient.SendAsync(finalReq);
        finalRes.EnsureSuccessStatusCode();

        var content = await finalRes.Content.ReadAsStringAsync();
        return (content, finalRes.RequestMessage?.RequestUri ?? targetUri);
    }

    private string? ExtractStreamFromHtml(string html, Uri baseUri)
    {
        string cleanedHtml = html.Replace("\\/", "/");

        var match = Regex.Match(cleanedHtml, @"(https?://[^\s""'<>]+\.m3u8[^\s""'<>]*)", RegexOptions.IgnoreCase);
        if (match.Success)
        {
            return match.Groups[1].Value;
        }

        var relativeMatch = Regex.Match(cleanedHtml, @"[""'](/[^""'\s<>]+\.m3u8[^""'\s<>]*)[""']", RegexOptions.IgnoreCase);
        if (relativeMatch.Success)
        {
            return ResolveUrl(baseUri, relativeMatch.Groups[1].Value);
        }

        var sourceMatch = Regex.Match(cleanedHtml, @"<source[^>]+src=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (sourceMatch.Success)
        {
            return ResolveUrl(baseUri, sourceMatch.Groups[1].Value);
        }

        return null;
    }

    private List<StreamQuality> ParseMasterPlaylist(string content, Uri baseUri)
    {
        var qualities = new List<StreamQuality>();
        var lines = content.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (line.StartsWith("#EXT-X-STREAM-INF"))
            {
                var quality = new StreamQuality();

                var bwMatch = Regex.Match(line, @"BANDWIDTH=(\d+)");
                if (bwMatch.Success && long.TryParse(bwMatch.Groups[1].Value, out var bw))
                {
                    quality.Bandwidth = bw;
                }

                var resMatch = Regex.Match(line, @"RESOLUTION=(\d+x\d+)");
                if (resMatch.Success)
                {
                    quality.Resolution = resMatch.Groups[1].Value;
                }

                var codecsMatch = Regex.Match(line, @"CODECS=""([^""]+)""");
                if (codecsMatch.Success)
                {
                    quality.Codecs = codecsMatch.Groups[1].Value;
                }

                for (int j = i + 1; j < lines.Length; j++)
                {
                    var nextLine = lines[j].Trim();
                    if (!string.IsNullOrEmpty(nextLine) && !nextLine.StartsWith("#"))
                    {
                        quality.Url = ResolveUrl(baseUri, nextLine);
                        qualities.Add(quality);
                        i = j;
                        break;
                    }
                }
            }
        }

        return qualities.OrderByDescending(q => q.Bandwidth).ToList();
    }

    private List<string> ParseMediaPlaylist(string content, Uri baseUri)
    {
        var segments = new List<string>();
        var lines = content.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (trimmed.StartsWith("#EXT-X-MAP"))
            {
                var uriMatch = Regex.Match(trimmed, @"URI=""([^""]+)""");
                if (uriMatch.Success)
                {
                    segments.Add(ResolveUrl(baseUri, uriMatch.Groups[1].Value));
                }
            }
        }

        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (line.StartsWith("#EXTINF"))
            {
                for (int j = i + 1; j < lines.Length; j++)
                {
                    var nextLine = lines[j].Trim();
                    if (!string.IsNullOrEmpty(nextLine) && !nextLine.StartsWith("#"))
                    {
                        segments.Add(ResolveUrl(baseUri, nextLine));
                        i = j;
                        break;
                    }
                }
            }
            else if (!line.StartsWith("#") && (line.EndsWith(".ts") || line.EndsWith(".m4s") || line.Contains(".ts?") || line.Contains(".m4s?")))
            {
                segments.Add(ResolveUrl(baseUri, line));
            }
        }

        return segments.Distinct().ToList();
    }

    private static string ResolveUrl(Uri baseUri, string relativeOrAbsolute)
    {
        if (Uri.TryCreate(relativeOrAbsolute, UriKind.Absolute, out var absUri))
        {
            return absUri.ToString();
        }

        return new Uri(baseUri, relativeOrAbsolute).ToString();
    }
}
