namespace Zonix.Core.Extractors;

public interface IVideoExtractor
{
    /// <summary>
    /// Unique name of the extractor (e.g., "YouTube", "Instagram", "Pixelflix", "OtherSites")
    /// </summary>
    string Name { get; }

    /// <summary>
    /// Execution priority. Higher values execute first. Generic/Fallback extractors use lowest priority.
    /// </summary>
    int Priority { get; }

    /// <summary>
    /// Checks if this extractor can handle the given target URI.
    /// </summary>
    bool CanHandle(Uri uri);

    /// <summary>
    /// Analyzes and extracts stream metadata, available qualities, and video/audio URLs.
    /// </summary>
    Task<StreamAnalysisResult> ExtractAsync(string url, int retryCount = 0);
}
