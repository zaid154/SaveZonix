using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

namespace SaveZonix.Services;

public static class FfmpegBootstrapper
{
    private static readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromMinutes(5) };
    private static bool _isInitialized = false;
    private static readonly object _initLock = new();

    public static async Task EnsureFfmpegAsync()
    {
        lock (_initLock)
        {
            if (_isInitialized) return;
        }

        string baseDir = Directory.GetCurrentDirectory();
        string exeName = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "ffmpeg.exe" : "ffmpeg";
        string targetPath = Path.Combine(baseDir, exeName);

        // 1. Check if already exists in project root folder
        if (File.Exists(targetPath) && new FileInfo(targetPath).Length > 1024 * 1024)
        {
            _isInitialized = true;
            return;
        }

        // 2. Check if already in bin output folder
        string binPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, exeName);
        if (File.Exists(binPath) && new FileInfo(binPath).Length > 1024 * 1024)
        {
            _isInitialized = true;
            return;
        }

        // 3. Check if available globally in system PATH
        if (IsFfmpegInPath(exeName))
        {
            _isInitialized = true;
            return;
        }

        // 4. Missing on new machine! Auto-download official standalone build
        Console.WriteLine();
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("╔══════════════════════════════════════════════════════════════════╗");
        Console.WriteLine("║ ⚡ [FFmpeg Auto-Setup] FFmpeg binary not found on this system.    ║");
        Console.WriteLine("║ ⬇️  Downloading official standalone FFmpeg binary automatically... ║");
        Console.WriteLine("╚══════════════════════════════════════════════════════════════════╝");
        Console.ResetColor();

        string downloadUrl;
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            downloadUrl = "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip";
        }
        else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
        {
            downloadUrl = "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-linux-64.zip";
        }
        else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
        {
            downloadUrl = "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-osx-64.zip";
        }
        else
        {
            Console.WriteLine("[FFmpeg Auto-Setup] Unsupported OS for auto-download.");
            return;
        }

        string tempZip = Path.Combine(Path.GetTempPath(), $"ffmpeg_{Guid.NewGuid():N}.zip");

        try
        {
            using (var response = await _httpClient.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead))
            {
                response.EnsureSuccessStatusCode();
                var totalBytes = response.Content.Headers.ContentLength ?? -1L;

                using var stream = await response.Content.ReadAsStreamAsync();
                using var fileStream = new FileStream(tempZip, FileMode.Create, FileAccess.Write, FileShare.None);

                byte[] buffer = new byte[81920];
                long downloaded = 0;
                int read;
                int lastPct = -1;

                while ((read = await stream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                {
                    await fileStream.WriteAsync(buffer, 0, read);
                    downloaded += read;
                    if (totalBytes > 0)
                    {
                        int pct = (int)((downloaded * 100) / totalBytes);
                        if (pct != lastPct && pct % 10 == 0)
                        {
                            lastPct = pct;
                            Console.Write($"\r[FFmpeg Download] {pct}% ({downloaded / (1024 * 1024)} MB / {totalBytes / (1024 * 1024)} MB)...");
                        }
                    }
                }
            }

            Console.WriteLine();
            Console.WriteLine("[FFmpeg Auto-Setup] Extracting FFmpeg binary...");

            using (var archive = ZipFile.OpenRead(tempZip))
            {
                foreach (var entry in archive.Entries)
                {
                    if (entry.Name.Equals(exeName, StringComparison.OrdinalIgnoreCase))
                    {
                        entry.ExtractToFile(targetPath, overwrite: true);
                        break;
                    }
                }
            }

            // On Linux/macOS, grant execution permissions
            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows) && File.Exists(targetPath))
            {
                try
                {
                    Process.Start("chmod", $"+x \"{targetPath}\"")?.WaitForExit();
                }
                catch { }
            }

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"✅ [FFmpeg Auto-Setup] FFmpeg successfully installed to: {targetPath}");
            Console.ResetColor();
            _isInitialized = true;
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"⚠️ [FFmpeg Auto-Setup] Auto-download failed: {ex.Message}");
            Console.WriteLine("   You can manually copy ffmpeg.exe into this project folder if needed.");
            Console.ResetColor();
        }
        finally
        {
            if (File.Exists(tempZip))
            {
                try { File.Delete(tempZip); } catch { }
            }
        }
    }

    private static bool IsFfmpegInPath(string exeName)
    {
        try
        {
            using var proc = Process.Start(new ProcessStartInfo
            {
                FileName = exeName,
                Arguments = "-version",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            });
            if (proc != null)
            {
                proc.WaitForExit(1500);
                return proc.ExitCode == 0;
            }
        }
        catch
        {
            // Not in PATH
        }
        return false;
    }
}
