import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { ROOT, PUBLIC_FILES, HEADERS, contained, inspectTree, sourceManifest, verifyBuild, fileRecords, sha256 } from './contract.mjs';
import { checkSource } from './check.mjs';

export const ORIGIN = 'https://labels.glossquote.com';
export const PRODUCTION_FILES = Object.freeze([...PUBLIC_FILES, '_redirects', 'sitemap.xml'].sort());
export const PRODUCTION_MANIFEST = 'dist-production-manifest.json';
export const REDIRECTS = Object.freeze({ '/': '/index.html', '/en/': '/en/index.html' });
export const WRANGLER = Object.freeze({
  name: 'glossquote-label-printer', compatibility_date: '2026-10-18', workers_dev: false,
  preview_urls: false, send_metrics: false,
  assets: { directory: './dist-production', html_handling: 'none', not_found_handling: '404-page' },
  routes: [{ pattern: 'labels.glossquote.com', custom_domain: true }],
  observability: { enabled: false, logs: { enabled: false, invocation_logs: false }, traces: { enabled: false } },
});
const LANGUAGES = Object.freeze([
  { lang: 'zh-Hant', file: 'index.html' }, { lang: 'en', file: 'en/index.html' },
]);
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + `  <url><loc>${ORIGIN}/index.html</loc></url>\n  <url><loc>${ORIGIN}/en/index.html</loc></url>\n</urlset>\n`;
const robots = `User-agent: *\nDisallow: /\nAllow: /index.html\nAllow: /en/index.html\nAllow: /assets/\nAllow: /js/\nSitemap: ${ORIGIN}/sitemap.xml\n`;
const htmlEscape = (text) => text.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export const scriptHash = (body) => 'sha256-' + createHash('sha256').update(body).digest('base64');
const cspFor = (body) => HEADERS['Content-Security-Policy'].replace("script-src 'self'",`script-src 'self' '${scriptHash(body)}'`);

export function validateWrangler(configuration) {
  if (!isDeepStrictEqual(configuration, WRANGLER)) throw new Error('Deployment configuration must match the reviewed static-assets-only contract');
}

/** Cloudflare _headers rules merge; only explicit ! removes inherited values. */
export function parseHeaderRules(text) {
  const rules = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      if (!/^\/(?:\*|[a-z/.-]+)$/.test(line)) throw new Error('Unsupported header route');
      rules.push({ path: line, operations: [] });
      continue;
    }
    if (!rules.length) throw new Error('Header operation without route');
    const remove = /^\s+! ([A-Za-z-]+)$/.exec(line);
    const add = /^\s+([A-Za-z-]+): (.+)$/.exec(line);
    if (!remove && !add) throw new Error('Invalid header operation');
    rules.at(-1).operations.push(remove ? { name: remove[1].toLowerCase(), remove: true } : { name: add[1].toLowerCase(), value: add[2] });
  }
  return rules;
}
export function mergedHeaders(rules, route) {
  const headers = {};
  for (const rule of rules) {
    const matches = rule.path.endsWith('*') ? (route || '/').startsWith(rule.path.slice(0,-1)) : route === rule.path;
    if (!matches) continue;
    for (const operation of rule.operations) {
      if (operation.remove) delete headers[operation.name];
      else headers[operation.name] = headers[operation.name] ? headers[operation.name] + ', ' + operation.value : operation.value;
    }
  }
  return headers;
}
export function robotsAllows(text, route) {
  const rules = [...text.matchAll(/^(Allow|Disallow): (.+)$/gm)]
    .map((m) => ({ prefix: m[2], allow: m[1] === 'Allow' }))
    .filter((rule) => route.startsWith(rule.prefix))
    .sort((a,b) => b.prefix.length-a.prefix.length || Number(b.allow)-Number(a.allow));
  return rules[0]?.allow ?? true;
}

