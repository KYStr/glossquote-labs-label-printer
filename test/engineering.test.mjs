import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, copyFile, link, symlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createServer, request } from 'node:http';
import { ROOT, SOURCE_FILES, DOCUMENT_FILES, PUBLIC_FILES, HEADERS, inspectTree, contained, sourceManifest, verifyBuild, sha256 } from '../scripts/contract.mjs';
import { checkSource } from '../scripts/check.mjs';
import { build } from '../scripts/build.mjs';
import { createHandler } from '../scripts/preview.mjs';
import { messages, errorMessage } from '../public/js/messages.mjs';

async function fixture(work) {
  const directory = await mkdtemp(path.join(ROOT, 'test', '.scratch-'));
  try { await work(directory); } finally {
    const resolved = await realpath(directory);
    const prefix = path.resolve(ROOT,'test') + path.sep + '.scratch-';
    if (!resolved.startsWith(prefix) || !path.resolve(directory).startsWith(prefix)) throw new Error('Unsafe fixture cleanup');
    await rm(directory, { recursive: true });
  }
}
async function copyTool(directory) {
  for (const file of [...SOURCE_FILES,...DOCUMENT_FILES]) {
    const target = contained(directory,file);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(contained(ROOT,file),target);
  }
}
const css = await readFile(path.join(ROOT,'public/assets/app.css'),'utf8');

test('engineering: source allowlist, bilingual HTML, safe defaults, privacy and headers', async () => {
  const manifest = await checkSource(ROOT, { syntax: false });
  assert.equal(manifest.sources.length, 23);
  assert.equal(manifest.files.length, 10);
});

test('C24: CSS geometry agrees with all four independently hand-calculated cell dimensions', () => {
  const sheet = /\.label-sheet \{([^}]+)\}/.exec(css)[1];
  const letter = /\.preset--letter-2x7, \.preset--letter-3x8 \{([^}]+)\}/.exec(css)[1];
  const measurement = (text,name) => Number(new RegExp(`${name}: ([0-9.]+)mm`).exec(text)[1]);
  assert.equal(measurement(sheet,'width'),210);
  assert.equal(measurement(sheet,'height'),297);
  assert.equal(measurement(sheet,'padding'),10);
  assert.equal(measurement(letter,'width'),215.9);
  assert.equal(measurement(letter,'height'),279.4);
  const gap = measurement(/\.label-grid \{([^}]+)\}/.exec(css)[1],'gap');
  assert.equal(gap,2);
  for (const [id,w,h,cols,rows,cellW,cellH] of [
    ['a4-2x7',210,297,2,7,94,265/7],
    ['a4-3x8',210,297,3,8,62,32.875],
    ['letter-2x7',215.9,279.4,2,7,96.95,247.4/7],
    ['letter-3x8',215.9,279.4,3,8,191.9/3,30.675],
  ]) {
    const grid = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
      .find((match) => match[1].split(',').map((selector) => selector.trim()).includes(`.preset--${id} .label-grid`))[2];
    const actualCols = Number(/grid-template-columns: repeat\((\d+)/.exec(grid)[1]);
    const actualRows = Number(/grid-template-rows: repeat\((\d+)/.exec(grid)[1]);
    assert.equal(actualCols, cols);
    assert.equal(actualRows, rows);
    assert.ok(Math.abs((w-20-(actualCols-1)*gap)/actualCols-cellW) < 1e-10);
    assert.ok(Math.abs((h-20-(actualRows-1)*gap)/actualRows-cellH) < 1e-10);
    assert.ok(css.includes(`@page labels-${id} { size: ${id.startsWith('a4')?'A4':'Letter'} portrait; margin: 10mm; }`));
    assert.ok(css.includes(`.preset--${id} { page: labels-${id};`));
  }
});

