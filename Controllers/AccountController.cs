using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using StreamHelper.Data;
using StreamHelper.Services;
using SaveZonix.Services;
using StreamHelper.ViewModels;

namespace StreamHelper.Controllers;

public class AccountController : Controller
{
    private readonly UserManager<AppUser> _userManager;
    private readonly SignInManager<AppUser> _signInManager;
    private readonly IEmailService _emailService;
    private readonly IDownloadHistoryService _downloadHistoryService;
    private readonly IAdminSettingsService _adminSettingsService;
    private readonly SaveZonix.Services.IDownloadAnalyticsService _analyticsService;
    private readonly SaveZonix.Services.IPlaylistQueueManager _queueManager;

    public AccountController(
        UserManager<AppUser> userManager,
        SignInManager<AppUser> signInManager,
        IEmailService emailService,
        IDownloadHistoryService downloadHistoryService,
        IAdminSettingsService adminSettingsService,
        SaveZonix.Services.IDownloadAnalyticsService analyticsService,
        SaveZonix.Services.IPlaylistQueueManager queueManager)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _emailService = emailService;
        _downloadHistoryService = downloadHistoryService;
        _adminSettingsService = adminSettingsService;
        _analyticsService = analyticsService;
        _queueManager = queueManager;
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult Login(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Index", "Home");
        }

