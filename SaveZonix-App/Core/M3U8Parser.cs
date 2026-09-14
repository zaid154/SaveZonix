using System.Net;
using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using YoutubeExplode;
using YoutubeExplode.Videos.Streams;
using Zonix.Core.Extractors;

namespace Zonix.Core;

public class M3U8Parser
{
    private readonly HttpClient _httpClient;
    private readonly YoutubeClient _youtubeClient = new();
    private readonly ExtractorDispatcher _dispatcher;

    public M3U8Parser(HttpClient httpClient)
    {
        _httpClient = httpClient;

        var extractors = new List<IVideoExtractor>
        {
            new YouTubeExtractor(httpClient),
            new InstagramExtractor(httpClient),
            new PixelflixExtractor(httpClient),
            new PornhubExtractor(httpClient, this),
            new OtherSitesExtractor(this)
        };
        _dispatcher = new ExtractorDispatcher(extractors);
    }

    public async Task<StreamAnalysisResult> ParseAsync(string url, int retryCount = 0)
    {
        return await _dispatcher.DispatchAsync(url, retryCount);
    }

    public async Task<StreamAnalysisResult> ParseInternalAsync(string url, int retryCount = 0)
    {
        var targetUri = new Uri(url);
        var result = new StreamAnalysisResult
        {
            Title = GetSmartFallbackTitle(targetUri),
            Platform = DetectPlatformName(targetUri)
        };

        // 0. Dedicated YouTube Video Extractor via YoutubeExplode (with retry logic)
        if (targetUri.Host.Contains("youtube.com", StringComparison.OrdinalIgnoreCase) || 
            targetUri.Host.Contains("youtu.be", StringComparison.OrdinalIgnoreCase))
        {
            return await ExtractYouTubeWithRetryAsync(url, result, retryCount);
        }

        // Instagram's normal reel page redirects server-side clients to login,
        // even for public posts. Its public embed document is still available
        // without a browser session and contains the signed progressive URL.
        // Resolve it before requesting the regular webpage.
        if (targetUri.Host.Contains("instagram.com", StringComparison.OrdinalIgnoreCase))
        {
            var embedResult = await ExtractInstagramFromPublicEmbedAsync(targetUri, url, result);
            if (embedResult != null)
            {
                return embedResult;
            }

            var oembedResult = await ExtractInstagramOEmbedFallbackAsync(url, result);
            if (oembedResult != null)
            {
                return oembedResult;
            }
        }

        // 1. Direct video file extension check (.mp4, .webm, .m4v)
        if (IsDirectMediaExtension(targetUri) || IsKnownProgressiveMediaUri(targetUri))
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

                    // Fallback to direct detected stream URL
                    bool isM3u8Url = detectedMasterUrl.Contains(".m3u8", StringComparison.OrdinalIgnoreCase);
                    result.IsDirectMediaFile = !isM3u8Url && (detectedMasterUrl.Contains(".mp4") || detectedMasterUrl.Contains(".webm"));
                    result.Qualities.Add(new StreamQuality
                    {
                        Resolution = isM3u8Url ? "1080p Full HD (HLS Stream)" : "Original Quality (Direct Stream)",
                        Url = detectedMasterUrl,
                        IsDirectFile = result.IsDirectMediaFile,
                        DurationSeconds = result.DurationSeconds,
                        Bandwidth = 4500000
                    });
                    return result;
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
                // Special handling for Instagram
                if (targetUri.Host.Contains("instagram"))
                {
                    var instagramResult = await ExtractInstagramVideoAsync(url, content, result);
                    if (instagramResult != null)
                    {
                        return instagramResult;
                    }
                }

                // Delayed source check for SPAs (Next.js / client-side players)
                if (retryCount < 2 && (content.Contains("__NEXT_DATA__") || content.Contains("react") || content.Contains("nextjs")))
                {
                    await Task.Delay(1500 * (retryCount + 1));
                    return await ParseAsync(url, retryCount + 1);
                }

                if (content.Contains("__NEXT_DATA__") || targetUri.Host.Contains("pixelflix") || targetUri.Host.Contains("youtube"))
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
            result.IsDirectMediaFile = false;

            // RFC 8216: In HLS, playlists without #EXT-X-ENDLIST are live streams with a rolling buffer
            bool hasEndList = content.Contains("#EXT-X-ENDLIST");
            result.IsLiveStream = !hasEndList;

            if (result.IsLiveStream)
            {
                if (!string.IsNullOrEmpty(result.Platform) && !result.Platform.Contains("Live"))
                {
                    result.Platform += " (Live Broadcast)";
                }
            }

            // Always add a StreamQuality item so that the client UI receives an explicit choice with IsDirectFile = false
            if (result.Qualities.Count == 0)
            {
                result.Qualities.Add(new StreamQuality
                {
                    Resolution = result.IsLiveStream ? "🔴 Live Stream (Adaptive)" : "Original Quality (HLS Stream)",
                    Url = url,
                    IsDirectFile = false,
                    DurationSeconds = duration,
                    Bandwidth = 3500000
                });
            }

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
        if (path.EndsWith(".m3u8") || path.Contains(".m3u8/")) return false;

        return path.EndsWith(".mp4") || path.EndsWith(".webm") || path.EndsWith(".m4v") || path.EndsWith(".mkv") ||
               path.Contains(".mp4/") || path.Contains(".webm/") || path.Contains(".m4v/") ||
               path.Contains("/get_file/");
    }

    private static bool IsKnownProgressiveMediaUri(Uri uri)
    {
        string host = uri.Host.ToLowerInvariant();
        string path = uri.AbsolutePath.ToLowerInvariant();

        // Instagram CDN URLs intentionally omit a .mp4 filename extension,
        // e.g. ...fbcdn.net/o1/v/t16/....  They are still progressive MP4s.
        return (host.Contains("cdninstagram.com") || host.Contains("fbcdn.net")) &&
               (path.Contains("/o1/v/") || path.Contains("/v/t"));
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
            if (res.Content.Headers.ContentLength.HasValue && res.Content.Headers.ContentLength.Value > 0)
            {
                length = res.Content.Headers.ContentLength.Value;
            }
        }
        catch { }

