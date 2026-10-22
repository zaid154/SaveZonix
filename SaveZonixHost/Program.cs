using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace SaveZonixHost;

class Program
{
    private const string HostName = "com.savezonix.launcher";
    private const int DefaultPort = 50550;

    static async Task<int> Main(string[] args)
    {
        // 1. Manual / Installer Registration Mode
        if (args.Length > 0 && args[0].Equals("--register", StringComparison.OrdinalIgnoreCase))
        {
            RegisterHost();
            return 0;
        }

        if (args.Length > 0 && args[0].Equals("--unregister", StringComparison.OrdinalIgnoreCase))
        {
            UnregisterHost();
            return 0;
        }

        // 2. Native Messaging Host Mode (Launched by Chrome or Edge via stdio)
        try
        {
            using var stdin = Console.OpenStandardInput();
            using var stdout = Console.OpenStandardOutput();

            while (true)
            {
                string? rawJson = ReadMessage(stdin);
                if (string.IsNullOrEmpty(rawJson))
                {
                    break; // Chrome closed pipe or EOF
                }

                var response = await HandleIncomingMessageAsync(rawJson);
                SendMessage(stdout, response);
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[SaveZonixHost Error] {ex.Message}");
            return 1;
        }

        return 0;
    }

    private static async Task<object> HandleIncomingMessageAsync(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            string action = root.TryGetProperty("action", out var act) ? act.GetString() ?? "start" : "start";

            // Ping / Status check
            if (action.Equals("ping", StringComparison.OrdinalIgnoreCase) || action.Equals("status", StringComparison.OrdinalIgnoreCase))
            {
                var (isRunning, activePort) = await CheckIfBackendRunningAsync();
                return new
                {
                    success = true,
                    running = isRunning,
                    port = activePort > 0 ? activePort : DefaultPort
                };
            }

            // Start / Launch action
            if (action.Equals("start", StringComparison.OrdinalIgnoreCase) || action.Equals("launch", StringComparison.OrdinalIgnoreCase))
            {
                var (isRunning, activePort) = await CheckIfBackendRunningAsync();
                if (isRunning)
                {
                    return new
                    {
                        success = true,
                        alreadyRunning = true,
                        port = activePort,
                        message = "SaveZonix desktop engine is already active and running."
                    };
                }

                string? zonixExe = LocateZonixExecutable();
                if (string.IsNullOrEmpty(zonixExe) || !File.Exists(zonixExe))
                {
                    return new
                    {
                        success = false,
                        error = "SaveZonix executable (Zonix.exe) could not be located on this system. Please run SaveZonix-Setup installer.",
                        port = DefaultPort
                    };
                }

                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = zonixExe,
                        Arguments = "--from-extension",
                        WorkingDirectory = Path.GetDirectoryName(zonixExe) ?? "",
                        UseShellExecute = true, // Detached from Chrome/Host process
                        WindowStyle = ProcessWindowStyle.Normal
                    };

                    Process.Start(psi);

                    return new
                    {
                        success = true,
                        started = true,
                        port = DefaultPort,
                        exePath = zonixExe,
                        message = "SaveZonix desktop engine starting..."
                    };
                }
                catch (Exception ex)
                {
                    return new
                    {
                        success = false,
                        error = $"Failed to start Zonix.exe: {ex.Message}",
                        port = DefaultPort
                    };
                }
            }

