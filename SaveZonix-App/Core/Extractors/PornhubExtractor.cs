using System.Text.RegularExpressions;
using System.Net;

namespace Zonix.Core.Extractors;

public class PornhubExtractor : IVideoExtractor
{
    private readonly HttpClient _httpClient;
    private readonly M3U8Parser _parser;

    public string Name => "Pornhub";
    public int Priority => 60; // Higher than OtherSites (0)

    public PornhubExtractor(HttpClient httpClient, M3U8Parser parser)
    {
        _httpClient = httpClient;
        _parser = parser;
    }

    public bool CanHandle(Uri uri)
    {
        string host = uri.Host.ToLowerInvariant();
        return host.Contains("pornhub.com") || host.Contains("pornhub.org") || host.Contains("phncdn.com");
    }

    public async Task<StreamAnalysisResult> ExtractAsync(string url, int retryCount = 0)
    {
        Console.WriteLine($"[Pornhub Extractor] Extracting stream for: {url}");
        var uri = new Uri(url);
        var result = new StreamAnalysisResult
        {
            Platform = "Pornhub",
            RequiresBrowserContext = false
        };

        string targetMasterUrl = url;

        // If it is a webpage URL, fetch HTML and find mediaDefinitions
        if (!url.Contains(".m3u8", StringComparison.OrdinalIgnoreCase))
        {
            string? html = null;
            try
            {
                var (content, _, _) = await _parser.FetchContentWithNegotiationAsync(url);
                if (!string.IsNullOrWhiteSpace(content) && content.Length > 200)
                {
                    html = content;
                }
            }
            catch { }

            if (string.IsNullOrWhiteSpace(html))
            {
                html = await M3U8Parser.FetchHtmlWithCurlAsync(url, uri);
            }

            if (string.IsNullOrWhiteSpace(html))
            {
                throw new Exception("Unable to load Pornhub webpage. Please ensure internet access or copy the direct stream URL.");
            }

            _parser.ExtractMetadataFromHtml(html, result);

            // Extract duration from video_duration if not yet populated
            if (result.DurationSeconds == 0)
            {
                var durMatch = Regex.Match(html, @"[""']video_duration[""']\s*:\s*(\d+)", RegexOptions.IgnoreCase);
                if (!durMatch.Success) durMatch = Regex.Match(html, @"[""']videoDuration[""']\s*:\s*(\d+)", RegexOptions.IgnoreCase);
                if (durMatch.Success && int.TryParse(durMatch.Groups[1].Value, out var phDur))
                {
                    result.DurationSeconds = phDur;
                }
            }

            // Extract thumbnail from posterUrl if empty
            if (string.IsNullOrEmpty(result.ThumbnailUrl))
            {
                var posterMatch = Regex.Match(html, @"[""']posterUrl[""']\s*:\s*[""']([^""']+)[""']", RegexOptions.IgnoreCase);
                if (posterMatch.Success)
                {
                    result.ThumbnailUrl = posterMatch.Groups[1].Value.Replace("\\/", "/");
                }
            }

            // Extract mediaDefinitions JSON array for all qualities
            var mediaDefMatch = Regex.Match(html, @"[""']mediaDefinitions[""']\s*:\s*(\[[^\]]+\])", RegexOptions.IgnoreCase);
            if (mediaDefMatch.Success)
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(mediaDefMatch.Groups[1].Value);
                    foreach (var el in doc.RootElement.EnumerateArray())
                    {
                        if (el.TryGetProperty("videoUrl", out var vUrlProp) && !string.IsNullOrWhiteSpace(vUrlProp.GetString()))
                        {
                            string vUrl = vUrlProp.GetString()!.Replace("\\/", "/");
                            if (string.IsNullOrWhiteSpace(vUrl)) continue;

                            // Exclude temporary get_media token endpoints (they return short-lived 410 Gone fMP4 streams)
                            if (vUrl.Contains("/video/get_media", StringComparison.OrdinalIgnoreCase)) continue;

                            string format = el.TryGetProperty("format", out var fProp) ? fProp.GetString() ?? "" : "";
                            string qualityStr = "";
                            if (el.TryGetProperty("quality", out var qProp))
                            {
                                qualityStr = qProp.ValueKind == System.Text.Json.JsonValueKind.Array
                                    ? ""
                                    : qProp.ToString();
                            }

                            int height = el.TryGetProperty("height", out var hProp) && hProp.TryGetInt32(out var h) ? h : 0;
                            int width = el.TryGetProperty("width", out var wProp) && wProp.TryGetInt32(out var w) ? w : 0;

                            if (height == 0 && int.TryParse(qualityStr, out var parsedH)) height = parsedH;

                            string res = (width > 0 && height > 0) ? $"{width}x{height}" : (height > 0 ? $"{height}p" : "Adaptive");
                            string dName = height >= 1080 ? $"{height}p Full HD" : (height >= 720 ? $"{height}p HD" : (height > 0 ? $"{height}p SD" : "Direct Stream"));

                            long bw = 0;
                            var kMatch = Regex.Match(vUrl, @"_(\d+)K_", RegexOptions.IgnoreCase);
                            if (kMatch.Success && long.TryParse(kMatch.Groups[1].Value, out var kbps))
                            {
                                bw = kbps * 1000L;
                            }
                            else
                            {
                                bw = height >= 2160 ? 14000000L :
                                     height >= 1440 ? 8000000L :
                                     height >= 1080 ? 4000000L :
                                     height >= 720  ? 2200000L :
                                     height >= 480  ? 1200000L :
                                     height >= 360  ? 750000L : 450000L;
                            }

                            // Convert master.m3u8 directly to index-v1-a1.m3u8 subplaylist with same auth query
                            string streamPlaylistUrl = vUrl.Contains("master.m3u8") 
                                ? vUrl.Replace("master.m3u8", "index-v1-a1.m3u8") 
                                : vUrl;

                            result.Qualities.Add(new StreamQuality
                            {
                                Resolution = res,
                                Bandwidth = bw,
                                Url = streamPlaylistUrl,
                                IsDirectFile = false,
                                DurationSeconds = result.DurationSeconds
                            });
                        }
                    }
                }
                catch { }
            }

