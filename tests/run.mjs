#!/usr/bin/env node
/**
 * Faehrt alle Testlaeufe nacheinander gegen einen laufenden Vorschau-Server.
 *
 *   npm run build && npm test
 *
 * Der Server wird selbst gestartet, sofern unter TEST_URL keiner erreichbar ist.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const URL = process.env.TEST_URL ?? 'http://127.0.0.1:4173/';
const only = process.argv[2];

const SUITES = [
  ['basics', () => import('./basics.mjs')],
  ['training', () => import('./training.mjs')],
  ['offline', () => import('./offline.mjs')],
  ['layout', () => import('./layout.mjs')],
  ['muscles', () => import('./muscles.mjs')],
  ['features', () => import('./features.mjs')],
  ['language', () => import('./language.mjs')],
  ['friends', () => import('./friends.mjs')],
  ['social', () => import('./social.mjs')],
  ['invite', () => import('./invite.mjs')],
];

async function reachable() {
  try {
    const response = await fetch(URL, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

let server = null;
if (!(await reachable())) {
  console.log('Starte Vorschau-Server…');
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'], {
    stdio: 'ignore', detached: false,
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(500);
    if (await reachable()) break;
  }
  if (!(await reachable())) {
    console.error('Vorschau-Server nicht erreichbar – wurde vorher gebaut?');
    process.exit(1);
  }
}

let failed = 0;
for (const [name, load] of SUITES) {
  if (only && only !== name) continue;
  console.log(`\n▸ ${name}`);
  try {
    const suite = await load();
    failed += await suite.run();
  } catch (error) {
    console.error(`  Lauf abgebrochen: ${error.message}`);
    failed += 1;
  }
}

server?.kill();
console.log(failed === 0 ? '\nAlles grün.' : `\n${failed} Prüfungen fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
