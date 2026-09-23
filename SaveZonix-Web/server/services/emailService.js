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
  const eyebrow = isReset ? 'ACCOUNT SECURITY' : 'WELCOME TO SAVEZONIX';
  const magicButtonText = isReset ? 'Reset Password in 1-Click' : 'Verify Account in 1-Click';
  const footerNotice = isReset
    ? 'If you did not request a password reset, please change your credentials immediately or ignore this email.'
    : 'If you did not create a SaveZonix account, you can safely ignore this email.';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#080d1a;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#080d1a;padding:36px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:540px;">
        
        <!-- Header Brand -->
        <tr>
          <td style="padding:0 8px 18px;text-align:left;">
            <div style="font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#38bdf8;">
              ⚡ SaveZonix <span style="font-size:12px;font-weight:600;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Cloud Engine</span>
            </div>
          </td>
        </tr>

        <!-- Main Card -->
        <tr>
          <td style="background-color:#0f172a;border:1px solid #1e293b;border-radius:20px;padding:36px 32px;box-shadow:0 12px 36px rgba(0,0,0,0.5);">
            <div style="color:#0ea5e9;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">${eyebrow}</div>
            <h1 style="margin:0 0 12px;color:#f8fafc;font-size:26px;font-weight:800;line-height:1.25;">${title}</h1>
            <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">Use the 6-digit one-time code below to ${action}:</p>
            
            <!-- Monospace OTP Box -->
            <div style="margin:24px 0;padding:20px 16px;background:linear-gradient(135deg,#0369a1 0%,#0f172a 100%);border:2px solid #38bdf8;border-radius:14px;text-align:center;">
              <div style="margin-bottom:6px;color:#bae6fd;font-size:11px;font-weight:700;letter-spacing:1.2px;">YOUR ONE-TIME VERIFICATION CODE</div>
              <div style="color:#ffffff;font-family:Consolas,'SF Mono','Courier New',monospace;font-size:38px;font-weight:900;letter-spacing:12px;line-height:1.1;">${code}</div>
            </div>

            <!-- 1-Click Magic Link Button (If available) -->
            ${magicLink ? `
            <div style="text-align:center;margin:28px 0 20px;">
              <div style="margin-bottom:12px;font-size:13px;color:#64748b;">— OR VERIFY INSTANTLY WITHOUT TYPING —</div>
              <a href="${magicLink}" target="_blank" style="display:inline-block;background-color:#0ea5e9;color:#ffffff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(14,165,233,0.4);">
                🚀 ${magicButtonText}
              </a>
            </div>
            ` : ''}

            <p style="margin:20px 0 0;color:#cbd5e1;font-size:13px;line-height:1.6;">
              ⏳ <strong style="color:#38bdf8;">Code expires in 10 minutes.</strong> Never share this verification code or link with anyone.
            </p>

            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #1e293b;color:#64748b;font-size:12px;line-height:1.6;">
              ${footerNotice}
            </div>
          </td>
        </tr>

        <!-- Security Footer -->
        <tr>
          <td style="padding:22px 12px 0;color:#475569;font-size:11px;line-height:1.5;text-align:center;">
            SaveZonix Cloud Security Engine • Automated security notification.<br/>
            © 2026 SaveZonix Inc. All rights reserved.
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
  console.log(`\n🔑 [SAVEZONIX OTP CODE for ${to} (${purpose})]: >>> ${code} <<<\n`);
  const isReset = purpose === 'reset';
  const action = isReset ? 'reset your SaveZonix password' : 'verify your SaveZonix email address';
  const title = isReset ? 'Reset Your Password' : 'Verify Your Email';
  const subject = isReset ? '🔑 SaveZonix — Password Reset Code' : '🔐 SaveZonix — Your Verification Code';
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
  const subject = `🛡️ Security Alert: SaveZonix ${actionName}`;
  const timestamp = new Date().toUTCString();
  const ip = reqDetails.ip || 'Unknown IP';
  const userAgent = reqDetails.userAgent || 'Unknown Device/Browser';

  const text = `Security Alert for your SaveZonix Account:\n\nAction: ${actionName}\nDate & Time: ${timestamp}\nIP Address: ${ip}\nDevice: ${userAgent}\n\nIf this was you, no action is needed. If you did not make this change, please reset your password immediately.`;

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#080d1a;color:#f8fafc;font-family:sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:32px;">
    <h2 style="color:#38bdf8;margin-top:0;">🛡️ Security Alert</h2>
    <p style="color:#cbd5e1;font-size:15px;line-height:1.5;">Your SaveZonix account recently had a security update: <strong>${actionName}</strong>.</p>
    <div style="background:#020617;border:1px solid #334155;border-radius:10px;padding:16px;margin:20px 0;font-size:13px;color:#94a3b8;line-height:1.8;">
      <div><strong>Timestamp:</strong> ${timestamp}</div>
      <div><strong>IP Address:</strong> ${ip}</div>
      <div><strong>Device / Client:</strong> ${userAgent}</div>
    </div>
    <p style="color:#94a3b8;font-size:13px;">If you initiated this change, you can safely disregard this message.</p>
    <p style="color:#ef4444;font-size:13px;font-weight:600;">If you did NOT perform this action, please reset your password immediately to protect your account.</p>
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
  const subject = '⚡ SaveZonix — Live Email Delivery Test';
  const text = `This is a live test email from SaveZonix Cloud Engine.\nTimestamp: ${new Date().toISOString()}`;
  const html = `<div style="font-family:sans-serif;background:#080d1a;color:#f8fafc;padding:24px;border-radius:12px;border:1px solid #0ea5e9;">
    <h2 style="color:#38bdf8;margin-top:0;">⚡ SaveZonix Delivery Test</h2>
    <p>Your SaveZonix email delivery pipeline is fully functional and delivering messages.</p>
    <p style="font-size:13px;color:#94a3b8;">Timestamp: ${new Date().toISOString()}</p>
  </div>`;

  return await sendEmail({ to, subject, text, html, templateType: 'test_diagnostic' });
}

module.exports = {
  generateOtp,
  sendEmail,
  sendOtpEmail,
  sendSecurityAlertEmail,
  testEmailDelivery
};
