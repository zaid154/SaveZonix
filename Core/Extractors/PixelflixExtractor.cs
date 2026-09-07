using System.Text.Json;
using System.Text.RegularExpressions;

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
            var titleMatch = Regex.Match(html, @"<title>([^<]+)</title>", RegexOptions.IgnoreCase);
            if (titleMatch.Success)
            {
                result.Title = titleMatch.Groups[1].Value.Replace(" - Pixelflix", "").Trim();
            }

            // 2. Extract Thumbnail
            var thumbMatch = Regex.Match(html, @"(?:poster|thumbnail|image)[""']?\s*[:=]\s*[""']([^""']+)[""']", RegexOptions.IgnoreCase);
            if (thumbMatch.Success)
            {
                result.ThumbnailUrl = thumbMatch.Groups[1].Value;
            }

            // 3. ReelsDownload API Stream Resolver for TV & Movies (e.g. /watch/tv/276161?season=1&episode=1)
            var pfMatch = Regex.Match(url, @"pixelflix\.cc/(?:watch|title)/(tv|movie)/(\d+)", RegexOptions.IgnoreCase);
            if (pfMatch.Success)
            {
                string type = pfMatch.Groups[1].Value.ToLower();
                string tmdbId = pfMatch.Groups[2].Value;

                var uriObj = new Uri(url);
                var queryParams = System.Web.HttpUtility.ParseQueryString(uriObj.Query);
                string season = queryParams["season"] ?? "1";
                string episode = queryParams["episode"] ?? "1";

                var extractApis = new[]
                {
                    $"https://embed.reelsdownload.online/api/redflix-extract?type={type}&tmdb_id={tmdbId}&season={season}&episode={episode}",
                    $"https://embed.reelsdownload.online/api/vidxgo-extract?type={type}&tmdb_id={tmdbId}&season={season}&episode={episode}",
                    $"https://embed.reelsdownload.online/api/cinemaos-extract?type={type}&tmdb_id={tmdbId}&season={season}&episode={episode}",
                    $"https://embed.reelsdownload.online/api/rive-extract?type={type}&tmdb_id={tmdbId}&season={season}&episode={episode}"
                };

                foreach (var api in extractApis)
                {
                    try
                    {
                        using var apiReq = new HttpRequestMessage(HttpMethod.Get, api);
                        apiReq.Headers.TryAddWithoutValidation("Referer", $"https://embed.reelsdownload.online/player/{tmdbId}/{season}/{episode}?key=k_5661ac637169a1733857dc50");
                        apiReq.Headers.TryAddWithoutValidation("Origin", "https://embed.reelsdownload.online");
                        apiReq.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");

                        using var apiRes = await _httpClient.SendAsync(apiReq);
                        if (apiRes.IsSuccessStatusCode)
                        {
                            var jsonDoc = await apiRes.Content.ReadAsStringAsync();
                            using var doc = JsonDocument.Parse(jsonDoc);
                            string? streamSrc = null;

                            if (doc.RootElement.TryGetProperty("sources", out var sourcesEl) && sourcesEl.GetArrayLength() > 0)
                            {
                                foreach (var s in sourcesEl.EnumerateArray())
                                {
                                    if (s.TryGetProperty("url", out var u))
                                    {
                                        streamSrc = u.GetString();
                                        break;
                                    }
                                }
                            }
                            else if (doc.RootElement.TryGetProperty("source", out var srcEl) && srcEl.TryGetProperty("url", out var su))
                            {
                                streamSrc = su.GetString();
                            }
                            else if (doc.RootElement.TryGetProperty("url", out var directUrl))
                            {
                                streamSrc = directUrl.GetString();
                            }

                            if (!string.IsNullOrEmpty(streamSrc))
                            {
                                bool isDirect = streamSrc.Contains(".mp4") || streamSrc.Contains(".webm");
                                result.IsDirectMediaFile = isDirect;
                                result.Qualities.Add(new StreamQuality
                                {
                                    Resolution = isDirect ? "1080p Full HD (Direct)" : "1080p Full HD (HLS)",
                                    Url = streamSrc,
                                    IsDirectFile = isDirect,
                                    Bandwidth = 4500000
                                });
                                return result;
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
