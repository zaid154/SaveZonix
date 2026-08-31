using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using YoutubeExplode;
using YoutubeExplode.Videos.Streams;

namespace Zonix.Core;

public class M3U8Parser
{
    private readonly HttpClient _httpClient;
    private readonly YoutubeClient _youtubeClient = new();

    public M3U8Parser(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<StreamAnalysisResult> ParseAsync(string url, int retryCount = 0)
    {
        var targetUri = new Uri(url);
        var result = new StreamAnalysisResult
        {
            Title = GetSmartFallbackTitle(targetUri),
            Platform = DetectPlatformName(targetUri)
        };

        // 0. Dedicated YouTube Video Extractor via YoutubeExplode
        if (targetUri.Host.Contains("youtube.com", StringComparison.OrdinalIgnoreCase) || 
            targetUri.Host.Contains("youtu.be", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var video = await _youtubeClient.Videos.GetAsync(url);
                var streamManifest = await _youtubeClient.Videos.Streams.GetManifestAsync(video.Id);

                result.Title = video.Title;
                result.Description = video.Description;
                result.DurationSeconds = (int)(video.Duration?.TotalSeconds ?? 0);
                result.ThumbnailUrl = $"https://i.ytimg.com/vi/{video.Id}/maxresdefault.jpg";
                result.Platform = "YouTube";

                var bestAudio = streamManifest.GetAudioOnlyStreams().GetWithHighestBitrate();
                string audioUrl = bestAudio?.Url ?? string.Empty;

                var muxedStreams = streamManifest.GetMuxedStreams().OrderByDescending(s => s.VideoQuality).ToList();
                foreach (var stream in muxedStreams)
                {
                    result.Qualities.Add(new StreamQuality
                    {
                        Resolution = $"{stream.VideoQuality.Label} HD (Video + Audio)",
                        Url = stream.Url,
                        AudioUrl = string.Empty, // Native muxed
                        IsDirectFile = true,
                        DurationSeconds = result.DurationSeconds,
                        Bandwidth = stream.Bitrate.BitsPerSecond
                    });
                }

                var videoStreams = streamManifest.GetVideoOnlyStreams().Where(s => s.Container == Container.Mp4).OrderByDescending(s => s.VideoQuality).ToList();
                foreach (var stream in videoStreams)
                {
                    result.Qualities.Add(new StreamQuality
                    {
                        Resolution = $"{stream.VideoQuality.Label} (Video + Audio)",
                        Url = stream.Url,
                        AudioUrl = audioUrl,
                        IsDirectFile = true,
                        DurationSeconds = result.DurationSeconds,
                        Bandwidth = stream.Bitrate.BitsPerSecond + (bestAudio?.Bitrate.BitsPerSecond ?? 0)
                    });
                }

                if (bestAudio != null)
                {
                    result.Qualities.Add(new StreamQuality
                    {
                        Resolution = "Audio Only (HQ M4A)",
                        Url = bestAudio.Url,
                        AudioUrl = string.Empty,
                        IsDirectFile = true,
                        DurationSeconds = result.DurationSeconds,
                        Bandwidth = bestAudio.Bitrate.BitsPerSecond
                    });
                }

                if (result.Qualities.Count > 0)
                {
                    return result;
                }
            }
            catch (Exception ex)
            {
                // Fallback to HTML analysis if API is throttled
                Console.WriteLine($"[YouTube Parser Notice] {ex.Message}");
            }
        }

        // 1. Direct video file extension check (.mp4, .webm, .m4v)
        if (IsDirectMediaExtension(targetUri))
        {
            return await AnalyzeDirectMediaUrlAsync(url, result);
        }

        // 2. Fetch Content with declarative header negotiation
        var (content, finalUri, contentType) = await FetchContentWithNegotiationAsync(url);

        if (contentType.Contains("video/mp4") || contentType.Contains("video/webm"))
        {
            return await AnalyzeDirectMediaUrlAsync(finalUri.ToString(), result);
        }

        // 3. HTML Webpage Analysis
        if (content.Contains("<!DOCTYPE html", StringComparison.OrdinalIgnoreCase) || 
            content.Contains("<html", StringComparison.OrdinalIgnoreCase) ||
            content.Contains("<head", StringComparison.OrdinalIgnoreCase))
        {
            ExtractMetadataFromHtml(content, result);
            var (detectedMasterUrl, detectedQualities) = await ExtractStreamsFromHtmlAsync(content, finalUri);

            if (!string.IsNullOrEmpty(detectedMasterUrl))
            {
                try
                {
                    var innerResult = await ParseAsync(detectedMasterUrl);
                    if (string.IsNullOrEmpty(innerResult.ThumbnailUrl)) innerResult.ThumbnailUrl = result.ThumbnailUrl;
                    if (!string.IsNullOrEmpty(result.Title) && result.Title != "High-Definition Video Stream" && !result.Title.EndsWith("Video Stream"))
                    {
                        innerResult.Title = result.Title;
                    }
                    if (!string.IsNullOrEmpty(result.Description)) innerResult.Description = result.Description;
                    if (innerResult.DurationSeconds == 0) innerResult.DurationSeconds = result.DurationSeconds;
                    innerResult.Platform = result.Platform;

                    if (innerResult.Qualities.Count > 0)
                    {
                        foreach (var q in innerResult.Qualities)
                        {
                            q.DurationSeconds = innerResult.DurationSeconds;
                            if (q.DirectContentLengthBytes > 0 && innerResult.DurationSeconds > 0)
                            {
                                q.Bandwidth = (long)((q.DirectContentLengthBytes * 8.0) / innerResult.DurationSeconds);
                            }
                        }
                    }
                    else if (detectedQualities.Count > 0)
                    {
                        innerResult.Qualities = detectedQualities;
                        foreach (var q in innerResult.Qualities)
                        {
                            q.DurationSeconds = innerResult.DurationSeconds;
                            if (q.DirectContentLengthBytes > 0 && innerResult.DurationSeconds > 0)
                            {
                                q.Bandwidth = (long)((q.DirectContentLengthBytes * 8.0) / innerResult.DurationSeconds);
                            }
                        }
                    }

                    return innerResult;
                }
                catch (Exception)
                {
                    if (detectedQualities.Count > 0)
                    {
                        result.Qualities = detectedQualities;
                        foreach (var q in result.Qualities)
                        {
                            q.DurationSeconds = result.DurationSeconds;
                        }
                        return result;
                    }
                    throw;
                }
            }
            else if (detectedQualities.Count > 0)
            {
                result.Qualities = detectedQualities;
                foreach (var q in result.Qualities)
                {
                    q.DurationSeconds = result.DurationSeconds;
                }
                return result;
            }
            else
            {
                // Delayed source check for SPAs (Next.js / client-side players)
                if (retryCount < 2 && (content.Contains("__NEXT_DATA__") || content.Contains("react") || content.Contains("nextjs")))
                {
                    await Task.Delay(1500 * (retryCount + 1));
                    return await ParseAsync(url, retryCount + 1);
                }

                if (content.Contains("__NEXT_DATA__") || targetUri.Host.Contains("pixelflix") || targetUri.Host.Contains("instagram") || targetUri.Host.Contains("youtube"))
                {
                    result.RequiresBrowserContext = true;
                    result.StatusMessage = $"This streaming player loads dynamically via browser JavaScript. Please open the link in your browser and use the Stream Helper extension to download at full speed.";
                    throw new Exception(result.StatusMessage);
                }

                throw new Exception("Webpage URL detected, but could not auto-extract a video stream. Please ensure the stream is active or use the Stream Helper browser extension.");
            }
        }

        // 4. HLS Master Playlist
        if (content.Contains("#EXT-X-STREAM-INF"))
        {
            result.IsMaster = true;
            result.Qualities = ParseMasterPlaylist(content, finalUri);
            return result;
        }
        // 5. HLS Media Playlist
        else if (content.Contains("#EXTM3U") || content.Contains("#EXTINF"))
        {
            result.IsMaster = false;
            var (segments, duration) = ParseMediaPlaylistWithDuration(content, finalUri);
            result.SegmentUrls = segments;
            result.TotalSegments = segments.Count;
            result.DurationSeconds = duration;
            return result;
        }
        else
        {
            result.IsDirectMediaFile = true;
            result.Qualities.Add(new StreamQuality
            {
                Resolution = "1080p Full HD",
                Url = url,
                IsDirectFile = true
            });
            return result;
        }
    }

    private static bool IsDirectMediaExtension(Uri uri)
    {
        string path = uri.AbsolutePath.ToLowerInvariant();
        return path.EndsWith(".mp4") || path.EndsWith(".webm") || path.EndsWith(".m4v") || path.EndsWith(".mkv");
    }

    private async Task<StreamAnalysisResult> AnalyzeDirectMediaUrlAsync(string url, StreamAnalysisResult result)
    {
        result.IsMaster = false;
        result.IsDirectMediaFile = true;

        long length = 0;
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Head, url);
            req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
            var referers = StreamSecurityHelper.GetCandidateReferers(new Uri(url));
            if (referers.Count > 0 && !string.IsNullOrEmpty(referers[0]))
            {
                req.Headers.TryAddWithoutValidation("Referer", referers[0]);
            }

            using var res = await _httpClient.SendAsync(req);
            if (res.Content.Headers.ContentLength.HasValue)
            {
                length = res.Content.Headers.ContentLength.Value;
            }
        }
        catch { }

