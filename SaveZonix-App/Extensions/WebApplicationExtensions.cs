using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SaveZonix.Core;
using StreamHelper.Data;
using StreamHelper.Services;

namespace SaveZonix.Extensions;

public static class WebApplicationExtensions
{
    public static WebApplication UseSaveZonixMiddlewares(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }
        else
        {
            app.UseExceptionHandler("/Home/Error");
            app.UseHsts();
        }

        // Aggressive Cache for Static Assets (with fingerprinting/asp-append-version)
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = ctx =>
            {
                var fileName = ctx.File.Name.ToLowerInvariant();
                if (fileName == "favicon.ico" || fileName == "app.ico")
                {
                    // Allow fast updates for favicons so browsers don't hold onto stale icons
                    ctx.Context.Response.Headers.CacheControl = "no-cache, must-revalidate";
                }
                else
                {
                    // Cache static assets (CSS, JS, images, fonts) aggressively for 1 year
                    const int durationInSeconds = 60 * 60 * 24 * 365;
                    ctx.Context.Response.Headers.CacheControl = $"public,max-age={durationInSeconds},immutable";
                }
            }
        });

        // Security & Anti-Stale Caching Middleware: Never cache auth, account, admin or user-specific data
        app.Use(async (context, next) =>
        {
            var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";
            bool isSensitive = path.StartsWith("/account") || 
                               path.StartsWith("/api/auth") || 
                               path.StartsWith("/api/admin") || 
                               path.StartsWith("/api/user") ||
                               context.User.Identity?.IsAuthenticated == true;

            if (isSensitive)
            {
                context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, private, max-age=0";
                context.Response.Headers.Pragma = "no-cache";
                context.Response.Headers.Expires = "0";
            }

            await next();
        });

        app.UseRouting();

        app.UseAuthentication();
        app.UseAuthorization();

        return app;
    }

    public static async Task RunStartupTasksAsync(this WebApplication app)
    {

        try
        {
            using var startupScope = app.Services.CreateScope();
            var startupHistoryService = startupScope.ServiceProvider.GetService<IDownloadHistoryService>();
            if (startupHistoryService != null)
            {
                int cleaned = await startupHistoryService.ReconcileOrphanedDownloadsAsync(DownloadTaskManager.GetActiveTaskIds());
                if (cleaned > 0)
                {
                    Console.WriteLine($"[Startup] Reconciled {cleaned} orphaned download(s) to Cancelled.");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Startup Reconciliation Notice] {ex.Message}");
        }
    }
}
