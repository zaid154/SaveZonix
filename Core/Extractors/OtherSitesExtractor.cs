namespace Zonix.Core.Extractors;

public class OtherSitesExtractor : IVideoExtractor
{
    private readonly M3U8Parser _parser;

    public string Name => "OtherSites";
    public int Priority => 0; // Lowest priority -> universal fallback

    public OtherSitesExtractor(M3U8Parser parser)
    {
        _parser = parser;
    }

    public bool CanHandle(Uri uri)
    {
        // CanHandle returns true for any valid URL as universal fallback
        return true;
    }

    public async Task<StreamAnalysisResult> ExtractAsync(string url, int retryCount = 0)
    {
        Console.WriteLine($"[OtherSites Extractor] Handling generic stream for: {url}");
        return await _parser.ParseInternalAsync(url, retryCount);
    }
}
