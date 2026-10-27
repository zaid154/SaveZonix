using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using SaveZonix.Core;
using SaveZonix.Models;
using SaveZonix.Services;
using StreamHelper.Data;
using StreamHelper.Services;

namespace SaveZonix.Endpoints;

public static class AuthEndpoints
{
    public static WebApplication MapAuthEndpoints(this WebApplication app)
    {
        // ─────────────────────────────────────────────────────────────
        // User Authentication APIs (Register, OTP Verification, Login, Google OAuth, Profile)
        // ─────────────────────────────────────────────────────────────
        app.MapPost("/api/auth/send-registration-otp", async (RegisterRequest req, IDownloadAnalyticsService analytics, IEmailVerificationService verificationService, IEmailService emailService) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            {
                return Results.BadRequest(new { success = false, message = "Please provide your email and a password." });
            }

            var email = req.Email.Trim().ToLowerInvariant();

            // 1. Disposable / Temporary Email Blocker
            if (verificationService.IsDisposableEmail(email))
            {
                return Results.BadRequest(new 
                { 
                    success = false, 
                    message = "Temporary or disposable email addresses are not supported. Please use a personal email (like Gmail, Outlook, Yahoo)." 
                });
            }

            // 2. Existing User Check
            var existing = await analytics.FindUserByEmailAsync(email);
            if (existing != null)
            {
                return Results.BadRequest(new { success = false, message = "An account with this email already exists. Please sign in instead." });
            }

            string fullName = string.IsNullOrWhiteSpace(req.FullName) ? email.Split('@')[0] : req.FullName.Trim();

            // 3. Generate 6-Digit OTP & Dispatch Email
            var otp = verificationService.GenerateAndStoreOtp(email, fullName, req.Password);
            Console.WriteLine($"[AUTH OTP] 🔑 Registration code for {email}: {otp}");
            _ = Task.Run(() => emailService.SendOtpVerificationEmailAsync(email, otp, fullName));

            return Results.Ok(new 
            { 
                success = true, 
                message = $"A 6-digit confirmation code was sent to {email}",
                email = email 
            });
        });

