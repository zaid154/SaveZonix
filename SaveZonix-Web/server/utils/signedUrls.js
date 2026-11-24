const crypto = require('crypto');

const STREAM_SECRET = process.env.STREAM_SECRET || process.env.JWT_SECRET || 'savezonix_stream_signing_secret_2026';

/**
 * Generate a signed URL token with an expiration timestamp (default: 15 minutes)
 */
function signStreamUrl(targetUrl, quality, expiryMinutes = 15) {
  const expiresAt = Date.now() + expiryMinutes * 60 * 1000;
  const payload = `${targetUrl}|${quality}|${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', STREAM_SECRET)
    .update(payload)
    .digest('hex');

  return {
    token: `${expiresAt}.${signature}`,
    expiresAt
  };
}

/**
 * Verify a signed stream token
 */
function verifyStreamToken(targetUrl, quality, token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Missing stream signature token' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed stream signature token' };
  }

  const [expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);

  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return { valid: false, error: 'Stream signature token has expired' };
  }

  const payload = `${targetUrl}|${quality}|${expiresAt}`;
  const expectedSig = crypto
    .createHmac('sha256', STREAM_SECRET)
    .update(payload)
    .digest('hex');

  try {
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSig, 'hex')
    );
    if (!isMatch) {
      return { valid: false, error: 'Invalid stream signature' };
    }
  } catch {
    return { valid: false, error: 'Invalid stream signature verification' };
  }

  return { valid: true, expiresAt };
}

module.exports = {
  signStreamUrl,
  verifyStreamToken
};