function metadata(html, language) {
  const description = /<meta name="description" content="([^"]+)">/.exec(html)?.[1];
  const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
  const name = /<h1>([^<]+)<\/h1>/.exec(html)?.[1];
  const faqs = [...html.matchAll(/<details><summary>([^<]+)<\/summary><p>([^<]+)<\/p><\/details>/g)];
  if (!description || !title || !name || faqs.length !== 4) throw new Error('Visible metadata/FAQ source is incomplete');
  const canonical = `${ORIGIN}/${language.file}`;
  const structured = JSON.stringify({
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebApplication', '@id': canonical + '#app', name, url: canonical, description,
        inLanguage: language.lang, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript. Native printing depends on browser and device support.' },
      { '@type': 'FAQPage', '@id': canonical + '#faq', inLanguage: language.lang,
        mainEntity: faqs.map((match) => ({ '@type': 'Question', name: match[1], acceptedAnswer: { '@type': 'Answer', text: match[2] } })) },
    ],
  }).replaceAll('<','\\u003c');
  return { title, description, canonical, structured, csp: cspFor(structured) };
}

async function assemble(root) {
  validateWrangler(JSON.parse(await readFile(path.join(root,'wrangler.jsonc'),'utf8')));
  const source = await sourceManifest(root);
  const assets = new Map();
  for (const file of PUBLIC_FILES) assets.set(file,await readFile(contained(path.join(root,'public'),file)));
  let headerText = '/*\n' + Object.entries(HEADERS).map(([key,value])=>`  ${key}: ${value}`).join('\n') + '\n';
  for (const language of LANGUAGES) {
    let html = assets.get(language.file).toString();
    const meta = metadata(html,language);
    html = html.replace('content="noindex,nofollow"','content="index,follow"');
    html = html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]+">/,
      `<meta http-equiv="Content-Security-Policy" content="${meta.csp.replace("; frame-ancestors 'none'",'')}">`);
    const head = [
      `<link rel="canonical" href="${meta.canonical}">`,
      `<link rel="alternate" hreflang="zh-Hant" href="${ORIGIN}/index.html">`,
      `<link rel="alternate" hreflang="en" href="${ORIGIN}/en/index.html">`,
      `<link rel="alternate" hreflang="x-default" href="${ORIGIN}/index.html">`,
      `<meta property="og:title" content="${htmlEscape(meta.title)}">`,
      `<meta property="og:description" content="${htmlEscape(meta.description)}">`,
      `<meta property="og:url" content="${meta.canonical}">`,
      '<meta property="og:type" content="website">',
      `<script type="application/ld+json">${meta.structured}</script>`,
    ].join('\n  ');
    html = html.replace('</head>',`  ${head}\n</head>`);
    assets.set(language.file,Buffer.from(html));
    headerText += `/${language.file}\n  ! X-Robots-Tag\n  X-Robots-Tag: index, follow\n  ! Content-Security-Policy\n  Content-Security-Policy: ${meta.csp}\n`;
  }
  assets.set('_headers',Buffer.from(headerText));
  assets.set('_redirects',Buffer.from('/ /index.html 308\n/en/ /en/index.html 308\n'));
  assets.set('robots.txt',Buffer.from(robots));
  assets.set('sitemap.xml',Buffer.from(xml));
  const files = [...assets].sort(([a],[b])=>a.localeCompare(b,'en')).map(([file,bytes])=>({path:file,bytes:bytes.length,sha256:sha256(bytes)})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const manifest = { schemaVersion:1,mode:'production',origin:ORIGIN,sources:source.sources,files };
  return { assets, manifest };
}

