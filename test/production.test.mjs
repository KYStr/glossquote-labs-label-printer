import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, copyFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { request } from 'node:http';
import { createHash } from 'node:crypto';
import { ROOT, SOURCE_FILES, DOCUMENT_FILES, PUBLIC_FILES, contained } from '../scripts/contract.mjs';
import { build } from '../scripts/build.mjs';
import { buildProduction, checkProduction, validateProductionAssets, validateWrangler, ORIGIN, WRANGLER, PRODUCTION_FILES, parseHeaderRules, mergedHeaders, robotsAllows } from '../scripts/production.mjs';
import { startProductionPreview } from '../scripts/production-preview.mjs';

async function fixture(work) {
  const directory=await mkdtemp(path.join(ROOT,'test','.scratch-'));
  try {
    for(const file of [...SOURCE_FILES,...DOCUMENT_FILES]) {
      const target=contained(directory,file);
      await mkdir(path.dirname(target),{recursive:true});
      await copyFile(contained(ROOT,file),target);
    }
    await work(directory);
  } finally {
    const prefix=path.resolve(ROOT,'test')+path.sep+'.scratch-';
    if(!path.resolve(directory).startsWith(prefix)||!(await realpath(directory)).startsWith(prefix)) throw new Error('Unsafe test fixture cleanup');
    await rm(directory,{recursive:true});
  }
}
async function assetsAt(directory) {
  const assets=new Map();
  for(const file of PRODUCTION_FILES) assets.set(file,await readFile(path.join(directory,'dist-production',file)));
  return assets;
}
async function scenario(work) { await fixture(async(directory)=>{await buildProduction(directory);await work(directory,await assetsAt(directory));}); }
const text=(assets,file)=>assets.get(file).toString();

