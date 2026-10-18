import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const PUBLIC_FILES = Object.freeze([
  '404.html', '_headers', 'assets/app.css', 'en/index.html', 'index.html',
  'js/app.mjs', 'js/core/label-printer.mjs', 'js/messages.mjs', 'js/render.mjs', 'robots.txt',
]);
export const SOURCE_FILES = Object.freeze([
  '.gitattributes', '.gitignore', 'package.json', 'wrangler.jsonc',
  ...PUBLIC_FILES.map((file) => `public/${file}`),
  'scripts/build.mjs', 'scripts/check.mjs', 'scripts/contract.mjs', 'scripts/preview.mjs',
  'scripts/production.mjs', 'scripts/production-preview.mjs',
  'test/engineering.test.mjs', 'test/label-printer.test.mjs',
  'test/production.test.mjs',
].sort());
export const DOCUMENT_FILES = Object.freeze([
  'AGENTS.md','README.md','PRODUCT.md','TECHNICAL.md','UX-SEO.md','ACCEPTANCE.md','TASKS.md',
  'HANDOFF.md','START-HERE.md','TASK-ENTRY.md','project.json',
  'docs/BRAND.md','docs/DESIGN-SYSTEM.md','docs/ENGINEERING.md','docs/PRIVACY-SECURITY.md',
  'docs/RELEASE.md','docs/RELEASE-CANDIDATE.md','docs/GIT-PUBLICATION-SAFETY.md',
]);
export const HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=()',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
});
export const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
});
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function contained(base, relative) {
  if (typeof relative !== 'string' || /[\\:]/.test(relative) || relative.split('/').some((part) => !part || part === '..' || part === '.')) throw new Error('Unsafe relative path');
  const target = path.resolve(base, relative);
  if (!target.startsWith(path.resolve(base) + path.sep)) throw new Error('Path outside tool');
  return target;
}

/** Reject links before traversal; inspect only the explicit tool tree. */
export async function inspectTree(base, files, { requireAll = true, skipRoot = [] } = {}) {
  const allowed = new Set(files);
  const directories = new Set(files.flatMap((file) => {
    const parts = file.split('/');
    return parts.slice(0,-1).map((_, index) => parts.slice(0,index+1).join('/'));
  }));
  const found = [];
  const rootStat = await lstat(base);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Unsafe tree root');
  if (path.resolve(await realpath(base)).toLowerCase() !== path.resolve(base).toLowerCase()) throw new Error('Linked tree root');
  async function visit(directory, prefix = '') {
    for (const name of (await readdir(directory)).sort()) {
      if (!prefix && skipRoot.includes(name)) continue;
      const relative = prefix + name;
      const stat = await lstat(contained(base, relative));
      if (stat.isSymbolicLink()) throw new Error('Link rejected');
      if (stat.isDirectory()) {
        if (!directories.has(relative)) throw new Error('Unexpected directory');
        await visit(contained(base, relative), relative + '/');
      } else {
        if (!stat.isFile() || stat.nlink !== 1) throw new Error('Non-regular or hardlinked file');
        if (!allowed.has(relative)) throw new Error('Unexpected file');
        found.push(relative);
      }
    }
  }
  await visit(base);
  if (requireAll && found.length !== allowed.size) throw new Error('Missing allowlisted file');
  return found.sort();
}

export async function fileRecords(base, files) {
  const records = [];
  for (const file of [...files].sort()) {
    const bytes = await readFile(contained(base, file));
    records.push({ path: file, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return records;
}

export async function sourceManifest(root = ROOT) {
  await inspectTree(root, [...SOURCE_FILES, ...DOCUMENT_FILES], { skipRoot: ['.git', 'dist', 'dist-production', 'dist-production-manifest.json'] });
  return {
    schemaVersion: 1, mode: 'preview',
    sources: await fileRecords(root, SOURCE_FILES),
    files: await fileRecords(path.join(root, 'public'), PUBLIC_FILES),
  };
}

export async function verifyBuild(root = ROOT) {
  const dist = path.join(root, 'dist');
  await inspectTree(dist, [...PUBLIC_FILES, 'manifest.json']);
  const stored = await readFile(contained(dist, 'manifest.json'), 'utf8');
  const expected = await sourceManifest(root);
  if (stored !== JSON.stringify(expected, null, 2) + '\n') throw new Error('Stale source manifest; run build');
  if (JSON.stringify(await fileRecords(dist, PUBLIC_FILES)) !== JSON.stringify(expected.files)) throw new Error('Stale output; run build');
  return expected;
}
