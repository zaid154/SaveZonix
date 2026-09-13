using System.Net;
using System.Net.Mail;
using System.Text;
using System.Text.Json;

namespace SaveZonix.Services;

public interface IEmailService
{
    Task SendEmailAsync(string email, string subject, string htmlMessage);
    Task SendWelcomeEmailAsync(string toEmail, string toName);
    Task SendOtpVerificationEmailAsync(string toEmail, string otp, string userName);
    Task SendEmailConfirmationAsync(string email, string confirmationLink);
    Task SendPasswordResetAsync(string email, string resetLink);
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;
    private static readonly HttpClient _httpClient = new();

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendOtpVerificationEmailAsync(string toEmail, string otp, string userName)
    {
        string subject = $"{otp} is your SaveZonix verification code";
        string displayName = string.IsNullOrWhiteSpace(userName) ? "there" : userName.Trim();

        string body = $@"
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset=""utf-8"">
            <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
            <title>SaveZonix Verification Code</title>
        </head>
        <body style=""margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;"">
            <table width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""background-color: #0f172a; padding: 40px 16px;"">
                <tr>
                    <td align=""center"">
                        <table width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""max-width: 520px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);"">
                            
                            <!-- Header / Brand -->
                            <tr>
                                <td style=""padding: 32px 32px 20px 32px; text-align: left;"">
                                    <div style=""display: inline-block; font-size: 22px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px;"">
                                        Save<span style=""color: #f8fafc;"">Zonix</span>
                                    </div>
                                </td>
                            </tr>

                            <!-- Main Body -->
                            <tr>
                                <td style=""padding: 0 32px 32px 32px;"">
                                    <h1 style=""font-size: 20px; font-weight: 700; color: #f8fafc; margin: 0 0 12px 0;"">Confirm your email address</h1>
                                    <p style=""font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 24px 0;"">
                                        Hi {displayName},<br>
                                        Use the verification code below to complete your SaveZonix account setup.
                                    </p>

                                    <!-- OTP Box -->
                                    <div style=""background-color: #0f172a; border: 1px solid #38bdf8; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;"">
                                        <div style=""font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #38bdf8; user-select: all;"">
                                            {otp}
                                        </div>
                                        <div style=""font-size: 12px; color: #64748b; margin-top: 8px;"">
                                            Valid for 10 minutes • Do not share this code with anyone
                                        </div>
                                    </div>

                                    <p style=""font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;"">
                                        If you didn't request this code, you can safely ignore this email. Someone may have entered your address by mistake.
                                    </p>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td style=""padding: 20px 32px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center; font-size: 12px; color: #64748b;"">
                                    © {DateTime.UtcNow.Year} SaveZonix Media Downloader. All rights reserved.
                                </td>
                            </tr>

                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>";

        await SendEmailAsync(toEmail, subject, body);
    }

    public async Task SendWelcomeEmailAsync(string toEmail, string toName)
    {
        string subject = "Welcome to SaveZonix — Unlimited High-Speed Video Downloader";
        string displayName = string.IsNullOrWhiteSpace(toName) ? "User" : toName.Trim();

        string body = $@"
        <!DOCTYPE html>
        <html>
        <head><meta charset=""utf-8""></head>
        <body style=""margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc;"">
            <table width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""background-color: #0f172a; padding: 40px 16px;"">
                <tr>
                    <td align=""center"">
                        <table width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""max-width: 520px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px;"">
                            <tr>
                                <td>
                                    <div style=""font-size: 22px; font-weight: 800; color: #38bdf8; margin-bottom: 20px;"">Save<span style=""color: #f8fafc;"">Zonix</span></div>
                                    <h2 style=""color: #f8fafc; margin: 0 0 12px 0;"">Welcome aboard, {displayName}! 🎉</h2>
                                    <p style=""color: #94a3b8; font-size: 14px; line-height: 1.6;"">
                                        Your SaveZonix account is officially active. You now have unlimited parallel downloads, personal history logging, and zero speed throttles.
                                    </p>
                                    <div style=""margin: 28px 0;"">
                                        <a href=""http://localhost:5000"" style=""background: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;"">Start Downloading</a>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>";

        await SendEmailAsync(toEmail, subject, body);
    }

    public async Task SendEmailConfirmationAsync(string email, string confirmationLink)
    {
        string subject = "Confirm Your SaveZonix Account";
        string body = $@"
        <div style=""font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px;"">
            <h2 style=""color: #38bdf8;"">Confirm Your Email</h2>
            <p style=""color: #94a3b8;"">Please click the button below to confirm your SaveZonix account:</p>
            <p><a href=""{confirmationLink}"" style=""background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;"">Confirm Email</a></p>
        </div>";

        await SendEmailAsync(email, subject, body);
    }

    public async Task SendPasswordResetAsync(string email, string resetLink)
    {
        string subject = "Reset Your SaveZonix Password";
        string body = $@"
        <div style=""font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px;"">
            <h2 style=""color: #38bdf8;"">Password Reset Request</h2>
            <p style=""color: #94a3b8;"">You requested a password reset for your SaveZonix account. Click the button below to choose a new password:</p>
            <p><a href=""{resetLink}"" style=""background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;"">Reset Password</a></p>
            <p style=""font-size: 12px; color: #64748b;"">If you did not request this, please ignore this email.</p>
        </div>";

        await SendEmailAsync(email, subject, body);
    }

    public async Task SendEmailAsync(string email, string subject, string htmlMessage)
    {
        var brevoApiKey = _config["Brevo:ApiKey"];
        bool sentViaBrevo = false;

        // 1. Primary: High-speed Brevo HTTP API v3
        if (!string.IsNullOrWhiteSpace(brevoApiKey) && !brevoApiKey.Contains("YOUR_BREVO"))
        {
            try
            {
                var payload = new
                {
                    sender = new { name = "SaveZonix", email = "trendykart.app@gmail.com" },
                    to = new[] { new { email = email } },
                    subject = subject,
                    htmlContent = htmlMessage
                };

                using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
                request.Headers.Add("api-key", brevoApiKey);
                request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                using var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    sentViaBrevo = true;
                    _logger.LogInformation("✓ Email delivered via Brevo API to {Email}", email);
                }
                else
                {
                    var err = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Brevo API delivery note: {Error}", err);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Brevo API dispatch note: {Message}", ex.Message);
            }
        }

        // 2. Secondary Fallback: Gmail SMTP Dispatcher
        if (!sentViaBrevo)
        {
            try
            {
                var host = _config["Smtp:Host"] ?? "smtp.gmail.com";
                var port = int.Parse(_config["Smtp:Port"] ?? "587");
                var user = _config["Smtp:User"] ?? "trendykart.app@gmail.com";
                var pass = _config["Smtp:Password"] ?? "ziqyiszqfggqgrjm";

                using var client = new SmtpClient(host, port)
                {
                    Credentials = new NetworkCredential(user, pass),
                    EnableSsl = true,
                    Timeout = 10000
                };

                using var mail = new MailMessage
                {
                    From = new MailAddress(user, "SaveZonix"),
                    Subject = subject,
                    Body = htmlMessage,
                    IsBodyHtml = true
                };
                mail.To.Add(email);

                await client.SendMailAsync(mail);
                _logger.LogInformation("✓ Email delivered via Gmail SMTP to {Email}", email);
            }
            catch (Exception ex)
            {
                _logger.LogError("SMTP delivery error for {Email}: {Message}", email, ex.Message);
            }
        }
    }
}