        app.MapPost("/api/auth/verify-registration-otp", async (VerifyOtpRequest req, IDownloadAnalyticsService analytics, IEmailVerificationService verificationService, IEmailService emailService, HttpContext ctx) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Otp))
            {
                return Results.BadRequest(new { success = false, message = "Please enter the 6-digit code sent to your email." });
            }

            var (isValid, error, pendingData) = verificationService.VerifyOtp(req.Email, req.Otp);
            if (!isValid || pendingData == null)
            {
                return Results.BadRequest(new { success = false, message = error ?? "Invalid verification code." });
            }

            var user = new SaveZonixUser
            {
                FullName = pendingData.FullName,
                Email = pendingData.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(pendingData.Password),
                Role = pendingData.Email.Equals("trendykart.app@gmail.com", StringComparison.OrdinalIgnoreCase) || pendingData.Email.Equals("zaidm1323@gmail.com", StringComparison.OrdinalIgnoreCase) ? "Admin" : "User",
                AuthProvider = "Local"
            };

            await analytics.CreateOrUpdateUserAsync(user);

            // Sign in cookie
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id ?? Guid.NewGuid().ToString("N")),
                new(ClaimTypes.Name, user.FullName),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Role, user.Role),
                new("isVip", "false")
            };
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

            // Send Welcome Email
            _ = Task.Run(() => emailService.SendWelcomeEmailAsync(user.Email, user.FullName));

            return Results.Ok(new { success = true, user = new { user.Id, user.FullName, user.Email, user.Role } });
        });

        app.MapPost("/api/auth/resend-registration-otp", (ResendOtpRequest req, IEmailVerificationService verificationService, IEmailService emailService) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email)) return Results.BadRequest(new { success = false, message = "Email is required." });
            
            if (!verificationService.CanResendOtp(req.Email))
            {
                return Results.BadRequest(new { success = false, message = "Please wait a moment before requesting another code." });
            }

            return Results.Ok(new { success = true, message = "A new verification code has been sent to your email." });
        });

        app.MapPost("/api/auth/register", async (RegisterRequest req, IDownloadAnalyticsService analytics, IEmailVerificationService verificationService, IEmailService emailService, HttpContext ctx) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            {
                return Results.BadRequest(new { success = false, message = "Email and password are required." });
            }

            if (verificationService.IsDisposableEmail(req.Email))
            {
                return Results.BadRequest(new { success = false, message = "Temporary or disposable email addresses are not supported. Please use a personal email." });
            }

            var existing = await analytics.FindUserByEmailAsync(req.Email);
            if (existing != null)
            {
                return Results.BadRequest(new { success = false, message = "An account with this email already exists." });
            }

            var user = new SaveZonixUser
            {
                FullName = string.IsNullOrWhiteSpace(req.FullName) ? req.Email.Split('@')[0] : req.FullName,
                Email = req.Email.Trim().ToLowerInvariant(),
                PasswordHash = MediaHelper.HashPassword(req.Password),
                Role = req.Email.Equals("trendykart.app@gmail.com", StringComparison.OrdinalIgnoreCase) ? "Admin" : "User",
                AuthProvider = "Local"
            };

            await analytics.CreateOrUpdateUserAsync(user);

            // Sign in cookie
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id ?? Guid.NewGuid().ToString("N")),
                new(ClaimTypes.Name, user.FullName),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Role, user.Role)
            };
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

            // Send Welcome Email
            _ = Task.Run(() => emailService.SendWelcomeEmailAsync(user.Email, user.FullName));

            return Results.Ok(new { success = true, user = new { user.Id, user.FullName, user.Email, user.Role } });
        });

        app.MapPost("/api/auth/login", async (LoginRequest req, IDownloadAnalyticsService analytics, HttpContext ctx) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            {
                return Results.BadRequest(new { success = false, message = "Email and password are required." });
            }

            var user = await analytics.FindUserByEmailAsync(req.Email);
            if (user == null || string.IsNullOrEmpty(user.PasswordHash) || !MediaHelper.VerifyPassword(req.Password, user.PasswordHash))
            {
                var cloudUrls = new[] { "https://savezonix-pro.vercel.app/api/auth/login", "https://savezonix.onrender.com/api/auth/login" };
                var payload = System.Text.Json.JsonSerializer.Serialize(new { email = req.Email.Trim().ToLowerInvariant(), password = req.Password });
                using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(7) };
                bool cloudSuccess = false;

                foreach (var url in cloudUrls)
                {
                    try
                    {
                        using var content = new System.Net.Http.StringContent(payload, System.Text.Encoding.UTF8, "application/json");
                        var resp = await client.PostAsync(url, content);
                        var json = await resp.Content.ReadAsStringAsync();
                        using var doc = System.Text.Json.JsonDocument.Parse(json);
                        var root = doc.RootElement;

                        if (resp.IsSuccessStatusCode && root.TryGetProperty("success", out var s) && s.GetBoolean() && root.TryGetProperty("user", out var u))
                        {
                            string id = u.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "" : "";
                            string name = u.TryGetProperty("name", out var nProp) ? nProp.GetString() ?? "" : "";
                            string uEmail = u.TryGetProperty("email", out var eProp) ? eProp.GetString() ?? "" : req.Email;
                            string role = u.TryGetProperty("role", out var rProp) ? rProp.GetString() ?? "User" : "User";
                            bool isVipCloud = u.TryGetProperty("isVip", out var vProp) && vProp.GetBoolean();

                            user = new SaveZonixUser
                            {
                                Id = id,
                                FullName = name,
                                Email = uEmail,
                                Role = role,
                                IsVip = isVipCloud,
                                IsActive = true,
                                PasswordHash = MediaHelper.HashPassword(req.Password)
                            };
                            await analytics.CreateOrUpdateUserAsync(user);
                            cloudSuccess = true;
                            break;
                        }
                    }
                    catch { }
                }

                if (!cloudSuccess || user == null)
                {
                    return Results.BadRequest(new { success = false, message = "Invalid email or password." });
                }
            }

            bool isAdmin = string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(user.Email, "zaidm1323@gmail.com", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(user.Email, "trendykart.app@gmail.com", StringComparison.OrdinalIgnoreCase);
            bool isVip = isAdmin || user.IsVip;

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id ?? Guid.NewGuid().ToString("N")),
                new(ClaimTypes.Name, user.FullName),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Role, isAdmin ? "Admin" : user.Role),
                new("isVip", isVip ? "true" : "false")
            };
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity),
                new AuthenticationProperties { IsPersistent = req.RememberMe });

            return Results.Ok(new { success = true, user = new { user.Id, user.FullName, user.Email, Role = isAdmin ? "Admin" : user.Role, IsVip = isVip } });
        });

        app.MapPost("/api/auth/logout", async (HttpContext ctx) =>
        {
            await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok(new { success = true });
        });

        app.MapGet("/api/auth/me", async (HttpContext ctx, IDownloadAnalyticsService analytics) =>
        {
            string clientIp = ctx.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            int remaining = await analytics.GetGuestRemainingDownloadsAsync(clientIp);
            var settings = await analytics.GetSettingsAsync();

            if (ctx.User.Identity?.IsAuthenticated == true)
            {
                var email = ctx.User.FindFirstValue(ClaimTypes.Email) ?? "";
                var user = await analytics.FindUserByEmailAsync(email);
                return Results.Ok(new
                {
                    isAuthenticated = true,
                    user = new
                    {
                        name = ctx.User.Identity.Name,
                        email = email,
                        role = ctx.User.FindFirstValue(ClaimTypes.Role) ?? "User",
                        totalDownloads = user?.TotalDownloadsCount ?? 0
                    },
                    guestRemaining = remaining,
                    settings = new { settings.AllowGuestDownloads, settings.GuestDailyDownloadLimit }
                });
            }

            return Results.Ok(new
            {
                isAuthenticated = false,
                guestRemaining = remaining,
                settings = new { settings.AllowGuestDownloads, settings.GuestDailyDownloadLimit }
            });
        });

        app.MapGet("/api/auth/history", async (HttpContext ctx, IDownloadAnalyticsService analytics) =>
        {
            if (ctx.User.Identity?.IsAuthenticated != true)
            {
                return Results.Unauthorized();
            }
            var userId = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
            var history = await analytics.GetUserDownloadHistoryAsync(userId);
            return Results.Ok(history);
        });

        return app;
    }
}
