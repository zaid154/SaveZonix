const fs = require('fs');
const path = require('path');

const adminPath = path.resolve(__dirname, '../server/routes/admin.js');
let code = fs.readFileSync(adminPath, 'utf8');

const targetStr = "'platformThreadCaps'";
const replacementStr = `'platformThreadCaps',
      'guestDailyLimit',
      'guestMaxQuality',
      'freeMaxQuality',
      'onQualityExceeded',
      'allowSignups',
      'allowPayments',
      'platformToggles',
      'blockedDomains',
      'turnstileSiteKey',
      'turnstileSecretKey',
      'stripePublishableKey',
      'stripeSecretKey'`;

if (code.includes(targetStr) && !code.includes("'guestMaxQuality'")) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync(adminPath, code, 'utf8');
  console.log('Successfully patched admin settings fields!');
} else {
  console.log('Fields already present or target not found.');
}
