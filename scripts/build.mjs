import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = 'https://static.nanoka.cc';
const version = process.argv[2] || new Date().toISOString().slice(0, 10).replaceAll('-', '.');
const output = path.resolve('resource-pack');
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'icons'), { recursive: true });
const json = async (url) => { const response = await fetch(url); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); };
const sourceVersion = (await json(`${base}/manifest.json`)).ww.latest;
const resources = [];
const downloads = [];
const icons = {};
const failures = [];
for (const [kind, entries] of [['role', await json(`${base}/ww/${sourceVersion}/character.json`)], ['weapon', await json(`${base}/ww/${sourceVersion}/weapon.json`)]]) {
  for (const [id, item] of Object.entries(entries)) {
    if (!/^\d+$/.test(id) || !item.zh || ![3, 4, 5].includes(item.rank)) continue;
    resources.push({ resource_id: Number(id), name: item.zh, quality_level: item.rank, resource_type: kind });
    if (item.icon) downloads.push({ id, path: item.icon });
    else failures.push({ id, reason: 'source catalog has no icon path' });
  }
}
const iconPath = (value) => `${base}/assets/ww${value.replace('/Game/Aki/UI', '').split('.')[0]}.webp`;
for (const item of downloads) {
  try {
    const response = await fetch(iconPath(item.path));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 12 || bytes.length > 2 * 1024 * 1024) throw new Error(`invalid size ${bytes.length}`);
    if (bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP') throw new Error('response is not WebP');
    await writeFile(path.join(output, 'icons', `${item.id}.webp`), bytes);
    icons[item.id] = `${item.id}.webp`;
  } catch (error) {
    failures.push({ id: item.id, reason: error instanceof Error ? error.message : String(error) });
  }
}
if (failures.length > 0) {
  console.error(JSON.stringify({ message: 'resource snapshot is incomplete', failures }, null, 2));
  throw new Error(`failed to build ${failures.length} resource icons`);
}
if (Object.keys(icons).length !== downloads.length) throw new Error('catalog icon count does not match downloaded files');
const catalog = Buffer.from(JSON.stringify({ version: sourceVersion, resources, icons }, null, 2) + '\n');
await writeFile(path.join(output, 'catalog.json'), catalog);
const archive = path.resolve(`resource-pack-${version}.zip`);
if (process.env.CREATE_ARCHIVE === '1') {
  const { execFileSync } = await import('node:child_process');
  if (process.platform === 'win32') execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${output}' -DestinationPath '${archive}' -Force`]);
  else execFileSync('zip', ['-qr', archive, 'resource-pack']);
}
console.log(JSON.stringify({ version, sourceVersion, resourceCount: resources.length, catalogSha256: createHash('sha256').update(catalog).digest('hex'), archive }, null, 2));
