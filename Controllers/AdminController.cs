using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StreamHelper.Data;
using StreamHelper.Services;
using StreamHelper.ViewModels;

namespace StreamHelper.Controllers;

[Authorize(Roles = "Admin")]
public class AdminController : Controller
{
    private readonly AppDbContext _context;
    private readonly UserManager<AppUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly IDownloadHistoryService _downloadHistoryService;
    private readonly IAdminSettingsService _adminSettingsService;
    private readonly SaveZonix.Services.IDownloadAnalyticsService _downloadAnalyticsService;

    public AdminController(
        AppDbContext context,
        UserManager<AppUser> userManager,
        RoleManager<IdentityRole> roleManager,
        IDownloadHistoryService downloadHistoryService,
        IAdminSettingsService adminSettingsService,
        SaveZonix.Services.IDownloadAnalyticsService downloadAnalyticsService)
    {
        _context = context;
        _userManager = userManager;
        _roleManager = roleManager;
        _downloadHistoryService = downloadHistoryService;
        _adminSettingsService = adminSettingsService;
        _downloadAnalyticsService = downloadAnalyticsService;
    }

    public async Task<IActionResult> Index()
    {
        var totalUsers = await _context.Users.CountAsync();
        var activeUsers = await _context.Users.CountAsync(u => u.IsActive);
        var verifiedUsers = await _context.Users.CountAsync(u => u.EmailConfirmed);
        var today = DateTime.UtcNow.Date;
        var newUsersToday = await _context.Users.CountAsync(u => u.CreatedAt >= today);

        var totalDownloads = await _context.DownloadHistories.CountAsync();
        var completedDownloads = await _context.DownloadHistories.CountAsync(d => d.Status == DownloadStatus.Completed);
        var failedDownloads = await _context.DownloadHistories.CountAsync(d => d.Status == DownloadStatus.Failed);
        var totalBytes = await _context.DownloadHistories.Where(d => d.Status == DownloadStatus.Completed).SumAsync(d => d.DownloadedBytes);
        var avgSpeed = await _context.DownloadHistories.Where(d => d.Status == DownloadStatus.Completed && d.AverageSpeedMBps > 0).Select(d => (double?)d.AverageSpeedMBps).AverageAsync() ?? 0.0;

        var recentDownloads = await _context.DownloadHistories
            .OrderByDescending(d => d.CreatedAt)
            .Take(8)
            .ToListAsync();

        var topPlatforms = await _context.DownloadHistories
            .GroupBy(d => d.Platform)
            .Select(g => new { Platform = g.Key, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .Take(5)
            .ToDictionaryAsync(g => g.Platform, g => g.Count);

        var model = new AdminDashboardViewModel
        {
            TotalUsers = totalUsers,
            ActiveUsers = activeUsers,
            VerifiedUsers = verifiedUsers,
            NewUsersToday = newUsersToday,
            TotalDownloads = totalDownloads,
            CompletedDownloads = completedDownloads,
            FailedDownloads = failedDownloads,
            TotalDownloadedBytes = totalBytes,
            AverageDownloadSpeedMBps = avgSpeed,
            RecentDownloads = recentDownloads,
            TopPlatforms = topPlatforms
        };

        return View(model);
    }

    public async Task<IActionResult> Users(string? search, string? status, int page = 1)
    {
        int pageSize = 20;
        var query = _context.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(u => u.Email!.Contains(search) || u.FullName.Contains(search));
        }

        if (status == "Active") query = query.Where(u => u.IsActive);
        else if (status == "Inactive") query = query.Where(u => !u.IsActive);
        else if (status == "Verified") query = query.Where(u => u.EmailConfirmed);

        int totalCount = await query.CountAsync();
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var userItems = new List<UserItemViewModel>();
        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var dlCount = await _context.DownloadHistories.CountAsync(d => d.UserId == user.Id);
            userItems.Add(new UserItemViewModel
            {
                Id = user.Id,
                FullName = user.FullName,
                Email = user.Email ?? "",
                EmailConfirmed = user.EmailConfirmed,
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt,
                LastLoginAt = user.LastLoginAt,
                Roles = roles,
                DownloadCount = dlCount
            });
        }

        var model = new AdminUsersViewModel
        {
            Users = userItems,
            SearchTerm = search,
            StatusFilter = status,
            CurrentPage = page,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            PageSize = pageSize
        };

        return View(model);
    }

