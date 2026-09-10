using System.Text.RegularExpressions;
using SaveZonix.Models;
using YoutubeExplode;
using YoutubeExplode.Common;
using YoutubeExplode.Exceptions;
using YoutubeExplode.Playlists;
using YoutubeExplode.Videos.Streams;

namespace SaveZonix.Services;

public class YouTubePlaylistService : IYouTubePlaylistService
{
    private static readonly HttpClient _sharedHttpClient = new(new SocketsHttpHandler
    {
        AutomaticDecompression = System.Net.DecompressionMethods.All,
        MaxConnectionsPerServer = 100,
        EnableMultipleHttp2Connections = true,
        PooledConnectionLifetime = TimeSpan.FromMinutes(15),
        PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
        ConnectTimeout = TimeSpan.FromSeconds(15)
    })
    {
        Timeout = TimeSpan.FromMinutes(10)
    };

    private readonly YoutubeClient _youtubeClient = new(_sharedHttpClient);
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (DateTime CachedAt, PlaylistInfoResult Result)> _cache = new();

    public string? ExtractPlaylistId(string urlOrId)
    {
        if (string.IsNullOrWhiteSpace(urlOrId)) return null;

        urlOrId = urlOrId.Trim();

        // 1. Direct Playlist ID pattern (usually starts with PL, UU, LL, FL, RD, OLAK5uy, etc.)
        if (Regex.IsMatch(urlOrId, @"^(?:PL|UU|LL|FL|RD|OLAK5uy)[a-zA-Z0-9_-]{10,}$", RegexOptions.IgnoreCase))
        {
            return urlOrId;
        }

        // 2. Query param ?list=... or &list=...
        var listMatch = Regex.Match(urlOrId, @"[?&]list=([a-zA-Z0-9_-]+)", RegexOptions.IgnoreCase);
        if (listMatch.Success)
        {
            return listMatch.Groups[1].Value;
        }

        // 3. Fallback try YoutubeExplode PlaylistId.TryParse
        var parsed = PlaylistId.TryParse(urlOrId);
        if (parsed != null)
        {
            return parsed.Value.Value;
        }

        return null;
    }

    public async Task<PlaylistInfoResult> LoadPlaylistAsync(string urlOrId, CancellationToken cancellationToken = default)
    {
        string? playlistId = ExtractPlaylistId(urlOrId);
        if (string.IsNullOrWhiteSpace(playlistId))
        {
            return new PlaylistInfoResult
            {
                Success = false,
                ErrorMessage = "Invalid YouTube Playlist URL or ID. Please check the URL and try again."
            };
        }

        // Check 15-minute memory cache for instant response
        if (_cache.TryGetValue(playlistId, out var cached) && (DateTime.UtcNow - cached.CachedAt).TotalMinutes < 15)
        {
            return cached.Result;
        }

        try
        {
            var playlist = await _youtubeClient.Playlists.GetAsync(playlistId, cancellationToken);
            var result = new PlaylistInfoResult
            {
                Success = true,
                Id = playlist.Id.Value,
                Title = playlist.Title,
                Author = playlist.Author?.ChannelTitle ?? "YouTube Creator",
                AuthorUrl = playlist.Author?.ChannelUrl ?? "",
                ThumbnailUrl = playlist.Thumbnails.GetWithHighestResolution()?.Url ?? $"https://i.ytimg.com/vi/{playlistId}/hqdefault.jpg",
                Description = playlist.Description
            };

            var videos = new List<PlaylistVideoDto>();
            int index = 1;
            long totalSeconds = 0;

            await foreach (var video in _youtubeClient.Playlists.GetVideosAsync(playlist.Id, cancellationToken))
            {
                try
                {
                    int durationSec = (int)(video.Duration?.TotalSeconds ?? 0);
                    totalSeconds += durationSec;

                    string formattedDur = video.Duration.HasValue
                        ? (video.Duration.Value.TotalHours >= 1 
                            ? video.Duration.Value.ToString(@"hh\:mm\:ss") 
                            : video.Duration.Value.ToString(@"mm\:ss"))
                        : "00:00";

                    string thumb = video.Thumbnails.GetWithHighestResolution()?.Url ?? $"https://i.ytimg.com/vi/{video.Id}/hqdefault.jpg";

                    videos.Add(new PlaylistVideoDto
                    {
                        VideoId = video.Id.Value,
                        Index = index++,
                        Title = video.Title,
                        Author = video.Author?.ChannelTitle ?? "Unknown",
                        DurationSeconds = durationSec,
                        FormattedDuration = formattedDur,
                        ThumbnailUrl = thumb,
                        IsAvailable = true,
                        AvailableQualities = new List<string> { "Best", "1080p", "720p", "480p", "360p", "Audio Only" },
                        AvailableFormats = new List<string> { "MP4", "WebM", "MP3", "M4A" }
                    });
                }
                catch (Exception ex)
                {
                    videos.Add(new PlaylistVideoDto
                    {
                        VideoId = video.Id.Value,
                        Index = index++,
                        Title = video.Title ?? "Unavailable Video",
                        Author = video.Author?.ChannelTitle ?? "Unknown",
                        DurationSeconds = 0,
                        FormattedDuration = "--:--",
                        ThumbnailUrl = "",
                        IsAvailable = false,
                        StatusReason = ex is VideoUnavailableException ? "Video is private, deleted or region-restricted" : ex.Message
                    });
                }
            }

            result.VideoCount = videos.Count;
            result.Videos = videos;

            var ts = TimeSpan.FromSeconds(totalSeconds);
            result.FormattedTotalDuration = ts.TotalHours >= 1
                ? $"{(int)ts.TotalHours}h {ts.Minutes}m"
                : $"{ts.Minutes}m {ts.Seconds}s";

            _cache[playlistId] = (DateTime.UtcNow, result);
            return result;
        }
        catch (PlaylistUnavailableException)
        {
            return new PlaylistInfoResult
            {
                Success = false,
                ErrorMessage = "The specified YouTube playlist is private, deleted, or does not exist."
            };
        }
        catch (Exception ex)
        {
            return new PlaylistInfoResult
            {
                Success = false,
                ErrorMessage = $"Failed to load YouTube playlist: {ex.Message}"
            };
        }
    }

    public async Task<List<string>> GetAvailableResolutionsAsync(string videoId, CancellationToken cancellationToken = default)
    {
        var resolutions = new List<string>();
        try
        {
            var manifest = await _youtubeClient.Videos.Streams.GetManifestAsync(videoId, cancellationToken);
            var videoStreams = manifest.GetVideoStreams()
                .OrderByDescending(s => s.VideoQuality)
                .Select(s => s.VideoQuality.Label)
                .Distinct()
                .ToList();

            if (videoStreams.Count > 0)
            {
                resolutions.AddRange(videoStreams);
            }
            else
            {
                resolutions.AddRange(new[] { "1080p", "720p", "480p", "360p" });
            }

            resolutions.Add("Audio Only (HQ MP3 / M4A)");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[YouTube Playlist Service] Quality probe error for {videoId}: {ex.Message}");
            resolutions.AddRange(new[] { "Best", "1080p", "720p", "480p", "360p", "Audio Only" });
        }

        return resolutions;
    }
}
