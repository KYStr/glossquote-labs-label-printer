import { mkdir, writeFile, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSource } from './check.mjs';
import { ROOT, PUBLIC_FILES, inspectTree, contained, verifyBuild } from './contract.mjs';

export async function build(root = ROOT) {
  const manifest = await checkSource(root, { syntax: false });
  const dist = path.join(root, 'dist');
  try {
    await lstat(dist);
    await inspectTree(dist, [...PUBLIC_FILES,'manifest.json'], { requireAll: false });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(dist, { recursive: true });
  for (const file of PUBLIC_FILES) {
    const target = contained(dist, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(contained(path.join(root,'public'),file)));
  }
  await writeFile(contained(dist, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await verifyBuild(root);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const manifest = await build();
    console.log(`PASS build: ${manifest.files.length} static files + deterministic manifest; preview noindex,nofollow`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
