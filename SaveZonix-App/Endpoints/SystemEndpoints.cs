using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using SaveZonix.Models;
using SaveZonix.Services;
using StreamHelper.Services;
using Zonix.Core.Engines;

namespace SaveZonix.Endpoints;

public static class SystemEndpoints
{
    public static WebApplication MapSystemEndpoints(this WebApplication app)
    {
        // ─────────────────────────────────────────────────────────────
        // 1. Client Desktop Health Check (Used by Browser Extension)
        // ─────────────────────────────────────────────────────────────
        app.MapGet("/api/system/health", () =>
        {
            return Results.Ok(new
            {
                status = "running",
                version = "2.5.4",
                engine = "SaveZonix Turbo Multi-Threaded Engine",
                timestamp = DateTime.UtcNow
            });
        });

        // ─────────────────────────────────────────────────────────────
        // 2. Local Network Info (For LAN / Apple Device Streaming)
        // ─────────────────────────────────────────────────────────────
        app.MapGet("/api/system/network-info", () =>
        {
            var ips = new List<string>();
            try
            {
                var host = System.Net.Dns.GetHostEntry(System.Net.Dns.GetHostName());
                foreach (var ip in host.AddressList)
                {
                    if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && !System.Net.IPAddress.IsLoopback(ip))
                    {
                        ips.Add(ip.ToString());
                    }
                }
            }
            catch { }

            string p = Environment.GetEnvironmentVariable("PORT") ?? "5000";
            var urls = ips.Select(ip => $"http://{ip}:{p}").ToList();

            return Results.Ok(new { success = true, port = p, localIps = ips, fullUrls = urls });
        });

        // ─────────────────────────────────────────────────────────────
        // 3. Silent Auto-Updater APIs (Official GitHub Releases only)
        // ─────────────────────────────────────────────────────────────
        app.MapPost("/api/system/silent-update", (SilentUpdateRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.DownloadUrl) || !Uri.TryCreate(req.DownloadUrl, UriKind.Absolute, out _))
            {
                return Results.BadRequest(new { success = false, message = "Invalid download URL" });
            }

            bool started = SilentUpdateManager.StartUpdate(req.DownloadUrl, req.TargetVersion ?? "2.5.4");
            return Results.Ok(new { success = started, message = started ? "Update download initialized." : "Update already running." });
        });

        app.MapGet("/api/system/update-progress", () =>
        {
            var state = SilentUpdateManager.State;
            return Results.Ok(new
            {
                isActive = state.IsActive,
                targetVersion = state.TargetVersion,
                percent = state.Percent,
                downloadedBytes = state.DownloadedBytes,
                totalBytes = state.TotalBytes,
                downloadedMB = Math.Round((double)state.DownloadedBytes / (1024 * 1024), 1),
                totalMB = Math.Round((double)state.TotalBytes / (1024 * 1024), 1),
                status = state.Status,
                isComplete = state.IsComplete,
                isError = state.IsError,
                errorMessage = state.ErrorMessage
            });
        });

        // ─────────────────────────────────────────────────────────────
        // 4. Remote App Configuration (Read-only version check from Web Server)
        // ─────────────────────────────────────────────────────────────
        app.MapGet("/api/app-config", async (IAdminSettingsService adminSettings) =>
        {
            var settings = await adminSettings.GetAllSettingsAsync();
            var dlUrl = settings.GetValueOrDefault("DownloadUrl", "https://github.com/zaid154/SaveZonix/releases/download/v2.5.4/SaveZonix-Setup-v2.5.4.exe");
            return Results.Ok(new
            {
                latestAppVersion = settings.GetValueOrDefault("LatestAppVersion", "2.5.4"),
                minAllowedVersion = settings.GetValueOrDefault("MinAllowedVersion", "2.0.0"),
                forceUpdate = settings.GetValueOrDefault("ForceUpdate", "false").Equals("true", StringComparison.OrdinalIgnoreCase),
                downloadUrl = dlUrl,
                appDownloadUrl = dlUrl,
                updateChangelog = settings.GetValueOrDefault("UpdateChangelog", "Parallel multi-threaded downloads, 4K Cinema Player & stability fixes."),
                silentAutoUpdate = settings.GetValueOrDefault("SilentAutoUpdate", "true").Equals("true", StringComparison.OrdinalIgnoreCase),
                freeDailyLimit = int.TryParse(settings.GetValueOrDefault("FreeDailyDownloadLimit", "10"), out var limit) ? limit : 10,
                lock4KForVip = settings.GetValueOrDefault("Lock4KForVIP", "false").Equals("true", StringComparison.OrdinalIgnoreCase),
                announcementMessage = settings.GetValueOrDefault("AnnouncementMessage", "")
            });
        });

        // ─────────────────────────────────────────────────────────────
        // 5. Client-Side Crash & Error Diagnostics Logging
        // ─────────────────────────────────────────────────────────────
        app.MapPost("/api/analytics/client-error", async (ErrorDiagnosticLog errorLog, IDownloadAnalyticsService analytics, HttpContext ctx) =>
        {
            errorLog.ClientIp = ctx.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            errorLog.UserAgent = ctx.Request.Headers.UserAgent.ToString();
            errorLog.Timestamp = DateTime.UtcNow;
            await analytics.LogErrorDiagnosticAsync(errorLog);
            return Results.Ok(new { success = true });
        });

        // ─────────────────────────────────────────────────────────────
        // 6. Local Engine Health Telemetry
        // ─────────────────────────────────────────────────────────────
        app.MapGet("/api/engine/health", (ServiceHealthMonitor monitor) =>
        {
            return Results.Ok(monitor.GetHealthSnapshot());
        });

        app.MapGet("/api/engine/stats", (ServiceHealthMonitor monitor) =>
        {
            return Results.Ok(monitor.GetHealthSnapshot());
        });

        return app;
    }
}
