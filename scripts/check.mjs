import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, PUBLIC_FILES, SOURCE_FILES, HEADERS, sourceManifest } from './contract.mjs';

export async function checkSource(root = ROOT, { syntax = true } = {}) {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node 24 or later required');
  const manifest = await sourceManifest(root);
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (pkg.type !== 'module' || pkg.engines?.node !== '>=24') throw new Error('ESM/Node contract');
  for (const key of ['dependencies','devDependencies','optionalDependencies','peerDependencies']) {
    if (pkg[key] && Object.keys(pkg[key]).length) throw new Error('External dependencies rejected');
  }
  const expectedScripts = {
    dev: 'node scripts/preview.mjs', test: 'node --test --test-concurrency=1', check: 'node scripts/check.mjs', build: 'node scripts/build.mjs',
    'build:production': 'node scripts/production.mjs --build', 'check:production': 'node scripts/production.mjs --check',
    'preview:production': 'node scripts/production-preview.mjs', 'release:check': 'node scripts/production.mjs --release-check',
  };
  if (Object.keys(pkg.scripts).sort().join(',') !== Object.keys(expectedScripts).sort().join(',')
    || Object.entries(expectedScripts).some(([key,value]) => pkg.scripts[key] !== value)) throw new Error('Unexpected scripts');
  const headerText = await readFile(path.join(root, 'public/_headers'), 'utf8');
  const expectedHeaderText = '/*\n' + Object.entries(HEADERS).map(([key,value]) => `  ${key}: ${value}`).join('\n') + '\n';
  if (headerText !== expectedHeaderText) throw new Error('Header contract drift');
  for (const [file,lang,home,title] of [
    ['index.html','zh-Hant','https://glossquote.com/index.html','物品標籤列印｜Gloss Tools by GlossQuote'],
    ['en/index.html','en','https://glossquote.com/en/index.html','Item Label Printer | Gloss Tools by GlossQuote'],
  ]) {
    const html = await readFile(path.join(root, 'public', file), 'utf8');
    for (const required of [`<html lang="${lang}">`, `<title>${title}</title>`, 'content="noindex,nofollow"', `href="${home}"`, '<textarea id="items"', 'value="1"', 'id="label-form" novalidate autocomplete="off"']) {
      if (!html.includes(required)) throw new Error('Bilingual HTML contract drift');
    }
    if (/<(?:input|textarea)\b[^>]*\bname\s*=/i.test(html) || /\bstyle\s*=|\bon\w+\s*=|rel="canonical"|sitemap|application\/ld\+json/i.test(html)) throw new Error('Unsafe or production HTML in preview');
    if (!/<textarea\b[^>]*><\/textarea>/.test(html)) throw new Error('Initial list must be blank');
    for (const tag of html.matchAll(/<(?:fieldset|button)\b[^>]*>/g)) if (!tag[0].includes('disabled')) throw new Error('Initially enabled work control');
    if ((html.match(/type="radio"/g) ?? []).length !== 4 || (html.match(/ checked/g) ?? []).length !== 1) throw new Error('Preset defaults');
    for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (script[2] || !script[1].includes('type="module" src="/js/app.mjs"')) throw new Error('Unexpected executable HTML');
    }
  }
  const runtime = (await Promise.all(PUBLIC_FILES.filter((file) => file.endsWith('.mjs')).map((file) => readFile(path.join(root,'public',file),'utf8')))).join('\n');
  if (/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|eval|Function)\s*\(|\b(?:localStorage|sessionStorage|indexedDB|caches|serviceWorker)\b|sendBeacon|document\.cookie|\bconsole\s*\.|\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|\.style\b|setAttribute\(['"]style|createObjectURL|navigator\.clipboard/.test(runtime)) throw new Error('Forbidden browser API');
  if ((runtime.match(/window\.print\(\)/g) ?? []).length !== 1) throw new Error('Print gesture boundary');
  if (syntax) {
    for (const file of SOURCE_FILES.filter((file) => file.endsWith('.mjs'))) {
      const result = spawnSync(process.execPath, ['--check', path.join(root,file)], { encoding: 'utf8', windowsHide: true });
      if (result.status !== 0) throw new Error(`Module syntax check failed: ${file}`);
    }
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const manifest = await checkSource();
    console.log(`PASS check: ${manifest.sources.length} allowlisted source files; bilingual preview, privacy and syntax contracts`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
