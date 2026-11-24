let upstashRedis = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    const { Redis } = require('@upstash/redis');
    upstashRedis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });
    console.log('[RateLimiter] 🚀 Upstash Redis connected for distributed rate limiting');
  } catch (err) {
    console.warn('[RateLimiter] Upstash Redis initialization warning:', err.message);
  }
}

// In-Memory sliding-window store fallback
const memoryStore = new Map();

// Periodic cleanup of stale in-memory entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (now > record.resetTime) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function createRateLimiter({ windowMs = 60 * 1000, max = 30, message = 'Too many requests, please try again later.' }) {
  return async function rateLimiterMiddleware(req, res, next) {
    const ip = (
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      '127.0.0.1'
    ).toString().split(',')[0].trim();

    const key = `ratelimit:${req.baseUrl || ''}:${req.path}:${ip}`;

    // 1. If Upstash Redis is configured
    if (upstashRedis) {
      try {
        const count = await upstashRedis.incr(key);
        if (count === 1) {
          await upstashRedis.expire(key, Math.ceil(windowMs / 1000));
        }

        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));

        if (count > max) {
          return res.status(429).json({
            success: false,
            code: 'RATE_LIMIT_EXCEEDED',
            message
          });
        }
        return next();
      } catch (redisErr) {
        console.warn('[RateLimiter] Redis error, falling back to memory:', redisErr.message);
      }
    }

    // 2. Fallback to in-memory sliding window
    const now = Date.now();
    let record = memoryStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      memoryStore.set(key, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message
      });
    }

    next();
  };
}

module.exports = {
  createRateLimiter,
  authLimiter: createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many authentication attempts. Please try again after 15 minutes.' }),
  downloadApiLimiter: createRateLimiter({ windowMs: 60 * 1000, max: 30, message: 'Too many download requests. Please pace your requests.' })
};
