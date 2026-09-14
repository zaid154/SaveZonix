using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace SaveZonix.Services;

public class UpdateProgressState
{
    public bool IsActive { get; set; } = false;
    public string TargetVersion { get; set; } = "";
    public int Percent { get; set; } = 0;
    public long DownloadedBytes { get; set; } = 0;
    public long TotalBytes { get; set; } = 0;
    public string Status { get; set; } = "Idle";
    public bool IsComplete { get; set; } = false;
    public bool IsError { get; set; } = false;
    public string ErrorMessage { get; set; } = "";
}

public static class SilentUpdateManager
{
    public static UpdateProgressState State { get; } = new UpdateProgressState();
    private static readonly object _lock = new object();
    private static CancellationTokenSource? _cts;

    public static bool StartUpdate(string downloadUrl, string targetVersion)
    {
        lock (_lock)
        {
            if (State.IsActive && !State.IsError && !State.IsComplete)
            {
                return false; // Already running
            }

            _cts?.Cancel();
            _cts = new CancellationTokenSource();

            State.IsActive = true;
            State.TargetVersion = string.IsNullOrWhiteSpace(targetVersion) ? "2.5.1" : targetVersion;
            State.Percent = 0;
            State.DownloadedBytes = 0;
            State.TotalBytes = 0;
            State.Status = "Connecting...";
            State.IsComplete = false;
            State.IsError = false;
            State.ErrorMessage = "";

            var token = _cts.Token;

            _ = Task.Run(async () =>
            {
                try
                {
                    string tempFolder = Path.Combine(Path.GetTempPath(), "SaveZonix-Updates");
                    Directory.CreateDirectory(tempFolder);
                    string setupExe = Path.Combine(tempFolder, $"SaveZonix-Setup-{State.TargetVersion}.exe");

                    using var http = new HttpClient();
                    http.Timeout = TimeSpan.FromMinutes(15);
                    http.DefaultRequestHeaders.UserAgent.ParseAdd("SaveZonix-AutoUpdater/2.5");

                    State.Status = "Requesting download...";
                    using var response = await http.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead, token);

                    if (!response.IsSuccessStatusCode)
                    {
                        State.IsError = true;
                        State.ErrorMessage = $"Server returned HTTP {(int)response.StatusCode}: {response.ReasonPhrase}";
                        State.Status = "Failed";
                        State.IsActive = false;
                        return;
                    }

                    long totalBytes = response.Content.Headers.ContentLength ?? 87000000;
                    State.TotalBytes = totalBytes;

                    using var stream = await response.Content.ReadAsStreamAsync(token);
                    using var fs = new FileStream(setupExe, FileMode.Create, FileAccess.Write, FileShare.None);

                    byte[] buffer = new byte[65536];
                    int read;
                    long downloaded = 0;

                    State.Status = "Downloading...";

                    while ((read = await stream.ReadAsync(buffer, 0, buffer.Length, token)) > 0)
                    {
                        await fs.WriteAsync(buffer, 0, read, token);
                        downloaded += read;
                        State.DownloadedBytes = downloaded;
                        if (totalBytes > 0)
                        {
                            State.Percent = (int)Math.Min(100, Math.Round((double)downloaded / totalBytes * 100));
                        }
                    }

                    fs.Close();

                    if (!File.Exists(setupExe) || new FileInfo(setupExe).Length < 1024 * 1024)
                    {
                        State.IsError = true;
                        State.ErrorMessage = "Downloaded file corrupted or too small.";
                        State.Status = "Failed";
                        State.IsActive = false;
                        return;
                    }

                    State.Percent = 100;
                    State.Status = "Installing...";
                    State.IsComplete = true;

                    // Launch setup with auto-kill and silent switches
                    var psi = new ProcessStartInfo
                    {
                        FileName = setupExe,
                        Arguments = "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART",
                        UseShellExecute = true
                    };
                    Process.Start(psi);
                }
                catch (Exception ex)
                {
                    State.IsError = true;
                    State.ErrorMessage = ex.Message;
                    State.Status = "Failed";
                    State.IsActive = false;
                }
            }, token);

            return true;
        }
    }
}
