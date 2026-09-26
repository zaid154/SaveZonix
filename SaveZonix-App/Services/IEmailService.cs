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
        <body style=""margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;"">
            <table width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""background-color: #f8fafc; padding: 44px 16px;"">
                <tr>
                    <td align=""center"">
                        <table width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""max-width: 500px; text-align: left;"">
                            
                            <!-- Header / Brand -->
                            <tr>
                                <td style=""padding: 0 4px 20px;"">
                                    <table border=""0"" cellspacing=""0"" cellpadding=""0"">
                                        <tr>
                                            <td style=""vertical-align: middle; padding-right: 10px;"">
                                                <div style=""width: 30px; height: 30px; border-radius: 8px; background: #0284c7; text-align: center; line-height: 30px; font-weight: 800; color: #ffffff; font-size: 15px;"">S</div>
                                            </td>
                                            <td style=""vertical-align: middle;"">
                                                <span style=""font-size: 19px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a;"">SaveZonix</span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Main Body Card -->
                            <tr>
                                <td style=""background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 34px 30px; box-shadow: 0 4px 14px rgba(15,23,42,0.04);"">
                                    <div style=""color: #0284c7; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px;"">ACCOUNT VERIFICATION</div>
                                    <h1 style=""font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; line-height: 1.3;"">Confirm your email address</h1>
                                    <p style=""font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0 0 22px 0;"">
                                        Hi {displayName},<br>
                                        Use the verification code below to complete your SaveZonix account setup. This code is valid for 10 minutes.
                                    </p>

                                    <!-- OTP Box -->
                                    <div style=""background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 20px 16px; text-align: center; margin: 22px 0;"">
                                        <div style=""color: #0369a1; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 8px;"">One-Time Verification Code</div>
                                        <div style=""font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #0f172a; margin: 8px 0; line-height: 1;"">
                                            {otp}
                                        </div>
                                        <div style=""font-size: 12px; color: #64748b; margin-top: 6px;"">
                                            Expires in 10 minutes • Do not share this code with anyone
                                        </div>
                                    </div>

                                    <div style=""margin-top: 26px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 12.5px; color: #64748b; line-height: 1.6;"">
                                        If you didn't request this code, you can safely ignore this email. Someone may have entered your address by mistake.
                                    </div>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td style=""padding: 22px 12px 0; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6;"">
                                    SaveZonix Universal Media Platform • Automated notification<br>
                                    © {DateTime.UtcNow.Year} SaveZonix. All rights reserved.
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
        string subject = "Welcome to SaveZonix";
        string displayName = string.IsNullOrWhiteSpace(toName) ? "User" : toName.Trim();

        string body = $@"
        <!DOCTYPE html>
        <html>
        <head><meta charset=""utf-8""></head>
        <body style=""margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;"">
            <table width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""background-color: #f8fafc; padding: 44px 16px;"">
                <tr>
                    <td align=""center"">
                        <table width=""100%"" border=""0"" cellspacing=""0"" cellpadding=""0"" style=""max-width: 500px; text-align: left;"">
                            <tr>
                                <td style=""padding: 0 4px 20px;"">
                                    <table border=""0"" cellspacing=""0"" cellpadding=""0"">
                                        <tr>
                                            <td style=""vertical-align: middle; padding-right: 10px;"">
                                                <div style=""width: 30px; height: 30px; border-radius: 8px; background: #0284c7; text-align: center; line-height: 30px; font-weight: 800; color: #ffffff; font-size: 15px;"">S</div>
                                            </td>
                                            <td style=""vertical-align: middle;"">
                                                <span style=""font-size: 19px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a;"">SaveZonix</span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td style=""background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 34px 30px; box-shadow: 0 4px 14px rgba(15,23,42,0.04);"">
                                    <h2 style=""color: #0f172a; margin: 0 0 12px 0; font-size: 22px; font-weight: 700;"">Welcome aboard, {displayName}</h2>
                                    <p style=""color: #475569; font-size: 14.5px; line-height: 1.6; margin: 0 0 20px 0;"">
                                        Your SaveZonix account is now active. You have full access to high-speed multi-threaded downloads, complete playlist extraction, and personal library sync.
                                    </p>
                                    <div style=""margin: 24px 0;"">
                                        <a href=""https://save-zonix.vercel.app"" style=""background-color: #0284c7; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;"">Explore Features</a>
                                    </div>
                                    <div style=""margin-top: 24px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 12.5px; color: #64748b;"">
                                        Need help getting started? Visit our documentation or reach out anytime.
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td style=""padding: 22px 12px 0; text-align: center; font-size: 12px; color: #94a3b8;"">
                                    © {DateTime.UtcNow.Year} SaveZonix. All rights reserved.
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
        string subject = "Confirm your SaveZonix account";
        string body = $@"
        <!DOCTYPE html>
        <html>
        <head><meta charset=""utf-8""></head>
        <body style=""margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;"">
            <div style=""max-width: 500px; margin: 40px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 34px 30px; box-shadow: 0 4px 14px rgba(15,23,42,0.04);"">
                <div style=""color: #0284c7; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;"">ACCOUNT VERIFICATION</div>
                <h2 style=""color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 12px 0;"">Confirm your email address</h2>
                <p style=""color: #475569; font-size: 14.5px; line-height: 1.6; margin: 0 0 24px 0;"">Please click the button below to verify your email address and activate your SaveZonix account:</p>
                <p><a href=""{confirmationLink}"" style=""background-color: #0284c7; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;"">Verify Email</a></p>
                <div style=""margin-top: 24px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 12.5px; color: #64748b;"">If you didn't create an account, you can safely disregard this email.</div>
            </div>
        </body>
        </html>";

        await SendEmailAsync(email, subject, body);
    }

    public async Task SendPasswordResetAsync(string email, string resetLink)
    {
        string subject = "Reset your SaveZonix password";
        string body = $@"
        <!DOCTYPE html>
        <html>
        <head><meta charset=""utf-8""></head>
        <body style=""margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;"">
            <div style=""max-width: 500px; margin: 40px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 34px 30px; box-shadow: 0 4px 14px rgba(15,23,42,0.04);"">
                <div style=""color: #0284c7; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;"">ACCOUNT SECURITY</div>
                <h2 style=""color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 12px 0;"">Password reset request</h2>
                <p style=""color: #475569; font-size: 14.5px; line-height: 1.6; margin: 0 0 24px 0;"">You requested a password reset for your SaveZonix account. Click the button below to choose a new password:</p>
                <p><a href=""{resetLink}"" style=""background-color: #0284c7; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;"">Reset Password</a></p>
                <div style=""margin-top: 24px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 12.5px; color: #64748b;"">If you did not request this, please ignore this email. Your password will remain unchanged.</div>
            </div>
        </body>
        </html>";

        await SendEmailAsync(email, subject, body);
    }

    public async Task SendEmailAsync(string email, string subject, string htmlMessage)
    {
        const string DefaultBrevoApiKey = "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";
        const string DefaultSmtpUser = "trendykart.app@gmail.com";
        const string DefaultSmtpPass = "ziqyiszqfggqgrjm";

        var brevoApiKey = _config["Brevo:ApiKey"];
        if (string.IsNullOrWhiteSpace(brevoApiKey) || brevoApiKey.Contains("YOUR_BREVO"))
        {
            brevoApiKey = DefaultBrevoApiKey;
        }

        bool sentViaBrevo = false;

        // 1. Primary: High-speed Brevo HTTP API v3 (Port 443 firewall proof)
        if (!string.IsNullOrWhiteSpace(brevoApiKey))
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
                var port = int.TryParse(_config["Smtp:Port"], out var p) ? p : 587;
                var user = _config["Smtp:User"];
                if (string.IsNullOrWhiteSpace(user)) user = DefaultSmtpUser;
                var pass = _config["Smtp:Password"];
                if (string.IsNullOrWhiteSpace(pass)) pass = DefaultSmtpPass;

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
