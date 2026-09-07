using System.Text.Json;
using System.Text.RegularExpressions;
using YoutubeExplode;
using YoutubeExplode.Videos.Streams;

namespace Zonix.Core.Extractors;

public class YouTubeExtractor : IVideoExtractor
{
    private readonly HttpClient _httpClient;
    private readonly YoutubeClient _youtubeClient = new();

    public string Name => "YouTube";
    public int Priority => 100;

    public YouTubeExtractor(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public bool CanHandle(Uri uri)
    {
        return uri.Host.Contains("youtube.com", StringComparison.OrdinalIgnoreCase) ||
               uri.Host.Contains("youtu.be", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<StreamAnalysisResult> ExtractAsync(string url, int retryCount = 0)
    {
        var targetUri = new Uri(url);
        var result = new StreamAnalysisResult
        {
            Title = "YouTube Video",
            Platform = "YouTube"
        };

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
                    await Task.Delay((int)Math.Pow(2, attempt) * 1000);
                    continue;
                }
            }
        }

        Console.WriteLine("[YouTube Extractor] All extraction attempts failed. Trying fallback method...");

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
}
