using System.Text.Json;
using System.Text.RegularExpressions;
using SaveZonix.Core;

namespace Zonix.Core.Extractors;

public class PixelflixExtractor : IVideoExtractor
{
    private readonly HttpClient _httpClient;

    public string Name => "Pixelflix";
    public int Priority => 80;

    public PixelflixExtractor(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public bool CanHandle(Uri uri)
    {
        return uri.Host.Contains("pixelflix.cc", StringComparison.OrdinalIgnoreCase) ||
               uri.Host.Contains("pixelflix", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<StreamAnalysisResult> ExtractAsync(string url, int retryCount = 0)
    {
        var targetUri = new Uri(url);
        var result = new StreamAnalysisResult
        {
            Title = "Pixelflix Video Stream",
            Platform = "Pixelflix"
        };

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
            req.Headers.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            req.Headers.TryAddWithoutValidation("Referer", "https://pixelflix.cc/");

            using var resp = await _httpClient.SendAsync(req);
            string html = resp.IsSuccessStatusCode ? await resp.Content.ReadAsStringAsync() : string.Empty;

            // 1. Extract Title
            string rawTitle = "Pixelflix Video Stream";
            var titleMatch = Regex.Match(html, @"<title>([^<]+)</title>", RegexOptions.IgnoreCase);
            if (titleMatch.Success && !titleMatch.Groups[1].Value.Contains("404"))
            {
                rawTitle = titleMatch.Groups[1].Value.Replace(" - Pixelflix", "").Replace(" — PixelFlix", "").Trim();
            }
            else
            {
                var altTitleMatch = Regex.Match(html, @"(?:Watch\s+)?([^""<]+?)\s*[-—–|]\s*PixelFlix", RegexOptions.IgnoreCase);
                if (altTitleMatch.Success)
                {
                    rawTitle = altTitleMatch.Groups[1].Value.Trim();
                }
            }

            // Smart Season & Episode formatting (e.g. "My Girlfriend is an Alien - S02E01")
            result.Title = MediaHelper.FormatEpisodeTitle(rawTitle, url);

            // 2. Extract Thumbnail (from TMDB poster or HTML meta)
            var thumbMatch = Regex.Match(html, @"(https:\/\/image\.tmdb\.org\/t\/p\/[^\s""'<>]+?\.(?:jpg|png|webp))", RegexOptions.IgnoreCase);
            if (thumbMatch.Success)
            {
                result.ThumbnailUrl = thumbMatch.Groups[1].Value;
            }
            else
            {
                var altThumb = Regex.Match(html, @"(?:poster|thumbnail|image)[""']?\s*[:=]\s*[""']([^""']+)[""']", RegexOptions.IgnoreCase);
                if (altThumb.Success)
                {
                    result.ThumbnailUrl = altThumb.Groups[1].Value;
                }
            }

            // 3. ReelsDownload API Stream Resolver for TV & Movies (e.g. /watch/tv/92779?season=2&episode=1 or /watch/movie/926172)
            var pfMatch = Regex.Match(url, @"pixelflix\.cc/(?:watch|title)/(tv|movie)/(\d+)", RegexOptions.IgnoreCase);
            if (pfMatch.Success)
            {
                string type = pfMatch.Groups[1].Value.ToLower();
                string tmdbId = pfMatch.Groups[2].Value;

                var uriObj = new Uri(url);
                var queryParams = System.Web.HttpUtility.ParseQueryString(uriObj.Query);
                string season = queryParams["season"] ?? queryParams["s"] ?? "1";
                string episode = queryParams["episode"] ?? queryParams["ep"] ?? queryParams["e"] ?? "1";

                int sNum = int.TryParse(season, out int sVal) ? sVal : 1;
                int eNum = int.TryParse(episode, out int eVal) ? eVal : 1;

                if (type == "tv")
                {
                    result.Description = $"Season {sNum}, Episode {eNum}";
                }

                // For movies: Never pass season/episode (it invalidates the lookup on providers).
                // CinemaOS extract is the fastest and most reliable provider returning adaptive DASH & MP4.
                var extractApis = type == "tv"
                    ? new[]
                    {
                        $"https://embed.reelsdownload.online/api/cinemaos-extract?type=tv&tmdb_id={tmdbId}&season={sNum}&episode={eNum}",
                        $"https://embed.reelsdownload.online/api/redflix-extract?type=tv&tmdb_id={tmdbId}&season={sNum}&episode={eNum}",
                        $"https://embed.reelsdownload.online/api/vidxgo-extract?type=tv&tmdb_id={tmdbId}&season={sNum}&episode={eNum}",
                        $"https://embed.reelsdownload.online/api/rive-extract?type=tv&tmdb_id={tmdbId}&season={sNum}&episode={eNum}"
                    }
                    : new[]
                    {
                        $"https://embed.reelsdownload.online/api/cinemaos-extract?type=movie&tmdb_id={tmdbId}",
                        $"https://embed.reelsdownload.online/api/redflix-extract?type=movie&tmdb_id={tmdbId}",
                        $"https://embed.reelsdownload.online/api/vidxgo-extract?type=movie&tmdb_id={tmdbId}",
                        $"https://embed.reelsdownload.online/api/rive-extract?type=movie&tmdb_id={tmdbId}"
                    };

                string referer = type == "tv"
                    ? $"https://embed.reelsdownload.online/player/{tmdbId}/{sNum}/{eNum}?key=k_5661ac637169a1733857dc50"
                    : $"https://embed.reelsdownload.online/player/{tmdbId}?key=k_5661ac637169a1733857dc50";

                foreach (var api in extractApis)
                {
                    try
                    {
                        using var apiReq = new HttpRequestMessage(HttpMethod.Get, api);
                        apiReq.Headers.TryAddWithoutValidation("Referer", referer);
                        apiReq.Headers.TryAddWithoutValidation("Origin", "https://embed.reelsdownload.online");
                        apiReq.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");

                        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
                        using var apiRes = await _httpClient.SendAsync(apiReq, cts.Token);
                        if (apiRes.IsSuccessStatusCode)
                        {
                            var jsonContent = await apiRes.Content.ReadAsStringAsync();
                            if (string.IsNullOrWhiteSpace(jsonContent)) continue;

                            // Providers stream newline-delimited JSON objects
                            var lines = jsonContent.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                            var extractedStreams = new List<(string url, string quality, string type, string label)>();

                            foreach (var line in lines)
                            {
                                try
                                {
                                    using var doc = JsonDocument.Parse(line.Trim());
                                    var root = doc.RootElement;

                                    if (root.TryGetProperty("source", out var srcEl) && srcEl.ValueKind == JsonValueKind.Object)
                                    {
                                        string? u = srcEl.TryGetProperty("url", out var uProp) ? uProp.GetString() : null;
                                        string q = srcEl.TryGetProperty("quality", out var qProp) ? (qProp.GetString() ?? "1080p") : "1080p";
                                        string t = srcEl.TryGetProperty("type", out var tProp) ? (tProp.GetString() ?? "") : "";
                                        string lbl = srcEl.TryGetProperty("label", out var lProp) ? (lProp.GetString() ?? "") : "";
                                        if (!string.IsNullOrEmpty(u)) extractedStreams.Add((u, q, t, lbl));
                                    }
                                    else if (root.TryGetProperty("sources", out var sourcesEl) && sourcesEl.ValueKind == JsonValueKind.Array)
                                    {
                                        foreach (var s in sourcesEl.EnumerateArray())
                                        {
                                            string? u = s.TryGetProperty("url", out var uProp) ? uProp.GetString() : null;
                                            string q = s.TryGetProperty("quality", out var qProp) ? (qProp.GetString() ?? "1080p") : "1080p";
                                            string t = s.TryGetProperty("type", out var tProp) ? (tProp.GetString() ?? "") : "";
                                            string lbl = s.TryGetProperty("label", out var lProp) ? (lProp.GetString() ?? "") : "";
                                            if (!string.IsNullOrEmpty(u)) extractedStreams.Add((u, q, t, lbl));
                                        }
                                    }
                                    else if (root.TryGetProperty("url", out var directUrlProp) && directUrlProp.ValueKind == JsonValueKind.String)
                                    {
                                        string? u = directUrlProp.GetString();
                                        if (!string.IsNullOrEmpty(u)) extractedStreams.Add((u, "1080p", "direct", "Direct Stream"));
                                    }
                                }
                                catch { }
                            }

                            if (extractedStreams.Count > 0)
                            {
                                // Prefer DASH streams (resilient CloudFront CDN, zero rate-limiting)
                                var dashStream = extractedStreams.FirstOrDefault(s => s.type.Equals("dash", StringComparison.OrdinalIgnoreCase) || s.url.Contains(".mpd", StringComparison.OrdinalIgnoreCase));
                                var mp4Streams = extractedStreams.Where(s => s.url.Contains(".mp4", StringComparison.OrdinalIgnoreCase)).ToList();
                                var hlsStreams = extractedStreams.Where(s => s.url.Contains(".m3u8", StringComparison.OrdinalIgnoreCase)).ToList();

                                if (!string.IsNullOrEmpty(dashStream.url))
                                {
                                    result.IsDirectMediaFile = false;
                                    result.Qualities.Add(new StreamQuality
                                    {
                                        Resolution = "1080p Full HD (Adaptive Stream)",
                                        Url = dashStream.url,
                                        IsDirectFile = false,
                                        Bandwidth = 4500000
                                    });
                                    result.Qualities.Add(new StreamQuality
                                    {
                                        Resolution = "720p HD (Adaptive Stream)",
                                        Url = dashStream.url,
                                        IsDirectFile = false,
                                        Bandwidth = 2500000
                                    });
                                    result.Qualities.Add(new StreamQuality
                                    {
                                        Resolution = "480p SD (Adaptive Stream)",
                                        Url = dashStream.url,
                                        IsDirectFile = false,
                                        Bandwidth = 1200000
                                    });
                                }

                                foreach (var hls in hlsStreams)
                                {
                                    string resLabel = string.IsNullOrWhiteSpace(hls.quality) ? "1080p FHD (HLS)" : $"{hls.quality} (HLS)";
                                    if (!result.Qualities.Any(q => q.Url == hls.url))
                                    {
                                        result.Qualities.Add(new StreamQuality
                                        {
                                            Resolution = resLabel,
                                            Url = hls.url,
                                            IsDirectFile = false,
                                            Bandwidth = 3500000
                                        });
                                    }
                                }

                                foreach (var mp4 in mp4Streams)
                                {
                                    string resLabel = string.IsNullOrWhiteSpace(mp4.quality) ? "1080p (MP4)" : $"{mp4.quality} {mp4.label} (MP4)".Trim();
                                    if (!result.Qualities.Any(q => q.Url == mp4.url))
                                    {
                                        result.Qualities.Add(new StreamQuality
                                        {
                                            Resolution = resLabel,
                                            Url = mp4.url,
                                            IsDirectFile = true,
                                            Bandwidth = 4500000
                                        });
                                    }
                                }

                                if (result.Qualities.Count > 0)
                                {
                                    result.RequiresBrowserContext = false;
                                    result.StatusMessage = "Stream ready for instant high-speed download.";
                                    return result;
                                }
                            }
                        }
                    }
                    catch { }
                }
            }

            // 4. Search for direct HLS stream (.m3u8) or MP4 sources in player configs
            var m3u8Match = Regex.Match(html, @"[""'](https?://[^""']+\.m3u8[^""']*)[""']", RegexOptions.IgnoreCase);
            if (m3u8Match.Success)
            {
                string streamUrl = m3u8Match.Groups[1].Value;
                result.Qualities.Add(new StreamQuality
                {
                    Resolution = "1080p FHD (HLS)",
                    Url = streamUrl,
                    IsDirectFile = false,
                    Bandwidth = 4500000
                });
                return result;
            }

            var mp4Match = Regex.Match(html, @"[""'](https?://[^""']+\.mp4[^""']*)[""']", RegexOptions.IgnoreCase);
            if (mp4Match.Success)
            {
                string streamUrl = mp4Match.Groups[1].Value;
                result.IsDirectMediaFile = true;
                result.Qualities.Add(new StreamQuality
                {
                    Resolution = "1080p FHD (Direct MP4)",
                    Url = streamUrl,
                    IsDirectFile = true,
                    Bandwidth = 4500000
                });
                return result;
            }

            // Pixelflix often embeds player iframes or uses Next.js/client-side encrypted streams.
            // When direct static stream isn't in raw HTML, signal browser context requirement.
            result.RequiresBrowserContext = true;
            result.StatusMessage = "Pixelflix loads streams via client-side player tokens. Play the video in browser or use the SaveZonix Extension.";
            result.Qualities.Add(new StreamQuality
            {
                Resolution = "1080p FHD (Browser Context)",
                Url = url,
                IsDirectFile = false,
                Bandwidth = 4500000
            });
            return result;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Pixelflix Extractor] Error: {ex.Message}");
            result.RequiresBrowserContext = true;
            result.StatusMessage = "Pixelflix stream requires browser player context. Please use the SaveZonix Extension.";
            return result;
        }
    }
}
