using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;
using SaveZonix.Models;
using SaveZonix.Services;
using StreamHelper.Data;
using StreamHelper.Services;
using StreamHelper.ViewModels;

namespace StreamHelper.Controllers;

public class AccountController : Controller
{
    private readonly IMongoCollection<BsonDocument>? _usersCollection;
    private readonly IEmailService _emailService;
    private readonly IDownloadHistoryService _downloadHistoryService;
    private readonly IAdminSettingsService _adminSettingsService;
    private readonly IDownloadAnalyticsService _analyticsService;
    private readonly IPlaylistQueueManager _queueManager;

    public AccountController(
        IMongoDatabase? mongoDb,
        IEmailService emailService,
        IDownloadHistoryService downloadHistoryService,
        IAdminSettingsService adminSettingsService,
        IDownloadAnalyticsService analyticsService,
        IPlaylistQueueManager queueManager)
    {
        _usersCollection = mongoDb?.GetCollection<BsonDocument>("users");
        _emailService = emailService;
        _downloadHistoryService = downloadHistoryService;
        _adminSettingsService = adminSettingsService;
        _analyticsService = analyticsService;
        _queueManager = queueManager;
    }

    private static bool VerifyUserPassword(string password, string storedHash)
    {
        if (string.IsNullOrEmpty(storedHash)) return false;

        if (storedHash.StartsWith("$2a$") || storedHash.StartsWith("$2b$") || storedHash.StartsWith("$2y$"))
        {
            try
            {
                return BCrypt.Net.BCrypt.Verify(password, storedHash);
            }
            catch
            {
                return false;
            }
        }

        // Fallback SHA-256
        try
        {
            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password + "SaveZonix_Salt_2026"));
            var hash = Convert.ToBase64String(bytes);
            if (hash == storedHash) return true;
        }
        catch { }

        return password == storedHash;
    }

    private async Task<BsonDocument?> FindUserByEmailAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || _usersCollection == null) return null;
        var normalized = email.Trim().ToLowerInvariant();
        var filter = Builders<BsonDocument>.Filter.Or(
            Builders<BsonDocument>.Filter.Eq("email", normalized),
            Builders<BsonDocument>.Filter.Eq("Email", normalized)
        );
        return await _usersCollection.Find(filter).FirstOrDefaultAsync();
    }

    private async Task<BsonDocument?> FindUserByIdAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id) || _usersCollection == null) return null;
        var fb = Builders<BsonDocument>.Filter;
        FilterDefinition<BsonDocument> filter;
        if (ObjectId.TryParse(id, out var oid))
        {
            filter = fb.Or(fb.Eq("_id", oid), fb.Eq("_id", id), fb.Eq("id", id), fb.Eq("Id", id));
        }
        else
        {
            filter = fb.Or(fb.Eq("_id", id), fb.Eq("id", id), fb.Eq("Id", id));
        }
        return await _usersCollection.Find(filter).FirstOrDefaultAsync();
    }

    private async Task SignInUserAsync(BsonDocument userDoc, bool isPersistent)
    {
        string id = userDoc.Contains("_id") ? userDoc["_id"].ToString() ?? Guid.NewGuid().ToString("N") : Guid.NewGuid().ToString("N");
        string fullName = userDoc.Contains("FullName") && !userDoc["FullName"].IsBsonNull ? userDoc["FullName"].AsString :
                         (userDoc.Contains("name") && !userDoc["name"].IsBsonNull ? userDoc["name"].AsString : "User");
        string email = userDoc.Contains("email") && !userDoc["email"].IsBsonNull ? userDoc["email"].AsString :
                      (userDoc.Contains("Email") && !userDoc["Email"].IsBsonNull ? userDoc["Email"].AsString : "");
        string role = userDoc.Contains("role") && !userDoc["role"].IsBsonNull ? userDoc["role"].AsString :
                     (userDoc.Contains("Role") && !userDoc["Role"].IsBsonNull ? userDoc["Role"].AsString : "User");
        bool isAdmin = string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(email, "zaidm1323@gmail.com", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(email, "trendykart.app@gmail.com", StringComparison.OrdinalIgnoreCase);
        if (isAdmin) role = "Admin";

        bool isVip = isAdmin;
        if (!isVip)
        {
            bool hasVipFlag = (userDoc.Contains("isVip") && !userDoc["isVip"].IsBsonNull && userDoc["isVip"].ToBoolean()) ||
                              (userDoc.Contains("IsVip") && !userDoc["IsVip"].IsBsonNull && userDoc["IsVip"].ToBoolean());
            if (hasVipFlag)
            {
                if (userDoc.Contains("vipExpiresAt") && !userDoc["vipExpiresAt"].IsBsonNull)
                {
                    isVip = userDoc["vipExpiresAt"].ToUniversalTime() >= DateTime.UtcNow;
                }
                else if (userDoc.Contains("VipExpiresAt") && !userDoc["VipExpiresAt"].IsBsonNull)
                {
                    isVip = userDoc["VipExpiresAt"].ToUniversalTime() >= DateTime.UtcNow;
                }
                else
                {
                    isVip = true; // Lifetime VIP
                }
            }
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, id),
            new(ClaimTypes.Name, fullName),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Role, role),
            new("isVip", isVip ? "true" : "false")
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);
        var authProps = new AuthenticationProperties
        {
            IsPersistent = isPersistent,
            ExpiresUtc = isPersistent ? DateTimeOffset.UtcNow.AddDays(30) : null
        };

        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, authProps);
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

        var user = await FindUserByEmailAsync(model.Email);
        if (user == null)
        {
            ModelState.AddModelError(string.Empty, "Invalid email or password.");
            return View(model);
        }

        bool isActive = user.Contains("isActive") && !user["isActive"].IsBsonNull ? user["isActive"].ToBoolean() :
                       (user.Contains("IsActive") && !user["IsActive"].IsBsonNull ? user["IsActive"].ToBoolean() : true);
        if (!isActive)
        {
            ModelState.AddModelError(string.Empty, "Your account has been deactivated. Please contact support.");
            return View(model);
        }

        bool emailReq = await _adminSettingsService.GetSettingBoolAsync("EmailVerificationRequired", false);
        bool emailConfirmed = user.Contains("emailConfirmed") && !user["emailConfirmed"].IsBsonNull ? user["emailConfirmed"].ToBoolean() : true;
        if (emailReq && !emailConfirmed)
        {
            ModelState.AddModelError(string.Empty, "Please verify your email address before logging in. Check your inbox for the verification link.");
            return View(model);
        }

        string storedHash = user.Contains("password") && !user["password"].IsBsonNull ? user["password"].AsString :
                           (user.Contains("PasswordHash") && !user["PasswordHash"].IsBsonNull ? user["PasswordHash"].AsString : "");

        if (!VerifyUserPassword(model.Password, storedHash))
        {
            ModelState.AddModelError(string.Empty, "Invalid email or password.");
            return View(model);
        }

        // Update last login in MongoDB
        if (_usersCollection != null)
        {
            try
            {
                var update = Builders<BsonDocument>.Update.Set("lastLoginAt", DateTime.UtcNow);
                await _usersCollection.UpdateOneAsync(Builders<BsonDocument>.Filter.Eq("_id", user["_id"]), update);
            }
            catch { }
        }

        await SignInUserAsync(user, model.RememberMe);

        if (!string.IsNullOrEmpty(model.ReturnUrl) && Url.IsLocalUrl(model.ReturnUrl))
        {
            return Redirect(model.ReturnUrl);
        }
        return RedirectToAction("Index", "Home");
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

        var existingUser = await FindUserByEmailAsync(model.Email);
        if (existingUser != null)
        {
            ModelState.AddModelError("Email", "An account with this email address already exists.");
            return View(model);
        }

        string passwordHash = BCrypt.Net.BCrypt.HashPassword(model.Password);
        string normalizedEmail = model.Email.Trim().ToLowerInvariant();
        string name = model.FullName.Trim();

        var newUserDoc = new BsonDocument
        {
            { "name", name },
            { "FullName", name },
            { "email", normalizedEmail },
            { "Email", normalizedEmail },
            { "password", passwordHash },
            { "PasswordHash", passwordHash },
            { "role", "User" },
            { "Role", "User" },
            { "isVip", false },
            { "isActive", true },
            { "IsActive", true },
            { "emailConfirmed", true },
            { "createdAt", DateTime.UtcNow },
            { "updatedAt", DateTime.UtcNow }
        };

        if (_usersCollection != null)
        {
            await _usersCollection.InsertOneAsync(newUserDoc);
        }

        await _analyticsService.CreateOrUpdateUserAsync(new SaveZonixUser
        {
            Email = normalizedEmail,
            FullName = name,
            Role = "User",
            AuthProvider = "Local",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });

        bool emailReq = await _adminSettingsService.GetSettingBoolAsync("EmailVerificationRequired", false);
        if (emailReq)
        {
            string confirmationLink = Url.Action("VerifyEmail", "Account", new { email = normalizedEmail }, Request.Scheme) ?? "";
            if (!string.IsNullOrEmpty(confirmationLink))
            {
                await _emailService.SendEmailConfirmationAsync(normalizedEmail, confirmationLink);
            }
            return RedirectToAction("VerifyEmailSent", new { email = normalizedEmail });
        }

        await SignInUserAsync(newUserDoc, isPersistent: true);

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
        {
            return Redirect(returnUrl);
        }
        return RedirectToAction("Index", "Home");
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
    public async Task<IActionResult> VerifyEmail(string email)
    {
        if (string.IsNullOrEmpty(email))
        {
            return View(new VerifyEmailViewModel { IsSuccess = false, Message = "Invalid email confirmation link." });
        }

        var user = await FindUserByEmailAsync(email);
        if (user == null)
        {
            return View(new VerifyEmailViewModel { IsSuccess = false, Message = "User account not found." });
        }

        if (_usersCollection != null)
        {
            var update = Builders<BsonDocument>.Update.Set("emailConfirmed", true);
            await _usersCollection.UpdateOneAsync(Builders<BsonDocument>.Filter.Eq("_id", user["_id"]), update);
        }

        return View(new VerifyEmailViewModel { IsSuccess = true, Message = "Your email has been confirmed successfully! You can now access all features." });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
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

        var user = await FindUserByEmailAsync(model.Email);
        if (user != null)
        {
            string token = Guid.NewGuid().ToString("N");
            var callbackUrl = Url.Action("ResetPassword", "Account", new { code = token, email = model.Email }, Request.Scheme);
            if (!string.IsNullOrEmpty(callbackUrl))
            {
                await _emailService.SendPasswordResetAsync(model.Email, callbackUrl);
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

        var user = await FindUserByEmailAsync(model.Email);
        if (user == null)
        {
            return RedirectToAction("Login");
        }

        string newHash = BCrypt.Net.BCrypt.HashPassword(model.Password);
        if (_usersCollection != null)
        {
            var update = Builders<BsonDocument>.Update
                .Set("password", newHash)
                .Set("PasswordHash", newHash)
                .Set("updatedAt", DateTime.UtcNow);
            await _usersCollection.UpdateOneAsync(Builders<BsonDocument>.Filter.Eq("_id", user["_id"]), update);
        }

        ViewBag.SuccessMessage = "Your password has been successfully reset! You may now sign in.";
        return View("ResetPasswordConfirmation");
    }

    [HttpPost]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public IActionResult ExternalLogin(string provider, string? returnUrl = null)
    {
        var redirectUrl = Url.Action("ExternalLoginCallback", "Account", new { returnUrl });
        var properties = new AuthenticationProperties { RedirectUri = redirectUrl };
        return Challenge(properties, provider);
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> ExternalLoginCallback(string? returnUrl = null, string? remoteError = null)
    {
        if (remoteError != null)
        {
            TempData["ErrorMessage"] = $"Google Sign-In Error: {remoteError}";
            return RedirectToAction("Login", new { returnUrl });
        }

        var authResult = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        var email = authResult.Principal?.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Email);
        var name = authResult.Principal?.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.Name) ?? email?.Split('@')[0] ?? "User";

        if (!string.IsNullOrEmpty(email))
        {
            var user = await FindUserByEmailAsync(email);
            if (user != null)
            {
                await SignInUserAsync(user, isPersistent: true);
                if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl)) return Redirect(returnUrl);
                return RedirectToAction("Index", "Home");
            }
            else
            {
                bool regEnabled = await _adminSettingsService.GetSettingBoolAsync("RegistrationEnabled", true);
                if (!regEnabled)
                {
                    ModelState.AddModelError(string.Empty, "New registrations are disabled.");
                    return View("Login");
                }

                var newUser = new BsonDocument
                {
                    { "name", name },
                    { "FullName", name },
                    { "email", email.ToLowerInvariant() },
                    { "Email", email.ToLowerInvariant() },
                    { "role", "User" },
                    { "Role", "User" },
                    { "isVip", false },
                    { "isActive", true },
                    { "IsActive", true },
                    { "emailConfirmed", true },
                    { "authProvider", "Google" },
                    { "createdAt", DateTime.UtcNow },
                    { "updatedAt", DateTime.UtcNow }
                };

                if (_usersCollection != null)
                {
                    await _usersCollection.InsertOneAsync(newUser);
                }

                await SignInUserAsync(newUser, isPersistent: true);
                if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl)) return Redirect(returnUrl);
                return RedirectToAction("Index", "Home");
            }
        }

        ModelState.AddModelError(string.Empty, "Unable to sign in with Google.");
        return View("Login");
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> Profile()
    {
        string? email = User.FindFirstValue(ClaimTypes.Email);
        string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        BsonDocument? user = null;
        if (!string.IsNullOrEmpty(email)) user = await FindUserByEmailAsync(email);
        if (user == null && !string.IsNullOrEmpty(userId)) user = await FindUserByIdAsync(userId);

        string effectiveId = userId ?? (user?.Contains("_id") == true ? user["_id"].ToString() ?? "" : "");
        string effectiveName = user != null && user.Contains("FullName") && !user["FullName"].IsBsonNull ? user["FullName"].AsString :
                              (User.Identity?.Name ?? "User");
        string effectiveEmail = email ?? (user != null && user.Contains("email") && !user["email"].IsBsonNull ? user["email"].AsString : "");

        var (downloads, totalCount) = await _downloadHistoryService.GetUserDownloadsAsync(effectiveId, 1, 1000, null, null, null);
        var completedCount = downloads.Count(d => d.Status == DownloadStatus.Completed);
        var totalBytes = downloads.Where(d => d.Status == DownloadStatus.Completed).Sum(d => d.DownloadedBytes);

        // Role & VIP determination
        string role = user != null && user.Contains("role") && !user["role"].IsBsonNull ? user["role"].AsString :
                     (user != null && user.Contains("Role") && !user["Role"].IsBsonNull ? user["Role"].AsString : "User");
        bool isAdmin = string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(effectiveEmail, "zaidm1323@gmail.com", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(effectiveEmail, "trendykart.app@gmail.com", StringComparison.OrdinalIgnoreCase);
        if (isAdmin) role = "Admin";

        bool isVip = isAdmin;
        DateTime? vipExpiresAt = null;
        string? vipPlan = null;

        if (user != null)
        {
            if (user.Contains("vipPlan") && !user["vipPlan"].IsBsonNull) vipPlan = user["vipPlan"].AsString;
            else if (user.Contains("VipPlan") && !user["VipPlan"].IsBsonNull) vipPlan = user["VipPlan"].AsString;

            if (user.Contains("vipExpiresAt") && !user["vipExpiresAt"].IsBsonNull)
            {
                try { vipExpiresAt = user["vipExpiresAt"].ToUniversalTime(); } catch { }
            }
            else if (user.Contains("VipExpiresAt") && !user["VipExpiresAt"].IsBsonNull)
            {
                try { vipExpiresAt = user["VipExpiresAt"].ToUniversalTime(); } catch { }
            }

            if (!isVip)
            {
                bool hasVipFlag = (user.Contains("isVip") && !user["isVip"].IsBsonNull && user.GetValue("isVip").ToBoolean()) ||
                                  (user.Contains("IsVip") && !user["IsVip"].IsBsonNull && user.GetValue("IsVip").ToBoolean());
                if (hasVipFlag)
                {
                    isVip = vipExpiresAt == null || vipExpiresAt >= DateTime.UtcNow;
                }
            }
        }

        if (!isVip && User.Claims.Any(c => c.Type == "isVip" && c.Value == "true"))
        {
            isVip = true;
        }

        DateTime? lastLoginAt = null;
        if (user != null && user.Contains("lastLoginAt") && !user["lastLoginAt"].IsBsonNull)
        {
            try { lastLoginAt = user["lastLoginAt"].ToUniversalTime(); } catch { }
        }

        bool emailConfirmed = true;
        if (user != null && user.Contains("emailConfirmed") && !user["emailConfirmed"].IsBsonNull)
        {
            try { emailConfirmed = user["emailConfirmed"].ToBoolean(); } catch { }
        }

        var model = new ProfileViewModel
        {
            Id = effectiveId,
            FullName = effectiveName,
            Email = effectiveEmail,
            EmailConfirmed = emailConfirmed,
            CreatedAt = user != null && user.Contains("createdAt") && !user["createdAt"].IsBsonNull ? user["createdAt"].ToUniversalTime() : DateTime.UtcNow,
            LastLoginAt = lastLoginAt,
            TotalDownloads = totalCount,
            CompletedDownloads = completedCount,
            TotalDownloadedBytes = totalBytes,
            Role = role,
            IsVip = isVip,
            VipPlan = vipPlan,
            VipExpiresAt = vipExpiresAt
        };

        return View(model);
    }

    [HttpPost]
    [Authorize]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateProfile(string fullName)
    {
        string? email = User.FindFirstValue(ClaimTypes.Email);
        if (!string.IsNullOrWhiteSpace(fullName) && !string.IsNullOrEmpty(email) && _usersCollection != null)
        {
            string cleanName = fullName.Trim();
            var update = Builders<BsonDocument>.Update
                .Set("name", cleanName)
                .Set("FullName", cleanName)
                .Set("updatedAt", DateTime.UtcNow);

            await _usersCollection.UpdateOneAsync(
                Builders<BsonDocument>.Filter.Or(
                    Builders<BsonDocument>.Filter.Eq("email", email.ToLowerInvariant()),
                    Builders<BsonDocument>.Filter.Eq("Email", email.ToLowerInvariant())
                ),
                update
            );

            var user = await FindUserByEmailAsync(email);
            if (user != null)
            {
                await SignInUserAsync(user, isPersistent: true);
            }

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

        string? email = User.FindFirstValue(ClaimTypes.Email);
        var user = !string.IsNullOrEmpty(email) ? await FindUserByEmailAsync(email) : null;
        if (user == null) return NotFound();

        string storedHash = user.Contains("password") && !user["password"].IsBsonNull ? user["password"].AsString :
                           (user.Contains("PasswordHash") && !user["PasswordHash"].IsBsonNull ? user["PasswordHash"].AsString : "");

        if (!VerifyUserPassword(model.CurrentPassword, storedHash))
        {
            ModelState.AddModelError("CurrentPassword", "Incorrect current password.");
            return View("Settings", model);
        }

        string newHash = BCrypt.Net.BCrypt.HashPassword(model.NewPassword);
        if (_usersCollection != null)
        {
            var update = Builders<BsonDocument>.Update
                .Set("password", newHash)
                .Set("PasswordHash", newHash)
                .Set("updatedAt", DateTime.UtcNow);
            await _usersCollection.UpdateOneAsync(Builders<BsonDocument>.Filter.Eq("_id", user["_id"]), update);
        }

        TempData["SuccessMessage"] = "Password changed successfully!";
        return RedirectToAction("Settings");
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Downloads(string? search, string? status, string? platform, int page = 1)
    {
        string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        string? userEmail = User.FindFirstValue(ClaimTypes.Email);

        int pageSize = 15;
        List<StreamHelper.Data.DownloadHistory> rawItems = new();

        var activeJobs = _queueManager.GetActiveJobs();
        try
        {
            var activeTaskIds = SaveZonix.Program.GetActiveTaskIds();
            if (activeJobs != null)
            {
                foreach (var job in activeJobs)
                {
                    if (job.Items != null)
                    {
                        foreach (var it in job.Items)
                        {
                            if (!string.IsNullOrEmpty(it.TaskId))
                            {
                                activeTaskIds.Add(it.TaskId);
                            }
                        }
                    }
                }
            }
            await _downloadHistoryService.ReconcileOrphanedDownloadsAsync(activeTaskIds);
        }
        catch { }

        if (!string.IsNullOrEmpty(userId))
        {
            var res = await _downloadHistoryService.GetUserDownloadsAsync(userId, 1, 500, search, status, platform);
            rawItems = res.Items;
        }
        else
        {
            var res = await _downloadHistoryService.GetAllDownloadsAsync(1, 500, search, status, platform, null);
            rawItems = res.Items;
        }

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
            if (string.IsNullOrWhiteSpace(d.ThumbnailUrl) && !string.IsNullOrWhiteSpace(d.OriginalUrl))
            {
                string? ytId = ExtractYouTubeVideoId(d.OriginalUrl);
                if (!string.IsNullOrWhiteSpace(ytId))
                {
                    d.ThumbnailUrl = $"https://i.ytimg.com/vi/{ytId}/hqdefault.jpg";
                }
            }

            string strategy = d.DownloadStrategy ?? "";
            bool isExplicitPlaylist = strategy.StartsWith("Playlist:", StringComparison.OrdinalIgnoreCase) ||
                                      strategy.Equals("Playlist Batch", StringComparison.OrdinalIgnoreCase);

            string seriesName = ExtractSeriesName(d.Title);
            bool isSeriesCandidate = !string.IsNullOrEmpty(seriesName) && seriesName.Length > 2;

            if (isExplicitPlaylist || isSeriesCandidate)
            {
                string groupKey;
                string playlistCode;
                string playlistTitle;

                if (strategy.StartsWith("Playlist: PL-", StringComparison.OrdinalIgnoreCase))
                {
                    var parts = strategy.Substring("Playlist:".Length).Split('•');
                    playlistCode = parts[0].Trim();
                    playlistTitle = parts.Length > 1 ? parts[1].Trim() : (!string.IsNullOrEmpty(seriesName) ? seriesName : "YouTube Playlist");
                    string cleanTitleSlug = Regex.Replace(playlistTitle, @"[^a-zA-Z0-9]", "_").Trim('_');
                    // Group by playlistCode, title and date so distinct downloads on different days do not merge
                    groupKey = $"{playlistCode}_{cleanTitleSlug}_{d.CreatedAt:yyyyMMdd}";
                }
                else if (!string.IsNullOrEmpty(seriesName))
                {
                    string cleanSlug = Regex.Replace(seriesName, @"[^a-zA-Z0-9_]", "_").Trim('_');
                    groupKey = $"PL_SERIES_{cleanSlug}_{d.CreatedAt:yyyyMMdd}";
                    playlistCode = "PL-SERIES";
                    playlistTitle = seriesName;
                }
                else
                {
                    string dateKey = d.CreatedAt.ToString("yyyyMMdd");
                    groupKey = $"PL_BATCH_{dateKey}";
                    playlistCode = "PL-01";
                    playlistTitle = "YouTube Playlist Collection";
                }

                // Check if this specific item is part of an active running job
                string? matchingJobId = activeJobs?.FirstOrDefault(j =>
                    j.Items != null && j.Items.Any(item => string.Equals(item.TaskId, d.Id, StringComparison.OrdinalIgnoreCase)))?.JobId;

                if (!playlistBuckets.TryGetValue(groupKey, out var group))
                {
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
                else if ((string.IsNullOrEmpty(group.JobId) || group.JobId == groupKey) && !string.IsNullOrEmpty(matchingJobId))
                {
                    group.JobId = matchingJobId;
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
                group.SubItems = group.SubItems
                    .OrderBy(s => ExtractIndexNumber(s))
                    .ThenBy(s => s.CreatedAt)
                    .ToList();

                if (string.IsNullOrEmpty(group.ThumbnailUrl) || group.ThumbnailUrl.Contains("placeholder"))
                {
                    var validThumb = group.SubItems.FirstOrDefault(s => !string.IsNullOrEmpty(s.ThumbnailUrl))?.ThumbnailUrl;
                    if (!string.IsNullOrEmpty(validThumb)) group.ThumbnailUrl = validThumb;
                }

                var matchingJob = activeJobs?.FirstOrDefault(j =>
                    (!string.IsNullOrEmpty(group.JobId) && group.JobId != group.GroupKey && string.Equals(j.JobId, group.JobId, StringComparison.OrdinalIgnoreCase)) ||
                    (j.Items != null && j.Items.Any(item => group.SubItems.Any(sub => string.Equals(sub.Id, item.TaskId, StringComparison.OrdinalIgnoreCase)))));

                if (matchingJob != null)
                {
                    bool isJobActive = matchingJob.Status == "Running" || matchingJob.Status == "Downloading" || matchingJob.Status == "Queued" ||
                                       matchingJob.ActiveCount > 0 || matchingJob.QueuedCount > 0;

                    if (isJobActive)
                    {
                        group.IsActive = true;
                        group.JobId = matchingJob.JobId;
                        group.TotalVideos = Math.Max(group.TotalVideos, matchingJob.TotalVideos);
                        group.CompletedCount = matchingJob.CompletedCount;
                        group.FailedCount = matchingJob.FailedCount;
                    }
                }

                var latestDate = group.SubItems.Max(s => s.CreatedAt);
                group.CreatedAt = latestDate;

                finalEntries.Add(group);
            }
        }

        var sortedEntries = finalEntries.OrderByDescending(g => g.CreatedAt).ToList();
        int plSeq = 1;
        foreach (var entry in sortedEntries)
        {
            if (entry.IsPlaylistGroup)
            {
                entry.PlaylistCode = $"PL-{plSeq:D2}";
                plSeq++;
            }
        }

        return sortedEntries;
    }

    private static int ExtractIndexNumber(StreamHelper.Data.DownloadHistory item)
    {
        string check = (item.ValidationDetails ?? "") + " " + (item.AudioVideoDetails ?? "");
        int hashIdx = check.IndexOf('#');
        if (hashIdx >= 0 && hashIdx + 3 <= check.Length)
        {
            string numPart = new string(check.Substring(hashIdx + 1).TakeWhile(char.IsDigit).ToArray());
            if (int.TryParse(numPart, out int parsed)) return parsed;
        }

        if (!string.IsNullOrEmpty(item.Title))
        {
            var match = Regex.Match(
                item.Title, 
                @"(?:Episode|Ep\.?|Part|Pt\.?)\s*(\d+)", 
                RegexOptions.IgnoreCase);
            if (match.Success && int.TryParse(match.Groups[1].Value, out int epNum))
            {
                return epNum;
            }
        }

        if (!string.IsNullOrEmpty(item.FileName))
        {
            var match = Regex.Match(item.FileName, @"^(\d{1,4})\s*[-_.]\s*");
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

        var match = Regex.Match(
            title, 
            @"^(.*?)(?:\s*[-–|:]\s*)?(?:Episode|Ep\.?|Part|Pt\.?|Vol\.?|Season\s*\d+\s*Episode)\s*\d+", 
            RegexOptions.IgnoreCase);

        if (match.Success && match.Groups[1].Value.Trim().Length > 2)
        {
            return match.Groups[1].Value.Trim(' ', '-', '|', ':', '_');
        }

        int epIdx = title.IndexOf("Episode", StringComparison.OrdinalIgnoreCase);
        if (epIdx > 2) return title.Substring(0, epIdx).Trim(' ', '-', '|', ':', '_');

        int epShortIdx = title.IndexOf("Ep ", StringComparison.OrdinalIgnoreCase);
        if (epShortIdx > 2) return title.Substring(0, epShortIdx).Trim(' ', '-', '|', ':', '_');

        int partIdx = title.IndexOf("Part ", StringComparison.OrdinalIgnoreCase);
        if (partIdx > 2) return title.Substring(0, partIdx).Trim(' ', '-', '|', ':', '_');

        return "";
    }

    private static string? ExtractYouTubeVideoId(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        try
        {
            var match = Regex.Match(url, @"(?:youtu\.be\/|v=|\/embed\/|\/v\/|\/shorts\/)([a-zA-Z0-9_-]{11})");
            if (match.Success) return match.Groups[1].Value;
        }
        catch { }
        return null;
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CancelDownload(string id)
    {
        string? currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

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
        string? currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        bool success = await _downloadHistoryService.DeleteDownloadAsync(id, currentUserId);
        if (success)
        {
            TempData["SuccessMessage"] = "Download record removed from history.";
        }
        return RedirectToAction("Downloads");
    }
}
