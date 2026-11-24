/**
 * SaveZonix Enterprise Authentication, Plans, Limits & Security Test Suite
 */
const assert = require('assert');
const { signStreamUrl, verifyStreamToken } = require('./utils/signedUrls');
const { getMidnightIST, getNextMidnightIST } = require('./middleware/enforceDownloadLimits');
const { planCreateOrUpdateSchema, couponSchema } = require('./middleware/validate');
const { defaultPlans } = require('./seeds/seedDefaultPlans');

console.log('🧪 Starting SaveZonix Test Suite...\n');

// ─────────────────────────────────────────────────────────────
// 1. Signed Stream URL Test
// ─────────────────────────────────────────────────────────────
console.log('Test 1: Signed Stream URL Token Generation & Verification');
const targetUrl = 'https://rr2---sn-xxxx.googlevideo.com/videoplayback?expire=123';
const quality = '1080p';
const { token } = signStreamUrl(targetUrl, quality, 15);
assert(token && token.includes('.'), 'Token must be generated and contain separator');

const validCheck = verifyStreamToken(targetUrl, quality, token);
assert(validCheck.valid === true, 'Token must be valid for matching url and quality');

const invalidUrlCheck = verifyStreamToken('https://tampered.com', quality, token);
assert(invalidUrlCheck.valid === false, 'Tampered URL must fail signature verification');

const invalidQualityCheck = verifyStreamToken(targetUrl, '4K', token);
assert(invalidQualityCheck.valid === false, 'Tampered quality must fail signature verification');

const malformedCheck = verifyStreamToken(targetUrl, quality, 'invalid.token.123');
assert(malformedCheck.valid === false, 'Malformed token must fail signature verification');
console.log('  ✓ Signed URLs correctly prevent tampering and plan bypass.\n');

// ─────────────────────────────────────────────────────────────
// 2. Midnight IST Calculation
// ─────────────────────────────────────────────────────────────
console.log('Test 2: Indian Standard Time (IST, UTC+5:30) Midnight Calculation');
const midnightIST = getMidnightIST();
const nextMidnightIST = getNextMidnightIST();
assert(midnightIST instanceof Date, 'Midnight IST must be a Date object');
assert(nextMidnightIST > midnightIST, 'Next midnight must be strictly greater than today midnight');
assert(nextMidnightIST.getTime() - midnightIST.getTime() === 24 * 60 * 60 * 1000, 'Difference must be exactly 24 hours');
console.log(`  ✓ Midnight IST: ${midnightIST.toISOString()}`);
console.log(`  ✓ Resets At: ${nextMidnightIST.toISOString()}\n`);

// ─────────────────────────────────────────────────────────────
// 3. Default Plans Integrity Test
// ─────────────────────────────────────────────────────────────
console.log('Test 3: Default Plans Integrity & Quota Hierarchy');
assert(Array.isArray(defaultPlans) && defaultPlans.length === 4, 'Must have exactly 4 default plans');

const slugs = defaultPlans.map(p => p.slug);
assert(slugs.includes('free'), 'Must include free plan');
assert(slugs.includes('basic'), 'Must include basic plan');
assert(slugs.includes('pro'), 'Must include pro plan');
assert(slugs.includes('ultimate'), 'Must include ultimate plan');

const freePlan = defaultPlans.find(p => p.slug === 'free');
const proPlan = defaultPlans.find(p => p.slug === 'pro');
const ultimatePlan = defaultPlans.find(p => p.slug === 'ultimate');

assert(freePlan.dailyDownloadLimit === 3, 'Free plan daily limit must be 3');
assert(freePlan.maxVideoQuality === '720p', 'Free plan max quality must be 720p');
assert(proPlan.maxVideoQuality === '4K', 'Pro plan max quality must be 4K');
assert(ultimatePlan.dailyDownloadLimit === -1, 'Ultimate plan daily limit must be unlimited (-1)');
console.log('  ✓ Plans correctly reflect hierarchy: Free (720p) -> Pro (4K) -> Ultimate (Unlimited).\n');

// ─────────────────────────────────────────────────────────────
// 4. Input Validation (Zod Schemas)
// ─────────────────────────────────────────────────────────────
console.log('Test 4: Zod Input Validation for Plans & Coupons');

const validPlan = planCreateOrUpdateSchema.safeParse({
  name: 'Studio Master',
  slug: 'studio-master',
  priceINR: 499,
  billingPeriod: 'monthly',
  dailyDownloadLimit: 200,
  monthlyDownloadLimit: 5000,
  maxVideoQuality: '4K',
  maxAudioQuality: 320,
  allowedFormats: ['mp4', 'webm', 'mp3', 'm4a'],
  playlistDownload: true,
  maxPlaylistItems: 100,
  concurrentDownloads: 5,
  maxFileSizeMB: 20480,
  speedPriority: 'ultra',
  ads: false,
  isActive: true,
  isPopular: false,
  sortOrder: 5
});
assert(validPlan.success === true, 'Valid plan schema must pass');

const invalidPlan = planCreateOrUpdateSchema.safeParse({
  name: 'Bad Plan',
  slug: 'Bad Slug With Spaces',
  priceINR: -10, // negative price
  maxVideoQuality: '8K' // not in enum
});
assert(invalidPlan.success === false, 'Invalid plan parameters must be rejected');

const validCoupon = couponSchema.safeParse({
  code: 'SAVE50',
  discountType: 'percentage',
  discountValue: 50,
  maxUses: 500
});
assert(validCoupon.success === true, 'Valid coupon schema must pass');

const invalidCoupon = couponSchema.safeParse({
  code: 'invalid code lowercase',
  discountValue: -5
});
assert(invalidCoupon.success === false, 'Invalid coupon must be rejected');
console.log('  ✓ Zod schemas correctly sanitize and enforce plan and coupon data.\n');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 100% verification complete.');