        // Fallback: Ranged GET (bytes 0-0) if HEAD returned 0 or was blocked
        if (length == 0)
        {
            try
            {
                using var rangeReq = new HttpRequestMessage(HttpMethod.Get, url);
                rangeReq.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                rangeReq.Headers.TryAddWithoutValidation("Range", "bytes=0-0");
                var referers = StreamSecurityHelper.GetCandidateReferers(new Uri(url));
                if (referers.Count > 0 && !string.IsNullOrEmpty(referers[0]))
                {
                    rangeReq.Headers.TryAddWithoutValidation("Referer", referers[0]);
                }

                using var rangeRes = await _httpClient.SendAsync(rangeReq, HttpCompletionOption.ResponseHeadersRead);
                if (rangeRes.Content.Headers.ContentRange?.Length.HasValue == true && rangeRes.Content.Headers.ContentRange.Length.Value > 0)
                {
                    length = rangeRes.Content.Headers.ContentRange.Length.Value;
                }
            }
            catch { }
        }

        if (length == 0 && result.ContentLengthBytes > 0)
        {
            length = result.ContentLengthBytes;
        }

        result.ContentLengthBytes = length;
        long calcBw = (length > 0 && result.DurationSeconds > 0) 
            ? (long)((length * 8.0) / result.DurationSeconds) 
            : ((length > 0) ? (long)((length * 8.0) / 1800.0) : 0);

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

