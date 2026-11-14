const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

const ROOT_DIR = path.resolve(__dirname, '..');
const EXT_SRC = path.join(ROOT_DIR, 'extension');
const EXT_DIST = path.join(ROOT_DIR, 'build_extension');
const OUT_ZIP_1 = path.join(ROOT_DIR, 'client', 'public', 'SaveZonix-Extension.zip');
const OUT_ZIP_2 = path.join(ROOT_DIR, 'SaveZonix-Web', 'client', 'public', 'SaveZonix-Extension.zip');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.name === '.git' || entry.name === 'node_modules') continue;

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function obfuscateJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      obfuscateJsFiles(fullPath);
    } else if (entry.name.endsWith('.js')) {
      const originalCode = fs.readFileSync(fullPath, 'utf8');

      try {
        // Step 1: Minify & Mangle via esbuild
        const minified = esbuild.transformSync(originalCode, {
          minify: true,
          target: 'chrome110',
          legalComments: 'none'
        });

        // Step 2: Add Anti-Tamper Obfuscation Header
        const timestamp = Date.now();
        const hexSig = Buffer.from(`SaveZonixShield_${timestamp}`).toString('hex');
        
        const protectedCode = `/** [SaveZonix Shield Protocol 0x${hexSig}] - Protected binary. Unauthorized reverse engineering prohibited. **/\n${minified.code}`;

        fs.writeFileSync(fullPath, protectedCode, 'utf8');
        console.log(`  ✓ Protected & Obfuscated: ${entry.name} (${originalCode.length}B -> ${protectedCode.length}B)`);
      } catch (err) {
        console.error(`  x Failed to obfuscate ${entry.name}:`, err.message);
      }
    }
  }
}

async function build() {
  console.log('[1/4] Preparing clean build directory...');
  if (fs.existsSync(EXT_DIST)) {
    fs.rmSync(EXT_DIST, { recursive: true, force: true });
  }

  console.log('[2/4] Copying extension source assets...');
  copyDirRecursive(EXT_SRC, EXT_DIST);

  console.log('[3/4] Scrambling & obfuscating all JavaScript components...');
  obfuscateJsFiles(EXT_DIST);

  console.log('[4/4] Compressing into SaveZonix-Extension.zip...');
  // Ensure destination folders exist
  fs.mkdirSync(path.dirname(OUT_ZIP_1), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_ZIP_2), { recursive: true });

  const psCmd = `Compress-Archive -Path '${EXT_DIST}/*' -DestinationPath '${OUT_ZIP_1}' -Force`;
  execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'inherit' });

  // Copy to SaveZonix-Web
  fs.copyFileSync(OUT_ZIP_1, OUT_ZIP_2);

  // Clean up build directory
  fs.rmSync(EXT_DIST, { recursive: true, force: true });

  const stats = fs.statSync(OUT_ZIP_1);
  console.log(`\n🎉 SUCCESS! Protected Extension Zip Created: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`   -> ${OUT_ZIP_1}`);
  console.log(`   -> ${OUT_ZIP_2}`);
}

build().catch(err => {
  console.error('Build Error:', err);
  process.exit(1);
});
