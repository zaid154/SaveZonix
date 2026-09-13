namespace Zonix.Core.Extractors;

public class ExtractorDispatcher
{
    private readonly List<IVideoExtractor> _extractors;
    private readonly IVideoExtractor _fallbackExtractor;

    public ExtractorDispatcher(IEnumerable<IVideoExtractor> extractors)
    {
        // Order by priority descending (highest priority first)
        _extractors = extractors.OrderByDescending(e => e.Priority).ToList();
        _fallbackExtractor = _extractors.FirstOrDefault(e => e is OtherSitesExtractor) 
                             ?? _extractors.Last();
    }

    public IVideoExtractor GetExtractor(string url)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            foreach (var extractor in _extractors)
            {
                // Skip fallback during domain-specific check
                if (extractor is OtherSitesExtractor) continue;

                if (extractor.CanHandle(uri))
                {
                    Console.WriteLine($"[ExtractorDispatcher] Routed to dedicated module: {extractor.Name}");
                    return extractor;
                }
            }
        }

        Console.WriteLine($"[ExtractorDispatcher] Routed to fallback module: {_fallbackExtractor.Name}");
        return _fallbackExtractor;
    }

    public async Task<StreamAnalysisResult> DispatchAsync(string url, int retryCount = 0)
    {
        var extractor = GetExtractor(url);
        return await extractor.ExtractAsync(url, retryCount);
    }
}
