using System;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Zonix.Core;

namespace Zonix.Controllers;

public class CinemaController : Controller
{
    private static readonly HttpClient _httpClient;

    static CinemaController()
    {
        var handler = new SocketsHttpHandler
        {
            SslOptions = new System.Net.Security.SslClientAuthenticationOptions
            {
                RemoteCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) => true,
                EnabledSslProtocols = System.Security.Authentication.SslProtocols.Tls12 | System.Security.Authentication.SslProtocols.Tls13
            },
            AutomaticDecompression = DecompressionMethods.All,
            UseCookies = false,
            MaxConnectionsPerServer = 500,
            EnableMultipleHttp2Connections = true,
            PooledConnectionLifetime = TimeSpan.FromMinutes(5)
        };

        _httpClient = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(15)
        };
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
        _httpClient.DefaultRequestHeaders.Add("Accept", "*/*");
    }

    [HttpGet("/cinema")]
    public async Task<IActionResult> Index(
        [FromQuery] string? url,
        [FromQuery] string? title,
        [FromQuery] string? poster,
        [FromQuery] string? quality,
        [FromQuery] string? site)
    {
        ViewData["Title"] = "CleanStream Cinema — Ad-Free Player";
        ViewData["ActiveNav"] = "Cinema";

        var rawUrl = url?.Trim() ?? "";
        var streamUrl = rawUrl;
        var streamType = "unknown";
        var videoTitle = title?.Trim() ?? "";
        var posterUrl = poster?.Trim() ?? "";
        var sourceSite = site?.Trim() ?? "";
        var currentQuality = string.IsNullOrWhiteSpace(quality) || quality.Equals("1080p", StringComparison.OrdinalIgnoreCase)
            ? "Best Available (4K / HD)"
            : quality.Trim();

        bool hasPlaylist = false;
        string playlistId = "";
        string playlistUrl = "";

        if (!string.IsNullOrEmpty(rawUrl))
        {
            // Normalize URL scheme if missing
            string testUrl = rawUrl;
            if (!testUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !testUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                testUrl = "https://" + testUrl;
            }

            // Check for YouTube
            var ytMatch = Regex.Match(testUrl, @"(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})", RegexOptions.IgnoreCase);
            var plMatch = Regex.Match(testUrl, @"[?&]list=([a-zA-Z0-9_-]+)", RegexOptions.IgnoreCase);

            if (plMatch.Success)
            {
                hasPlaylist = true;
                playlistId = plMatch.Groups[1].Value;
                playlistUrl = $"/playlist?url={Uri.EscapeDataString(testUrl)}";
            }

            if (ytMatch.Success)
            {
                var videoId = ytMatch.Groups[1].Value;
                streamType = "youtube";
                streamUrl = $"https://www.youtube-nocookie.com/embed/{videoId}?autoplay=0&rel=0&enablejsapi=1";

                if (string.IsNullOrEmpty(sourceSite) || sourceSite.Equals("Unknown", StringComparison.OrdinalIgnoreCase))
                {
                    sourceSite = "YouTube";
                }

                // If title is generic or empty, resolve via YouTube oEmbed
                if (string.IsNullOrEmpty(videoTitle) || videoTitle.Equals("Stream", StringComparison.OrdinalIgnoreCase) || videoTitle.Equals("Untitled Stream", StringComparison.OrdinalIgnoreCase))
                {
                    try
                    {
                        var oembedEndpoint = $"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={videoId}&format=json";
                        var response = await _httpClient.GetStringAsync(oembedEndpoint);
                        using var doc = JsonDocument.Parse(response);
                        if (doc.RootElement.TryGetProperty("title", out var titleEl))
                        {
                            videoTitle = titleEl.GetString() ?? videoTitle;
                        }
                        if (doc.RootElement.TryGetProperty("author_name", out var authorEl))
                        {
                            var author = authorEl.GetString();
                            if (!string.IsNullOrEmpty(author))
                            {
                                sourceSite = $"YouTube • {author}";
                            }
                        }
                        if (string.IsNullOrEmpty(posterUrl) && doc.RootElement.TryGetProperty("thumbnail_url", out var thumbEl))
                        {
                            posterUrl = thumbEl.GetString() ?? "";
                        }
                    }
                    catch
                    {
                        if (string.IsNullOrEmpty(videoTitle) || videoTitle.Equals("Stream", StringComparison.OrdinalIgnoreCase))
                        {
                            videoTitle = $"YouTube Video ({videoId})";
                        }
                    }
                }
            }
            else
            {
                // Non-YouTube: Auto-resolve media stream using M3U8Parser
                bool resolved = false;
                try
                {
                    var parser = new M3U8Parser(_httpClient);
                    var analysis = await parser.ParseAsync(testUrl);

                    if (analysis != null && analysis.Qualities != null && analysis.Qualities.Count > 0)
                    {
                        var best = analysis.Qualities[0];
                        var resolvedMediaUrl = best.Url;
                        if (!string.IsNullOrEmpty(resolvedMediaUrl))
                        {
                            resolved = true;
                            var lowerMedia = resolvedMediaUrl.ToLowerInvariant();
                            bool isHls = lowerMedia.Contains(".m3u8") || lowerMedia.Contains("/hls/") || lowerMedia.Contains("serve_m3u8");
                            
                            streamType = isHls ? "hls" : "direct";
                            // Route through Cinema Stream Proxy to defeat CORS and Anti-Hotlinking 403
                            streamUrl = $"/api/cinema/proxy-stream?url={Uri.EscapeDataString(resolvedMediaUrl)}&referer={Uri.EscapeDataString(testUrl)}";

                            if (string.IsNullOrEmpty(videoTitle) || videoTitle.Equals("Stream", StringComparison.OrdinalIgnoreCase))
                            {
                                videoTitle = !string.IsNullOrEmpty(analysis.Title) ? analysis.Title : videoTitle;
                            }
                            if (string.IsNullOrEmpty(posterUrl) && !string.IsNullOrEmpty(analysis.ThumbnailUrl))
                            {
                                posterUrl = analysis.ThumbnailUrl;
                            }
                            if (string.IsNullOrEmpty(sourceSite) || sourceSite.Equals("Unknown", StringComparison.OrdinalIgnoreCase))
                            {
                                sourceSite = !string.IsNullOrEmpty(analysis.Platform) ? analysis.Platform : "Web Stream";
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Cinema Stream Analysis Notice] {ex.Message}");
                }

                if (!resolved)
                {
                    var lower = testUrl.ToLowerInvariant();
                    if (lower.Contains(".m3u8") || lower.Contains("/hls/"))
                    {
                        streamType = "hls";
                        streamUrl = $"/api/cinema/proxy-stream?url={Uri.EscapeDataString(testUrl)}";
                    }
                    else if (lower.EndsWith(".mp4") || lower.Contains(".mp4?") || lower.Contains("/videos/"))
                    {
                        streamType = "direct";
                        streamUrl = $"/api/cinema/proxy-stream?url={Uri.EscapeDataString(testUrl)}";
                    }
                    else
                    {
                        streamType = "embed";
                        streamUrl = testUrl;
                    }

                    if (string.IsNullOrEmpty(sourceSite) || sourceSite.Equals("Unknown", StringComparison.OrdinalIgnoreCase))
                    {
                        if (Uri.TryCreate(testUrl, UriKind.Absolute, out var uri))
                        {
                            var host = uri.Host;
                            if (host.StartsWith("www.", StringComparison.OrdinalIgnoreCase))
                                host = host.Substring(4);

                            sourceSite = char.ToUpper(host[0]) + host.Substring(1);
                        }
                        else
                        {
                            sourceSite = "Web Video Stream";
                        }
                    }
                }
            }
        }

        if (string.IsNullOrEmpty(videoTitle))
        {
            videoTitle = "CleanStream Video";
        }

        ViewData["StreamUrl"] = streamUrl;
        ViewData["OriginalUrl"] = rawUrl;
        ViewData["StreamType"] = streamType;
        ViewData["VideoTitle"] = videoTitle;
        ViewData["PosterUrl"] = posterUrl;
        ViewData["Quality"] = currentQuality;
        ViewData["SourceSite"] = sourceSite;
        ViewData["HasPlaylist"] = hasPlaylist;
        ViewData["PlaylistId"] = playlistId;
        ViewData["PlaylistUrl"] = playlistUrl;

        return View();
    }

    // ─────────────────────────────────────────────────────────────
    // Cinema Stream Stealth Proxy: Defeats CORS, 403 Forbidden & Rewrites M3U8 Playlists
    // ─────────────────────────────────────────────────────────────
    [HttpGet("/api/cinema/proxy-stream")]
    public async Task<IActionResult> ProxyStream([FromQuery] string url, [FromQuery] string? referer)
    {
        if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var targetUri))
        {
            return BadRequest("Invalid stream URL");
        }

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, targetUri);
            req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");

            // Forward Range header for byte-range seeking / scrubbing support
            if (Request.Headers.ContainsKey("Range"))
            {
                req.Headers.TryAddWithoutValidation("Range", (string)Request.Headers["Range"]!);
            }

            var candidateReferers = StreamSecurityHelper.GetCandidateReferers(targetUri, referer);
            if (candidateReferers.Count > 0 && !string.IsNullOrEmpty(candidateReferers[0]))
            {
                req.Headers.TryAddWithoutValidation("Referer", candidateReferers[0]);
            }

            var response = await _httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);

            // Enable universal CORS headers
            Response.Headers["Access-Control-Allow-Origin"] = "*";
            Response.Headers["Access-Control-Allow-Headers"] = "*";
            Response.Headers["Access-Control-Expose-Headers"] = "Content-Length, Content-Range, Accept-Ranges";

            var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
            bool isM3u8 = url.Contains(".m3u8", StringComparison.OrdinalIgnoreCase) ||
                          contentType.Contains("mpegurl", StringComparison.OrdinalIgnoreCase);

            if (isM3u8)
            {
                var manifestText = await response.Content.ReadAsStringAsync();
                var baseUri = new Uri(targetUri, ".");
                var lines = manifestText.Split('\n');
                var sb = new StringBuilder();

                foreach (var rawLine in lines)
                {
                    var line = rawLine.Trim();
                    if (string.IsNullOrEmpty(line))
                    {
                        sb.AppendLine(rawLine);
                        continue;
                    }

                    if (line.StartsWith("#"))
                    {
                        // Check for tags containing URI="..." (e.g. #EXT-X-KEY or #EXT-X-MAP)
                        if (line.Contains("URI=\""))
                        {
                            var rewrittenLine = Regex.Replace(line, "URI=\"([^\"]+)\"", m =>
                            {
                                var subUrl = m.Groups[1].Value;
                                var resolved = Uri.TryCreate(subUrl, UriKind.Absolute, out var abs)
                                    ? abs.ToString()
                                    : new Uri(baseUri, subUrl).ToString();
                                return $"URI=\"/api/cinema/proxy-stream?url={Uri.EscapeDataString(resolved)}\"";
                            });
                            sb.AppendLine(rewrittenLine);
                        }
                        else
                        {
                            sb.AppendLine(rawLine);
                        }
                    }
                    else
                    {
                        // Segment or child playlist URI
                        var resolved = Uri.TryCreate(line, UriKind.Absolute, out var abs)
                            ? abs.ToString()
                            : new Uri(baseUri, line).ToString();
                        sb.AppendLine($"/api/cinema/proxy-stream?url={Uri.EscapeDataString(resolved)}");
                    }
                }

                return Content(sb.ToString(), "application/vnd.apple.mpegurl");
            }

            // Direct binary stream (video chunks or MP4)
            if (response.StatusCode == HttpStatusCode.PartialContent)
            {
                Response.StatusCode = (int)HttpStatusCode.PartialContent;
                if (response.Content.Headers.ContentRange != null)
                {
                    Response.Headers["Content-Range"] = response.Content.Headers.ContentRange.ToString();
                }
            }
            Response.Headers["Accept-Ranges"] = "bytes";

            var stream = await response.Content.ReadAsStreamAsync();
            return File(stream, contentType);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Cinema Stream Proxy Error] {ex.Message}");
            return StatusCode(500, $"Proxy error: {ex.Message}");
        }
    }
}