export function validateProductionAssets(assets) {
  const rules = parseHeaderRules(assets.get('_headers').toString());
  const robotsText = assets.get('robots.txt').toString();
  const sitemap = assets.get('sitemap.xml').toString();
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m)=>m[1]);
  if (!isDeepStrictEqual(locations,[ORIGIN+'/index.html',ORIGIN+'/en/index.html'])) throw new Error('Sitemap must contain only the two canonicals');
  for (const language of LANGUAGES) {
    const html = assets.get(language.file).toString();
    const canonical = ORIGIN+'/'+language.file;
    if ((html.match(/rel="canonical"/g)??[]).length!==1 || !html.includes(`rel="canonical" href="${canonical}"`)) throw new Error('Canonical mismatch');
    for (const [lang,url] of [['zh-Hant','/index.html'],['en','/en/index.html'],['x-default','/index.html']]) {
      if (!html.includes(`hreflang="${lang}" href="${ORIGIN}${url}"`)) throw new Error('Hreflang mismatch');
    }
    if (!html.includes('name="robots" content="index,follow"') || !robotsAllows(robotsText,'/'+language.file)) throw new Error('Canonical is not indexable');
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (scripts.length!==1) throw new Error('Structured data count');
    const graph=JSON.parse(scripts[0][1])['@graph'];
    if (graph[0]['@type']!=='WebApplication' || graph[0].url!==canonical || graph[1]['@type']!=='FAQPage' || graph[1].mainEntity.length!==4) throw new Error('Structured data mismatch');
    const headers=mergedHeaders(rules,'/'+language.file);
    if (headers['x-robots-tag']!=='index, follow') throw new Error('Merged canonical robots header is not index-only');
    if (headers['content-security-policy']!==cspFor(scripts[0][1]) || !html.includes(scriptHash(scripts[0][1]))) throw new Error('Exact JSON-LD CSP hash mismatch');
  }
  for (const file of PRODUCTION_FILES.filter((file)=>/\.(?:mjs|css)$/.test(file))) {
    if (!robotsAllows(robotsText,'/'+file)) throw new Error('Required asset is robots-blocked');
  }
  for (const route of ['/404.html','/missing','/','/en/','/robots.txt','/sitemap.xml']) {
    if (mergedHeaders(rules,route)['x-robots-tag']!=='noindex, nofollow') throw new Error('Noncanonical robots policy');
  }
  if (!assets.get('404.html').toString().includes('noindex,nofollow') || assets.get('404.html').toString().includes('id="label-form"')) throw new Error('404 is a tool success page');
  return rules;
}

export async function buildProduction(root=ROOT) {
  await checkSource(root,{syntax:false});
  const {assets,manifest}=await assemble(root);
  validateProductionAssets(assets);
  const directory=path.join(root,'dist-production');
  try { await lstat(directory); await inspectTree(directory,PRODUCTION_FILES,{requireAll:false}); }
  catch(error) { if(error.code!=='ENOENT') throw error; }
  await mkdir(directory,{recursive:true});
  for (const [file,bytes] of assets) {
    const target=contained(directory,file);
    await mkdir(path.dirname(target),{recursive:true});
    await writeFile(target,bytes);
  }
  await checkManifestFile(root,true);
  await writeFile(contained(root,PRODUCTION_MANIFEST),JSON.stringify(manifest,null,2)+'\n');
  await checkProduction(root);
  return manifest;
}

export async function checkProduction(root=ROOT) {
  await checkSource(root,{syntax:false});
  const {assets,manifest}=await assemble(root);
  const directory=path.join(root,'dist-production');
  await inspectTree(directory,PRODUCTION_FILES);
  await checkManifestFile(root,false);
  if(await readFile(contained(root,PRODUCTION_MANIFEST),'utf8')!==JSON.stringify(manifest,null,2)+'\n') throw new Error('Stale production source manifest');
  if(!isDeepStrictEqual(await fileRecords(directory,PRODUCTION_FILES),manifest.files)) throw new Error('Stale production output');
  validateProductionAssets(assets);
  return manifest;
}

async function checkManifestFile(root,allowMissing) {
  try {
    const stat=await lstat(contained(root,PRODUCTION_MANIFEST));
    if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1) throw new Error('Unsafe external production manifest');
  } catch(error) { if(!allowMissing||error.code!=='ENOENT') throw error; }
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const flag=process.argv[2];
    if(process.argv.length!==3 || !['--build','--check','--release-check'].includes(flag)) throw new Error('Use --build, --check or --release-check');
    if(flag==='--build') await buildProduction();
    else {
      await checkProduction();
      if(flag==='--release-check') await verifyBuild();
    }
    console.log(`PASS ${flag}: production SEO/FAQ/hash-CSP, robots longest match, merged headers, static-only deployment config; no deployment performed`);
  } catch(error) { console.error(error.message); process.exitCode=1; }
}