        result.ContentLengthBytes = length;
        long calcBw = (length > 0 && result.DurationSeconds > 0) 
            ? (long)((length * 8.0) / result.DurationSeconds) 
            : ((length > 0) ? (long)((length * 8.0) / 1800.0) : 4000000);

        result.Qualities = new List<StreamQuality>
        {
            new StreamQuality
            {
                Resolution = "Original Quality (Direct Stream)",
                Url = url,
                DirectContentLengthBytes = length,
                DurationSeconds = result.DurationSeconds,
                Bandwidth = calcBw,
                IsDirectFile = true
            }
        };

        return result;
    }

    private void ExtractMetadataFromHtml(string html, StreamAnalysisResult result)
    {
        // 1. Extract Exact Title (Priority: JSON video_title -> og:title -> twitter:title -> <title>)
        var jsonTitleMatch = Regex.Match(html, @"[""']video_title[""']\s*:\s*[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (jsonTitleMatch.Success && !string.IsNullOrWhiteSpace(jsonTitleMatch.Groups[1].Value))
        {
            result.Title = CleanTitle(jsonTitleMatch.Groups[1].Value);
        }
        else
        {
            var ogTitleMatch = Regex.Match(html, @"<meta\s+(?:property|name)=[""'](?:og:title|twitter:title)[""']\s+content=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
            if (ogTitleMatch.Success)
            {
                result.Title = CleanTitle(ogTitleMatch.Groups[1].Value);
            }
            else
            {
                var titleMatch = Regex.Match(html, @"<title>([^<]+)</title>", RegexOptions.IgnoreCase);
                if (titleMatch.Success)
                {
                    result.Title = CleanTitle(titleMatch.Groups[1].Value);
                }
            }
        }

        // 2. Extract Description
        var ogDescMatch = Regex.Match(html, @"<meta\s+(?:property|name)=[""'](?:og:description|twitter:description|description)[""']\s+content=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (ogDescMatch.Success)
        {
            result.Description = CleanDescription(WebUtility.HtmlDecode(ogDescMatch.Groups[1].Value).Trim());
        }

        // 3. Extract Thumbnail Image
        var ogImageMatch = Regex.Match(html, @"<meta\s+(?:property|name)=[""'](?:og:image|twitter:image|twitter:image:src)[""']\s+content=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (ogImageMatch.Success)
        {
            result.ThumbnailUrl = ogImageMatch.Groups[1].Value;
        }
        else
        {
            var linkThumbMatch = Regex.Match(html, @"<link\s+rel=[""']image_src[""']\s+href=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
            if (linkThumbMatch.Success)
            {
                result.ThumbnailUrl = linkThumbMatch.Groups[1].Value;
            }
        }

        // 4. Extract Duration
        var durMatch = Regex.Match(html, @"<meta\s+(?:property|itemprop)=[""'](?:video:duration|duration)[""']\s+content=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (durMatch.Success)
        {
            result.DurationSeconds = ParseDurationSeconds(durMatch.Groups[1].Value);
        }
    }

    private static string CleanTitle(string rawTitle)
    {
        if (string.IsNullOrWhiteSpace(rawTitle)) return "High-Definition Video";
        
        string decoded = WebUtility.HtmlDecode(rawTitle).Trim();
        decoded = Regex.Replace(decoded, @"^Watch\s+(?:Free\s+)?(?:Full\s+Video\s+)?", "", RegexOptions.IgnoreCase);
        decoded = Regex.Replace(decoded, @"\s*[-|–—/•]\s*(?:Pornhub\.com|Pornhub|XNXX\.COM|XNXX|XVideos\.com|XVideos|PixelFlix|YouTube|Instagram|PvrPlay|Twitter|TikTok)\s*$", "", RegexOptions.IgnoreCase);
        
        return string.IsNullOrWhiteSpace(decoded) ? "High-Definition Video" : decoded.Trim();
    }

    private static string CleanDescription(string rawDesc)
    {
        if (string.IsNullOrWhiteSpace(rawDesc)) return string.Empty;
        string decoded = WebUtility.HtmlDecode(rawDesc).Trim();
        decoded = Regex.Replace(decoded, @"^Watch\s+(?:Free\s+)?(?:Full\s+Video\s+)?", "", RegexOptions.IgnoreCase);
        return decoded;
    }

    private static int ParseDurationSeconds(string input)
    {
        if (int.TryParse(input, out var sec)) return sec;
        var isoMatch = Regex.Match(input, @"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", RegexOptions.IgnoreCase);
        if (isoMatch.Success)
        {
            int h = int.TryParse(isoMatch.Groups[1].Value, out var v1) ? v1 : 0;
            int m = int.TryParse(isoMatch.Groups[2].Value, out var v2) ? v2 : 0;
            int s = int.TryParse(isoMatch.Groups[3].Value, out var v3) ? v3 : 0;
            return (h * 3600) + (m * 60) + s;
        }
        return 0;
    }

    private static string DetectPlatformName(Uri uri)
    {
        var host = uri.Host.ToLowerInvariant();
        if (host.Contains("pornhub") || host.Contains("phncdn")) return "Pornhub";
        if (host.Contains("xnxx")) return "XNXX";
        if (host.Contains("xvideos")) return "XVideos";
        if (host.Contains("xhaccess") || host.Contains("xhamster")) return "xHamster";
        if (host.Contains("pixelflix")) return "PixelFlix";
        if (host.Contains("youtube") || host.Contains("googlevideo")) return "YouTube";
        if (host.Contains("instagram")) return "Instagram";
        if (host.Contains("twitch")) return "Twitch";
        if (host.Contains("vimeo")) return "Vimeo";
        return uri.Host.Replace("www.", "");
    }

    private static string GetSmartFallbackTitle(Uri uri)
    {
        string platform = DetectPlatformName(uri);
        return $"{platform} Video Stream";
    }

    private async Task<(string Content, Uri FinalUri, string ContentType)> FetchContentWithNegotiationAsync(string url)
    {
        var targetUri = new Uri(url);
        var referers = StreamSecurityHelper.GetCandidateReferers(targetUri);

        foreach (var referer in referers)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                request.Headers.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
                request.Headers.TryAddWithoutValidation("Accept-Language", "en-US,en;q=0.9");
                request.Headers.TryAddWithoutValidation("Cookie", "platform=pc; bs=1; ss=1; accessAgeDisclaimerPH=1; age_verified=1");

                if (!string.IsNullOrEmpty(referer))
                {
                    request.Headers.TryAddWithoutValidation("Referer", referer);
                }

                using var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync();
                    var cType = response.Content.Headers.ContentType?.MediaType ?? string.Empty;
                    if (!string.IsNullOrWhiteSpace(body))
                    {
                        return (body, response.RequestMessage?.RequestUri ?? targetUri, cType);
                    }
                }
            }
            catch { }
        }

        using var finalReq = new HttpRequestMessage(HttpMethod.Get, url);
        finalReq.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
        finalReq.Headers.TryAddWithoutValidation("Accept", "*/*");
        finalReq.Headers.TryAddWithoutValidation("Cookie", "platform=pc; bs=1; ss=1; accessAgeDisclaimerPH=1; age_verified=1");
        using var finalRes = await _httpClient.SendAsync(finalReq);
        finalRes.EnsureSuccessStatusCode();

        var content = await finalRes.Content.ReadAsStringAsync();
        var ct = finalRes.Content.Headers.ContentType?.MediaType ?? string.Empty;
        return (content, finalRes.RequestMessage?.RequestUri ?? targetUri, ct);
    }

    private async Task<(string? MasterUrl, List<StreamQuality> Qualities)> ExtractStreamsFromHtmlAsync(string html, Uri baseUri)
    {
        string cleanedHtml = html.Replace("\\/", "/");
        var qualities = new List<StreamQuality>();

        // 0. Automatic PixelFlix / ReelsDownload API Stream Resolver
        var pfMatch = Regex.Match(baseUri.ToString(), @"pixelflix\.cc/(?:watch|title)/(tv|movie)/(\d+)", RegexOptions.IgnoreCase);
        if (pfMatch.Success)
        {
            string type = pfMatch.Groups[1].Value.ToLower();
            string tmdbId = pfMatch.Groups[2].Value;
            var extractApis = new[]
            {
                $"https://embed.reelsdownload.online/api/redflix-extract?type={type}&tmdb_id={tmdbId}&season=1&episode=1",
                $"https://embed.reelsdownload.online/api/vidxgo-extract?type={type}&tmdb_id={tmdbId}&season=1&episode=1",
                $"https://embed.reelsdownload.online/api/cinemaos-extract?type={type}&tmdb_id={tmdbId}&season=1&episode=1",
                $"https://embed.reelsdownload.online/api/rive-extract?type={type}&tmdb_id={tmdbId}&season=1&episode=1"
            };

            foreach (var api in extractApis)
            {
                try
                {
                    using var apiReq = new HttpRequestMessage(HttpMethod.Get, api);
                    apiReq.Headers.TryAddWithoutValidation("Referer", $"https://embed.reelsdownload.online/player/{tmdbId}/1/1?key=k_5661ac637169a1733857dc50");
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
                            return (streamSrc, qualities);
                        }
                    }
                }
                catch { }
            }
        }

        // 0. Parse JWPlayer / Custom Player Playlist & Sources JSON (e.g. window.playlist = { sources: [...] })
        var playlistMatches = Regex.Matches(cleanedHtml, @"(?:window\.)?(?:playlist|playerConfig|videoData|playerSetup)\s*=\s*(\{[\s\S]*?\});", RegexOptions.IgnoreCase);
        foreach (Match pm in playlistMatches)
        {
            try
            {
                string jsonText = pm.Groups[1].Value.Trim();
                using var pDoc = JsonDocument.Parse(jsonText);
                if (pDoc.RootElement.TryGetProperty("sources", out var sourcesEl) && sourcesEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var sItem in sourcesEl.EnumerateArray())
                    {
                        if (sItem.TryGetProperty("file", out var fileEl))
                        {
                            string fileUrl = fileEl.GetString() ?? "";
                            string label = sItem.TryGetProperty("label", out var lblEl) ? lblEl.GetString() ?? "720" : "720";
                            if (!string.IsNullOrEmpty(fileUrl) && (fileUrl.Contains(".mp4") || fileUrl.Contains(".m3u8") || fileUrl.Contains(".webm")))
                            {
                                string cleanFileUrl = Regex.Unescape(fileUrl);
                                int h = int.TryParse(Regex.Match(label, @"\d+").Value, out var ph) ? ph : 720;
                                qualities.Add(new StreamQuality
                                {
                                    Resolution = $"{h}p HD",
                                    Url = cleanFileUrl,
                                    IsDirectFile = !cleanFileUrl.Contains(".m3u8"),
                                    Bandwidth = h * 5000
                                });
                            }
                        }
                    }
                    if (qualities.Count > 0)
                    {
                        return (qualities[0].Url, qualities.OrderByDescending(q => q.Bandwidth).ToList());
                    }
                }
            }
            catch { }
        }

        // 0b. Parse Generic Source Objects: {"file":"https://...mp4", "label":"720"}
        var genericSources = Regex.Matches(cleanedHtml, @"\{[^{}]*[""']file[""']\s*:\s*[""'](https?:[^""']+\.(?:mp4|m3u8|webm)[^""']*)[""'][^{}]*\}", RegexOptions.IgnoreCase);
        foreach (Match gMatch in genericSources)
        {
            string block = gMatch.Value;
            var fileMatch = Regex.Match(block, @"[""']file[""']\s*:\s*[""']([^""']+)[""']");
            var labelMatch = Regex.Match(block, @"[""']label[""']\s*:\s*[""']?(\d+p?|\w+)[""']?");
            if (fileMatch.Success)
            {
                string rawUrl = Regex.Unescape(fileMatch.Groups[1].Value);
                string lbl = labelMatch.Success ? labelMatch.Groups[1].Value : "720";
                int h = int.TryParse(Regex.Match(lbl, @"\d+").Value, out var ph) ? ph : 720;
                if (!qualities.Any(q => q.Url == rawUrl))
                {
                    qualities.Add(new StreamQuality
                    {
                        Resolution = $"{h}p HD",
                        Url = rawUrl,
                        IsDirectFile = !rawUrl.Contains(".m3u8"),
                        Bandwidth = h * 5000
                    });
                }
            }
        }
        if (qualities.Count > 0)
        {
            return (qualities[0].Url, qualities.OrderByDescending(q => q.Bandwidth).ToList());
        }

        // 1. Check for Master Playlist in JSON (e.g. master.m3u8)
        var masterMatch = Regex.Match(cleanedHtml, @"[""']videoUrl[""']\s*:\s*[""']([^""']*master\.m3u8[^""']*)[""']", RegexOptions.IgnoreCase);
        if (masterMatch.Success)
        {
            return (masterMatch.Groups[1].Value, qualities);
        }

        // 2. OpenGraph / Twitter Player video streams
        var ogVideoMatch = Regex.Match(cleanedHtml, @"<meta\s+(?:property|name)=[""'](?:og:video|og:video:url|og:video:secure_url|twitter:player:stream)[""']\s+content=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (ogVideoMatch.Success)
        {
            string ogUrl = ogVideoMatch.Groups[1].Value;
            if (ogUrl.Contains(".m3u8", StringComparison.OrdinalIgnoreCase) || ogUrl.Contains("/hls/"))
            {
                return (ResolveUrl(baseUri, ogUrl), qualities);
            }
            else if (ogUrl.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) || ogUrl.Contains(".mp4?"))
            {
                qualities.Add(new StreamQuality { Resolution = "1080p Full HD (Direct)", Url = ResolveUrl(baseUri, ogUrl), IsDirectFile = true });
                return (ResolveUrl(baseUri, ogUrl), qualities);
            }
        }

        // 3. HTML5 <video> and <source> tags
        var videoTagMatch = Regex.Match(cleanedHtml, @"<(?:video|source)[^>]+src=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (videoTagMatch.Success)
        {
            string srcUrl = videoTagMatch.Groups[1].Value;
            if (!srcUrl.StartsWith("blob:") && !srcUrl.StartsWith("data:"))
            {
                string resolved = ResolveUrl(baseUri, srcUrl);
                if (resolved.Contains(".m3u8") || resolved.Contains("/hls/"))
                {
                    return (resolved, qualities);
                }
                else if (resolved.Contains(".mp4") || resolved.Contains(".webm"))
                {
                    qualities.Add(new StreamQuality { Resolution = "1080p Full HD (HTML5 Video)", Url = resolved, IsDirectFile = true });
                    return (resolved, qualities);
                }
            }
        }

        // 4. JSON-LD VideoObject schema
        var jsonLdMatches = Regex.Matches(cleanedHtml, @"<script[^>]+type=[""']application/ld\+json[""'][^>]*>(.*?)</script>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
        foreach (Match jsonLd in jsonLdMatches)
        {
            try
            {
                string jsonText = jsonLd.Groups[1].Value.Trim();
                var contentUrlMatch = Regex.Match(jsonText, @"[""']contentUrl[""']\s*:\s*[""']([^""']+)[""']");
                if (contentUrlMatch.Success)
                {
                    string cUrl = ResolveUrl(baseUri, contentUrlMatch.Groups[1].Value);
                    if (cUrl.Contains(".m3u8") || cUrl.Contains(".mp4"))
                    {
                        return (cUrl, qualities);
                    }
                }
            }
            catch { }
        }

        // 5. Parse quality entries from JSON mediaDefinitions / flashvars
        var qualityBlocks = Regex.Matches(cleanedHtml, @"\{[^{}]*[""']videoUrl[""']\s*:\s*[""']([^""']+)[""'][^{}]*\}", RegexOptions.IgnoreCase);
        foreach (Match block in qualityBlocks)
        {
            string blockText = block.Value;
            var urlMatch = Regex.Match(blockText, @"[""']videoUrl[""']\s*:\s*[""']([^""']+)[""']");
            var qMatch = Regex.Match(blockText, @"[""']quality[""']\s*:\s*(?:[""']([^""']+)[""']|\[([^\]]+)\]|(\d+))");

            if (urlMatch.Success)
            {
                string streamUrl = urlMatch.Groups[1].Value;
                if (streamUrl.Contains("master.m3u8", StringComparison.OrdinalIgnoreCase))
                {
                    return (streamUrl, qualities);
                }

                string qVal = "1080";
                if (qMatch.Success)
                {
                    qVal = !string.IsNullOrEmpty(qMatch.Groups[1].Value) ? qMatch.Groups[1].Value :
                           !string.IsNullOrEmpty(qMatch.Groups[3].Value) ? qMatch.Groups[3].Value : "1080";
                }

                int h = int.TryParse(qVal, out var parsedH) ? parsedH : 1080;
                string res = h switch
                {
                    2160 => "3840x2160",
                    1440 => "2560x1440",
                    1080 => "1920x1080",
                    720 => "1280x720",
                    480 => "854x480",
                    360 => "640x360",
                    240 => "426x240",
                    _ => $"{h}p"
                };

                long estBw = h switch
                {
                    2160 => 12000000,
                    1440 => 8000000,
                    1080 => 4100000,
                    720 => 2200000,
                    480 => 1100000,
                    360 => 700000,
                    _ => 400000
                };

                if (!qualities.Any(q => q.Url == streamUrl))
                {
                    qualities.Add(new StreamQuality
                    {
                        Resolution = res,
                        Bandwidth = estBw,
                        Url = streamUrl
                    });
                }
            }
        }

        if (qualities.Count > 0)
        {
            qualities = qualities.OrderByDescending(q => q.Bandwidth).ToList();
            return (qualities[0].Url, qualities);
        }

        // 6. Direct general M3U8 match
        var generalMatch = Regex.Match(cleanedHtml, @"(https?://[^\s""'<>]+\.m3u8[^\s""'<>]*)", RegexOptions.IgnoreCase);
        if (generalMatch.Success)
        {
            return (generalMatch.Groups[1].Value, qualities);
        }

        // 7. Relative M3U8 match
        var relativeMatch = Regex.Match(cleanedHtml, @"[""'](/[^""'\s<>]+\.m3u8[^""'\s<>]*)[""']", RegexOptions.IgnoreCase);
        if (relativeMatch.Success)
        {
            return (ResolveUrl(baseUri, relativeMatch.Groups[1].Value), qualities);
        }

        // 8. Embedded player iframe checking
        var iframeMatch = Regex.Match(cleanedHtml, @"<iframe[^>]+src=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (iframeMatch.Success)
        {
            string iframeSrc = ResolveUrl(baseUri, iframeMatch.Groups[1].Value);
            if (iframeSrc.StartsWith("http") && !iframeSrc.Contains("google") && !iframeSrc.Contains("facebook"))
            {
                try
                {
                    var (iframeContent, iframeUri, _) = await FetchContentWithNegotiationAsync(iframeSrc);
                    var (innerMaster, innerQ) = await ExtractStreamsFromHtmlAsync(iframeContent, iframeUri);
                    if (!string.IsNullOrEmpty(innerMaster) || innerQ.Count > 0)
                    {
                        return (innerMaster, innerQ);
                    }
                }
                catch { }
            }
        }

        // 9. Direct MP4 link match in page
        var mp4Match = Regex.Match(cleanedHtml, @"(https?://[^\s""'<>]+\.(?:mp4|webm)[^\s""'<>]*)", RegexOptions.IgnoreCase);
        if (mp4Match.Success)
        {
            qualities.Add(new StreamQuality { Resolution = "1080p Full HD (Direct File)", Url = mp4Match.Groups[1].Value, IsDirectFile = true });
            return (mp4Match.Groups[1].Value, qualities);
        }

        return (null, qualities);
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

    private (List<string> Segments, int DurationSeconds) ParseMediaPlaylistWithDuration(string content, Uri baseUri)
    {
        var segments = new List<string>();
        double totalDuration = 0;
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
                var dMatch = Regex.Match(line, @"#EXTINF:([\d.]+)");
                if (dMatch.Success && double.TryParse(dMatch.Groups[1].Value, out var d))
                {
                    totalDuration += d;
                }

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

        return (segments.Distinct().ToList(), (int)Math.Round(totalDuration));
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
