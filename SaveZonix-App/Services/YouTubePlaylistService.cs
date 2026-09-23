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

    private readonly YoutubeClient _youtubeClient = Zonix.Core.YouTubeClientFactory.SharedClient;
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

    public string? ExtractVideoId(string urlOrId)
    {
        if (string.IsNullOrWhiteSpace(urlOrId)) return null;
        var match = Regex.Match(urlOrId, @"(?:v=|\/embed\/|\/v\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : null;
    }

    public async Task<PlaylistInfoResult> LoadPlaylistAsync(string urlOrId, int? limit = null, int? offset = null, string? lastVideoId = null, CancellationToken cancellationToken = default)
    {
        string? playlistId = ExtractPlaylistId(urlOrId);
        string? seedVideoId = ExtractVideoId(urlOrId);

        if (string.IsNullOrWhiteSpace(playlistId))
        {
            return new PlaylistInfoResult
            {
                Success = false,
                ErrorMessage = "Invalid YouTube Playlist URL or ID. Please check the URL and try again."
            };
        }

        bool isMix = playlistId.StartsWith("RD", StringComparison.OrdinalIgnoreCase) 
                     || urlOrId.Contains("start_radio=1", StringComparison.OrdinalIgnoreCase);

        // Determine target limit:
        // If limit is explicitly 0, load all.
        // If limit is specified > 0, use it.
        // If isMix and limit not specified, default to 25 (exact YouTube watch page queue).
        // Otherwise for normal playlists, default to 100 or all.
        int targetLimit = (limit.HasValue && limit.Value > 0) 
            ? limit.Value 
            : ((limit.HasValue && limit.Value == 0) ? int.MaxValue : (isMix ? 25 : 100));

        int skipCount = (offset.HasValue && offset.Value > 0) ? offset.Value : 0;

        // Check 15-minute memory cache for instant response if cached has enough items
        if (_cache.TryGetValue(playlistId, out var cached) && (DateTime.UtcNow - cached.CachedAt).TotalMinutes < 15)
        {
            var full = cached.Result;
            if (full.Videos != null && full.Videos.Count > 0 && (full.Videos.Count >= skipCount + targetLimit || !full.HasMore))
            {
                var pagedVideos = full.Videos.Skip(skipCount).Take(targetLimit).ToList();
                bool moreAvailable = (skipCount + pagedVideos.Count) < full.Videos.Count || full.HasMore;
                return new PlaylistInfoResult
                {
                    Success = true,
                    Id = full.Id,
                    Title = full.Title,
                    Author = full.Author,
                    AuthorUrl = full.AuthorUrl,
                    ThumbnailUrl = full.ThumbnailUrl,
                    Description = full.Description,
                    VideoCount = pagedVideos.Count,
                    TotalKnownVideos = full.TotalKnownVideos > 0 ? full.TotalKnownVideos : full.Videos.Count,
                    HasMore = moreAvailable,
                    IsMix = isMix,
                    FormattedTotalDuration = full.FormattedTotalDuration,
                    Videos = pagedVideos
                };
            }
        }

        // Dynamic Seed-Chaining: When loading more items for a Mix and offset >= cached count,
        // use the last video ID to construct a new Mix seed and fetch fresh recommendations
        if (isMix && !string.IsNullOrWhiteSpace(lastVideoId) && skipCount > 0)
        {
            // Build existing ID set for deduplication from cache
            var existingIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (_cache.TryGetValue(playlistId, out var existingCache))
            {
                foreach (var v in existingCache.Result.Videos)
                    existingIds.Add(v.VideoId);
            }

            try
            {
                // Construct a new Mix playlist ID seeded from the last video
                var seedMixId = $"RD{lastVideoId}";
                var seedVideos = new List<PlaylistVideoDto>();
                int seedIdx = 0;

                await foreach (var video in _youtubeClient.Playlists.GetVideosAsync(seedMixId, cancellationToken))
                {
                    if (existingIds.Contains(video.Id.Value))
                        continue; // Skip duplicates

                    seedIdx++;
                    if (seedVideos.Count >= targetLimit)
                        break;

                    try
                    {
                        int durationSec = (int)(video.Duration?.TotalSeconds ?? 0);
                        string formattedDur = video.Duration.HasValue
                            ? (video.Duration.Value.TotalHours >= 1
                                ? video.Duration.Value.ToString(@"hh\:mm\:ss")
                                : video.Duration.Value.ToString(@"mm\:ss"))
                            : "00:00";

                        string thumb = video.Thumbnails.GetWithHighestResolution()?.Url ?? $"https://i.ytimg.com/vi/{video.Id}/hqdefault.jpg";

                        seedVideos.Add(new PlaylistVideoDto
                        {
                            VideoId = video.Id.Value,
                            Index = skipCount + seedVideos.Count + 1,
                            Title = video.Title,
                            Author = video.Author?.ChannelTitle ?? "Unknown",
                            DurationSeconds = durationSec,
                            FormattedDuration = formattedDur,
                            ThumbnailUrl = thumb,
                            IsAvailable = true,
                            AvailableQualities = new List<string> { "4K", "2K", "1080p", "720p", "480p", "MP3" },
                            AvailableFormats = new List<string> { "MP4", "WebM", "MP3", "M4A" }
                        });
                    }
                    catch { }
                }

                if (seedVideos.Count > 0)
                {
                    // Merge into cache
                    if (_cache.TryGetValue(playlistId, out var prevCache))
                    {
                        var merged = new List<PlaylistVideoDto>(prevCache.Result.Videos);
                        merged.AddRange(seedVideos);
                        prevCache.Result.Videos = merged;
                        prevCache.Result.VideoCount = merged.Count;
                        prevCache.Result.TotalKnownVideos = merged.Count;
                        prevCache.Result.HasMore = seedVideos.Count >= targetLimit;
                        _cache[playlistId] = (DateTime.UtcNow, prevCache.Result);
                    }

                    long totalSec = seedVideos.Sum(v => (long)v.DurationSeconds);
                    var ts = TimeSpan.FromSeconds(totalSec);

                    return new PlaylistInfoResult
                    {
                        Success = true,
                        Id = playlistId,
                        Title = _cache.TryGetValue(playlistId, out var c) ? c.Result.Title : "YouTube Mix",
                        Author = _cache.TryGetValue(playlistId, out var c2) ? c2.Result.Author : "YouTube",
                        ThumbnailUrl = seedVideos.FirstOrDefault()?.ThumbnailUrl ?? "",
                        VideoCount = seedVideos.Count,
                        TotalKnownVideos = (_cache.TryGetValue(playlistId, out var c3) ? c3.Result.Videos.Count : skipCount + seedVideos.Count),
                        HasMore = seedVideos.Count >= targetLimit,
                        IsMix = true,
                        FormattedTotalDuration = ts.TotalHours >= 1 ? $"{(int)ts.TotalHours}h {ts.Minutes}m" : $"{ts.Minutes}m {ts.Seconds}s",
                        Videos = seedVideos
                    };
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[YouTube Mix Seed-Chain] Failed to chain from {lastVideoId}: {ex.Message}");
            }
        }

        try
        {
            var playlist = await _youtubeClient.Playlists.GetAsync(playlistId, cancellationToken);

            // Fetch seed video (the active playing video from v=...) if present
            PlaylistVideoDto? seedVideoDto = null;
            if (!string.IsNullOrWhiteSpace(seedVideoId))
            {
                try
                {
                    var seedVid = await _youtubeClient.Videos.GetAsync(seedVideoId, cancellationToken);
                    int seedSec = (int)(seedVid.Duration?.TotalSeconds ?? 0);
                    string seedDur = seedVid.Duration.HasValue
                        ? (seedVid.Duration.Value.TotalHours >= 1 
                            ? seedVid.Duration.Value.ToString(@"hh\:mm\:ss") 
                            : seedVid.Duration.Value.ToString(@"mm\:ss"))
                        : "00:00";

                    seedVideoDto = new PlaylistVideoDto
                    {
                        VideoId = seedVid.Id.Value,
                        Index = 1,
                        Title = seedVid.Title,
                        Author = seedVid.Author?.ChannelTitle ?? "YouTube Creator",
                        DurationSeconds = seedSec,
                        FormattedDuration = seedDur,
                        ThumbnailUrl = seedVid.Thumbnails.GetWithHighestResolution()?.Url ?? $"https://i.ytimg.com/vi/{seedVid.Id}/hqdefault.jpg",
                        IsAvailable = true,
                        AvailableQualities = new List<string> { "4K", "2K", "1080p", "720p", "480p", "MP3" },
                        AvailableFormats = new List<string> { "MP4", "WebM", "MP3", "M4A" }
                    };
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[YouTube Playlist] Could not probe seed video {seedVideoId}: {ex.Message}");
                }
            }

            // Clean title: remove "Mix - " prefix if present so clean song title is displayed
            string cleanTitle = playlist.Title;
            if (cleanTitle.StartsWith("Mix - ", StringComparison.OrdinalIgnoreCase))
            {
                cleanTitle = cleanTitle.Substring("Mix - ".Length).Trim();
            }

            var result = new PlaylistInfoResult
            {
                Success = true,
                Id = playlist.Id.Value,
                Title = !string.IsNullOrWhiteSpace(cleanTitle) ? cleanTitle : (seedVideoDto?.Title ?? playlist.Title),
                Author = seedVideoDto?.Author ?? (playlist.Author?.ChannelTitle ?? "YouTube Creator"),
                AuthorUrl = playlist.Author?.ChannelUrl ?? "",
                ThumbnailUrl = seedVideoDto?.ThumbnailUrl ?? (playlist.Thumbnails.GetWithHighestResolution()?.Url ?? $"https://i.ytimg.com/vi/{playlistId}/hqdefault.jpg"),
                Description = playlist.Description,
                IsMix = isMix
            };

            var videos = new List<PlaylistVideoDto>();
            long totalSeconds = 0;
            bool hasMore = false;

            // If seed video exists, it MUST be Track #01 in the table
            if (seedVideoDto != null && skipCount == 0)
            {
                videos.Add(seedVideoDto);
                totalSeconds += seedVideoDto.DurationSeconds;
            }

            int streamIndex = 0;
            await foreach (var video in _youtubeClient.Playlists.GetVideosAsync(playlist.Id, cancellationToken))
            {
                // Skip seed video if YouTube includes it in the recommendations to avoid duplicate
                if (seedVideoDto != null && video.Id.Value == seedVideoDto.VideoId)
                {
                    continue;
                }

                streamIndex++;

                // Skip items before offset
                if (streamIndex <= skipCount)
                {
                    continue;
                }

                // Stop once targetLimit is reached
                if (videos.Count >= targetLimit)
                {
                    hasMore = true;
                    break;
                }

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
                        Index = videos.Count + 1,
                        Title = video.Title,
                        Author = video.Author?.ChannelTitle ?? "Unknown",
                        DurationSeconds = durationSec,
                        FormattedDuration = formattedDur,
                        ThumbnailUrl = thumb,
                        IsAvailable = true,
                        AvailableQualities = new List<string> { "4K", "2K", "1080p", "720p", "480p", "MP3" },
                        AvailableFormats = new List<string> { "MP4", "WebM", "MP3", "M4A" }
                    });
                }
                catch (Exception ex)
                {
                    videos.Add(new PlaylistVideoDto
                    {
                        VideoId = video.Id.Value,
                        Index = videos.Count + 1,
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
            result.TotalKnownVideos = hasMore ? (isMix ? 400 : (skipCount + videos.Count + 50)) : (skipCount + videos.Count);
            result.HasMore = hasMore;
            result.Videos = videos;

            var ts = TimeSpan.FromSeconds(totalSeconds);
            result.FormattedTotalDuration = ts.TotalHours >= 1
                ? $"{(int)ts.TotalHours}h {ts.Minutes}m"
                : $"{ts.Minutes}m {ts.Seconds}s";

            // If we loaded a large or complete batch, update cache
            if (skipCount == 0)
            {
                _cache[playlistId] = (DateTime.UtcNow, result);
            }

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
                resolutions.AddRange(new[] { "4K", "2K", "1080p", "720p", "480p", "360p" });
            }

            resolutions.Add("Audio Only (HQ MP3 / M4A)");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[YouTube Playlist Service] Quality probe error for {videoId}: {ex.Message}");
            resolutions.AddRange(new[] { "Best", "4K", "2K", "1080p", "720p", "480p", "360p", "Audio Only" });
        }

        return resolutions;
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, PlaylistInfoResult> _importedQueues = new();

    public string SaveImportedQueue(ImportTabQueueRequest request)
    {
        var key = Guid.NewGuid().ToString("N");
        var videos = request.Items.Select((it, idx) => {
            var durationSec = 0;
            if (!string.IsNullOrWhiteSpace(it.Duration))
            {
                var parts = it.Duration.Split(':');
                if (parts.Length == 2 && int.TryParse(parts[0], out var m) && int.TryParse(parts[1], out var s))
                {
                    durationSec = m * 60 + s;
                }
                else if (parts.Length == 3 && int.TryParse(parts[0], out var h) && int.TryParse(parts[1], out var m2) && int.TryParse(parts[2], out var s2))
                {
                    durationSec = h * 3600 + m2 * 60 + s2;
                }
            }

            return new PlaylistVideoDto
            {
                Index = it.Index > 0 ? it.Index : idx + 1,
                VideoId = it.Id,
                Title = it.Title,
                Author = string.IsNullOrWhiteSpace(it.Author) ? "YouTube" : it.Author,
                DurationSeconds = durationSec,
                FormattedDuration = string.IsNullOrWhiteSpace(it.Duration) ? "00:00" : it.Duration,
                ThumbnailUrl = string.IsNullOrWhiteSpace(it.ThumbnailUrl) ? $"https://i.ytimg.com/vi/{it.Id}/hqdefault.jpg" : it.ThumbnailUrl,
                IsAvailable = true,
                AvailableQualities = new List<string> { "4K", "2K", "1080p", "720p", "480p", "MP3" },
                AvailableFormats = new List<string> { "MP4", "WebM", "MP3", "M4A" }
            };
        }).ToList();

        string cleanTitle = (request.Title ?? "YouTube Mix (Active Tab)").Trim();
        if (cleanTitle.StartsWith("Mix - ", StringComparison.OrdinalIgnoreCase))
        {
            cleanTitle = cleanTitle.Substring("Mix - ".Length).Trim();
        }

        var firstVid = videos.FirstOrDefault();
        var result = new PlaylistInfoResult
        {
            Success = true,
            Id = key,
            Title = !string.IsNullOrWhiteSpace(cleanTitle) ? cleanTitle : (firstVid?.Title ?? "YouTube Mix"),
            Author = firstVid?.Author ?? (request.Author ?? "YouTube Mix"),
            ThumbnailUrl = firstVid?.ThumbnailUrl ?? "",
            VideoCount = videos.Count,
            TotalKnownVideos = videos.Count,
            HasMore = false,
            IsMix = true,
            Videos = videos
        };

        _importedQueues[key] = result;

        // Also cache under playlistId so loading by URL also returns this exact queue!
        var playlistId = ExtractPlaylistId(request.Url);
        if (!string.IsNullOrWhiteSpace(playlistId))
        {
            _cache[playlistId] = (DateTime.UtcNow, result);
        }

        return key;
    }

    public PlaylistInfoResult? GetImportedQueue(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return null;

        if (_importedQueues.TryGetValue(key, out var res))
        {
            return res;
        }

        // Check cache as well
        if (_cache.TryGetValue(key, out var cached))
        {
            return cached.Result;
        }

        return null;
    }
}
