namespace Zonix.Core;

public static class StreamSecurityHelper
{
    public static List<string> GetCandidateReferers(Uri uri, string? originalPageUrl = null)
    {
        var host = uri.Host.ToLowerInvariant();
        var full = uri.ToString().ToLowerInvariant();
        var candidates = new List<string>();

        if (!string.IsNullOrEmpty(originalPageUrl))
        {
            candidates.Add(originalPageUrl);
            if (Uri.TryCreate(originalPageUrl, UriKind.Absolute, out var origUri))
            {
                candidates.Add($"{origUri.Scheme}://{origUri.Host}/");
            }
        }

        // 1. Dynamic extraction from URL parameters (e.g. referer=force,.xhcdn.com,.xhamster1.desi)
        var refMatch = System.Text.RegularExpressions.Regex.Match(full, @"referer=(?:force,)?([^/&]+)");
        if (refMatch.Success)
        {
            var raw = refMatch.Groups[1].Value;
            var domains = raw.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var d in domains)
            {
                var cleanD = d.Trim().TrimStart('.');
                if (!string.IsNullOrEmpty(cleanD) && cleanD.Contains('.'))
                {
                    candidates.Add($"https://{cleanD}/");
                    candidates.Add($"https://www.{cleanD}/");
                }
            }
        }

        if (host.Contains("xhpingcdn") || host.Contains("xhcdn") || host.Contains("xhaccess") || host.Contains("xhamster") || full.Contains("xhamster"))
        {
            candidates.Add("https://xhamster.com/");
            candidates.Add("https://www.xhamster.com/");
            candidates.Add("https://xhamster1.desi/");
            candidates.Add("https://xhamster.desi/");
            candidates.Add("https://xhaccess.com/");
        }
        else if (host.Contains("phcdn") || host.Contains("okxxx") || host.Contains("ok.xxx") || full.Contains("ok.xxx") || full.Contains("okxxx"))
        {
            candidates.Add("https://okxxx1.com/");
            candidates.Add("https://www.ok.xxx/");
            candidates.Add("https://ok.xxx/");
        }
        else if (host.Contains("phncdn") || host.Contains("pornhub") || full.Contains("pornhub"))
        {
            candidates.Add("https://www.pornhub.org/");
            candidates.Add("https://www.pornhub.com/");
            candidates.Add("https://pornhub.com/");
        }
        else if (host.Contains("spankbang") || host.Contains("sb-cd") || full.Contains("spankbang"))
        {
            candidates.Add("https://spankbang.com/");
        }
        else if (host.Contains("mat6tube") || host.Contains("mat6") || host.Contains("pvvstream") || full.Contains("mat6tube"))
        {
            candidates.Add("https://mat6tube.com/");
        }
        else if (host.Contains("xnxx") || full.Contains("xnxx"))
        {
            candidates.Add("https://www.xnxx.com/");
            candidates.Add("https://xnxx.com/");
        }
        else if (host.Contains("xvideos") || full.Contains("xvideos"))
        {
            candidates.Add("https://www.xvideos.com/");
            candidates.Add("https://xvideos.com/");
        }
        else if (host.Contains("pixelflix") || full.Contains("pixelflix"))
        {
            candidates.Add("https://pixelflix.cc/");
        }
        else if (host.Contains("freepornvideo.sex") || full.Contains("freepornvideo.sex"))
        {
            // KVS get_file URLs redirect through the site's storage host and
            // require the originating site as referer.
            candidates.Add("https://www.freepornvideo.sex/");
            candidates.Add("https://freepornvideo.sex/");
        }
        else if (host.Contains("googlevideo"))
        {
            candidates.Add(string.Empty);
        }
        else if (host.Contains("youtube"))
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
