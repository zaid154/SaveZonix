const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');

let cachedTransporter = null;
let lastConfigHash = '';

// Verified fallback credentials ensuring zero-downtime email dispatch
const DEFAULT_SMTP_USER = 'trendykart.app@gmail.com';
const DEFAULT_SMTP_PASS = 'ziqyiszqfggqgrjm';
const DEFAULT_BREVO_KEY = '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';

function getEmailConfig() {
  const smtpUser = (process.env.SMTP_USER || DEFAULT_SMTP_USER).trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || DEFAULT_SMTP_PASS).trim();
  const smtpHost = (process.env.SMTP_HOST || process.env.SMTP_SERVER || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpFrom = (process.env.SMTP_FROM || `SaveZonix <${smtpUser}>`).trim();
  const brevoKey = (process.env.BREVO_API_KEY || DEFAULT_BREVO_KEY).trim();

  return { smtpUser, smtpPass, smtpHost, smtpPort, smtpFrom, brevoKey };
}

function getTransporter(config) {
  const hash = `${config.smtpHost}:${config.smtpPort}:${config.smtpUser}:${config.smtpPass}`;
  if (cachedTransporter && lastConfigHash === hash) {
    return cachedTransporter;
  }

  const isGmail =
    config.smtpHost === 'smtp.gmail.com' ||
    (config.smtpUser && config.smtpUser.endsWith('@gmail.com'));

  if (isGmail) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.smtpUser, pass: config.smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  } else {
    cachedTransporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  lastConfigHash = hash;
  return cachedTransporter;
}

/**
 * Log dispatch telemetry to MongoDB EmailLog collection asynchronously
 */
async function recordTelemetry({ recipient, templateType, channel, status, latencyMs, errorMessage, messageId }) {
  try {
    const log = new EmailLog({
      recipient: (recipient || '').toLowerCase().trim(),
      templateType: templateType || 'register_otp',
      channel: channel || 'unknown',
      status: status || 'delivered',
      latencyMs: latencyMs || 0,
      errorMessage: errorMessage || null,
      messageId: messageId || null
    });
    await log.save();
  } catch (err) {
    console.error('[Telemetry Error] Failed to record email log:', err.message);
  }
}

/**
 * Core dispatch engine with automated failover:
 * Priority 1: Gmail SMTP (Direct inbox delivery)
 * Priority 2: Brevo HTTPS REST API (Port 443 cloud firewall-proof fallback)
 */
async function sendEmail({ to, subject, text, html, templateType = 'register_otp' }) {
  const config = getEmailConfig();
  const errors = [];
  const start = Date.now();

  // 1. Primary: Direct Gmail SMTP
  if (config.smtpUser && config.smtpPass) {
    try {
      const tx = getTransporter(config);
      const from = config.smtpFrom || `SaveZonix <${config.smtpUser}>`;
      console.log(`[Email Service] Dispatching via Gmail SMTP to ${to}`);
      const info = await tx.sendMail({
        from,
        to: to.trim(),
        subject,
        text,
        html
      });
      const latencyMs = Date.now() - start;
      console.log(`[Email Service] Gmail SMTP delivered successfully (${latencyMs}ms): ${info.messageId}`);

      recordTelemetry({
        recipient: to,
        templateType,
        channel: 'gmail_smtp',
        status: 'delivered',
        latencyMs,
        messageId: info.messageId
      });

      return { success: true, provider: 'gmail-smtp', messageId: info.messageId, latencyMs };
    } catch (err) {
      console.error(`[Email Service] Gmail SMTP failed to ${to}:`, err.message);
      errors.push(`Gmail SMTP (${err.message})`);
    }
  }

  // 2. Automated Failover: Brevo REST API v3 over HTTPS Port 443
  if (config.brevoKey) {
    try {
      const senderEmail = config.smtpUser || 'trendykart.app@gmail.com';
      console.log(`[Email Service] Failover dispatching via Brevo REST API to ${to}`);

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': config.brevoKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'SaveZonix', email: senderEmail },
          to: [{ email: to.trim() }],
          subject,
          textContent: text,
          htmlContent: html,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detailedMsg = errData.message || errData.code || `Brevo HTTP ${res.status}`;
        throw new Error(detailedMsg);
      }

      const data = await res.json().catch(() => ({}));
      const latencyMs = Date.now() - start;
      console.log(`[Email Service] Brevo API delivered successfully (${latencyMs}ms): ${data?.messageId}`);

      recordTelemetry({
        recipient: to,
        templateType,
        channel: 'brevo_api',
        status: 'delivered',
        latencyMs,
        messageId: data?.messageId
      });

      return { success: true, provider: 'brevo-api', messageId: data?.messageId, latencyMs };
    } catch (err) {
      console.error(`[Email Service] Brevo API failover failed to ${to}:`, err.message);
      errors.push(`Brevo API (${err.message})`);
    }
  }

  const latencyMs = Date.now() - start;
  const errorSummary = `Email delivery failed via all configured channels: ${errors.join('; ')}`;
  console.error(`[Email Service] FATAL: ${errorSummary}`);

  recordTelemetry({
    recipient: to,
    templateType,
    channel: 'unknown',
    status: 'failed',
    latencyMs,
    errorMessage: errorSummary
  });

  const deliveryError = new Error(errorSummary);
  deliveryError.status = 503;
  throw deliveryError;
}

