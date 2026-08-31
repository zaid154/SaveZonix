using System;
using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace StreamHelper.Services;

public interface IEmailService
{
    Task SendEmailAsync(string email, string subject, string htmlMessage);
    Task SendEmailConfirmationAsync(string email, string confirmationLink);
    Task SendPasswordResetAsync(string email, string resetLink);
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendEmailConfirmationAsync(string email, string confirmationLink)
    {
        string subject = "Confirm Your Stream Helper Account";
        string body = string.Format(@"
<div style='background-color:#070a13; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; padding:40px 20px; border-radius:12px;'>
    <div style='max-width:560px; margin:0 auto; background:rgba(15,23,42,0.9); padding:32px; border-radius:16px; border:1px solid rgba(255,255,255,0.1);'>
        <h2 style='color:#38bdf8; margin-top:0;'>Stream<span style='color:#10b981;'>Helper</span></h2>
        <h3 style='color:#f8fafc;'>Verify Your Email Address</h3>
        <p style='color:#94a3b8; line-height:1.6;'>Thank you for creating an account with Stream Helper. Please click the button below to confirm your email and activate your full download dashboard access:</p>
        <div style='text-align:center; margin:32px 0;'>
            <a href='{0}' style='background:#2563eb; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; display:inline-block;'>Verify Email Address</a>
        </div>
        <p style='color:#64748b; font-size:13px;'>If you did not request this account, you can safely ignore this email.</p>
        <hr style='border:none; border-top:1px solid rgba(255,255,255,0.08); margin:24px 0;' />
        <p style='color:#475569; font-size:12px;'>Or copy and paste this link in your browser:<br/><a href='{0}' style='color:#38bdf8; word-break:break-all;'>{0}</a></p>
    </div>
</div>", confirmationLink);

        await SendEmailAsync(email, subject, body);
    }

    public async Task SendPasswordResetAsync(string email, string resetLink)
    {
        string subject = "Reset Your Stream Helper Password";
        string body = string.Format(@"
<div style='background-color:#070a13; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; padding:40px 20px; border-radius:12px;'>
    <div style='max-width:560px; margin:0 auto; background:rgba(15,23,42,0.9); padding:32px; border-radius:16px; border:1px solid rgba(255,255,255,0.1);'>
        <h2 style='color:#38bdf8; margin-top:0;'>Stream<span style='color:#10b981;'>Helper</span></h2>
        <h3 style='color:#f8fafc;'>Reset Your Password</h3>
        <p style='color:#94a3b8; line-height:1.6;'>We received a request to reset the password for your Stream Helper account. Click the button below to set a new password:</p>
        <div style='text-align:center; margin:32px 0;'>
            <a href='{0}' style='background:#f43f5e; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:600; display:inline-block;'>Reset Password</a>
        </div>
        <p style='color:#64748b; font-size:13px;'>This password reset link will expire in 2 hours. If you did not request a password reset, please ignore this email.</p>
        <hr style='border:none; border-top:1px solid rgba(255,255,255,0.08); margin:24px 0;' />
        <p style='color:#475569; font-size:12px;'>Or copy and paste this link in your browser:<br/><a href='{0}' style='color:#38bdf8; word-break:break-all;'>{0}</a></p>
    </div>
</div>", resetLink);

        await SendEmailAsync(email, subject, body);
    }

    public async Task SendEmailAsync(string email, string subject, string htmlMessage)
    {
        bool devMode = _config.GetValue<bool>("DevMode", true);
        string host = _config["Smtp:Host"] ?? "";
        string user = _config["Smtp:Username"] ?? "";
        string pass = _config["Smtp:Password"] ?? "";

        // Always log clean developer message in console for immediate testing
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine("\n=======================================================");
        Console.WriteLine("[EMAIL NOTIFICATION]");
        Console.WriteLine(string.Format("To: {0}", email));
        Console.WriteLine(string.Format("Subject: {0}", subject));
        Console.WriteLine("=======================================================");
        Console.ResetColor();

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(pass) || devMode)
        {
            _logger.LogInformation("Email simulated in DevMode for {Email} with Subject: {Subject}", email, subject);
            return;
        }

        try
        {
            int port = _config.GetValue<int>("Smtp:Port", 587);
            bool enableSsl = _config.GetValue<bool>("Smtp:EnableSsl", true);
            string senderEmail = _config["Smtp:SenderEmail"] ?? "noreply@streamhelper.app";
            string senderName = _config["Smtp:SenderName"] ?? "Stream Helper";

            using var message = new MailMessage();
            message.From = new MailAddress(senderEmail, senderName);
            message.To.Add(new MailAddress(email));
            message.Subject = subject;
            message.Body = htmlMessage;
            message.IsBodyHtml = true;

            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(user, pass),
                EnableSsl = enableSsl
            };

            await client.SendMailAsync(message);
            _logger.LogInformation("Email sent successfully to {Email}", email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {Email}", email);
        }
    }
}
