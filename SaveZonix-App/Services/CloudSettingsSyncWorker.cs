using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StreamHelper.Services;

namespace SaveZonix.Services;

public class CloudSettingsSyncWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<CloudSettingsSyncWorker> _logger;
    private static readonly HttpClient _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
    private const string CloudConfigUrl = "https://savezonix.onrender.com/api/app-config";

    public CloudSettingsSyncWorker(IServiceProvider serviceProvider, ILogger<CloudSettingsSyncWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[CloudSyncWorker] Starting periodic Cloud Configuration sync...");

        // Initial delay on startup
        await Task.Delay(5000, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var response = await _httpClient.GetAsync(CloudConfigUrl, stoppingToken);
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync(stoppingToken);
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    using var scope = _serviceProvider.CreateScope();
                    var adminSettings = scope.ServiceProvider.GetRequiredService<IAdminSettingsService>();

                    var updates = new Dictionary<string, string>();

                    if (root.TryGetProperty("latestAppVersion", out var lv))
                        updates["LatestAppVersion"] = lv.GetString() ?? "2.5.1";

                    if (root.TryGetProperty("minAllowedVersion", out var mv))
                        updates["MinAllowedVersion"] = mv.GetString() ?? "2.0.0";

                    if (root.TryGetProperty("forceUpdate", out var fu))
                        updates["ForceUpdate"] = fu.GetBoolean().ToString().ToLowerInvariant();

                    if (root.TryGetProperty("appDownloadUrl", out var du) && !string.IsNullOrWhiteSpace(du.GetString()))
                        updates["DownloadUrl"] = du.GetString()!;

                    if (root.TryGetProperty("freeDailyLimit", out var fdl))
                        updates["FreeDailyDownloadLimit"] = fdl.GetInt32().ToString();

                    if (root.TryGetProperty("lock4KForVip", out var l4k))
                        updates["Lock4KForVIP"] = l4k.GetBoolean().ToString().ToLowerInvariant();

                    if (root.TryGetProperty("announcementMessage", out var am))
                        updates["AnnouncementMessage"] = am.GetString() ?? "";

                    if (updates.Count > 0)
                    {
                        await adminSettings.UpdateSettingsAsync(updates);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug("[CloudSyncWorker] Notice: {Message}", ex.Message);
            }

            // Sync every 30 seconds
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }
}
