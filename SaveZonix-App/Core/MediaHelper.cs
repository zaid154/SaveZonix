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

    public static async Task<bool> ExtractAudioAsync(string inputVideoPath, string outputAudioPath, string bitrate = "320k", string format = "mp3")
    {
        string ffmpegPath = GetFfmpegPath();

        try
        {
            if (format.Equals("m4a", StringComparison.OrdinalIgnoreCase))
            {
                var psiCopy = new ProcessStartInfo
                {
                    FileName = ffmpegPath,
                    Arguments = $"-i \"{inputVideoPath}\" -vn -c:a copy \"{outputAudioPath}\" -y",
                    RedirectStandardOutput = false,
                    RedirectStandardError = false,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using var procCopy = Process.Start(psiCopy);
                if (procCopy != null)
                {
                    await procCopy.WaitForExitAsync();
                    if (procCopy.ExitCode == 0 && File.Exists(outputAudioPath) && new FileInfo(outputAudioPath).Length > 1024)
                        return true;
                }
            }

            string codecArgs = format.Equals("m4a", StringComparison.OrdinalIgnoreCase)
                ? $"-c:a aac -b:a {bitrate} -ar 48000"
                : $"-c:a libmp3lame -b:a {bitrate} -ar 44100 -id3v2_version 3 -preset ultrafast";

            var psi = new ProcessStartInfo
            {
                FileName = ffmpegPath,
                Arguments = $"-i \"{inputVideoPath}\" -vn {codecArgs} -threads 2 \"{outputAudioPath}\" -y",
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

                // Also check for unique suffixed files like "video (1).mp4", "video (2).mp4"
                string nameNoExt = Path.GetFileNameWithoutExtension(targetFileName);
                string ext = Path.GetExtension(targetFileName);
                var patternMatch = Directory.GetFiles(baseDir, $"{nameNoExt}*{ext}", SearchOption.AllDirectories)
                    .OrderByDescending(File.GetLastWriteTimeUtc)
                    .FirstOrDefault();
                if (patternMatch != null && File.Exists(patternMatch)) return patternMatch;
            }
            catch { }

            string userDownloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            string userDirect = Path.Combine(userDownloads, targetFileName);
            if (File.Exists(userDirect)) return userDirect;

            try
            {
                string nameNoExt = Path.GetFileNameWithoutExtension(targetFileName);
                string ext = Path.GetExtension(targetFileName);
                var patternMatch = Directory.GetFiles(userDownloads, $"{nameNoExt}*{ext}", SearchOption.TopDirectoryOnly)
                    .OrderByDescending(File.GetLastWriteTimeUtc)
                    .FirstOrDefault();
                if (patternMatch != null && File.Exists(patternMatch)) return patternMatch;
            }
            catch { }
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

    public static string? GetExtensionDirectory()
    {
        string[] candidates = new[]
        {
            // 1. Installed location (Inno Setup: %LOCALAPPDATA%\Programs\SaveZonix\Extension)
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "SaveZonix", "Extension"),
            // 2. Project source directory relative to bin/Debug or bin/Release
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "Extension"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "SaveZonix-App", "Extension"),
            // 3. Current Working Directory and common subpaths
            Path.Combine(Directory.GetCurrentDirectory(), "SaveZonix-App", "Extension"),
            Path.Combine(Directory.GetCurrentDirectory(), "Extension"),
            // 4. Output folder beside Zonix.exe
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Extension"),
            Path.Combine(AppContext.BaseDirectory, "Extension")
        };

        // First pass: find a candidate that has manifest.json AND the src folder
        foreach (var rawPath in candidates)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(rawPath)) continue;
                var full = Path.GetFullPath(rawPath);
                if (Directory.Exists(full) &&
                    File.Exists(Path.Combine(full, "manifest.json")) &&
                    Directory.Exists(Path.Combine(full, "src")))
                {
                    return full;
                }
            }
            catch { }
        }

        // Second pass: if any source folder has src and manifest, synchronize to target output
        string? completeSource = candidates
            .Select(c => { try { return Path.GetFullPath(c); } catch { return null; } })
            .FirstOrDefault(p => !string.IsNullOrEmpty(p) && Directory.Exists(p) && File.Exists(Path.Combine(p, "manifest.json")) && Directory.Exists(Path.Combine(p, "src")));

        if (!string.IsNullOrEmpty(completeSource))
        {
            try
            {
                var targetDir = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Extension"));
                CopyDirectoryRecursive(completeSource, targetDir);
                if (File.Exists(Path.Combine(targetDir, "manifest.json")) && Directory.Exists(Path.Combine(targetDir, "src")))
                {
                    return targetDir;
                }
            }
            catch { }

            return completeSource;
        }

        // Fallback to any directory that exists with manifest.json
        foreach (var rawPath in candidates)
        {
            try
            {
                var full = Path.GetFullPath(rawPath);
                if (Directory.Exists(full) && File.Exists(Path.Combine(full, "manifest.json")))
                {
                    return full;
                }
            }
            catch { }
        }

        return null;
    }

    public static string? EnsureExtensionZipExists()
    {
        try
        {
            string? extDir = GetExtensionDirectory();
            if (string.IsNullOrEmpty(extDir)) return null;

            string wwwrootDir = Path.Combine(FindRootWithWwwroot(), "wwwroot");
            if (!Directory.Exists(wwwrootDir))
            {
                wwwrootDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
            }
            if (!Directory.Exists(wwwrootDir)) Directory.CreateDirectory(wwwrootDir);

            string zipPath = Path.Combine(wwwrootDir, "SaveZonix-Extension.zip");

            // Also check SaveZonix-Web for pre-existing zip
            string webZip = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "SaveZonix-Web", "SaveZonix-Extension.zip"));
            try
            {
                if (File.Exists(webZip) && (!File.Exists(zipPath) || new FileInfo(zipPath).Length == 0))
                {
                    File.Copy(webZip, zipPath, true);
                    return zipPath;
                }
            }
            catch { }

            if (!File.Exists(zipPath) || new FileInfo(zipPath).Length == 0)
            {
                System.IO.Compression.ZipFile.CreateFromDirectory(extDir, zipPath, System.IO.Compression.CompressionLevel.Fastest, false);
            }

            return zipPath;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Zip Notice] {ex.Message}");
            return null;
        }
    }

    private static void CopyDirectoryRecursive(string sourceDir, string targetDir)
    {
        Directory.CreateDirectory(targetDir);
        foreach (var file in Directory.GetFiles(sourceDir))
        {
            var dest = Path.Combine(targetDir, Path.GetFileName(file));
            if (!File.Exists(dest) || File.GetLastWriteTimeUtc(file) > File.GetLastWriteTimeUtc(dest))
            {
                File.Copy(file, dest, true);
            }
        }
        foreach (var dir in Directory.GetDirectories(sourceDir))
        {
            var subDest = Path.Combine(targetDir, Path.GetFileName(dir));
            CopyDirectoryRecursive(dir, subDest);
        }
    }

    public static void OpenBrowser(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            });
        }
        catch
        {
            try
            {
                Process.Start(new ProcessStartInfo("cmd", $"/c start \"\" \"{url}\"") { CreateNoWindow = true });
            }
            catch { }
        }
    }
}