// Generate random 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate branded enterprise dark-mode HTML template with Monospace Code & 1-Click Magic Link
 */
function buildOtpEmailHtml({ code, title, action, isReset, magicLink }) {
  const eyebrow = isReset ? 'ACCOUNT SECURITY' : 'ACCOUNT VERIFICATION';
  const magicButtonText = isReset ? 'Reset Password in 1-Click' : 'Verify Account in 1-Click';
  const footerNotice = isReset
    ? 'If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.'
    : 'If you did not create a SaveZonix account, you can safely ignore this email.';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;color:#1e293b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;padding:44px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:500px;text-align:left;">
        
        <!-- Header Brand -->
        <tr>
          <td style="padding:0 4px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="vertical-align:middle;padding-right:10px;">
                  <div style="width:30px;height:30px;border-radius:8px;background:#0284c7;text-align:center;line-height:30px;font-weight:800;color:#ffffff;font-size:15px;">S</div>
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-size:19px;font-weight:800;letter-spacing:-0.5px;color:#0f172a;">SaveZonix</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Main Card -->
        <tr>
          <td style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:34px 30px;box-shadow:0 4px 14px rgba(15,23,42,0.04);">
            <div style="color:#0284c7;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">${eyebrow}</div>
            <h1 style="margin:0 0 12px;color:#0f172a;font-size:23px;font-weight:700;line-height:1.3;letter-spacing:-0.4px;">${title}</h1>
            <p style="margin:0 0 22px;color:#475569;font-size:14.5px;line-height:1.6;">Use the 6-digit verification code below to ${action}. This code is valid for 10 minutes.</p>
            
            <!-- Monospace OTP Box -->
            <div style="margin:22px 0;padding:20px 16px;background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;text-align:center;">
              <div style="margin-bottom:8px;color:#0369a1;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">One-Time Verification Code</div>
              <div style="color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'SF Mono',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:800;letter-spacing:10px;line-height:1;margin:8px 0;">${code}</div>
              <div style="color:#64748b;font-size:12px;margin-top:6px;">Expires in 10 minutes • Do not share this code with anyone</div>
            </div>

            <!-- 1-Click Magic Link Button (If available) -->
            ${magicLink ? `
            <div style="text-align:center;margin:26px 0 18px;">
              <div style="margin-bottom:12px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Or verify instantly with one click</div>
              <a href="${magicLink}" target="_blank" style="display:inline-block;background-color:#0284c7;color:#ffffff;font-weight:600;font-size:13.5px;padding:12px 26px;border-radius:8px;text-decoration:none;letter-spacing:0.2px;">
                ${magicButtonText}
              </a>
            </div>
            ` : ''}

            <div style="margin-top:26px;padding-top:18px;border-top:1px solid #f1f5f9;color:#64748b;font-size:12.5px;line-height:1.6;">
              ${footerNotice}
            </div>
          </td>
        </tr>

        <!-- Security Footer -->
        <tr>
          <td style="padding:22px 12px 0;color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;">
            SaveZonix Universal Media Platform • Automated security notification<br/>
            © 2026 SaveZonix. All rights reserved.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send OTP Email with Dual-Failover (Gmail SMTP + Brevo REST API)
 */
async function sendOtpEmail(to, code, purpose, magicLink = null) {
  console.log(`\n[SaveZonix OTP Code for ${to} (${purpose})]: >>> ${code} <<<\n`);
  const isReset = purpose === 'reset';
  const action = isReset ? 'reset your SaveZonix password' : 'verify your SaveZonix email address';
  const title = isReset ? 'Reset Your Password' : 'Verify Your Email';
  const subject = isReset ? 'SaveZonix: Password reset code' : 'SaveZonix: Your verification code';
  const templateType = isReset ? 'reset_otp' : 'register_otp';

  const text = [
    `SaveZonix — ${title}\n`,
    `Use this one-time code to ${action}: ${code}`,
    magicLink ? `Or click here to verify instantly: ${magicLink}` : '',
    'This code expires in 10 minutes and can only be used once.',
    'If you did not request this code, you can safely ignore this email.'
  ].filter(Boolean).join('\n\n');

  const html = buildOtpEmailHtml({ code, title, action, isReset, magicLink });

  return await sendEmail({ to, subject, text, html, templateType });
}

/**
 * Send Post-Action Security Notification Email (e.g. after password changed)
 */
async function sendSecurityAlertEmail(to, actionName, reqDetails = {}) {
  const subject = `SaveZonix: Account security notice (${actionName})`;
  const timestamp = new Date().toUTCString();
  const ip = reqDetails.ip || 'Unknown IP';
  const userAgent = reqDetails.userAgent || 'Unknown Device/Browser';

  const text = `Security Notice for your SaveZonix Account:\n\nAction: ${actionName}\nDate & Time: ${timestamp}\nIP Address: ${ip}\nDevice: ${userAgent}\n\nIf this was you, no action is needed. If you did not make this change, please reset your password immediately.`;

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:40px 16px;background-color:#f8fafc;color:#1e293b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:500px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:32px 28px;box-shadow:0 4px 14px rgba(15,23,42,0.04);">
    <div style="color:#0284c7;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">SECURITY NOTICE</div>
    <h2 style="color:#0f172a;font-size:22px;font-weight:700;margin:0 0 12px 0;">Account Activity Alert</h2>
    <p style="color:#475569;font-size:14.5px;line-height:1.6;margin:0 0 20px 0;">Your SaveZonix account recently had a security update: <strong>${actionName}</strong>.</p>
    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:20px 0;font-size:13px;color:#64748b;line-height:1.8;">
      <div><strong style="color:#334155;">Timestamp:</strong> ${timestamp}</div>
      <div><strong style="color:#334155;">IP Address:</strong> ${ip}</div>
      <div><strong style="color:#334155;">Device / Browser:</strong> ${userAgent}</div>
    </div>
    <p style="color:#64748b;font-size:13px;line-height:1.5;margin:0 0 12px 0;">If you initiated this change, no further action is required.</p>
    <p style="color:#dc2626;font-size:13px;font-weight:600;line-height:1.5;margin:0;">If you did not perform this action, please reset your password immediately to protect your account.</p>
  </div>
  <div style="max-width:500px;margin:20px auto 0;color:#94a3b8;font-size:12px;text-align:center;">
    © 2026 SaveZonix. All rights reserved.
  </div>
</body>
</html>`;

  return await sendEmail({ to, subject, text, html, templateType: 'security_alert' });
}

/**
 * Diagnostic Email Dispatcher for testing setup
 */
async function testEmailDelivery(targetEmail) {
  const to = (targetEmail || '').trim();
  if (!to) throw new Error('Target email is required');
  const subject = 'SaveZonix: Email delivery test';
  const text = `This is a live test email from SaveZonix Cloud Engine.\nTimestamp: ${new Date().toISOString()}`;
  const html = `<!doctype html>
<html>
<body style="margin:0;padding:40px 16px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:500px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:32px 28px;box-shadow:0 4px 14px rgba(15,23,42,0.04);">
    <h2 style="color:#0f172a;margin-top:0;">SaveZonix Delivery Test</h2>
    <p style="color:#475569;font-size:14.5px;line-height:1.6;">Your SaveZonix email delivery pipeline is fully functional and delivering messages.</p>
    <p style="font-size:12.5px;color:#94a3b8;margin-top:16px;">Timestamp: ${new Date().toISOString()}</p>
  </div>
</body>
</html>`;

  return await sendEmail({ to, subject, text, html, templateType: 'test_diagnostic' });
}

module.exports = {
  generateOtp,
  sendEmail,
  sendOtpEmail,
  sendSecurityAlertEmail,
  testEmailDelivery
};
