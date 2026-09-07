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

            // Extract master.m3u8 from mediaDefinitions / flashvars
            var masterMatch = Regex.Match(html, @"[""']videoUrl[""']\s*:\s*[""']([^""']*master\.m3u8[^""']*)[""']", RegexOptions.IgnoreCase);
            if (masterMatch.Success)
            {
                targetMasterUrl = masterMatch.Groups[1].Value.Replace("\\/", "/");
            }
            else
            {
                // Fallback to any videoUrl in mediaDefinitions
                var anyVideoMatch = Regex.Match(html, @"[""']videoUrl[""']\s*:\s*[""']([^""']+)[""']", RegexOptions.IgnoreCase);
                if (anyVideoMatch.Success)
                {
                    targetMasterUrl = anyVideoMatch.Groups[1].Value.Replace("\\/", "/");
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
            result.Qualities = M3U8Parser.ParseMasterPlaylistStatic(masterContent, masterUri);

            // Ensure every quality is marked as HLS stream (never direct MP4 file)
            foreach (var q in result.Qualities)
            {
                q.IsDirectFile = false;
                q.DurationSeconds = result.DurationSeconds;
            }

            // Pre-resolve segments from best quality sub-playlist
            if (result.Qualities.Count > 0)
            {
                var best = result.Qualities[0];
                var subUri = new Uri(best.Url);
                string? subContent = await M3U8Parser.FetchHtmlWithCurlAsync(best.Url, subUri);
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
            }
            result.IsDirectMediaFile = false;
            return result;
        }
        else if (masterContent.Contains("#EXTM3U") || masterContent.Contains("#EXTINF"))
        {
            result.IsMaster = false;
            var (segments, duration) = M3U8Parser.ParseMediaPlaylistWithDurationStatic(masterContent, masterUri);
            result.SegmentUrls = segments;
            result.TotalSegments = segments.Count;
            result.DurationSeconds = duration;
            result.IsDirectMediaFile = false;
            return result;
        }

        throw new Exception("Unknown Pornhub stream response format.");
    }
}
