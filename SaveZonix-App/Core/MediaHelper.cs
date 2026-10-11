using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace SaveZonix.Core;

public static class MediaHelper
{
    public static string GetFfmpegPath()
    {
        string[] candidates = new[]
        {
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ffmpeg.exe"),
            Path.Combine(Directory.GetCurrentDirectory(), "ffmpeg.exe"),
            Path.Combine(Directory.GetCurrentDirectory(), "SaveZonix-App", "ffmpeg.exe"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "ffmpeg.exe"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "ffmpeg.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "SaveZonix", "ffmpeg.exe")
        };

        foreach (var path in candidates)
        {
            try
            {
                if (File.Exists(path)) return Path.GetFullPath(path);
            }
            catch { }
        }

        return "ffmpeg";
    }

    public static async Task<bool> MuxVideoAndAudioAsync(string videoPath, string audioPath, string outputPath)
    {
        string ffmpegPath = GetFfmpegPath();

        try
        {
            // Ultra-Fast Pass: direct stream copy (-c copy) — 0 CPU re-encoding, finishes in ~0.3s
            var psi = new ProcessStartInfo
            {
                FileName = ffmpegPath,
                Arguments = $"-i \"{videoPath}\" -i \"{audioPath}\" -c copy -map 0:v:0 -map 1:a:0? -movflags +faststart \"{outputPath}\" -y",
                RedirectStandardOutput = false,
                RedirectStandardError = false,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var proc = Process.Start(psi);
            if (proc != null)
            {
                await proc.WaitForExitAsync();
                if (proc.ExitCode == 0 && File.Exists(outputPath) && new FileInfo(outputPath).Length > 1024)
                {
                    return true;
                }
            }

            // Fallback Pass: AAC re-encode if container incompatible
            var psiFallback = new ProcessStartInfo
            {
                FileName = ffmpegPath,
                Arguments = $"-i \"{videoPath}\" -i \"{audioPath}\" -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0? -movflags +faststart \"{outputPath}\" -y",
                RedirectStandardOutput = false,
                RedirectStandardError = false,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var proc2 = Process.Start(psiFallback);
            if (proc2 != null)
            {
                await proc2.WaitForExitAsync();
                return proc2.ExitCode == 0 && File.Exists(outputPath);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FFmpeg Mux Notice] {ex.Message}");
        }
        return false;
    }

    public static async Task<bool> ExtractAudioAsync(string inputVideoPath, string outputAudioPath, string bitrate = "320k")
    {
        string ffmpegPath = GetFfmpegPath();

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = ffmpegPath,
                Arguments = $"-i \"{inputVideoPath}\" -vn -b:a {bitrate} \"{outputAudioPath}\" -y",
                RedirectStandardOutput = false,
                RedirectStandardError = false,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var proc = Process.Start(psi);
            if (proc != null)
            {
                await proc.WaitForExitAsync();
                return proc.ExitCode == 0 && File.Exists(outputAudioPath);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FFmpeg Audio Extract Notice] {ex.Message}");
        }
        return false;
    }

    public static string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password + "SaveZonix_Salt_2026"));
        return Convert.ToBase64String(bytes);
    }

    public static bool VerifyPassword(string password, string storedHash)
    {
        return HashPassword(password) == storedHash;
    }

    public static string SanitizeFileName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "video.mp4";

        var invalid = Path.GetInvalidFileNameChars().ToHashSet();
        invalid.Add('|');
        invalid.Add(':');
        invalid.Add('*');
        invalid.Add('?');
        invalid.Add('"');
        invalid.Add('<');
        invalid.Add('>');
        invalid.Add('/');
        invalid.Add('\\');

        var sb = new StringBuilder();
        foreach (var c in name)
        {
            if (invalid.Contains(c))
            {
                sb.Append('-');
            }
            else
            {
                sb.Append(c);
            }
        }

        // Clean up multiple consecutive hyphens or spaces
        string clean = Regex.Replace(sb.ToString(), @"[-]{2,}", "-");
        clean = Regex.Replace(clean, @"\s{2,}", " ").Trim(' ', '.', '-');

        return string.IsNullOrWhiteSpace(clean) ? "video.mp4" : clean;
    }

    public static string FindRootWithWwwroot()
    {
        string[] candidates = new[]
        {
            AppContext.BaseDirectory,
            Directory.GetCurrentDirectory(),
            Path.Combine(AppContext.BaseDirectory, ".."),
            Path.Combine(AppContext.BaseDirectory, "..", ".."),
            Path.Combine(AppContext.BaseDirectory, "..", "..", ".."),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..")
        };

        foreach (var dir in candidates)
        {
            try
            {
                var full = Path.GetFullPath(dir);
                var testWwwroot = Path.Combine(full, "wwwroot");
                if (Directory.Exists(testWwwroot) && File.Exists(Path.Combine(testWwwroot, "style.css")))
                {
                    return full;
                }
            }
            catch { }
        }

        return AppContext.BaseDirectory;
    }

    public static HttpClient CreateConfiguredHttpClient()
    {
        var handler = new SocketsHttpHandler
        {
            SslOptions = new System.Net.Security.SslClientAuthenticationOptions
            {
                RemoteCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) => true,
                EnabledSslProtocols = System.Security.Authentication.SslProtocols.Tls12 | System.Security.Authentication.SslProtocols.Tls13
            },
            AutomaticDecompression = System.Net.DecompressionMethods.All,
            UseCookies = false,
            MaxConnectionsPerServer = 500,
            EnableMultipleHttp2Connections = true,
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
            ConnectTimeout = TimeSpan.FromSeconds(10)
        };

        var client = new HttpClient(handler);
        client.Timeout = TimeSpan.FromMinutes(10);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36");
        client.DefaultRequestHeaders.Add("Accept", "*/*");
        client.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.9");
        return client;
    }

    public static string GetAvailableUniqueFilePath(string folder, string fileName)
    {
        string path = Path.Combine(folder, fileName);
        if (!File.Exists(path)) return path;

        string nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
        string ext = Path.GetExtension(fileName);
        for (int i = 1; i <= 500; i++)
        {
            string candidate = Path.Combine(folder, $"{nameWithoutExt} ({i}){ext}");
            if (!File.Exists(candidate)) return candidate;
        }
        return Path.Combine(folder, $"{nameWithoutExt}_{DateTime.UtcNow.Ticks.ToString().Substring(10)}{ext}");
    }

    public static string GetDownloadsDirectory()
    {
        string userDownloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads", "SaveZonix");
        if (!Directory.Exists(userDownloads))
        {
            try { Directory.CreateDirectory(userDownloads); } catch { }
        }
        if (Directory.Exists(userDownloads)) return userDownloads;

        string localDownloads = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Downloads", "SaveZonix");
        if (!Directory.Exists(localDownloads))
        {
            try { Directory.CreateDirectory(localDownloads); } catch { }
        }
        return localDownloads;
    }

    public static async Task<string?> ResolveMediaFilePathAsync(string? path, string? id, string? fileName, StreamHelper.Services.IDownloadHistoryService? historyService)
    {
        if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
            return Path.GetFullPath(path);

        string targetFileName = fileName ?? string.Empty;
        if (string.IsNullOrWhiteSpace(targetFileName) && !string.IsNullOrWhiteSpace(id) && historyService != null)
        {
            try
            {
                var item = await historyService.GetDownloadByIdAsync(id);
                if (item != null && !string.IsNullOrWhiteSpace(item.FileName))
                    targetFileName = item.FileName;
            }
            catch { }
        }

        if (!string.IsNullOrWhiteSpace(targetFileName))
        {
            string baseDir = GetDownloadsDirectory();
            string direct = Path.Combine(baseDir, targetFileName);
            if (File.Exists(direct)) return direct;

            try
            {
                var found = Directory.GetFiles(baseDir, targetFileName, SearchOption.AllDirectories).FirstOrDefault();
                if (found != null && File.Exists(found)) return found;
            }
            catch { }

            string userDownloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            string userDirect = Path.Combine(userDownloads, targetFileName);
            if (File.Exists(userDirect)) return userDirect;
        }

        return null;
    }

    public static string FormatBytes(long bytes)
    {
        if (bytes < 1024) return $"{bytes} B";
        if (bytes < 1024 * 1024) return $"{(bytes / 1024.0):F1} KB";
        if (bytes < 1024 * 1024 * 1024) return $"{(bytes / (1024.0 * 1024.0)):F1} MB";
        return $"{(bytes / (1024.0 * 1024.0 * 1024.0)):F2} GB";
    }
}