    public async Task<IActionResult> UserDetails(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var roles = await _userManager.GetRolesAsync(user);
        var downloads = await _context.DownloadHistories
            .Where(d => d.UserId == id)
            .OrderByDescending(d => d.CreatedAt)
            .Take(50)
            .ToListAsync();

        var totalDownloads = await _context.DownloadHistories.CountAsync(d => d.UserId == id);
        var completedDownloads = downloads.Count(d => d.Status == DownloadStatus.Completed);
        var totalBytes = downloads.Where(d => d.Status == DownloadStatus.Completed).Sum(d => d.DownloadedBytes);

        var model = new AdminUserDetailsViewModel
        {
            User = user,
            Roles = roles,
            RecentDownloads = downloads,
            TotalDownloads = totalDownloads,
            CompletedDownloads = completedDownloads,
            TotalDownloadedBytes = totalBytes
        };

        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleUserStatus(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var currentUserId = _userManager.GetUserId(User);
        if (user.Id == currentUserId || await _userManager.IsInRoleAsync(user, "Admin"))
        {
            TempData["ErrorMessage"] = "Administrator accounts are protected and cannot be deactivated.";
            return RedirectToAction("Users");
        }

        user.IsActive = !user.IsActive;
        await _userManager.UpdateAsync(user);
        TempData["SuccessMessage"] = $"User '{user.Email}' is now {(user.IsActive ? "Active" : "Deactivated")}.";
        return RedirectToAction("Users");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var currentUserId = _userManager.GetUserId(User);
        if (user.Id == currentUserId || await _userManager.IsInRoleAsync(user, "Admin"))
        {
            TempData["ErrorMessage"] = "Administrator accounts are protected and cannot be deleted.";
            return RedirectToAction("Users");
        }

        await _userManager.DeleteAsync(user);
        TempData["SuccessMessage"] = $"User '{user.Email}' was deleted.";
        return RedirectToAction("Users");
    }

    public async Task<IActionResult> Downloads(string? search, string? status, string? platform, string? userEmail, int page = 1)
    {
        // Reconcile any orphaned downloading tasks that are not running in memory
        try
        {
            var activeIds = SaveZonix.Program.GetActiveTaskIds();
            await _downloadHistoryService.ReconcileOrphanedDownloadsAsync(activeIds);
        }
        catch { }

        int pageSize = 20;
        var (items, totalCount) = await _downloadHistoryService.GetAllDownloadsAsync(page, pageSize, search, status, platform, userEmail);

        var model = new AdminDownloadsViewModel
        {
            Downloads = items,
            SearchTerm = search,
            StatusFilter = status,
            PlatformFilter = platform,
            UserFilter = userEmail,
            CurrentPage = page,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            PageSize = pageSize
        };

        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CancelDownload(string id)
    {
        SaveZonix.Program.CancelTask(id);
        await _downloadHistoryService.MarkCancelledAsync(id);
        TempData["SuccessMessage"] = "Download marked as cancelled.";
        return RedirectToAction("Downloads");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CleanOrphanedDownloads()
    {
        var activeIds = SaveZonix.Program.GetActiveTaskIds();
        int cleaned = await _downloadHistoryService.ReconcileOrphanedDownloadsAsync(activeIds);
        TempData["SuccessMessage"] = $"{cleaned} inactive download task(s) marked as Cancelled.";
        return RedirectToAction("Downloads");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteDownload(string id)
    {
        await _downloadHistoryService.DeleteDownloadAsync(id);
        TempData["SuccessMessage"] = "Download record deleted.";
        return RedirectToAction("Downloads");
    }

    [HttpGet]
    public async Task<IActionResult> Settings()
    {
        var settings = await _adminSettingsService.GetAllSettingsAsync();
        return View(new AdminSettingsViewModel { Settings = settings });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Settings(Dictionary<string, string> settings)
    {
        await _adminSettingsService.UpdateSettingsAsync(settings);
        TempData["SuccessMessage"] = "System settings updated successfully!";
        return RedirectToAction("Settings");
    }

    [HttpGet]
    public async Task<IActionResult> Diagnostics(string? search, string? status, int page = 1)
    {
        int pageSize = 25;
        var (downloads, totalCount) = await _downloadHistoryService.GetAllDownloadsAsync(page, pageSize, search, status, null, null);
        var recentErrors = await _downloadAnalyticsService.GetRecentErrorDiagnosticsAsync(50, search);

        var totalAll = await _context.DownloadHistories.CountAsync();
        var completedAll = await _context.DownloadHistories.CountAsync(d => d.Status == DownloadStatus.Completed);
        var corruptedAll = await _context.DownloadHistories.CountAsync(d => d.Status == DownloadStatus.Corrupted || d.ValidationStatus == "Corrupted" || d.ValidationStatus == "Truncated");
        var failedAll = await _context.DownloadHistories.CountAsync(d => d.Status == DownloadStatus.Failed);

        double passRate = totalAll > 0 ? ((double)completedAll / totalAll) * 100.0 : 100.0;

        bool ffmpegFound = System.IO.File.Exists(System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ffmpeg.exe")) ||
                           System.IO.File.Exists(System.IO.Path.Combine(Directory.GetCurrentDirectory(), "ffmpeg.exe"));

        var model = new AdminDiagnosticsViewModel
        {
            DiagnosticDownloads = downloads,
            ErrorLogs = recentErrors,
            TotalDownloads = totalAll,
            CompletedCount = completedAll,
            CorruptedCount = corruptedAll,
            FailedCount = failedAll,
            ValidationPassRate = passRate,
            AppVersion = Zonix.Core.MediaValidator.CurrentAppVersion,
            SystemVersion = Zonix.Core.MediaValidator.CurrentSystemVersion,
            OsDescription = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
            DotNetVersion = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
            IsFfmpegAvailable = ffmpegFound,
            SearchTerm = search,
            StatusFilter = status,
            CurrentPage = page,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            PageSize = pageSize
        };

        return View(model);
    }

    [HttpGet]
    public IActionResult Security()
    {
        return View();
    }
}
