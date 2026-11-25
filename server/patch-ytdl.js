const fs = require('fs');
const path = require('path');

function patchFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return false;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    for (const [target, replacement] of replacements) {
        if (content.includes(replacement)) continue;
        if (content.includes(target)) {
            content = content.replace(target, replacement);
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
    return changed;
}

try {
    const pkgEntry = require.resolve('@distube/ytdl-core/package.json', {
        paths: [__dirname, path.resolve(__dirname, '..'), process.cwd()]
    });
    const distDir = path.join(path.dirname(pkgEntry), 'dist');

    // 1. Allow slow 0.1 vCPU hosts (Render Free Tier) >10s to compile 3MB base.js in worker once
    const p1 = patchFile(path.join(distDir, 'solver', 'index.js'), [
        ['const CALL_DEADLINE_MS = 10_000;', 'const CALL_DEADLINE_MS = 45_000;']
    ]);

    // 2. Skip full-AST walk for ImportExpression unless source actually mentions import(
    const p2 = patchFile(path.join(distDir, 'solver', 'worker.js'), [
        ['if (hasDynamicImport(program))', 'if (source.includes("import(") && hasDynamicImport(program))']
    ]);

    // 3. When YOUTUBE_COOKIE is configured, attempt signed-in Mweb before anonymous to save datacenter roundtrips
    const p3 = patchFile(path.join(distDir, 'resolve.js'), [
        [
            'return account === "optional" && config.cookie ? [anonymous, { client, signedIn: true }] : [anonymous];',
            'return account === "optional" && config.cookie ? [{ client, signedIn: true }, anonymous] : [anonymous];'
        ]
    ]);

    if (p1 || p2 || p3) {
        console.log(`[patch-ytdl] Applied ytdl-core patches (solverDeadline=${p1}, workerAst=${p2}, signedInFirst=${p3})`);
    }
} catch (err) {
    console.warn('[patch-ytdl] Non-fatal notice:', err.message);
}
