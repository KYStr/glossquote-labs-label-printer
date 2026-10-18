import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './contract.mjs';
import { createHandler } from './preview.mjs';
import { checkProduction, PRODUCTION_FILES, REDIRECTS, parseHeaderRules, mergedHeaders } from './production.mjs';

export async function startProductionPreview({root=ROOT,port=5210}={}) {
  await checkProduction(root);
  const assets=new Map();
  for(const file of PRODUCTION_FILES) assets.set(file,await readFile(path.join(root,'dist-production',file)));
  const rules=parseHeaderRules(assets.get('_headers').toString());
  const server=createServer({maxHeaderSize:8192},createHandler(assets,{headersForPath:(route)=>mergedHeaders(rules,route),redirects:REDIRECTS}));
  server.requestTimeout=5000;
  server.headersTimeout=5000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const server=await startProductionPreview();
    console.log(`Production HTTP model only: http://127.0.0.1:${server.address().port}/index.html; not a deployed site`);
    const stop=()=>server.close();
    process.once('SIGINT',stop);
    process.once('SIGTERM',stop);
  } catch(error) {console.error(error.code==='EADDRINUSE'?'Port 5210 in use; no existing service stopped.':error.message);process.exitCode=1;}
}