    internal void ExtractMetadataFromHtml(string html, StreamAnalysisResult result)
    {
        // 1. Extract Exact Title (Priority: og:title -> twitter:title -> inlineFree/h1 -> JSON video_title -> <title>)
        string? candidateTitle = null;

        var ogTitleMatch = Regex.Match(html, @"<meta\s+(?:property|name)=[""'](?:og:title|twitter:title)[""']\s+content=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (ogTitleMatch.Success && !string.IsNullOrWhiteSpace(ogTitleMatch.Groups[1].Value))
        {
            candidateTitle = ogTitleMatch.Groups[1].Value;
        }

        if (string.IsNullOrWhiteSpace(candidateTitle))
        {
            var inlineFreeMatch = Regex.Match(html, @"<span[^>]*class=[""'][^""']*inlineFree[^""']*[""'][^>]*>([^<]+)</span>", RegexOptions.IgnoreCase);
            if (inlineFreeMatch.Success && !string.IsNullOrWhiteSpace(inlineFreeMatch.Groups[1].Value))
            {
                candidateTitle = inlineFreeMatch.Groups[1].Value;
            }
        }

        if (string.IsNullOrWhiteSpace(candidateTitle))
        {
            var h1Match = Regex.Match(html, @"<h1[^>]*>(?:<span[^>]*>)?([^<]+)(?:</span>)?</h1>", RegexOptions.IgnoreCase);
            if (h1Match.Success && !string.IsNullOrWhiteSpace(h1Match.Groups[1].Value))
            {
                candidateTitle = h1Match.Groups[1].Value;
            }
        }

        if (string.IsNullOrWhiteSpace(candidateTitle))
        {
            var jsonTitleMatch = Regex.Match(html, @"[""']video_title[""']\s*:\s*[""']([^""']+)[""']", RegexOptions.IgnoreCase);
            if (jsonTitleMatch.Success && !string.IsNullOrWhiteSpace(jsonTitleMatch.Groups[1].Value))
            {
                candidateTitle = jsonTitleMatch.Groups[1].Value;
            }
        }

        if (string.IsNullOrWhiteSpace(candidateTitle))
        {
            var titleMatch = Regex.Match(html, @"<title>([^<]+)</title>", RegexOptions.IgnoreCase);
            if (titleMatch.Success)
            {
                candidateTitle = titleMatch.Groups[1].Value;
            }
        }

        if (!string.IsNullOrWhiteSpace(candidateTitle))
        {
            result.Title = CleanTitle(candidateTitle);
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
        // Correct regex without character range bug:
        decoded = Regex.Replace(decoded, @"\s*(?:[-–—|/•]|\s-\s)\s*(?:Pornhub(?:\.com|\.org)?|XNXX(?:\.COM)?|XVideos(?:\.com)?|xHamster(?:\.com)?|PixelFlix|YouTube|Instagram|PvrPlay|Twitter|TikTok|SpankBang|OKXXX)\s*$", "", RegexOptions.IgnoreCase);
        
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

    internal async Task<(string Content, Uri FinalUri, string ContentType)> FetchContentWithNegotiationAsync(string url)
    {
        var targetUri = new Uri(url);

        // Some tube hosts reject .NET's TLS fingerprint or have SSL cipher mismatches.
        // Resolve page with curl first before standard negotiation.
        if ((targetUri.Host.Contains("freepornvideo.sex", StringComparison.OrdinalIgnoreCase) ||
             targetUri.Host.Contains("mat6tube.com", StringComparison.OrdinalIgnoreCase) ||
             targetUri.Host.Contains("pron.click", StringComparison.OrdinalIgnoreCase) ||
             targetUri.Host.Contains("pornhub.com", StringComparison.OrdinalIgnoreCase) ||
             targetUri.Host.Contains("pornhub.org", StringComparison.OrdinalIgnoreCase) ||
             targetUri.Host.Contains("phncdn.com", StringComparison.OrdinalIgnoreCase) ||
             targetUri.Host.Contains("xnxx.com", StringComparison.OrdinalIgnoreCase) ||
             targetUri.Host.Contains("xvideos.com", StringComparison.OrdinalIgnoreCase)) &&
            !IsDirectMediaExtension(targetUri))
        {
            var curlHtml = await FetchHtmlWithCurlAsync(url, targetUri);
            if (!string.IsNullOrWhiteSpace(curlHtml))
            {
                return (curlHtml, targetUri, "text/html");
            }
        }
        var referers = StreamSecurityHelper.GetCandidateReferers(targetUri);

        foreach (var referer in referers)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
                request.Headers.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
                request.Headers.TryAddWithoutValidation("Accept-Language", "en-US,en;q=0.9");
                request.Headers.TryAddWithoutValidation("Cookie", "platform=pc; bs=1; ss=1; accessAgeDisclaimerPH=1; age_verified=1; _sv=1");

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

        try
        {
            using var finalReq = new HttpRequestMessage(HttpMethod.Get, url);
            finalReq.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
            finalReq.Headers.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            finalReq.Headers.TryAddWithoutValidation("Cookie", "platform=pc; bs=1; ss=1; accessAgeDisclaimerPH=1; age_verified=1; _sv=1");
            using var finalRes = await _httpClient.SendAsync(finalReq);
            
            if (finalRes.StatusCode == HttpStatusCode.Forbidden || (int)finalRes.StatusCode == 403)
            {
                var curlHtml = await FetchHtmlWithCurlAsync(url, targetUri);
                if (!string.IsNullOrWhiteSpace(curlHtml))
                {
                    return (curlHtml, targetUri, "text/html");
                }
                throw new HttpRequestException($"Site '{targetUri.Host}' is protected by Cloudflare bot verification. Please play the video in your Chrome browser and click the Stream Helper extension (or copy the direct .m3u8 / .mp4 stream URL) to download!");
            }

            finalRes.EnsureSuccessStatusCode();

            var content = await finalRes.Content.ReadAsStringAsync();
            var ct = finalRes.Content.Headers.ContentType?.MediaType ?? string.Empty;
            return (content, finalRes.RequestMessage?.RequestUri ?? targetUri, ct);
        }
        catch (Exception ex)
        {
            if (ex is HttpRequestException hre && hre.Message.Contains("Cloudflare"))
            {
                throw;
            }

            var curlHtml = await FetchHtmlWithCurlAsync(url, targetUri);
            if (!string.IsNullOrWhiteSpace(curlHtml))
            {
                return (curlHtml, targetUri, "text/html");
            }
            throw;
        }
    }

    internal static async Task<string?> FetchHtmlWithCurlAsync(string url, Uri targetUri)
    {
        string? tempFile = null;
        try
        {
            string executable = OperatingSystem.IsWindows()
                ? Path.Combine(Environment.SystemDirectory, "curl.exe")
                : "curl";
            tempFile = Path.Combine(Path.GetTempPath(), $"zonix_curl_{Guid.NewGuid():N}.html");
            var startInfo = new ProcessStartInfo
            {
                FileName = executable,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            startInfo.ArgumentList.Add("--silent");
            startInfo.ArgumentList.Add("--show-error");
            startInfo.ArgumentList.Add("--location");
            startInfo.ArgumentList.Add("--insecure");
            startInfo.ArgumentList.Add("--max-time");
            startInfo.ArgumentList.Add("30");
            startInfo.ArgumentList.Add("--output");
            startInfo.ArgumentList.Add(tempFile);
            startInfo.ArgumentList.Add("--user-agent");
            startInfo.ArgumentList.Add("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36");
            startInfo.ArgumentList.Add("--header");
            startInfo.ArgumentList.Add("Accept-Language: en-US,en;q=0.9");
            startInfo.ArgumentList.Add("--header");
            startInfo.ArgumentList.Add("Cookie: platform=pc; bs=1; ss=1; accessAgeDisclaimerPH=1; age_verified=1; _sv=1");
            
            var candidateReferers = StreamSecurityHelper.GetCandidateReferers(targetUri);
            string referer = candidateReferers.Count > 0 ? candidateReferers[0] : $"{targetUri.Scheme}://{targetUri.Host}/";
            startInfo.ArgumentList.Add("--referer");
            startInfo.ArgumentList.Add(referer);

            if (Uri.TryCreate(referer, UriKind.Absolute, out var rUri))
            {
                startInfo.ArgumentList.Add("--header");
                startInfo.ArgumentList.Add($"Origin: {rUri.Scheme}://{rUri.Host}");
            }

            startInfo.ArgumentList.Add(url);

            using var process = Process.Start(startInfo);
            if (process == null) return null;
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(35));
            var stderr = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync(timeout.Token);
            _ = await stderr;
            string html = File.Exists(tempFile) ? await File.ReadAllTextAsync(tempFile, timeout.Token) : string.Empty;
            Console.WriteLine($"[Curl Fetcher] curl exit={process.ExitCode}, html={html.Length} bytes for {targetUri.Host}");
            
            return (html.Contains("#EXTM3U") || html.Length > 200) ? html : null;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[KVS Extractor] curl fallback failed: {ex.Message}");
            return null;
        }
        finally
        {
            try { if (!string.IsNullOrEmpty(tempFile) && File.Exists(tempFile)) File.Delete(tempFile); } catch { }
        }
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

        // 0a. xHamster Multi-Resolution HLS Parser (supports _TPL_ template or direct resolution suffix like 144p.av1.mp4.m3u8)
        var xhMultiMatch = Regex.Match(cleanedHtml, @"(https?:\/\/[^\s""'<>]+multi=[^\s""'<>]+\/[^\s""'<>]+\/(?:_TPL_|\d+p)[^\s""'<>]+\.m3u8)", RegexOptions.IgnoreCase);
        if (xhMultiMatch.Success)
        {
            string masterRawUrl = xhMultiMatch.Groups[1].Value;
            var multiPartMatch = Regex.Match(masterRawUrl, @"multi=([^/]+)");
            if (multiPartMatch.Success)
            {
                string multiPart = multiPartMatch.Groups[1].Value;
                var qEntries = Regex.Matches(multiPart, @"(\d+x\d+):(\w+):");
                foreach (Match qe in qEntries)
                {
                    string res = qe.Groups[1].Value;
                    string label = qe.Groups[2].Value; // e.g. 2160p, 1080p, 720p, 480p, 240p, 144p
                    string specificPlaylistUrl = Regex.Replace(masterRawUrl, @"\/(_TPL_|\d+p)", $"/{label}");
                    int h = int.TryParse(Regex.Match(label, @"\d+").Value, out var ph) ? ph : 720;
                    string resDisplay = h >= 2160 ? $"{label} 4K UHD ({res})" : (h >= 1080 ? $"{label} Full HD ({res})" : (h >= 720 ? $"{label} HD ({res})" : $"{label} SD ({res})"));
                    qualities.Add(new StreamQuality
                    {
                        Resolution = resDisplay,
                        Url = specificPlaylistUrl,
                        Bandwidth = h * 6000,
                        IsDirectFile = false
                    });
                }
                if (qualities.Count > 0)
                {
                    var sortedQualities = qualities.OrderByDescending(q => q.Bandwidth).ToList();
                    return (sortedQualities[0].Url, sortedQualities);
                }
            }
        }

        // 0b. mat6tube & pvvstream direct MP4 Full Video Extractor (strictly exclude 'tr_' preview trailers)
        var mat6Matches = Regex.Matches(cleanedHtml, @"(https?:\/\/[^""'\s<>]*(?:pvvstream\.pro\/videos\/)[^""'\s<>]*(?:vid_)(?:\d+p)\.mp4[^""'\s<>]*)", RegexOptions.IgnoreCase);
        foreach (Match m6 in mat6Matches)
        {
            string streamUrl = Regex.Unescape(m6.Groups[1].Value).Replace("\\u0026", "&").Replace("&amp;", "&");
            string label = "720p HD";
            if (streamUrl.Contains("1080p")) label = "1080p Full HD";
            else if (streamUrl.Contains("720p")) label = "720p HD";
            else if (streamUrl.Contains("480p")) label = "480p SD";
            else if (streamUrl.Contains("360p")) label = "360p SD";
            else if (streamUrl.Contains("240p")) label = "240p SD";

            if (!qualities.Any(q => q.Url == streamUrl))
            {
                int h = int.TryParse(Regex.Match(label, @"\d+").Value, out var ph) ? ph : 720;
                qualities.Add(new StreamQuality
                {
                    Resolution = label,
                    Url = streamUrl,
                    IsDirectFile = true,
                    Bandwidth = h * 5000
                });
            }
        }
        if (qualities.Count > 0)
        {
            return (qualities[0].Url, qualities.OrderByDescending(q => q.Bandwidth).ToList());
        }

        // 0c. Parse SpankBang & Tube stream_data: var stream_data = { "240p": ["https://...mp4"], "720p": ["https://...mp4"] }
        var streamDataMatches = Regex.Matches(cleanedHtml, @"(?:var\s+)?(?:stream_data|play_streams|video_sources|sources_data|streams)\s*=\s*(\{[\s\S]*?\});", RegexOptions.IgnoreCase);
        foreach (Match sdm in streamDataMatches)
        {
            try
            {
                string jsonText = sdm.Groups[1].Value.Trim();
                using var sDoc = JsonDocument.Parse(jsonText);
                foreach (var prop in sDoc.RootElement.EnumerateObject())
                {
                    string qLabel = prop.Name;
                    string? sUrl = null;
                    if (prop.Value.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in prop.Value.EnumerateArray())
                        {
                            var strVal = item.GetString();
                            if (!string.IsNullOrEmpty(strVal) && (strVal.Contains(".mp4") || strVal.Contains(".m3u8") || strVal.Contains(".webm") || strVal.Contains("http")))
                            {
                                sUrl = strVal;
                                break;
                            }
                        }
                    }
                    else if (prop.Value.ValueKind == JsonValueKind.String)
                    {
                        sUrl = prop.Value.GetString();
                    }

                    if (!string.IsNullOrEmpty(sUrl) && (sUrl.Contains(".mp4") || sUrl.Contains(".m3u8") || sUrl.Contains(".webm") || sUrl.StartsWith("http")))
                    {
                        string cleanUrl = Regex.Unescape(sUrl);
                        int h = int.TryParse(Regex.Match(qLabel, @"\d+").Value, out var ph) ? ph : 720;
                        if (!qualities.Any(q => q.Url == cleanUrl))
                        {
                            qualities.Add(new StreamQuality
                            {
                                Resolution = $"{qLabel.ToUpper()} (Direct)",
                                Url = cleanUrl,
                                IsDirectFile = !cleanUrl.Contains(".m3u8"),
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
            catch { }
        }

        // 0b. Parse Direct stream_url assignments: var stream_url = 'https://...';
        var directStreamUrlMatches = Regex.Matches(cleanedHtml, @"(?:var\s+)?(?:stream_url|main_stream|video_stream|streamUrl|mediaUrl)\s*=\s*[""'](https?:[^""']+\.(?:mp4|m3u8|webm)[^""']*)[""']", RegexOptions.IgnoreCase);
        foreach (Match dsu in directStreamUrlMatches)
        {
            string cleanUrl = Regex.Unescape(dsu.Groups[1].Value);
            if (!qualities.Any(q => q.Url == cleanUrl))
            {
                qualities.Add(new StreamQuality
                {
                    Resolution = "1080p Full HD (Direct)",
                    Url = cleanUrl,
                    IsDirectFile = !cleanUrl.Contains(".m3u8"),
                    Bandwidth = 4500000
                });
            }
        }
        if (qualities.Count > 0)
        {
            return (qualities[0].Url, qualities.OrderByDescending(q => q.Bandwidth).ToList());
        }

        // 0c. Parse JWPlayer / Custom Player Playlist & Sources JSON (e.g. window.playlist = { sources: [...] })
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
                if (rawUrl.Contains("/tr_") || rawUrl.Contains("_tr.")) continue;
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

        // 0d. Parse Pornhub / Tube mediaDefinitions JSON array: mediaDefinitions: [...]
        var phMediaDefMatch = Regex.Match(cleanedHtml, @"[""']mediaDefinitions[""']\s*:\s*(\[[\s\S]*?\])\s*,\s*[""']", RegexOptions.IgnoreCase);
        if (phMediaDefMatch.Success)
        {
            try
            {
                using var mdDoc = JsonDocument.Parse(phMediaDefMatch.Groups[1].Value);
                foreach (var item in mdDoc.RootElement.EnumerateArray())
                {
                    if (item.TryGetProperty("videoUrl", out var vUrlEl) && item.TryGetProperty("format", out var fmtEl))
                    {
                        string? vUrl = vUrlEl.GetString();
                        string? fmt = fmtEl.GetString();
                        if (!string.IsNullOrEmpty(vUrl) && (fmt == "hls" || vUrl.Contains(".m3u8")))
                        {
                            int height = 720;
                            if (item.TryGetProperty("height", out var hEl))
                            {
                                if (hEl.ValueKind == JsonValueKind.Number) hEl.TryGetInt32(out height);
                                else if (hEl.ValueKind == JsonValueKind.String) int.TryParse(hEl.GetString(), out height);
                            }
                            string qLabel = item.TryGetProperty("quality", out var qEl) && qEl.ValueKind == JsonValueKind.String ? qEl.GetString() ?? $"{height}p" : $"{height}p";
                            if (!qLabel.EndsWith("p", StringComparison.OrdinalIgnoreCase)) qLabel += "p";

                            if (!qualities.Any(q => q.Url == vUrl))
                            {
                                qualities.Add(new StreamQuality
                                {
                                    Resolution = $"{qLabel} HD ({height}p)",
                                    Url = vUrl,
                                    Bandwidth = height * 4500,
                                    IsDirectFile = false
                                });
                            }
                        }
                    }
                }
                if (qualities.Count > 0)
                {
                    var sorted = qualities.OrderByDescending(q => q.Bandwidth).ToList();
                    return (sorted[0].Url, sorted);
                }
            }
            catch { }
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

        // 4. KVS/tube player configuration. Prefer this signed URL over the
        // public JSON-LD contentUrl, which is only an unsigned descriptor and
        // cannot be downloaded directly.
        var kvsVideoUrls = Regex.Matches(
            cleanedHtml,
            "\\bvideo_(?:alt_)?url\\s*[:=]\\s*['\\\"]([^'\\\"]+)['\\\"]",
            RegexOptions.IgnoreCase);
        foreach (Match match in kvsVideoUrls)
        {
            string streamUrl = WebUtility.HtmlDecode(match.Groups[1].Value).Replace("\\/", "/");
            if (!streamUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase)) continue;
            bool isLowQuality = match.Value.Contains("video_alt_url", StringComparison.OrdinalIgnoreCase) ||
                                streamUrl.Contains("_lq.", StringComparison.OrdinalIgnoreCase);
            if (!qualities.Any(q => q.Url == streamUrl))
            {
                qualities.Add(new StreamQuality
                {
                    Resolution = isLowQuality ? "480p SD (KVS Direct)" : "Original Quality (KVS Direct)",
                    Url = streamUrl,
                    IsDirectFile = true,
                    Bandwidth = isLowQuality ? 1100000 : 4500000
                });
            }
        }
        if (qualities.Count > 0)
        {
            var sorted = qualities.OrderByDescending(q => q.Bandwidth).ToList();
            return (sorted[0].Url, sorted);
        }

        // 5. JSON-LD VideoObject schema
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

        // 6. Parse quality entries from JSON mediaDefinitions / flashvars
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
            var master = qualities.FirstOrDefault(q => q.Url.Contains("master.m3u8", StringComparison.OrdinalIgnoreCase));
            if (master != null)
            {
                return (master.Url, qualities);
            }

            qualities = qualities.OrderByDescending(q => q.Bandwidth).ToList();
            return (qualities[0].Url, qualities);
        }

        // 7. Direct general M3U8 match
        var generalMatch = Regex.Match(cleanedHtml, @"(https?://[^\s""'<>]+\.m3u8[^\s""'<>]*)", RegexOptions.IgnoreCase);
        if (generalMatch.Success)
        {
            return (generalMatch.Groups[1].Value, qualities);
        }

        // 8. Relative M3U8 match
        var relativeMatch = Regex.Match(cleanedHtml, @"[""'](/[^""'\s<>]+\.m3u8[^""'\s<>]*)[""']", RegexOptions.IgnoreCase);
        if (relativeMatch.Success)
        {
            return (ResolveUrl(baseUri, relativeMatch.Groups[1].Value), qualities);
        }

        // 9. Embedded player iframe checking
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

        // 10. Multi-Quality MP4 Stream Matcher & Resolution Optimizer
        var allMp4Matches = Regex.Matches(cleanedHtml, @"(https?://[^\s""'<>]+\.(?:mp4|webm)[^\s""'<>]*)", RegexOptions.IgnoreCase);
        foreach (Match m in allMp4Matches)
        {
            string vUrl = m.Groups[1].Value.Replace("&amp;", "&");
            if (vUrl.Contains(".m3u8", StringComparison.OrdinalIgnoreCase)) continue;
            if (vUrl.Contains("preview") && !vUrl.Contains("video") && allMp4Matches.Count > 1) continue;

            int height = 720;
            if (vUrl.Contains("2160") || vUrl.Contains("4k")) height = 2160;
            else if (vUrl.Contains("1440") || vUrl.Contains("2k")) height = 1440;
            else if (vUrl.Contains("1080")) height = 1080;
            else if (vUrl.Contains("720")) height = 720;
            else if (vUrl.Contains("480")) height = 480;
            else if (vUrl.Contains("360")) height = 360;

            string resName = height switch
            {
                2160 => "4K Ultra HD (3840x2160)",
                1440 => "2K QHD (2560x1440)",
                1080 => "1080p Full HD (1920x1080)",
                720 => "720p HD (1280x720)",
                480 => "480p SD (854x480)",
                360 => "360p (640x360)",
                _ => $"{height}p HD"
            };

            long bw = height switch
            {
                2160 => 14000000,
                1440 => 8500000,
                1080 => 4500000,
                720 => 2400000,
                480 => 1200000,
                _ => 800000
            };

            if (!qualities.Any(q => q.Url == vUrl))
            {
                qualities.Add(new StreamQuality
                {
                    Resolution = resName,
                    Url = vUrl,
                    IsDirectFile = true,
                    Bandwidth = bw
                });
            }

            // If lower tier found (e.g. 480p on xHamster), probe 720p and 1080p variants
            if (height == 480 && (vUrl.Contains("xhpingcdn") || vUrl.Contains("xhcdn") || vUrl.Contains("480p")))
            {
                string url720 = vUrl.Replace("480p", "720p");
                if (!qualities.Any(q => q.Url == url720))
                {
                    qualities.Add(new StreamQuality { Resolution = "720p HD (1280x720)", Url = url720, IsDirectFile = true, Bandwidth = 2400000 });
                }
                string url1080 = vUrl.Replace("480p", "1080p");
                if (!qualities.Any(q => q.Url == url1080))
                {
                    qualities.Add(new StreamQuality { Resolution = "1080p Full HD (1920x1080)", Url = url1080, IsDirectFile = true, Bandwidth = 4500000 });
                }
            }
        }

        if (qualities.Count > 0)
        {
            var sorted = qualities.OrderByDescending(q => q.Bandwidth).ToList();
            return (sorted[0].Url, sorted);
        }

        return (null, qualities);
    }

    internal static List<StreamQuality> ParseMasterPlaylistStatic(string content, Uri baseUri) => ParseMasterPlaylist(content, baseUri);

    internal static List<StreamQuality> ParseMasterPlaylist(string content, Uri baseUri)
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

    internal static (List<string> Segments, int DurationSeconds) ParseMediaPlaylistWithDurationStatic(string content, Uri baseUri) => ParseMediaPlaylistWithDuration(content, baseUri);

    internal static (List<string> Segments, int DurationSeconds) ParseMediaPlaylistWithDuration(string content, Uri baseUri)
    {
        var segments = new List<string>();
        double totalDuration = 0;
        long currentByteOffset = 0;
        string? pendingByteRange = null;

        var lines = content.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

        // 1. Check Initialization Map (fMP4)
        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (trimmed.StartsWith("#EXT-X-MAP"))
            {
                var uriMatch = Regex.Match(trimmed, @"URI=""([^""]+)""");
                if (uriMatch.Success)
                {
                    string mapUrl = ResolveUrl(baseUri, uriMatch.Groups[1].Value);
                    var byteMatch = Regex.Match(trimmed, @"BYTERANGE=""(\d+)(?:@(\d+))?""");
                    if (byteMatch.Success)
                    {
                        long len = long.Parse(byteMatch.Groups[1].Value);
                        long off = byteMatch.Groups[2].Success ? long.Parse(byteMatch.Groups[2].Value) : 0;
                        mapUrl += $"#range={off}-{off + len - 1}";
                    }
                    segments.Add(mapUrl);
                }
            }
        }

        // 2. Parse Segments with EXTINF and EXT-X-BYTERANGE
        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i].Trim();

            if (line.StartsWith("#EXT-X-BYTERANGE:"))
            {
                pendingByteRange = line.Substring("#EXT-X-BYTERANGE:".Length).Trim();
            }
            else if (line.StartsWith("#EXTINF"))
            {
                var dMatch = Regex.Match(line, @"#EXTINF:([\d.]+)");
                if (dMatch.Success && double.TryParse(dMatch.Groups[1].Value, out var d))
                {
                    totalDuration += d;
                }

                for (int j = i + 1; j < lines.Length; j++)
                {
                    var nextLine = lines[j].Trim();
                    if (nextLine.StartsWith("#EXT-X-BYTERANGE:"))
                    {
                        pendingByteRange = nextLine.Substring("#EXT-X-BYTERANGE:".Length).Trim();
                    }
                    else if (!string.IsNullOrEmpty(nextLine) && !nextLine.StartsWith("#"))
                    {
                        string segUrl = ResolveUrl(baseUri, nextLine);
                        if (!string.IsNullOrEmpty(pendingByteRange))
                        {
                            var parts = pendingByteRange.Split('@');
                            long len = long.Parse(parts[0]);
                            long off = parts.Length > 1 ? long.Parse(parts[1]) : currentByteOffset;
                            segUrl += $"#range={off}-{off + len - 1}";
                            currentByteOffset = off + len;
                            pendingByteRange = null;
                        }
                        segments.Add(segUrl);
                        i = j;
                        break;
                    }
                }
            }
            else if (!line.StartsWith("#") && (line.EndsWith(".ts") || line.EndsWith(".m4s") || line.EndsWith(".mp4") || line.Contains(".ts?") || line.Contains(".m4s?") || line.Contains(".mp4?")))
            {
                string segUrl = ResolveUrl(baseUri, line);
                if (!string.IsNullOrEmpty(pendingByteRange))
                {
                    var parts = pendingByteRange.Split('@');
                    long len = long.Parse(parts[0]);
                    long off = parts.Length > 1 ? long.Parse(parts[1]) : currentByteOffset;
                    segUrl += $"#range={off}-{off + len - 1}";
                    currentByteOffset = off + len;
                    pendingByteRange = null;
                }
                segments.Add(segUrl);
            }
        }

        return (segments, (int)Math.Round(totalDuration));
    }

    private static string ResolveUrl(Uri baseUri, string relativeOrAbsolute)
    {
        string parentQuery = baseUri.Query?.TrimStart('?') ?? string.Empty;

        if (Uri.TryCreate(relativeOrAbsolute, UriKind.Absolute, out var absUri))
        {
            string absStr = absUri.ToString();
            if (string.IsNullOrEmpty(absUri.Query) && !string.IsNullOrEmpty(parentQuery))
            {
                return absStr + (absStr.Contains('?') ? "&" : "?") + parentQuery;
            }
            return absStr;
        }

        var resolved = new Uri(baseUri, relativeOrAbsolute);
        string resStr = resolved.ToString();
        if (string.IsNullOrEmpty(resolved.Query) && !string.IsNullOrEmpty(parentQuery))
        {
            return resStr + (resStr.Contains('?') ? "&" : "?") + parentQuery;
        }

        return resStr;
    }

    private async Task<StreamAnalysisResult> ExtractYouTubeWithRetryAsync(string url, StreamAnalysisResult result, int retryCount = 0)
    {
        const int maxRetries = 2;
        Exception? lastException = null;

        for (int attempt = 0; attempt <= maxRetries; attempt++)
        {
            try
            {
                string cleanYtUrl = url;
                var vMatch = Regex.Match(url, @"(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})");
                string videoId = vMatch.Success ? vMatch.Groups[1].Value : url;
                cleanYtUrl = $"https://www.youtube.com/watch?v={videoId}";

                Console.WriteLine($"[YouTube Extractor] Attempt {attempt + 1}/{maxRetries + 1}: Extracting video ID: {videoId}");

                var video = await _youtubeClient.Videos.GetAsync(cleanYtUrl);
                var streamManifest = await _youtubeClient.Videos.Streams.GetManifestAsync(video.Id);

                result.Title = video.Title;
                result.Description = video.Description;
                result.DurationSeconds = (int)(video.Duration?.TotalSeconds ?? 0);
                result.ThumbnailUrl = $"https://i.ytimg.com/vi/{video.Id}/maxresdefault.jpg";
                result.Platform = "YouTube";

                var bestAudio = streamManifest.GetAudioOnlyStreams().GetWithHighestBitrate();
                string audioUrl = bestAudio?.Url ?? string.Empty;

                var allStreams = streamManifest.GetVideoStreams()
                    .OrderByDescending(s => s.VideoQuality)
                    .ThenByDescending(s => s.Bitrate)
                    .GroupBy(s => s.VideoQuality.Label)
                    .Select(g => g.First())
                    .ToList();

                foreach (var stream in allStreams)
                {
                    bool isMuxed = stream is YoutubeExplode.Videos.Streams.MuxedStreamInfo;
                    result.Qualities.Add(new StreamQuality
                    {
                        Resolution = $"{stream.VideoQuality.Label}",
                        Url = stream.Url,
                        AudioUrl = isMuxed ? string.Empty : audioUrl,
                        IsDirectFile = true,
                        DurationSeconds = result.DurationSeconds,
                        Bandwidth = stream.Bitrate.BitsPerSecond + (isMuxed ? 0 : (bestAudio?.Bitrate.BitsPerSecond ?? 0))
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
                    result.Qualities = result.Qualities.OrderByDescending(q => q.Bandwidth).ToList();
                    Console.WriteLine($"[YouTube Extractor] SUCCESS: Extracted {result.Qualities.Count} quality options");
                    return result;
                }
            }
            catch (Exception ex)
            {
                lastException = ex;
                Console.WriteLine($"[YouTube Extractor] Attempt {attempt + 1} failed: {ex.GetType().Name} - {ex.Message}");
                
                if (attempt < maxRetries)
                {
                    // Wait before retrying (exponential backoff: 1s, 2s)
                    await Task.Delay((int)Math.Pow(2, attempt) * 1000);
                    continue;
                }
            }
        }

        // All retry attempts failed, try fallback methods
        Console.WriteLine($"[YouTube Extractor] All extraction attempts failed. Trying fallback method...");
        
        try
        {
            return await ExtractYouTubeFallbackAsync(url, result);
        }
        catch (Exception fallbackEx)
        {
            Console.WriteLine($"[YouTube Extractor] Fallback also failed: {fallbackEx.Message}");
            throw new Exception($"Unable to extract YouTube video after {maxRetries + 1} attempts. Last error: {lastException?.Message ?? fallbackEx.Message}");
        }
    }

    private async Task<StreamAnalysisResult> ExtractYouTubeFallbackAsync(string url, StreamAnalysisResult result)
    {
        Console.WriteLine("[YouTube Extractor] Using oEmbed fallback method...");
        
        try
        {
            var oembedUrl = $"https://www.youtube.com/oembed?url={Uri.EscapeDataString(url)}&format=json";
            
            using var req = new HttpRequestMessage(HttpMethod.Get, oembedUrl);
            req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");
            
            using var resp = await _httpClient.SendAsync(req);
            
            if (resp.IsSuccessStatusCode)
            {
                var oembedRes = await resp.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(oembedRes);
                
                if (doc.RootElement.TryGetProperty("title", out var tProp)) 
                    result.Title = tProp.GetString() ?? result.Title;
                if (doc.RootElement.TryGetProperty("author_name", out var aProp)) 
                    result.Platform = $"YouTube • {aProp.GetString()}";
                if (doc.RootElement.TryGetProperty("thumbnail_url", out var thProp)) 
                    result.ThumbnailUrl = thProp.GetString() ?? result.ThumbnailUrl;

                // Add placeholder quality options
                result.Qualities.Add(new StreamQuality
                {
                    Resolution = "1080p Full HD (Desktop - Requires browser context)",
                    Url = url,
                    IsDirectFile = false,
                    Bandwidth = 4500000
                });
                result.Qualities.Add(new StreamQuality
                {
                    Resolution = "720p HD (Desktop - Requires browser context)",
                    Url = url,
                    IsDirectFile = false,
                    Bandwidth = 2200000
                });

                result.RequiresBrowserContext = true;
                result.StatusMessage = "This video requires browser-based playback. Please use the SaveZonix Browser Extension for best results.";
                
                Console.WriteLine("[YouTube Extractor] Fallback method succeeded with limited quality options");
                return result;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[YouTube Extractor] oEmbed fallback failed: {ex.Message}");
        }

        throw new Exception("Unable to extract YouTube video. Please verify the URL and ensure the video is not private, age-restricted, or deleted.");
    }

    private async Task<StreamAnalysisResult?> ExtractInstagramVideoAsync(string url, string htmlContent, StreamAnalysisResult result)
    {
        try
        {
            Console.WriteLine("[Instagram Extractor] Attempting to extract video from Instagram page...");

            // Try to extract from __NEXT_DATA__ JSON
            var nextDataMatch = Regex.Match(htmlContent, @"<script\s+id=[""']__NEXT_DATA__[""'][^>]*>([^<]+)</script>", RegexOptions.IgnoreCase);
            if (nextDataMatch.Success)
            {
                try
                {
                    using var doc = JsonDocument.Parse(nextDataMatch.Groups[1].Value);
                    var videoUrl = ExtractVideoUrlFromInstagramJson(doc.RootElement);
                    if (!string.IsNullOrEmpty(videoUrl))
                    {
                        Console.WriteLine($"[Instagram Extractor] Found video URL in __NEXT_DATA__");
                        result.Title = ExtractInstagramTitle(htmlContent) ?? "Instagram Video";
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
                catch (Exception ex)
                {
                    Console.WriteLine($"[Instagram Extractor] JSON parsing failed: {ex.Message}");
                }
            }

            // Try extracting from meta og:video
            var ogVideoMatch = Regex.Match(htmlContent, @"<meta\s+property=[""']og:video[""']\s+content=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
            if (ogVideoMatch.Success)
            {
                string videoUrl = ogVideoMatch.Groups[1].Value;
                if (!string.IsNullOrEmpty(videoUrl) && (videoUrl.Contains(".mp4") || videoUrl.Contains("video")))
                {
                    Console.WriteLine($"[Instagram Extractor] Found video URL in og:video meta tag");
                    result.Title = ExtractInstagramTitle(htmlContent) ?? "Instagram Video";
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

            // Instagram also embeds video data in shared JSON outside __NEXT_DATA__.
            var embeddedVideoMatch = Regex.Match(
                htmlContent,
                @"\\?[\x22']video_url\\?[\x22']\s*:\s*\\?[\x22']([^\x22']+)[\x22']|\\?[\x22']video_versions\\?[\x22'][^\]]*?\\?[\x22']url\\?[\x22']\s*:\s*\\?[\x22']([^\x22']+)[\x22']",
                RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (embeddedVideoMatch.Success)
            {
                string videoUrl = embeddedVideoMatch.Groups[1].Success
                    ? embeddedVideoMatch.Groups[1].Value
                    : embeddedVideoMatch.Groups[2].Value;
                videoUrl = NormalizeInstagramEmbeddedUrl(videoUrl);

                if (Uri.TryCreate(videoUrl, UriKind.Absolute, out var parsedVideoUri) &&
                    (parsedVideoUri.Scheme == Uri.UriSchemeHttp || parsedVideoUri.Scheme == Uri.UriSchemeHttps))
                {
                    Console.WriteLine("[Instagram Extractor] Found video URL in embedded Instagram JSON");
                    result.Title = ExtractInstagramTitle(htmlContent) ?? "Instagram Video";
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

            Console.WriteLine("[Instagram Extractor] Could not extract Instagram video - requires browser");
            return null;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Instagram Extractor] Exception: {ex.Message}");
            return null;
        }
    }

    private async Task<StreamAnalysisResult?> ExtractInstagramFromPublicEmbedAsync(Uri targetUri, string originalUrl, StreamAnalysisResult result)
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
            var (embedHtml, _, _) = await FetchContentWithNegotiationAsync(embedUrl);
            if (string.IsNullOrWhiteSpace(embedHtml)) return null;

            ExtractMetadataFromHtml(embedHtml, result);
            var extracted = await ExtractInstagramVideoAsync(originalUrl, embedHtml, result);
            if (extracted != null)
            {
                Console.WriteLine("[Instagram Extractor] Public embed extraction succeeded.");
            }
            return extracted;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Instagram Extractor] Public embed fallback failed: {ex.Message}");
            return null;
        }
    }

    private static string NormalizeInstagramEmbeddedUrl(string value)
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

    private string? ExtractVideoUrlFromInstagramJson(JsonElement element)
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
                return ExtractVideoUrlFromInstagramJson(video);
            }

            if (element.TryGetProperty("media", out var media) && media.ValueKind == JsonValueKind.Object)
            {
                return ExtractVideoUrlFromInstagramJson(media);
            }

            // Recursively search in object
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
                        var result = ExtractVideoUrlFromInstagramJson(prop.Value);
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

    private string? ExtractInstagramTitle(string html)
    {
        // Try meta og:title
        var titleMatch = Regex.Match(html, @"<meta\s+property=[""']og:title[""']\s+content=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (titleMatch.Success)
        {
            return titleMatch.Groups[1].Value;
        }

        // Try og:description
        var descMatch = Regex.Match(html, @"<meta\s+property=[""']og:description[""']\s+content=[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        if (descMatch.Success)
        {
            return descMatch.Groups[1].Value;
        }

        return null;
    }

    private async Task<StreamAnalysisResult?> ExtractInstagramOEmbedFallbackAsync(string originalUrl, StreamAnalysisResult result)
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
                else
                {
                    result.Platform = "Instagram";
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
            else
            {
                var err = await resp.Content.ReadAsStringAsync();
                Console.WriteLine($"[Instagram Extractor] oEmbed failed with status {resp.StatusCode}: {err.Substring(0, Math.Min(200, err.Length))}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Instagram Extractor] oEmbed fallback error: {ex.Message}");
        }

        return null;
    }
}

