const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50).optional(),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

const planCreateOrUpdateSchema = z.object({
  name: z.string().min(2).max(40),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  priceINR: z.number().min(0),
  priceUSD: z.number().min(0).optional(),
  billingPeriod: z.enum(['monthly', 'yearly', 'lifetime']).default('monthly'),
  dailyDownloadLimit: z.number().int().min(-1),
  monthlyDownloadLimit: z.number().int().min(-1),
  maxVideoQuality: z.enum(['360p', '480p', '720p', '1080p', '1440p', '4K']),
  maxAudioQuality: z.union([z.literal(128), z.literal(192), z.literal(320)]).default(128),
  allowedFormats: z.array(z.string()).default(['mp4', 'mp3']),
  playlistDownload: z.boolean().default(false),
  maxPlaylistItems: z.number().int().min(0).default(0),
  concurrentDownloads: z.number().int().min(1).default(1),
  maxFileSizeMB: z.number().int().min(50).default(500),
  speedPriority: z.enum(['standard', 'high', 'ultra']).default('standard'),
  ads: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  sortOrder: z.number().int().default(0)
});

const couponSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9_-]+$/, 'Coupon code must be uppercase alphanumeric'),
  discountType: z.enum(['percentage', 'fixed']).default('percentage'),
  discountValue: z.number().positive('Discount value must be greater than zero'),
  maxUses: z.number().int().positive().default(100),
  expiresAt: z.string().datetime().optional().nullable()
});

function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: err.errors[0]?.message || 'Invalid input data',
          errors: err.errors
        });
      }
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
  };
}

module.exports = {
  validateBody,
  registerSchema,
  loginSchema,
  planCreateOrUpdateSchema,
  couponSchema
};