            if (result.Qualities.Count > 0)
            {
                result.Qualities = result.Qualities
                    .OrderByDescending(q => {
                        var m = Regex.Match(q.Resolution, @"(\d+)x(\d+)");
                        return m.Success ? int.Parse(m.Groups[2].Value) : (int.TryParse(Regex.Match(q.Resolution, @"\d+").Value, out var h) ? h : 0);
                    })
                    .ToList();
                targetMasterUrl = result.Qualities[0].Url;
            }
            else
            {
                // Fallback: Extract master.m3u8 from mediaDefinitions / flashvars
                var masterMatch = Regex.Match(html, @"[""']videoUrl[""']\s*:\s*[""']([^""']*master\.m3u8[^""']*)[""']", RegexOptions.IgnoreCase);
                if (masterMatch.Success)
                {
                    targetMasterUrl = masterMatch.Groups[1].Value.Replace("\\/", "/");
                }
                else
                {
                    var anyVideoMatch = Regex.Match(html, @"[""']videoUrl[""']\s*:\s*[""']([^""']+)[""']", RegexOptions.IgnoreCase);
                    if (anyVideoMatch.Success)
                    {
                        targetMasterUrl = anyVideoMatch.Groups[1].Value.Replace("\\/", "/");
                    }
                }
            }
        }

        if (string.IsNullOrWhiteSpace(targetMasterUrl))
        {
            throw new Exception("Could not find a valid video stream in this Pornhub video.");
        }

        // Fetch master playlist content using curl with proper headers
        var masterUri = new Uri(targetMasterUrl);
        string? masterContent = await M3U8Parser.FetchHtmlWithCurlAsync(targetMasterUrl, masterUri);
        if (string.IsNullOrWhiteSpace(masterContent))
        {
            // Fallback to negotiation
            try
            {
                var (c, _, _) = await _parser.FetchContentWithNegotiationAsync(targetMasterUrl);
                masterContent = c;
            }
            catch { }
        }

        if (string.IsNullOrWhiteSpace(masterContent))
        {
            throw new Exception("Failed to fetch stream playlist from CDN. The stream token may have expired. Please retry.");
        }

        if (masterContent.Contains("#EXT-X-STREAM-INF"))
        {
            result.IsMaster = true;
            var parsedSubQualities = M3U8Parser.ParseMasterPlaylistStatic(masterContent, masterUri);
            if (result.Qualities.Count == 0 && parsedSubQualities.Count > 0)
            {
                result.Qualities = parsedSubQualities;
            }

            // Ensure every quality is marked as HLS stream (never direct MP4 file)
            foreach (var q in result.Qualities)
            {
                q.IsDirectFile = false;
                if (result.DurationSeconds > 0) q.DurationSeconds = result.DurationSeconds;
            }

            // Pre-resolve segments from best quality sub-playlist
            string bestSubUrl = parsedSubQualities.Count > 0 ? parsedSubQualities[0].Url : targetMasterUrl;
            var subUri = new Uri(bestSubUrl);
            string? subContent = await M3U8Parser.FetchHtmlWithCurlAsync(bestSubUrl, subUri);
            if (!string.IsNullOrWhiteSpace(subContent))
            {
                var (segments, duration) = M3U8Parser.ParseMediaPlaylistWithDurationStatic(subContent, subUri);
                result.SegmentUrls = segments;
                result.TotalSegments = segments.Count;
                if (duration > 0 && result.DurationSeconds == 0)
                {
                    result.DurationSeconds = duration;
                }
            }

            result.IsDirectMediaFile = false;
            return result;
        }
        else if (masterContent.Contains("#EXTM3U") || masterContent.Contains("#EXTINF"))
        {
            result.IsMaster = false;
            var (segments, duration) = M3U8Parser.ParseMediaPlaylistWithDurationStatic(masterContent, masterUri);
            Console.WriteLine($"[Pornhub Extractor] Parsed media playlist: {segments.Count} segments, {duration}s duration from {masterContent.Length} bytes content");
            if (segments.Count > 0) Console.WriteLine($"[Pornhub Extractor] First segment: {segments[0].Substring(0, Math.Min(120, segments[0].Length))}...");
            if (segments.Count > 1) Console.WriteLine($"[Pornhub Extractor] Last segment: {segments[segments.Count - 1].Substring(0, Math.Min(120, segments[segments.Count - 1].Length))}...");
            result.SegmentUrls = segments;
            result.TotalSegments = segments.Count;
            if (duration > 0 && result.DurationSeconds == 0)
            {
                result.DurationSeconds = duration;
            }
            result.IsDirectMediaFile = false;
            return result;
        }

        throw new Exception("Unknown Pornhub stream response format.");
    }
}