            return new { success = true, message = $"Action '{action}' processed." };
        }
        catch (Exception ex)
        {
            return new { success = false, error = ex.Message };
        }
    }

    private static async Task<(bool isRunning, int port)> CheckIfBackendRunningAsync()
    {
        var procs = Process.GetProcessesByName("Zonix");
        if (procs.Length == 0)
        {
            return (false, 0);
        }

        int[] ports = new[] { 50550, 50551, 50552, 50553, 50554, 50555, 5000 };
        using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(1000) };

        foreach (var p in ports)
        {
            try
            {
                var res = await client.GetAsync($"http://127.0.0.1:{p}/api/system/health");
                if (res.IsSuccessStatusCode)
                {
                    return (true, p);
                }
            }
            catch { }
        }

        // Process is running, so backend is active/starting
        return (true, DefaultPort);
    }

    public static string? LocateZonixExecutable()
    {
        string currentDir = AppDomain.CurrentDomain.BaseDirectory;
        string directInDir = Path.Combine(currentDir, "Zonix.exe");
        if (File.Exists(directInDir)) return directInDir;

        string localAppDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs", "SaveZonix", "Zonix.exe");
        if (File.Exists(localAppDir)) return localAppDir;

        string progFilesDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            "SaveZonix", "Zonix.exe");
        if (File.Exists(progFilesDir)) return progFilesDir;

        string progFilesX86Dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            "SaveZonix", "Zonix.exe");
        if (File.Exists(progFilesX86Dir)) return progFilesX86Dir;

        // Development fallback paths
        string[] devCandidates = new[]
        {
            Path.Combine(currentDir, "..", "Zonix.exe"),
            Path.Combine(currentDir, "..", "net10.0", "Zonix.exe"),
            @"C:\Users\user\Desktop\All-Pojects\2 DotNET\SaveZonix\SaveZonix-App\bin\Debug\net10.0\Zonix.exe",
            @"C:\Users\user\Desktop\All-Pojects\2 DotNET\SaveZonix\SaveZonix-App\bin\Release\net10.0\win-x64\publish\Zonix.exe"
        };

        foreach (var dev in devCandidates)
        {
            try
            {
                var full = Path.GetFullPath(dev);
                if (File.Exists(full)) return full;
            }
            catch { }
        }

        return null;
    }

    private static string? ReadMessage(Stream stream)
    {
        byte[] lenBytes = new byte[4];
        int read = stream.Read(lenBytes, 0, 4);
        if (read < 4) return null;

        int length = BitConverter.ToInt32(lenBytes, 0);
        if (length <= 0 || length > 10 * 1024 * 1024) return null;

        byte[] buffer = new byte[length];
        int totalRead = 0;
        while (totalRead < length)
        {
            int r = stream.Read(buffer, totalRead, length - totalRead);
            if (r <= 0) break;
            totalRead += r;
        }

        return Encoding.UTF8.GetString(buffer, 0, totalRead);
    }

    private static void SendMessage(Stream stream, object payload)
    {
        string json = JsonSerializer.Serialize(payload);
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        byte[] lenBytes = BitConverter.GetBytes(bytes.Length);

        stream.Write(lenBytes, 0, lenBytes.Length);
        stream.Write(bytes, 0, bytes.Length);
        stream.Flush();
    }

    public static void RegisterHost()
    {
        try
        {
            string hostExePath = Process.GetCurrentProcess().MainModule?.FileName 
                ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "SaveZonixHost.exe");
            string hostDir = Path.GetDirectoryName(hostExePath) ?? AppDomain.CurrentDomain.BaseDirectory;
            string manifestPath = Path.Combine(hostDir, $"{HostName}.json");

            // Scan Chrome/Edge preferences to automatically discover all installed extension IDs
            var allowedOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "chrome-extension://ioeinfededpjponjnigbicadbfpoohhc/",
                "chrome-extension://fgleedmlpejpdmnmgckidmokgobkdnig/",
                "chrome-extension://fiamecdpdkgnicpifamjcncefcjfnlad/"
            };

            foreach (var discoveredId in FindInstalledExtensionIds())
            {
                allowedOrigins.Add($"chrome-extension://{discoveredId}/");
            }

            var manifestObj = new
            {
                name = HostName,
                description = "SaveZonix Desktop Native Messaging Host",
                path = hostExePath,
                type = "stdio",
                allowed_origins = allowedOrigins.ToList()
            };

            string manifestJson = JsonSerializer.Serialize(manifestObj, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(manifestPath, manifestJson, Encoding.UTF8);
            Console.WriteLine($"[SaveZonixHost] Created manifest: {manifestPath}");

            // Register in Windows Registry for Chrome and Edge
            string[] registryTargets = new[]
            {
                @"Software\Google\Chrome\NativeMessagingHosts",
                @"Software\Microsoft\Edge\NativeMessagingHosts"
            };

            foreach (var rootSubKey in registryTargets)
            {
                try
                {
                    using var key = Registry.CurrentUser.CreateSubKey($@"{rootSubKey}\{HostName}");
                    key?.SetValue("", manifestPath, RegistryValueKind.String);
                    Console.WriteLine($@" [Registry HKCU\{rootSubKey}\{HostName}] -> {manifestPath}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Registry Warning] {rootSubKey}: {ex.Message}");
                }
            }

            // Register Custom URL Protocol (savezonix://)
            try
            {
                string? zonixExe = LocateZonixExecutable() ?? Path.Combine(hostDir, "Zonix.exe");
                using var protoKey = Registry.CurrentUser.CreateSubKey(@"Software\Classes\savezonix");
                protoKey?.SetValue("", "URL:SaveZonix Protocol", RegistryValueKind.String);
                protoKey?.SetValue("URL Protocol", "", RegistryValueKind.String);

                using var cmdKey = Registry.CurrentUser.CreateSubKey(@"Software\Classes\savezonix\shell\open\command");
                cmdKey?.SetValue("", $"\"{zonixExe}\" \"%1\"", RegistryValueKind.String);
                Console.WriteLine($@" [Registry Protocol savezonix://] -> {zonixExe}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Registry Protocol Warning] {ex.Message}");
            }

            Console.WriteLine("SUCCESS: SaveZonix Native Messaging Host & Protocol registered successfully!");
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[Registration Error] {ex.Message}");
        }
    }

    public static void UnregisterHost()
    {
        try
        {
            string[] registryTargets = new[]
            {
                @"Software\Google\Chrome\NativeMessagingHosts",
                @"Software\Microsoft\Edge\NativeMessagingHosts"
            };

            foreach (var rootSubKey in registryTargets)
            {
                try
                {
                    Registry.CurrentUser.DeleteSubKeyTree($@"{rootSubKey}\{HostName}", throwOnMissingSubKey: false);
                }
                catch { }
            }

            try
            {
                Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\savezonix", throwOnMissingSubKey: false);
            }
            catch { }

            Console.WriteLine("SUCCESS: Unregistered SaveZonix host.");
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[Unregistration Error] {ex.Message}");
        }
    }

    private static List<string> FindInstalledExtensionIds()
    {
        var foundIds = new List<string>();
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] browserDirs = new[]
        {
            Path.Combine(localAppData, "Google", "Chrome", "User Data"),
            Path.Combine(localAppData, "Microsoft", "Edge", "User Data")
        };

        foreach (var bDir in browserDirs)
        {
            if (!Directory.Exists(bDir)) continue;

            try
            {
                foreach (var profileDir in Directory.GetDirectories(bDir))
                {
                    string[] prefFiles = new[]
                    {
                        Path.Combine(profileDir, "Secure Preferences"),
                        Path.Combine(profileDir, "Preferences")
                    };

                    foreach (var prefFile in prefFiles)
                    {
                        if (!File.Exists(prefFile)) continue;
                        try
                        {
                            string text = File.ReadAllText(prefFile);
                            if (text.Contains("SaveZonix", StringComparison.OrdinalIgnoreCase))
                            {
                                using var doc = JsonDocument.Parse(text);
                                if (doc.RootElement.TryGetProperty("extensions", out var exts) &&
                                    exts.TryGetProperty("settings", out var settings))
                                {
                                    foreach (var prop in settings.EnumerateObject())
                                    {
                                        string sRaw = prop.Value.GetRawText();
                                        if (sRaw.Contains("SaveZonix", StringComparison.OrdinalIgnoreCase))
                                        {
                                            foundIds.Add(prop.Name);
                                        }
                                    }
                                }
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }

        return foundIds.Distinct().ToList();
    }
}