test('production config is pure JSON and exactly the reviewed free static-assets-only contract',async()=>{
  const actual=JSON.parse(await readFile(path.join(ROOT,'wrangler.jsonc'),'utf8'));
  validateWrangler(actual);
  assert.deepEqual(actual,{
    name:'glossquote-label-printer',compatibility_date:'2026-10-18',workers_dev:false,preview_urls:false,send_metrics:false,
    assets:{directory:'./dist-production',html_handling:'none',not_found_handling:'404-page'},
    routes:[{pattern:'labels.glossquote.com',custom_domain:true}],
    observability:{enabled:false,logs:{enabled:false,invocation_logs:false},traces:{enabled:false}},
  });
});
test('production config rejects extra bindings, telemetry and any unreviewed authority',()=>{
  for(const change of [{workers_dev:true},{send_metrics:true},{main:'worker.mjs'},{kv_namespaces:[]},{routes:[]},{compatibility_date:'2026-10-19'}]) {
    assert.throws(()=>validateWrangler({...structuredClone(WRANGLER),...change}),/reviewed static-assets-only/);
  }
});
test('production build leaves every preview source and preview output byte-for-byte unchanged',async()=>fixture(async(directory)=>{
  await build(directory);
  const before=new Map();
  for(const file of [...PUBLIC_FILES.map(f=>'public/'+f),...PUBLIC_FILES.map(f=>'dist/'+f),'dist/manifest.json']) before.set(file,await readFile(path.join(directory,file)));
  await buildProduction(directory);
  for(const [file,bytes] of before) assert.deepEqual(await readFile(path.join(directory,file)),bytes,file);
}));
test('production has exact bilingual self-canonicals, reciprocal hreflang and x-default',async()=>scenario(async(_,assets)=>{
  assert.equal(ORIGIN,'https://labels.glossquote.com');
  for(const [file,lang] of [['index.html','zh-Hant'],['en/index.html','en']]) {
    const html=text(assets,file);
    assert.ok(html.includes(`<html lang="${lang}">`));
    assert.deepEqual([...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map(m=>m[1]),['https://labels.glossquote.com/'+file]);
    assert.deepEqual([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m=>[m[1],m[2]]),[
      ['zh-Hant','https://labels.glossquote.com/index.html'],['en','https://labels.glossquote.com/en/index.html'],['x-default','https://labels.glossquote.com/index.html'],
    ]);
    assert.match(html,/name="robots" content="index,follow"/);
  }
}));
test('production OG title/description match visible metadata, both languages',async()=>scenario(async(_,assets)=>{
  for(const file of ['index.html','en/index.html']) {
    const html=text(assets,file);
    const title=/<title>([^<]+)<\/title>/.exec(html)[1];
    const description=/<meta name="description" content="([^"]+)">/.exec(html)[1];
    assert.ok(html.includes(`property="og:title" content="${title}"`));
    assert.ok(html.includes(`property="og:description" content="${description}"`));
    assert.ok(html.includes(`property="og:url" content="https://labels.glossquote.com/${file}"`));
    assert.match(html,/property="og:type" content="website"/);
  }
}));
test('production WebApplication and FAQPage reflect exact visible names, questions and answers',async()=>scenario(async(_,assets)=>{
  for(const file of ['index.html','en/index.html']) {
    const html=text(assets,file);
    const graph=JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1])['@graph'];
    assert.equal(graph[0]['@type'],'WebApplication');
    assert.equal(graph[0].name,/<h1>([^<]+)<\/h1>/.exec(html)[1]);
    assert.equal(graph[0].url,'https://labels.glossquote.com/'+file);
    assert.equal(graph[0].applicationCategory,'UtilitiesApplication');
    assert.equal(graph[1]['@type'],'FAQPage');
    assert.deepEqual(graph[1].mainEntity.map(q=>[q.name,q.acceptedAnswer.text]),[...html.matchAll(/<details><summary>([^<]+)<\/summary><p>([^<]+)<\/p><\/details>/g)].map(m=>[m[1],m[2]]));
    assert.equal(graph[1].mainEntity.length,4);
    assert.equal(JSON.stringify(graph).includes('aggregateRating'),false);
  }
}));
test('production CSP uses the exact JSON-LD bytes hash with no unsafe-inline/eval',async()=>scenario(async(_,assets)=>{
  const rules=parseHeaderRules(text(assets,'_headers'));
  for(const file of ['index.html','en/index.html']) {
    const html=text(assets,file);
    const body=/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];
    const hash='sha256-'+createHash('sha256').update(body).digest('base64');
    const csp=mergedHeaders(rules,'/'+file)['content-security-policy'];
    assert.ok(csp.includes(`script-src 'self' '${hash}';`));
    assert.equal((csp.match(/sha256-/g)??[]).length,1);
    assert.equal(/unsafe-inline|unsafe-eval/.test(csp),false);
    for(const directive of ["connect-src 'none'","object-src 'none'","base-uri 'none'","frame-ancestors 'none'","form-action 'none'"]) assert.ok(csp.includes(directive));
    assert.ok(html.includes(hash));
  }
}));
test('header model merges repeated values and only ! removes inheritance',()=>{
  const merged=mergedHeaders(parseHeaderRules('/*\n  X-Robots-Tag: noindex\n/index.html\n  X-Robots-Tag: index\n'),'/index.html');
  assert.equal(merged['x-robots-tag'],'noindex, index');
  const replaced=mergedHeaders(parseHeaderRules('/*\n  X-Robots-Tag: noindex\n/index.html\n  ! X-Robots-Tag\n  X-Robots-Tag: index\n'),'/index.html');
  assert.equal(replaced['x-robots-tag'],'index');
});
test('production gate rejects missing inherited-header removals and altered structured data',async()=>scenario(async(_,assets)=>{
  const bad=new Map(assets);
  bad.set('_headers',Buffer.from(text(assets,'_headers').replaceAll('  ! X-Robots-Tag\n','')));
  assert.throws(()=>validateProductionAssets(bad),/robots header/);
  const tampered=new Map(assets);
  tampered.set('en/index.html',Buffer.from(text(assets,'en/index.html').replace('Requires JavaScript.','Needs JavaScript.')));
  assert.throws(()=>validateProductionAssets(tampered),/CSP hash/);
}));
test('robots longest match permits every required asset and canonical, not arbitrary pages',async()=>scenario(async(_,assets)=>{
  const robots=text(assets,'robots.txt');
  for(const route of ['/index.html','/en/index.html','/assets/app.css','/js/app.mjs','/js/messages.mjs','/js/render.mjs','/js/core/label-printer.mjs']) assert.equal(robotsAllows(robots,route),true,route);
  for(const route of ['/','/private','/404.html','/en/']) assert.equal(robotsAllows(robots,route),false,route);
  assert.equal(robotsAllows('Disallow: /js/\nAllow: /js/core/\n','/js/core/label-printer.mjs'),true);
  assert.equal(robotsAllows('Disallow: /js/\nAllow: /js/\n','/js/app.mjs'),true);
  const bad=new Map(assets);
  bad.set('robots.txt',Buffer.from(robots.replace('Allow: /js/\n','')));
  assert.throws(()=>validateProductionAssets(bad),/robots-blocked/);
}));
test('sitemap contains exactly the two canonical pages and rejects extra URLs',async()=>scenario(async(_,assets)=>{
  assert.deepEqual([...text(assets,'sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]),['https://labels.glossquote.com/index.html','https://labels.glossquote.com/en/index.html']);
  const bad=new Map(assets);
  bad.set('sitemap.xml',Buffer.from(text(assets,'sitemap.xml').replace('</urlset>','<url><loc>https://labels.glossquote.com/404.html</loc></url></urlset>')));
  assert.throws(()=>validateProductionAssets(bad),/Sitemap/);
}));
test('production transforms head metadata only; UI body, core, CSS and runtime bytes stay identical',async()=>scenario(async(directory,assets)=>{
  for(const file of ['index.html','en/index.html']) {
    const source=await readFile(path.join(directory,'public',file),'utf8');
    assert.equal(text(assets,file).slice(text(assets,file).indexOf('<body>')),source.slice(source.indexOf('<body>')));
  }
  for(const file of ['404.html',...PUBLIC_FILES.filter(f=>/\.(css|mjs)$/.test(f))]) assert.deepEqual(assets.get(file),await readFile(path.join(directory,'public',file)));
}));
test('production manifest is deterministic, excludes itself and detects stale output/source',async()=>scenario(async(directory)=>{
  const first=await readFile(path.join(directory,'dist-production/manifest.json'),'utf8');
  await buildProduction(directory);
  assert.equal(await readFile(path.join(directory,'dist-production/manifest.json'),'utf8'),first);
  assert.equal(JSON.parse(first).files.length,12);
  assert.equal(JSON.parse(first).files.some(f=>f.path==='manifest.json'),false);
  await writeFile(path.join(directory,'dist-production/sitemap.xml'),'changed');
  await assert.rejects(checkProduction(directory),/Stale production output/);
  await buildProduction(directory);
  await writeFile(path.join(directory,'wrangler.jsonc'),JSON.stringify({...WRANGLER,send_metrics:true}));
  await assert.rejects(checkProduction(directory),/reviewed static-assets-only/);
}));
test('production build rejects unknown output rather than silently deleting it',async()=>scenario(async(directory)=>{
  await writeFile(path.join(directory,'dist-production/unexpected.txt'),'unexpected');
  await assert.rejects(buildProduction(directory),/Unexpected file/);
}));

function http(port,route,method='GET') {
  return new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port,path:route,method},(response)=>{
      const parts=[];response.on('data',chunk=>parts.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(parts).toString()}));
    });req.on('error',reject);req.end();
  });
}
test('actual production HTTP model: canonical effective headers, CSP, redirects, XML/MIME and non-SPA 404',async()=>scenario(async(directory,assets)=>{
  const server=await startProductionPreview({root:directory,port:0});
  assert.equal(server.address().address,'127.0.0.1');
  const port=server.address().port;
  try {
    for(const file of ['index.html','en/index.html']) {
      const r=await http(port,'/'+file);
      assert.equal(r.status,200);
      assert.equal(r.body,text(assets,file));
      assert.equal(r.headers['x-robots-tag'],'index, follow');
      assert.ok(r.headers['content-security-policy'].includes('sha256-'));
      assert.equal(r.headers['content-type'],'text/html; charset=utf-8');
    }
    for(const [route,target] of [['/','/index.html'],['/en/','/en/index.html']]) {
      const r=await http(port,route);assert.equal(r.status,308);assert.equal(r.headers.location,target);assert.equal(r.headers['x-robots-tag'],'noindex, nofollow');
    }
    for(const route of ['/missing','/en/missing.html','/_headers','/_redirects','/manifest.json','/package.json']) {
      const r=await http(port,route);assert.equal(r.status,404);assert.equal(r.headers['x-robots-tag'],'noindex, nofollow');assert.equal(r.body.includes('id="label-form"'),false);
    }
    assert.equal((await http(port,'/sitemap.xml')).headers['content-type'],'application/xml; charset=utf-8');
    assert.equal((await http(port,'/js/core/label-printer.mjs')).headers['content-type'],'text/javascript; charset=utf-8');
    assert.equal((await http(port,'/assets/app.css')).headers['content-type'],'text/css; charset=utf-8');
    assert.equal((await http(port,'/robots.txt')).headers['content-type'],'text/plain; charset=utf-8');
    assert.equal((await http(port,'/index.html','HEAD')).body,'');
    assert.equal((await http(port,'/index.html','POST')).status,405);
    assert.equal((await http(port,'/%2e%2e/package.json')).status,400);
  } finally {await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}));
