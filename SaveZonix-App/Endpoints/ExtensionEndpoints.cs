using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using SaveZonix.Core;
using StreamHelper.Services;

namespace SaveZonix.Endpoints;

public static class ExtensionEndpoints
{
    public static WebApplication MapExtensionEndpoints(this WebApplication app)
    {
        // ─────────────────────────────────────────────────────────────
        // Image Stealth Proxy (Bypasses Anti-Hotlinking, CORS & 403 Forbidden)
        // ─────────────────────────────────────────────────────────────
        app.MapGet("/api/proxy-image", async (HttpContext ctx, string url) =>
        {
            if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                return Results.NotFound();
            }

            try
            {
                using var client = MediaHelper.CreateConfiguredHttpClient();
                var resp = await client.GetAsync(url);
                if (resp.IsSuccessStatusCode)
                {
                    var bytes = await resp.Content.ReadAsByteArrayAsync();
                    string contentType = resp.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
                    ctx.Response.Headers.AccessControlAllowOrigin = "*";
                    ctx.Response.Headers.CacheControl = "public, max-age=86400";
                    return Results.Bytes(bytes, contentType);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Proxy Image Notice] {ex.Message}");
            }

            return Results.Redirect(url);
        });

        app.MapGet("/api/proxy/thumbnail", (HttpContext ctx, string url) =>
        {
            return Results.Redirect($"/api/proxy-image?url={Uri.EscapeDataString(url)}");
        });

        // ─────────────────────────────────────────────────────────────
        // Extension Recent Downloads Sync APIs (Direct Database Driven)
        // ─────────────────────────────────────────────────────────────
        app.MapGet("/api/extension/recent-downloads", async (IDownloadHistoryService historyService) =>
        {
            var (items, total) = await historyService.GetAllDownloadsAsync(1, 30, null, "Completed", null, null);
            var list = items.Select(i =>
            {
                var cleanTitle = (string.IsNullOrWhiteSpace(i.Title) || i.Title.Equals("Video.mp4", StringComparison.OrdinalIgnoreCase) || i.Title.Equals("video.mp4", StringComparison.OrdinalIgnoreCase) || i.Title.Equals("Video", StringComparison.OrdinalIgnoreCase))
                    ? (!string.IsNullOrWhiteSpace(i.FileName) && !i.FileName.Equals("video.mp4", StringComparison.OrdinalIgnoreCase) ? i.FileName : "Media Item")
                    : i.Title;

                var cleanFileName = !string.IsNullOrWhiteSpace(i.FileName) && !i.FileName.Equals("video.mp4", StringComparison.OrdinalIgnoreCase)
                    ? i.FileName
                    : (cleanTitle.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) ? cleanTitle : $"{cleanTitle}.mp4");

                return new
                {
                    id = i.Id,
                    title = cleanTitle,
                    filename = cleanFileName,
                    quality = string.IsNullOrWhiteSpace(i.Quality) ? "1080p Full HD" : i.Quality,
                    size = string.IsNullOrWhiteSpace(i.FormattedFileSize) ? "Completed" : i.FormattedFileSize,
                    site = string.IsNullOrWhiteSpace(i.Platform) ? "Web Stream" : i.Platform,
                    thumbnail = !string.IsNullOrWhiteSpace(i.ThumbnailUrl) ? i.ThumbnailUrl : "",
                    downloadId = (int?)null,
                    timestamp = i.CreatedAt.ToString("o")
                };
            }).Where(i => !i.title.Equals("video.mp4", StringComparison.OrdinalIgnoreCase));
            return Results.Ok(new { success = true, items = list });
        });

        app.MapPost("/api/extension/clear-history", async (IDownloadHistoryService historyService) =>
        {
            var success = await historyService.ClearAllDownloadsAsync();
            return Results.Ok(new { success });
        });

        app.MapDelete("/api/extension/history/{id}", async (string id, IDownloadHistoryService historyService) =>
        {
            var decodedId = System.Uri.UnescapeDataString(id);
            var deleted = await historyService.DeleteDownloadAsync(decodedId);
            return Results.Ok(new { success = deleted });
        });

        // ─────────────────────────────────────────────────────────────
        // Extension 1-Click Browser Loader, Open Folder & ZIP Download
        // ─────────────────────────────────────────────────────────────
        app.MapPost("/api/extension/install-browser", () =>
        {
            try
            {
                string? extensionPath = MediaHelper.GetExtensionDirectory();
                if (string.IsNullOrEmpty(extensionPath) || !Directory.Exists(extensionPath))
                {
                    return Results.NotFound(new { success = false, message = "SaveZonix Extension folder could not be located." });
                }

                // Check popular browser executable paths on Windows
                string[] browserCandidates = new[]
                {
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BraveSoftware", "Brave-Browser", "Application", "brave.exe")
                };

                string? browserExe = browserCandidates.FirstOrDefault(File.Exists) ?? "chrome.exe";

                // Also open explorer to extension path for convenience
                try
                {
                    Process.Start(new ProcessStartInfo("explorer.exe", $"\"{extensionPath}\"") { UseShellExecute = true });
                }
                catch { }

                return Results.Ok(new
                {
                    success = true,
                    message = "Extension folder opened! Copy path and load into chrome://extensions",
                    browser = Path.GetFileNameWithoutExtension(browserExe),
                    extensionFolder = extensionPath
                });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Failed to locate extension");
            }
        });

        app.MapPost("/api/extension/open-folder", () =>
        {
            try
            {
                string? extensionPath = MediaHelper.GetExtensionDirectory();
                if (!string.IsNullOrEmpty(extensionPath) && Directory.Exists(extensionPath))
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo("explorer.exe", $"\"{extensionPath}\"") { UseShellExecute = true });
                    }
                    catch { }

                    return Results.Ok(new { success = true, path = extensionPath });
                }
                return Results.NotFound(new { success = false, message = "Extension folder not found." });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        });

        app.MapGet("/api/extension/download-zip", () =>
        {
            try
            {
                string? zipFile = MediaHelper.EnsureExtensionZipExists();
                if (!string.IsNullOrEmpty(zipFile) && File.Exists(zipFile))
                {
                    return Results.File(zipFile, "application/zip", "SaveZonix-Extension.zip");
                }
                return Results.NotFound(new { success = false, message = "Extension archive could not be generated." });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Failed to download extension archive");
            }
        });

        return app;
    }
}
