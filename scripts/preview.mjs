import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, PUBLIC_FILES, HEADERS, MIME, verifyBuild } from './contract.mjs';

export function createHandler(assets, { headersForPath = () => HEADERS, redirects = null } = {}) {
  return (request, response) => {
    let headers = { ...headersForPath('') };
    function send(status, body, type = 'text/plain; charset=utf-8') {
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
      response.writeHead(status, { ...headers, 'Content-Type': type, 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      headers.Allow = 'GET, HEAD';
      headers.Connection = 'close';
      send(405, 'Method not allowed'); return;
    }
    if (request.headers['transfer-encoding'] || (request.headers['content-length'] && request.headers['content-length'] !== '0')) {
      headers.Connection = 'close';
      send(400, 'Invalid request'); return;
    }
    const url = request.url ?? '';
    if (url.length > 2048) { send(414, 'URI too long'); return; }
    let route;
    try {
      if (!url.startsWith('/') || /[?#\\\u0000-\u001f\u007f]/.test(url)) throw new Error();
      route = decodeURIComponent(url);
      if (/[?%#\\\u0000-\u001f\u007f]/.test(route) || route.split('/').some((part) => part === '.' || part === '..')) throw new Error();
    } catch { send(400, 'Invalid request'); return; }
    if (redirects && Object.hasOwn(redirects,route)) {
      headers = { ...headersForPath(route), Location: redirects[route] };
      send(308,''); return;
    }
    if (!redirects && route === '/') route = '/index.html';
    if (!redirects && route === '/en/') route = '/en/index.html';
    const relative = route.slice(1);
    if (!assets.has(relative) || ['_headers','_redirects'].includes(relative)) {
      send(404, assets.get('404.html'), MIME['.html']); return;
    }
    headers = { ...headersForPath(route) };
    send(200, assets.get(relative), MIME[path.extname(relative)]);
  };
}

export async function startPreview({ root = ROOT, port = 4210 } = {}) {
  await verifyBuild(root);
  const assets = new Map();
  for (const file of PUBLIC_FILES) assets.set(file, await readFile(path.join(root,'dist',file)));
  const server = createServer({ maxHeaderSize: 8192 }, createHandler(assets));
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const server = await startPreview();
    console.log(`Label Printer preview: http://127.0.0.1:${server.address().port}/index.html (loopback only)`);
    const stop = () => server.close();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    console.error(error.code === 'EADDRINUSE' ? 'Port 4210 is in use; no existing service was stopped.' : error.message);
    process.exitCode = 1;
  }
}
