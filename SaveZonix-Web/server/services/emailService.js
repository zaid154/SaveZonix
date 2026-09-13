const nodemailer = require('nodemailer');

// Create SMTP transporter from environment variables
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_SERVER || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
}

// Generate random 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email with SaveZonix branded template
async function sendOtpEmail(email, otp, type) {
  const transporter = createTransporter();

  const subjects = {
    register: '🔐 SaveZonix — Your Verification Code',
    reset: '🔑 SaveZonix — Password Reset Code'
  };

  const headings = {
    register: 'Verify Your Email',
    reset: 'Reset Your Password'
  };

  const messages = {
    register: 'Use this code to verify your SaveZonix account. This code expires in 10 minutes.',
    reset: 'Use this code to reset your SaveZonix password. This code expires in 10 minutes.'
  };

  const html = `
    <div style="background:#090e17;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0284c7,#7c3aed);padding:24px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">⚡ SaveZonix</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Premium Video Download Engine</p>
        </div>
        <div style="padding:32px 28px;text-align:center;">
          <h2 style="color:#f8fafc;font-size:20px;margin:0 0 8px;">${headings[type] || 'Verification Code'}</h2>
          <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.5;">${messages[type] || 'Enter this code in the app.'}</p>
          <div style="background:#030712;border:2px solid #38bdf8;border-radius:12px;padding:20px;margin:0 auto;display:inline-block;">
            <span style="font-size:36px;font-weight:900;letter-spacing:12px;color:#38bdf8;font-family:monospace;">${otp}</span>
          </div>
          <p style="color:#64748b;font-size:12px;margin:24px 0 0;">If you didn't request this code, please ignore this email.</p>
        </div>
        <div style="background:#060a14;padding:16px;text-align:center;border-top:1px solid #1e293b;">
          <p style="margin:0;color:#475569;font-size:11px;">© 2026 SaveZonix Inc. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;

  const info = await transporter.sendMail({
    from: `"SaveZonix" <${process.env.SMTP_USER || 'noreply@savezonix.com'}>`,
    to: email,
    subject: subjects[type] || '🔐 SaveZonix — Verification Code',
    html: html
  });

  return info;
}

module.exports = { generateOtp, sendOtpEmail };
