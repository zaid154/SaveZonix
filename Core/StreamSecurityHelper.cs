namespace Zonix.Core;

public static class StreamSecurityHelper
{
    public static List<string> GetCandidateReferers(Uri uri)
    {
        var host = uri.Host.ToLowerInvariant();
        var candidates = new List<string>();

        if (host.Contains("phncdn") || host.Contains("pornhub"))
        {
            candidates.Add("https://www.pornhub.org/");
            candidates.Add("https://www.pornhub.com/");
        }
        else if (host.Contains("xnxx"))
        {
            candidates.Add("https://www.xnxx.com/");
        }
        else if (host.Contains("xvideos"))
        {
            candidates.Add("https://www.xvideos.com/");
        }
        else if (host.Contains("xhaccess") || host.Contains("xhamster"))
        {
            candidates.Add("https://xhaccess.com/");
            candidates.Add("https://xhamster.com/");
        }
        else if (host.Contains("pixelflix"))
        {
            candidates.Add("https://pixelflix.cc/");
        }
        else if (host.Contains("youtube") || host.Contains("googlevideo"))
        {
            candidates.Add("https://www.youtube.com/");
        }
        else if (host.Contains("instagram") || host.Contains("cdninstagram") || host.Contains("fbcdn"))
        {
            candidates.Add("https://www.instagram.com/");
        }

        // Generic origin and host referers
        candidates.Add($"{uri.Scheme}://{uri.Host}/");
        candidates.Add(string.Empty);

        return candidates.Distinct().ToList();
    }
}
