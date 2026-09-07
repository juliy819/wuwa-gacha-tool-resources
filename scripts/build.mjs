import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = 'https://static.nanoka.cc';
const version = process.argv[2] || new Date().toISOString().slice(0, 10).replaceAll('-', '.');
const output = path.resolve('resource-pack');
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'icons'), { recursive: true });
await mkdir(path.join(output, 'portraits'), { recursive: true });
const json = async (url) => { const response = await fetch(url); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); };
const sourceVersion = (await json(`${base}/manifest.json`)).ww.latest;
const resources = [];
const downloads = [];
const icons = {};
const portraits = {};
const failures = [];
const assetsHash = createHash('sha256');
for (const [kind, entries] of [['role', await json(`${base}/ww/${sourceVersion}/character.json`)], ['weapon', await json(`${base}/ww/${sourceVersion}/weapon.json`)]]) {
  for (const [id, item] of Object.entries(entries)) {
    if (!/^\d+$/.test(id) || !item.zh || ![3, 4, 5].includes(item.rank)) continue;
    resources.push({ resource_id: Number(id), name: item.zh, quality_level: item.rank, resource_type: kind });
    if (item.icon) downloads.push({ id, path: item.icon, directory: 'icons', mapping: icons });
    else failures.push({ id, directory: 'icons', reason: 'source catalog has no icon path' });
    if (kind === 'role' && (item.portrait || item.background)) downloads.push({ id, path: item.portrait || item.background, directory: 'portraits', mapping: portraits });
    else if (kind === 'role') failures.push({ id, directory: 'portraits', reason: 'source catalog has no portrait path' });
  }
}
const iconPath = (value) => `${base}/assets/ww${value.replace('/Game/Aki/UI', '').split('.')[0]}.webp`;
downloads.sort((left, right) => left.directory.localeCompare(right.directory) || Number(left.id) - Number(right.id));
for (const item of downloads) {
  try {
    const response = await fetch(iconPath(item.path));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 12 || bytes.length > 2 * 1024 * 1024) throw new Error(`invalid size ${bytes.length}`);
    if (bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP') throw new Error('response is not WebP');
    const target = path.join(output, item.directory, `${item.id}.webp`);
    await writeFile(target, bytes);
    assetsHash.update(`${item.directory}/${item.id}.webp\0`);
    assetsHash.update(bytes);
    item.mapping[item.id] = `${item.id}.webp`;
  } catch (error) {
    await rm(path.join(output, item.directory, `${item.id}.webp`), { force: true });
    failures.push({ id: item.id, directory: item.directory, reason: error instanceof Error ? error.message : String(error) });
  }
}
// Beta catalogs can arrive before every corresponding image. Publish the
// directory and available assets, while recording missing files for audits.
const missingAssets = failures.map(({ id, directory, reason }) => ({ id: Number(id), directory, reason }));
const assetsSha256 = assetsHash.digest('hex');
const catalog = Buffer.from(JSON.stringify({ version: sourceVersion, assets_sha256: assetsSha256, resources, icons, portraits, missing_assets: missingAssets }, null, 2) + '\n');
await writeFile(path.join(output, 'catalog.json'), catalog);
const archive = path.resolve(`resource-pack-${version}.zip`);
if (process.env.CREATE_ARCHIVE === '1') {
  const { execFileSync } = await import('node:child_process');
  if (process.platform === 'win32') execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${output}' -DestinationPath '${archive}' -Force`]);
  else execFileSync('zip', ['-qr', archive, 'resource-pack']);
}
console.log(JSON.stringify({ version, sourceVersion, resourceCount: resources.length, iconCount: Object.keys(icons).length, portraitCount: Object.keys(portraits).length, missingAssetCount: missingAssets.length, assetsSha256, catalogSha256: createHash('sha256').update(catalog).digest('hex'), archive }, null, 2));
