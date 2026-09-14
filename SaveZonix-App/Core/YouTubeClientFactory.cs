using System.Net;
using System.Net.Http;
using YoutubeExplode;

namespace Zonix.Core;

/// <summary>
/// Centralized Factory for YouTube clients with optimized network sockets,
/// compression, and mobile client emulation to bypass 429 rate limits and anti-bot blocks.
/// </summary>
public static class YouTubeClientFactory
{
    private static readonly HttpClient _sharedHttpClient = CreateConfiguredHttpClient();
    private static readonly YoutubeClient _sharedClient = new(_sharedHttpClient);

    private static HttpClient CreateConfiguredHttpClient()
    {
        var handler = new SocketsHttpHandler
        {
            AutomaticDecompression = DecompressionMethods.All,
            MaxConnectionsPerServer = 100,
            EnableMultipleHttp2Connections = true,
            PooledConnectionLifetime = TimeSpan.FromMinutes(15),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
            ConnectTimeout = TimeSpan.FromSeconds(15)
        };

        var client = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromMinutes(5)
        };

        // Android YouTube Client signature — highly trusted by YouTube servers,
        // bypasses web 429 rate limiting and bot verification challenges.
        client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", "com.google.android.youtube/19.29.37 (Linux; U; Android 14; US) gzip");
        client.DefaultRequestHeaders.TryAddWithoutValidation("Accept-Language", "en-US,en;q=0.9");

        return client;
    }

    /// <summary>
    /// Returns the shared, optimized YoutubeClient instance.
    /// </summary>
    public static YoutubeClient SharedClient => _sharedClient;

    /// <summary>
    /// Returns a new YoutubeClient configured with the stealth HTTP pipeline.
    /// </summary>
    public static YoutubeClient CreateClient() => new(_sharedHttpClient);

    /// <summary>
    /// Returns the underlying configured HttpClient.
    /// </summary>
    public static HttpClient SharedHttpClient => _sharedHttpClient;
}