        ViewData["ReturnUrl"] = returnUrl;
        return View(new LoginViewModel { ReturnUrl = returnUrl });
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginViewModel model)
    {
        if (!ModelState.IsValid) return View(model);

        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user == null)
        {
            ModelState.AddModelError(string.Empty, "Invalid email or password.");
            return View(model);
        }

        if (!user.IsActive)
        {
            ModelState.AddModelError(string.Empty, "Your account has been deactivated. Please contact support.");
            return View(model);
        }

        bool emailReq = await _adminSettingsService.GetSettingBoolAsync("EmailVerificationRequired", false);
        if (emailReq && !user.EmailConfirmed)
        {
            ModelState.AddModelError(string.Empty, "Please verify your email address before logging in. Check your inbox for the verification link.");
            return View(model);
        }

        var result = await _signInManager.PasswordSignInAsync(user.UserName ?? model.Email, model.Password, model.RememberMe, lockoutOnFailure: true);
        if (result.Succeeded)
        {
            user.LastLoginAt = DateTime.UtcNow;
            await _userManager.UpdateAsync(user);

            if (!string.IsNullOrEmpty(model.ReturnUrl) && Url.IsLocalUrl(model.ReturnUrl))
            {
                return Redirect(model.ReturnUrl);
            }
            return RedirectToAction("Index", "Home");
        }
        if (result.IsLockedOut)
        {
            ModelState.AddModelError(string.Empty, "Account locked due to multiple failed login attempts. Please try again later.");
            return View(model);
        }

        ModelState.AddModelError(string.Empty, "Invalid email or password.");
        return View(model);
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Register(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Index", "Home");
        }

        bool regEnabled = await _adminSettingsService.GetSettingBoolAsync("RegistrationEnabled", true);
        if (!regEnabled)
        {
            ViewBag.ErrorMessage = "Registration is currently disabled by administrator.";
            return View("RegistrationDisabled");
        }

        ViewData["ReturnUrl"] = returnUrl;
        return View(new RegisterViewModel());
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Register(RegisterViewModel model, string? returnUrl = null)
    {
        if (!ModelState.IsValid) return View(model);

        bool regEnabled = await _adminSettingsService.GetSettingBoolAsync("RegistrationEnabled", true);
        if (!regEnabled)
        {
            ModelState.AddModelError(string.Empty, "Registration is currently disabled by administrator.");
            return View(model);
        }

        var existingUser = await _userManager.FindByEmailAsync(model.Email);
        if (existingUser != null)
        {
            ModelState.AddModelError("Email", "An account with this email address already exists.");
            return View(model);
        }

        var user = new AppUser
        {
            UserName = model.Email,
            Email = model.Email,
            FullName = model.FullName.Trim(),
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        var result = await _userManager.CreateAsync(user, model.Password);
        if (result.Succeeded)
        {
            await _userManager.AddToRoleAsync(user, "User");

            await _analyticsService.CreateOrUpdateUserAsync(new SaveZonix.Models.SaveZonixUser
            {
                Email = user.Email,
                FullName = user.FullName,
                Role = "User",
                AuthProvider = "Local",
                IsActive = true,
                CreatedAt = user.CreatedAt
            });

            var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
            var confirmationLink = Url.Action("VerifyEmail", "Account", new { userId = user.Id, code = token }, Request.Scheme);

            if (!string.IsNullOrEmpty(confirmationLink))
            {
                await _emailService.SendEmailConfirmationAsync(user.Email, confirmationLink);
            }

            bool emailReq = await _adminSettingsService.GetSettingBoolAsync("EmailVerificationRequired", false);
            if (emailReq)
            {
                return RedirectToAction("VerifyEmailSent", new { email = user.Email });
            }

            await _signInManager.SignInAsync(user, isPersistent: true);
            if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            {
                return Redirect(returnUrl);
            }
            return RedirectToAction("Index", "Home");
        }

        foreach (var error in result.Errors)
        {
            ModelState.AddModelError(string.Empty, error.Description);
        }
        return View(model);
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult VerifyEmailSent(string email)
    {
        ViewBag.Email = email;
        return View();
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyEmail(string userId, string code)
    {
        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(code))
        {
            return View(new VerifyEmailViewModel { IsSuccess = false, Message = "Invalid email confirmation link." });
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
        {
            return View(new VerifyEmailViewModel { IsSuccess = false, Message = "User account not found." });
        }

        var result = await _userManager.ConfirmEmailAsync(user, code);
        if (result.Succeeded)
        {
            return View(new VerifyEmailViewModel { IsSuccess = true, Message = "Your email has been confirmed successfully! You can now access all features." });
        }

        return View(new VerifyEmailViewModel { IsSuccess = false, Message = "Error confirming your email. The token may have expired." });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return RedirectToAction("Index", "Home");
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult ForgotPassword()
    {
        return View();
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordViewModel model)
    {
        if (!ModelState.IsValid) return View(model);

        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user != null && user.IsActive)
        {
            var code = await _userManager.GeneratePasswordResetTokenAsync(user);
            var callbackUrl = Url.Action("ResetPassword", "Account", new { code, email = user.Email }, Request.Scheme);
            if (!string.IsNullOrEmpty(callbackUrl) && !string.IsNullOrEmpty(user.Email))
            {
                await _emailService.SendPasswordResetAsync(user.Email, callbackUrl);
            }
        }

        ViewBag.Message = "If an account matches that email, a password reset link has been dispatched to your inbox.";
        return View("ForgotPasswordConfirmation");
    }

    [HttpGet]
    [AllowAnonymous]
    public IActionResult ResetPassword(string? code = null, string? email = null)
    {
        if (string.IsNullOrEmpty(code))
        {
            return BadRequest("A reset code must be supplied.");
        }
        return View(new ResetPasswordViewModel { Code = code, Email = email ?? "" });
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResetPassword(ResetPasswordViewModel model)
    {
        if (!ModelState.IsValid) return View(model);

        var user = await _userManager.FindByEmailAsync(model.Email);
        if (user == null)
        {
            return RedirectToAction("Login");
        }

        var result = await _userManager.ResetPasswordAsync(user, model.Code, model.Password);
        if (result.Succeeded)
        {
            ViewBag.SuccessMessage = "Your password has been successfully reset! You may now sign in.";
            return View("ResetPasswordConfirmation");
        }

        foreach (var error in result.Errors)
        {
            ModelState.AddModelError(string.Empty, error.Description);
        }
        return View(model);
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public IActionResult ExternalLogin(string provider, string? returnUrl = null)
    {
        var redirectUrl = Url.Action("ExternalLoginCallback", "Account", new { returnUrl });
        var properties = _signInManager.ConfigureExternalAuthenticationProperties(provider, redirectUrl);
        return new ChallengeResult(provider, properties);
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> ExternalLoginCallback(string? returnUrl = null, string? remoteError = null)
    {
        if (remoteError != null)
        {
            ModelState.AddModelError(string.Empty, $"Error from external provider: {remoteError}");
            return View("Login");
        }

        var info = await _signInManager.GetExternalLoginInfoAsync();
        if (info == null)
        {
            return RedirectToAction("Login");
        }

        var signInResult = await _signInManager.ExternalLoginSignInAsync(info.LoginProvider, info.ProviderKey, isPersistent: true, bypassTwoFactor: true);
        if (signInResult.Succeeded)
        {
            var existingUser = await _userManager.FindByLoginAsync(info.LoginProvider, info.ProviderKey);
            if (existingUser != null)
            {
                existingUser.LastLoginAt = DateTime.UtcNow;
                await _userManager.UpdateAsync(existingUser);
            }

            if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl)) return Redirect(returnUrl);
            return RedirectToAction("Index", "Home");
        }

        var email = info.Principal.FindFirstValue(ClaimTypes.Email);
        var name = info.Principal.FindFirstValue(ClaimTypes.Name) ?? email?.Split('@')[0] ?? "Stream Helper User";

        if (!string.IsNullOrEmpty(email))
        {
            var user = await _userManager.FindByEmailAsync(email);
            if (user != null)
            {
                var addLoginResult = await _userManager.AddLoginAsync(user, info);
                if (addLoginResult.Succeeded)
                {
                    await _signInManager.SignInAsync(user, isPersistent: true);
                    if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl)) return Redirect(returnUrl);
                    return RedirectToAction("Index", "Home");
                }
            }
            else
            {
                bool regEnabled = await _adminSettingsService.GetSettingBoolAsync("RegistrationEnabled", true);
                if (!regEnabled)
                {
                    ModelState.AddModelError(string.Empty, "New registrations are disabled.");
                    return View("Login");
                }

                var newUser = new AppUser
                {
                    UserName = email,
                    Email = email,
                    FullName = name,
                    EmailConfirmed = true,
                    CreatedAt = DateTime.UtcNow,
                    LastLoginAt = DateTime.UtcNow,
                    IsActive = true
                };

                var createResult = await _userManager.CreateAsync(newUser);
                if (createResult.Succeeded)
                {
                    await _userManager.AddToRoleAsync(newUser, "User");
                    await _userManager.AddLoginAsync(newUser, info);
                    await _signInManager.SignInAsync(newUser, isPersistent: true);
                    if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl)) return Redirect(returnUrl);
                    return RedirectToAction("Index", "Home");
                }
            }
        }

        ModelState.AddModelError(string.Empty, "Unable to sign in with Google.");
        return View("Login");
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> Profile()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();

        var (downloads, totalCount) = await _downloadHistoryService.GetUserDownloadsAsync(user.Id, 1, 1000, null, null, null);
        var completedCount = downloads.Count(d => d.Status == DownloadStatus.Completed);
        var totalBytes = downloads.Where(d => d.Status == DownloadStatus.Completed).Sum(d => d.DownloadedBytes);

        var model = new ProfileViewModel
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email ?? "",
            EmailConfirmed = user.EmailConfirmed,
            CreatedAt = user.CreatedAt,
            LastLoginAt = user.LastLoginAt,
            TotalDownloads = totalCount,
            CompletedDownloads = completedCount,
            TotalDownloadedBytes = totalBytes
        };

        return View(model);
    }

    [HttpPost]
    [Authorize]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateProfile(string fullName)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(fullName))
        {
            user.FullName = fullName.Trim();
            await _userManager.UpdateAsync(user);
            TempData["SuccessMessage"] = "Profile updated successfully!";
        }

        return RedirectToAction("Profile");
    }

    [HttpGet]
    [Authorize]
    public IActionResult Settings()
    {
        return View(new ChangePasswordViewModel());
    }

    [HttpPost]
    [Authorize]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ChangePassword(ChangePasswordViewModel model)
    {
        if (!ModelState.IsValid) return View("Settings", model);

        var user = await _userManager.GetUserAsync(User);
        if (user == null) return NotFound();

        var result = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);
        if (result.Succeeded)
        {
            await _signInManager.RefreshSignInAsync(user);
            TempData["SuccessMessage"] = "Password changed successfully!";
            return RedirectToAction("Settings");
        }

        foreach (var error in result.Errors)
        {
            ModelState.AddModelError(string.Empty, error.Description);
        }
        return View("Settings", model);
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Downloads(string? search, string? status, string? platform, int page = 1)
    {
        var user = await _userManager.GetUserAsync(User);
        int pageSize = 15;
        List<StreamHelper.Data.DownloadHistory> rawItems = new();

        try
        {
            await _downloadHistoryService.ReconcileOrphanedDownloadsAsync(SaveZonix.Program.GetActiveTaskIds());
        }
        catch { }

        if (user != null)
        {
            var res = await _downloadHistoryService.GetUserDownloadsAsync(user.Id, 1, 500, search, status, platform);
            rawItems = res.Items;
        }
        else
        {
            var res = await _downloadHistoryService.GetAllDownloadsAsync(1, 500, search, status, platform, null);
            rawItems = res.Items;
        }

        var activeJobs = _queueManager.GetActiveJobs();
        var allGrouped = GroupDownloads(rawItems, activeJobs);
        int totalGroups = allGrouped.Count;
        var pagedGroups = allGrouped.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        var model = new UserDownloadsViewModel
        {
            Downloads = rawItems,
            GroupedEntries = pagedGroups,
            SearchTerm = search,
            StatusFilter = status,
            PlatformFilter = platform,
            CurrentPage = page,
            TotalCount = totalGroups,
            TotalPages = Math.Max(1, (int)Math.Ceiling(totalGroups / (double)pageSize)),
            PageSize = pageSize
        };

        return View(model);
    }

    private static List<HistoryItemEntry> GroupDownloads(List<StreamHelper.Data.DownloadHistory> allDownloads, List<SaveZonix.Models.PlaylistBatchJobState>? activeJobs = null)
    {
        var finalEntries = new List<HistoryItemEntry>();
        var playlistBuckets = new Dictionary<string, HistoryItemEntry>(StringComparer.OrdinalIgnoreCase);

        foreach (var d in allDownloads)
        {
            string strategy = d.DownloadStrategy ?? "";
            bool isPlaylist = strategy.StartsWith("Playlist:", StringComparison.OrdinalIgnoreCase) ||
                              strategy.Equals("Playlist Batch", StringComparison.OrdinalIgnoreCase);

            if (isPlaylist)
            {
                string groupKey;
                string playlistCode;
                string playlistTitle;

                if (strategy.StartsWith("Playlist: PL-", StringComparison.OrdinalIgnoreCase))
                {
                    var parts = strategy.Substring("Playlist:".Length).Split('•');
                    playlistCode = parts[0].Trim();
                    playlistTitle = parts.Length > 1 ? parts[1].Trim() : "YouTube Playlist";
                    groupKey = playlistCode;
                }
                else
                {
                    // Smart legacy grouping: extract common series name if available, or group by day
                    string seriesName = ExtractSeriesName(d.Title);
                    string dateKey = d.CreatedAt.ToString("yyyyMMdd");
                    groupKey = !string.IsNullOrEmpty(seriesName) ? $"PL_SERIES_{dateKey}_{seriesName}" : $"PL_BATCH_{dateKey}";
                    playlistCode = "PL-01";
                    playlistTitle = !string.IsNullOrEmpty(seriesName) ? seriesName : "YouTube Playlist Collection";
                }

                if (!playlistBuckets.TryGetValue(groupKey, out var group))
                {
                    string? matchingJobId = activeJobs?.FirstOrDefault(j =>
                        string.Equals(j.PlaylistCode, playlistCode, StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(j.PlaylistTitle, playlistTitle, StringComparison.OrdinalIgnoreCase))?.JobId;

                    group = new HistoryItemEntry
                    {
                        IsPlaylistGroup = true,
                        GroupKey = groupKey,
                        JobId = matchingJobId ?? groupKey,
                        PlaylistCode = playlistCode,
                        Title = playlistTitle,
                        Platform = d.Platform,
                        ThumbnailUrl = d.ThumbnailUrl,
                        CreatedAt = d.CreatedAt,
                        TotalBytes = 0,
                        TotalVideos = 0,
                        CompletedCount = 0,
                        FailedCount = 0,
                        SubItems = new List<StreamHelper.Data.DownloadHistory>()
                    };
                    playlistBuckets[groupKey] = group;
                }

                group.SubItems.Add(d);
                group.TotalVideos++;
                group.TotalBytes += d.FileSize > 0 ? d.FileSize : d.DownloadedBytes;
                if (d.Status == StreamHelper.Data.DownloadStatus.Completed) group.CompletedCount++;
                if (d.Status == StreamHelper.Data.DownloadStatus.Failed || d.Status == StreamHelper.Data.DownloadStatus.Cancelled) group.FailedCount++;
                if (string.IsNullOrEmpty(group.ThumbnailUrl) && !string.IsNullOrEmpty(d.ThumbnailUrl))
                {
                    group.ThumbnailUrl = d.ThumbnailUrl;
                }
            }
            else
            {
                finalEntries.Add(new HistoryItemEntry
                {
                    IsPlaylistGroup = false,
                    GroupKey = d.Id,
                    Title = d.Title,
                    Platform = d.Platform,
                    ThumbnailUrl = d.ThumbnailUrl,
                    CreatedAt = d.CreatedAt,
                    TotalBytes = d.FileSize > 0 ? d.FileSize : d.DownloadedBytes,
                    TotalVideos = 1,
                    CompletedCount = d.Status == StreamHelper.Data.DownloadStatus.Completed ? 1 : 0,
                    FailedCount = d.Status == StreamHelper.Data.DownloadStatus.Failed || d.Status == StreamHelper.Data.DownloadStatus.Cancelled ? 1 : 0,
                    SingleItem = d
                });
            }
        }

        // Process playlist buckets:
        // If a bucket has only 1 video, unpack it into a regular single-video row
        // so it shows the actual video title and thumbnail instead of a confusing "Collection 1 Videos" accordion!
        foreach (var group in playlistBuckets.Values)
        {
            if (group.TotalVideos <= 1 && group.SubItems.Count == 1)
            {
                var single = group.SubItems[0];
                finalEntries.Add(new HistoryItemEntry
                {
                    IsPlaylistGroup = false,
                    GroupKey = single.Id,
                    Title = single.Title,
                    Platform = single.Platform,
                    ThumbnailUrl = single.ThumbnailUrl,
                    CreatedAt = single.CreatedAt,
                    TotalBytes = single.FileSize > 0 ? single.FileSize : single.DownloadedBytes,
                    TotalVideos = 1,
                    CompletedCount = single.Status == StreamHelper.Data.DownloadStatus.Completed ? 1 : 0,
                    FailedCount = single.Status == StreamHelper.Data.DownloadStatus.Failed || single.Status == StreamHelper.Data.DownloadStatus.Cancelled ? 1 : 0,
                    SingleItem = single
                });
            }
            else
            {
                // Sort sub-items in natural ascending order (#01, #02, #03... or Episode 1, 2, 3...)
                group.SubItems = group.SubItems
                    .OrderBy(s => ExtractIndexNumber(s))
                    .ThenBy(s => s.CreatedAt)
                    .ToList();
                finalEntries.Add(group);
            }
        }

        return finalEntries.OrderByDescending(g => g.CreatedAt).ToList();
    }

    private static int ExtractIndexNumber(StreamHelper.Data.DownloadHistory item)
    {
        // 1. Check ValidationDetails or AudioVideoDetails for "#01", "#02"
        string check = (item.ValidationDetails ?? "") + " " + (item.AudioVideoDetails ?? "");
        int hashIdx = check.IndexOf('#');
        if (hashIdx >= 0 && hashIdx + 3 <= check.Length)
        {
            string numPart = new string(check.Substring(hashIdx + 1).TakeWhile(char.IsDigit).ToArray());
            if (int.TryParse(numPart, out int parsed)) return parsed;
        }

        // 2. Check title for "Episode XX" or "Ep XX"
        if (!string.IsNullOrEmpty(item.Title))
        {
            var match = System.Text.RegularExpressions.Regex.Match(item.Title, @"(?:Episode|Ep)\s*(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (match.Success && int.TryParse(match.Groups[1].Value, out int epNum))
            {
                return epNum;
            }
        }

        // 3. Check filename prefix "01 - ", "02 - "
        if (!string.IsNullOrEmpty(item.FileName))
        {
            var match = System.Text.RegularExpressions.Regex.Match(item.FileName, @"^(\d{1,4})\s*-\s*");
            if (match.Success && int.TryParse(match.Groups[1].Value, out int fnNum))
            {
                return fnNum;
            }
        }

        return int.MaxValue;
    }

    private static string ExtractSeriesName(string? title)
    {
        if (string.IsNullOrWhiteSpace(title)) return "";
        int epIdx = title.IndexOf("Episode", StringComparison.OrdinalIgnoreCase);
        if (epIdx > 2) return title.Substring(0, epIdx).Trim(' ', '-', '|', ':', '_');

        int epShortIdx = title.IndexOf("Ep ", StringComparison.OrdinalIgnoreCase);
        if (epShortIdx > 2) return title.Substring(0, epShortIdx).Trim(' ', '-', '|', ':', '_');

        int pipeIdx = title.IndexOf('|');
        if (pipeIdx > 2) return title.Substring(0, pipeIdx).Trim(' ', '-', '|', ':', '_');

        return "";
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CancelDownload(string id)
    {
        var user = await _userManager.GetUserAsync(User);
        string? currentUserId = user?.Id;

        var download = await _downloadHistoryService.GetDownloadByIdAsync(id);
        if (download != null && (currentUserId == null || download.UserId == currentUserId || string.IsNullOrEmpty(download.UserId)))
        {
            SaveZonix.Program.CancelTask(id);
            _queueManager.CancelPlaylistItemByTaskId(id);
            await _downloadHistoryService.MarkCancelledAsync(id);
            TempData["SuccessMessage"] = "Download cancelled.";
        }
        return RedirectToAction("Downloads");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteDownload(string id)
    {
        var user = await _userManager.GetUserAsync(User);
        string? currentUserId = user?.Id;

        bool success = await _downloadHistoryService.DeleteDownloadAsync(id, currentUserId);
        if (success)
        {
            TempData["SuccessMessage"] = "Download record removed from history.";
        }
        return RedirectToAction("Downloads");
    }
}
