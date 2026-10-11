using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using SaveZonix.Core;
using SaveZonix.Models;
using StreamHelper.Services;
using Zonix.Core.Engines;

namespace SaveZonix.Endpoints;

public static class MediaPowerEndpoints
{
    public static WebApplication MapMediaPowerEndpoints(this WebApplication app)
    {
        // ─────────────────────────────────────────────────────────────
        // SUPER-ENGINE POWER FEATURES (Sponsors, Subtitles, Trimming, Batch)
        // ─────────────────────────────────────────────────────────────
        app.MapGet("/api/power/sponsors", async (string videoId, PowerFeaturesEngine engine) =>
        {
            var segments = await engine.GetSponsorSegmentsAsync(videoId);
            return Results.Ok(new { success = true, videoId, count = segments.Count, segments });
        });

        app.MapGet("/api/power/subtitles", async (string videoId, PowerFeaturesEngine engine) =>
        {
            var subs = await engine.GetAvailableSubtitlesAsync(videoId);
            return Results.Ok(new { success = true, videoId, count = subs.Count, subtitles = subs });
        });

        app.MapPost("/api/power/trim", async (PowerTrimRequest req, PowerFeaturesEngine engine) =>
        {
            if (string.IsNullOrEmpty(req.InputPath) || !File.Exists(req.InputPath))
                return Results.BadRequest(new { success = false, message = "Input video file not found." });

            string outDir = Path.GetDirectoryName(req.InputPath) ?? MediaHelper.GetDownloadsDirectory();
            string outName = $"{Path.GetFileNameWithoutExtension(req.InputPath)}_trimmed_{DateTime.UtcNow.Ticks % 10000}{Path.GetExtension(req.InputPath)}";
            string outPath = Path.Combine(outDir, outName);

            bool ok = await engine.TrimVideoAsync(req.InputPath, outPath, TimeSpan.FromSeconds(req.StartSeconds), TimeSpan.FromSeconds(req.EndSeconds));
            return Results.Ok(new { success = ok, outputPath = outPath });
        });

        app.MapPost("/api/batch/multi-url", (BulkBatchCreateRequest req, BulkBatchEngine batchEngine) =>
        {
            if (req.Urls == null || req.Urls.Count == 0)
                return Results.BadRequest(new { success = false, message = "No valid URLs provided." });

            string downloadDir = MediaHelper.GetDownloadsDirectory();
            string batchId = batchEngine.CreateBatch(req.Urls);
            batchEngine.StartBatchBackground(batchId, downloadDir, maxConcurrency: 4);

            return Results.Ok(new { success = true, batchId });
        });

        app.MapGet("/api/batch/multi-url/{batchId}", (string batchId, BulkBatchEngine batchEngine) =>
        {
            var status = batchEngine.GetBatchStatus(batchId);
            if (status == null) return Results.NotFound(new { success = false, message = "Batch not found." });
            return Results.Ok(new { success = true, status });
        });

        // ─────────────────────────────────────────────────────────────
        // DESKTOP & CROSS-PLATFORM (APPLE / WINDOWS / MOBILE) INTEGRATION APIS
        // ─────────────────────────────────────────────────────────────

        // File Reveal: Opens Windows File Explorer or Mac Finder highlighting the completed download
        app.MapGet("/api/file/reveal", async (string? path, string? id, string? fileName, IDownloadHistoryService? historyService) =>
        {
            string? targetPath = await MediaHelper.ResolveMediaFilePathAsync(path, id, fileName, historyService);
            if (string.IsNullOrWhiteSpace(targetPath) || !File.Exists(targetPath))
            {
                targetPath = MediaHelper.GetDownloadsDirectory();
            }

            try
            {
                if (OperatingSystem.IsWindows())
                {
                    if (File.Exists(targetPath))
                        Process.Start(new ProcessStartInfo("explorer.exe", $"/select,\"{targetPath}\"") { UseShellExecute = true });
                    else
                        Process.Start(new ProcessStartInfo("explorer.exe", $"\"{targetPath}\"") { UseShellExecute = true });
                }
                else if (OperatingSystem.IsMacOS())
                {
                    if (File.Exists(targetPath))
                        Process.Start("open", $"-R \"{targetPath}\"");
                    else
                        Process.Start("open", $"\"{targetPath}\"");
                }
                else
                {
                    string dir = File.Exists(targetPath) ? (Path.GetDirectoryName(targetPath) ?? targetPath) : targetPath;
                    Process.Start("xdg-open", $"\"{dir}\"");
                }
                return Results.Ok(new { success = true, resolvedPath = targetPath });
            }
            catch (Exception ex)
            {
                return Results.Problem(ex.Message);
            }
        });

        // HTML5 Media Range Streaming: Smooth seeking on iOS Safari, macOS QuickTime, and Chrome
        app.MapGet("/api/stream/preview", async (string? path, string? id, string? fileName, bool? download, IDownloadHistoryService? historyService) =>
        {
            string? targetPath = await MediaHelper.ResolveMediaFilePathAsync(path, id, fileName, historyService);
            if (string.IsNullOrWhiteSpace(targetPath) || !File.Exists(targetPath))
                return Results.NotFound(new { success = false, message = "File not found." });

            string ext = Path.GetExtension(targetPath).ToLowerInvariant();
            string contentType = ext switch
            {
                ".mp4" => "video/mp4",
                ".webm" => "video/webm",
                ".mkv" => "video/x-matroska",
                ".mp3" => "audio/mpeg",
                ".m4a" => "audio/mp4",
                ".wav" => "audio/wav",
                ".flac" => "audio/flac",
                _ => "application/octet-stream"
            };

            string outName = Path.GetFileName(targetPath);
            return download == true
                ? Results.File(targetPath, contentType, fileDownloadName: outName, enableRangeProcessing: true)
                : Results.File(targetPath, contentType, enableRangeProcessing: true);
        });

        // Apple Device Optimization: Fast transcode to Apple-friendly H.264/AAC with +faststart
        app.MapPost("/api/media/apple-optimize", async (AppleOptimizeRequest req, TranscoderEngine transcoder, IDownloadHistoryService? historyService) =>
        {
            string? inputPath = await MediaHelper.ResolveMediaFilePathAsync(req?.Path, req?.Id, req?.FileName, historyService);
            if (string.IsNullOrWhiteSpace(inputPath) || !File.Exists(inputPath))
                return Results.BadRequest(new { success = false, message = "Source media file not found." });

            string dir = Path.GetDirectoryName(inputPath) ?? MediaHelper.GetDownloadsDirectory();
            string baseName = Path.GetFileNameWithoutExtension(inputPath);
            string outputPath = Path.Combine(dir, $"{baseName}_Apple_Optimized.mp4");

            var result = await transcoder.OptimizeForAppleDeviceAsync(inputPath, outputPath);
            if (result.Success && File.Exists(outputPath))
            {
                return Results.Ok(new 
                { 
                    success = true, 
                    outputPath, 
                    fileName = Path.GetFileName(outputPath),
                    previewUrl = $"/api/stream/preview?path={Uri.EscapeDataString(outputPath)}" 
                });
            }

            return Results.Problem(result.ErrorMessage);
        });

        // Browser Cookie Vault: YouTube 1080p Premium & Age-Restricted Unlocks
        app.MapGet("/api/cookies/status", (CookieVaultEngine vault) =>
        {
            return Results.Ok(new { success = true, status = vault.GetStatus() });
        });

        app.MapPost("/api/cookies/import", (CookieImportRequest req, CookieVaultEngine vault) =>
        {
            bool ok = vault.ImportCookies(req.Content);
            return Results.Ok(new { success = ok, status = vault.GetStatus() });
        });

        app.MapPost("/api/cookies/clear", (CookieVaultEngine vault) =>
        {
            vault.ClearCookies();
            return Results.Ok(new { success = true, status = vault.GetStatus() });
        });

        return app;
    }
}
