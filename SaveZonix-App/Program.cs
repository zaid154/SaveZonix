using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Threading;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SaveZonix.Core;
using SaveZonix.Endpoints;
using SaveZonix.Extensions;
using SaveZonix.Models;
using Zonix.Core.Engines;

// 0. Single-Instance Guard & Process Shield
const string AppMutexName = "SaveZonix_SingleInstance_Mutex_2026";
bool isFirstInstance;
using var singleInstanceMutex = new Mutex(true, AppMutexName, out isFirstInstance);
var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";

if (!isFirstInstance)
{
    // If SaveZonix is already running in background, focus/open the browser to it and exit cleanly
    MediaHelper.OpenBrowser($"http://localhost:{port}");
    return;
}

CrashGuard.Initialize();

string rootDir = MediaHelper.FindRootWithWwwroot();
string wwwrootDir = Path.Combine(rootDir, "wwwroot");
Directory.SetCurrentDirectory(rootDir);

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = rootDir,
    WebRootPath = wwwrootDir
});

// 1. Dependency Injection: Register modular services & engines
builder.Services.AddSaveZonixServices(builder.Configuration);

builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var app = builder.Build();

// 2. HTTP Pipeline & Middlewares
app.UseSaveZonixMiddlewares();

// 3. Map Modular API Endpoint Slices (Clean, Decoupled & Zero Admin Loopholes)
app.MapDownloadEndpoints();
app.MapAuthEndpoints();
app.MapExtensionEndpoints();
app.MapMediaPowerEndpoints();
app.MapSystemEndpoints();

// 4. Default MVC Controller Route
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// 5. Background Startup Lifecycle (Auto-seed, orphan reconcile & auto-launch browser)
bool forceReset = args.Any(a => a.Equals("--seed-reset", StringComparison.OrdinalIgnoreCase) ||
                               a.Equals("--reset-db", StringComparison.OrdinalIgnoreCase) ||
                               a.Equals("seed-reset", StringComparison.OrdinalIgnoreCase));

app.Lifetime.ApplicationStarted.Register(() =>
{
    _ = Task.Run(async () =>
    {
        await app.RunStartupTasksAsync(forceReset);
    });

    _ = Task.Run(async () =>
    {
        try
        {
            await Task.Delay(250);
            MediaHelper.OpenBrowser($"http://localhost:{port}");
        }
        catch { }
    });
});

Console.ForegroundColor = ConsoleColor.Cyan;
Console.WriteLine($@"
══════════════════════════════════════════════════════════════════
  🚀 SaveZonix Client Engine v2.5.4 Running
  ⚡ Parallel Segment Downloader & Media Studio Online
  🌐 http://localhost:{port}
══════════════════════════════════════════════════════════════════
");
Console.ResetColor();

app.Run();

// ─────────────────────────────────────────────────────────────
// Backward Compatibility Forwarders for Existing Controllers
// ─────────────────────────────────────────────────────────────
namespace SaveZonix
{
    public partial class Program
    {
        public static HashSet<string> GetActiveTaskIds() =>
            DownloadTaskManager.GetActiveTaskIds().ToHashSet();

        public static void CancelTask(string taskId) =>
            DownloadTaskManager.CancelTask(taskId);

        public static List<DownloadTaskState> GetActiveSingleTasks() =>
            DownloadTaskManager.GetActiveSingleTasks();

        public static ConcurrentDictionary<string, DownloadTaskState> Tasks =>
            DownloadTaskManager.Tasks;
    }
}
