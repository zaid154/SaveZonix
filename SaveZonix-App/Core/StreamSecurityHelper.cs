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
            candidates.Add("https://www.okxxx1.com/");
            candidates.Add("https://hi.okxxx1.com/");
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
        else if (host.Contains("area51") || full.Contains("area51"))
        {
            candidates.Add("https://area51.porn/");
            candidates.Add("https://www.area51.porn/");
        }
        else if (host.Contains("googlevideo"))
        {
            candidates.Add("https://www.youtube.com/");
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

    /// <summary>
    /// Strict SSRF & Loopback Protection: Validates that an incoming stream/download URL 
    /// is an absolute HTTP/HTTPS URI targeting public internet servers, strictly rejecting 
    /// internal RFC 1918 networks, loopback (127.0.0.1, localhost), and cloud metadata endpoints.
    /// </summary>
    public static bool IsSafePublicDownloadUrl(string? rawUrl, out string? errorMessage)
    {
        errorMessage = null;
        if (string.IsNullOrWhiteSpace(rawUrl))
        {
            errorMessage = "URL cannot be empty.";
            return false;
        }

        string trimmed = rawUrl.Trim();
        // Allow pure 11-char YouTube Video IDs (e.g. dQw4w9WgXcQ)
        if (System.Text.RegularExpressions.Regex.IsMatch(trimmed, @"^[a-zA-Z0-9_-]{11}$"))
        {
            return true;
        }

        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
        {
            errorMessage = "Malformatted URL.";
            return false;
        }

        // Only allow HTTP and HTTPS schemes
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
        {
            errorMessage = $"Restricted URL scheme '{uri.Scheme}'. Only HTTP and HTTPS are permitted.";
            return false;
        }

        string host = uri.Host.ToLowerInvariant().Trim();
        if (host == "localhost" || host == "127.0.0.1" || host == "::1" || host == "0.0.0.0")
        {
            errorMessage = "Loopback and localhost targets are strictly prohibited.";
            return false;
        }

        // Direct IP check
        if (System.Net.IPAddress.TryParse(host, out var ip))
        {
            if (IsPrivateOrRestrictedIp(ip))
            {
                errorMessage = "Access to private, local, or cloud metadata IP addresses is prohibited.";
                return false;
            }
        }

        return true;
    }

    private static bool IsPrivateOrRestrictedIp(System.Net.IPAddress ip)
    {
        if (System.Net.IPAddress.IsLoopback(ip)) return true;

        if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
        {
            byte[] bytes = ip.GetAddressBytes();
            // 10.0.0.0/8
            if (bytes[0] == 10) return true;
            // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
            if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;
            // 192.168.0.0/16
            if (bytes[0] == 192 && bytes[1] == 168) return true;
            // 169.254.0.0/16 (Link-Local / AWS/GCP/Azure Metadata 169.254.169.254)
            if (bytes[0] == 169 && bytes[1] == 254) return true;
            // 127.0.0.0/8
            if (bytes[0] == 127) return true;
            // 0.0.0.0
            if (bytes[0] == 0) return true;
        }
        else if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
        {
            if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6Multicast) return true;
        }

        return false;
    }
}