test('print CSS isolates the pages and removes screen padding to preserve 10 mm page margins', () => {
  const print = css.slice(css.indexOf('@media print'));
  for (const selector of ['.topbar','.introduction','form','.data-note','footer','.faq','dialog','.preview-heading','.page-caption','.print-help']) assert.ok(print.includes(selector));
  assert.match(print, /\.label-sheet \{ margin: 0; padding: 0; width: 190mm; height: 277mm;/);
  assert.match(print, /width: 195\.9mm; height: 259\.4mm;/);
  assert.match(print, /\.page-preview:last-child \.label-sheet \{ break-after: auto;/);
  assert.match(print, /\.page-preview \+ \.page-preview \{ margin-top: 0; \}/);
  assert.match(css, /\.paper-viewport \{[^}]*overflow: auto;/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('error messages stay localized, use 1-based line numbers and never interpolate raw names', () => {
  assert.equal(errorMessage(messages.en, { code: 'item_too_long', field: 'itemsRaw.lines[3]' }), 'Line 4 is longer than 80 Unicode code points.');
  assert.equal(errorMessage(messages['zh-Hant'], { code: 'item_control_character', field: 'itemsRaw.lines[1]' }), '第 2 行含不支援的控制或行分隔字元。');
  assert.equal(errorMessage(messages.en, { code: 'no_items', field: 'itemsRaw' }), 'Enter at least one item name.');
  assert.deepEqual(Object.keys(messages.en.errors).sort(), Object.keys(messages['zh-Hant'].errors).sort());
  assert.equal(Object.keys(messages.en.errors).length, 11);
});

test('static fail-closed initialization and print gesture boundaries', async () => {
  const app = await readFile(path.join(ROOT,'public/js/app.mjs'),'utf8');
  assert.ok(app.indexOf("event.preventDefault();") < app.indexOf('function initialize()'));
  assert.ok(app.indexOf("form.addEventListener('submit'") < app.indexOf("control.disabled = false"));
  assert.ok(app.includes("window.addEventListener('pagehide', reset)"));
  assert.ok(app.includes('if (event.persisted) reset()'));
  assert.ok(app.includes('current.revision !== revision'));
  assert.ok(app.includes('current.generation !== generation'));
  assert.match(app, /printButton\.addEventListener\('click',[\s\S]*?window\.print\(\)/);
  assert.ok(app.includes("const languageTarget = document.documentElement.lang === 'en' ? '/index.html' : '/en/index.html'"));
});

test('preview robots longest-prefix rules allow all required JS/CSS assets', async () => {
  const robots = await readFile(path.join(ROOT,'public/robots.txt'),'utf8');
  const rules = [...robots.matchAll(/^(Allow|Disallow): (.+)$/gm)].map((m) => ({ allow: m[1] === 'Allow', prefix: m[2] }));
  const allowed = (url) => rules.filter((rule) => url.startsWith(rule.prefix)).sort((a,b) => b.prefix.length-a.prefix.length || Number(b.allow)-Number(a.allow))[0]?.allow ?? true;
  assert.equal(allowed('/index.html'), false);
  assert.equal(allowed('/en/index.html'), false);
  for (const file of PUBLIC_FILES.filter((file) => /\.(css|mjs)$/.test(file))) assert.equal(allowed('/'+file), true);
});

test('relative path containment rejects traversal and platform path injection', () => {
  for (const file of ['../x','/x','a/../x','a/./x','a//x','a\\x','C:/x','']) assert.throws(() => contained(ROOT,file));
});

test('tree allowlist rejects unknown file, missing file, and unknown directory', async () => fixture(async (directory) => {
  await writeFile(path.join(directory,'safe.txt'),'safe');
  assert.deepEqual(await inspectTree(directory,['safe.txt']),['safe.txt']);
  await assert.rejects(inspectTree(directory,['safe.txt','missing.txt']),/Missing/);
  await writeFile(path.join(directory,'extra.txt'),'extra');
  await assert.rejects(inspectTree(directory,['safe.txt']),/Unexpected file/);
  await mkdir(path.join(directory,'unexpected'));
  await assert.rejects(inspectTree(directory,['safe.txt','extra.txt']),/Unexpected directory/);
}));

test('hardlinked source is rejected', async () => fixture(async (directory) => {
  await writeFile(path.join(directory,'source.txt'),'safe');
  await link(path.join(directory,'source.txt'),path.join(directory,'linked.txt'));
  await assert.rejects(inspectTree(directory,['source.txt','linked.txt']),/hardlinked/);
}));

test('symlink or Windows junction is rejected before traversal', async () => fixture(async (directory) => {
  await mkdir(path.join(directory,'target'));
  await writeFile(path.join(directory,'target/safe.txt'),'safe');
  await symlink(path.join(directory,'target'),path.join(directory,'linked'),process.platform === 'win32'?'junction':'dir');
  await assert.rejects(inspectTree(directory,['target/safe.txt','linked/safe.txt']),/Link rejected/);
}));

test('deterministic build, exact manifest, stale source/output and unexpected output rejection', async () => fixture(async (directory) => {
  await copyTool(directory);
  const first = await build(directory);
  const firstText = await readFile(path.join(directory,'dist/manifest.json'),'utf8');
  const second = await build(directory);
  assert.deepEqual(first,second);
  assert.equal(await readFile(path.join(directory,'dist/manifest.json'),'utf8'),firstText);
  assert.equal(first.files.some((file) => file.path === 'manifest.json'),false);
  for (const record of first.files) {
    const bytes = await readFile(path.join(directory,'dist',record.path));
    assert.equal(bytes.length,record.bytes);
    assert.equal(sha256(bytes),record.sha256);
  }
  await writeFile(path.join(directory,'dist/robots.txt'),'stale');
  await assert.rejects(verifyBuild(directory),/Stale output/);
  await build(directory);
  await writeFile(path.join(directory,'public/robots.txt'),'changed');
  await assert.rejects(verifyBuild(directory),/Stale source/);
  await writeFile(path.join(directory,'dist/unknown.txt'),'unknown');
  await assert.rejects(build(directory),/Unexpected file/);
}));

function http(port, route, method = 'GET', headers = {}) {
  return new Promise((resolve,reject) => {
    const req = request({ host: '127.0.0.1', port, path: route, method, headers },(response) => {
      const chunks = [];
      response.on('data',(chunk) => chunks.push(chunk));
      response.on('end',() => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error',reject);
    req.end();
  });
}

test('real loopback HTTP: both languages, MIME, headers, HEAD, 404, 405 and route containment', async () => {
  const assets = new Map();
  for (const file of PUBLIC_FILES) assets.set(file,await readFile(path.join(ROOT,'public',file)));
  const server = createServer(createHandler(assets));
  await new Promise((resolve) => server.listen(0,'127.0.0.1',resolve));
  const {port,address} = server.address();
  assert.equal(address,'127.0.0.1');
  try {
    for (const [url,token] of [['/','lang="zh-Hant"'],['/index.html','物品標籤列印'],['/en/','lang="en"'],['/en/index.html','Item Label Printer']]) {
      const response = await http(port,url);
      assert.equal(response.status,200);
      assert.ok(response.body.includes(token));
      assert.equal(response.headers['content-type'],'text/html; charset=utf-8');
      for (const [key,value] of Object.entries(HEADERS)) assert.equal(response.headers[key.toLowerCase()],value);
    }
    for (const [url,type] of [['/assets/app.css','text/css; charset=utf-8'],['/js/app.mjs','text/javascript; charset=utf-8'],['/js/core/label-printer.mjs','text/javascript; charset=utf-8'],['/robots.txt','text/plain; charset=utf-8']]) {
      const response = await http(port,url);
      assert.equal(response.status,200);
      assert.equal(response.headers['content-type'],type);
      assert.ok(response.body.length > 20);
    }
    const head = await http(port,'/index.html','HEAD');
    assert.equal(head.status,200);
    assert.equal(head.body,'');
    assert.equal(Number(head.headers['content-length']),assets.get('index.html').length);
    for (const url of ['/missing','/package.json','/manifest.json','/_headers','/en/missing.html','/sitemap.xml']) {
      const response = await http(port,url);
      assert.equal(response.status,404);
      assert.ok(response.body.includes('Page not found'));
      assert.equal(response.body.includes('id="label-form"'),false);
    }
    for (const url of ['/../package.json','/%2e%2e/package.json','/%252e%252e/package.json','/%5csecret','/index.html?items=FAKE_PRIVATE_CANARY','/%00','/%ZZ','//host/../x']) assert.equal((await http(port,url)).status,400);
    for (const method of ['POST','PUT','DELETE','OPTIONS']) {
      const response = await http(port,'/index.html',method);
      assert.equal(response.status,405);
      assert.equal(response.headers.allow,'GET, HEAD');
    }
    assert.equal((await http(port,'/index.html','GET',{'Content-Length':'1'})).status,400);
    assert.equal((await http(port,'/'+'x'.repeat(2048))).status,414);
  } finally { await new Promise((resolve,reject) => server.close((error) => error?reject(error):resolve())); }
});
