/**
 * Wandelt den kompakten Katalog (data/catalogRaw.ts) einmal beim Bauen in eine
 * JSON-Datei um. Zur Laufzeit wird dann nur noch JSON.parse ausgefuehrt statt
 * Zeile fuer Zeile zu zerlegen.
 *
 *   node scripts/build-catalog.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawFile = readFileSync(join(root, 'src/data/catalogRaw.ts'), 'utf8');
const match = rawFile.match(/String\.raw`([\s\S]*?)`/);
if (!match) { console.error('CATALOG_RAW nicht gefunden'); process.exit(1); }
const RAW = match[1];

const CATEGORIES = new Set(['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'glutes', 'cardio', 'fullbody', 'mobility', 'other']);
const KINDS = new Set(['strength', 'bodyweight', 'cardio', 'time', 'mobility']);
const splitList = (raw) => raw.split(';').map((s) => s.trim()).filter((s) => s.length > 0 && s !== '-');
const slugify = (value) => value
  .toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const out = [];
const seen = new Set();
for (const line of RAW.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const parts = trimmed.split('|');
  if (parts.length < 8) continue;
  const [name, nameEn, category, kind, primary, secondary, equipment, met, aliases] = parts;
  const cat = category.trim();
  const knd = kind.trim();
  if (!CATEGORIES.has(cat) || !KINDS.has(knd)) continue;
  const id = `cat_${slugify(nameEn || name)}`;
  if (seen.has(id)) continue;
  seen.add(id);
  out.push({
    id,
    name: name.trim(),
    nameEn: nameEn.trim(),
    category: cat,
    kind: knd,
    primaryMuscles: splitList(primary),
    secondaryMuscles: splitList(secondary),
    equipment: splitList(equipment),
    met: Number.parseFloat(met) || 5,
    aliases: aliases ? splitList(aliases) : [],
    source: 'catalog',
  });
}

writeFileSync(join(root, 'src/data/catalog.json'), `${JSON.stringify(out)}\n`);
console.log(`catalog.json: ${out.length} Übungen`);
