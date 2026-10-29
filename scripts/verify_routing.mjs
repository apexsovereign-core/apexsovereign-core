#!/usr/bin/env node
/**
 * Routing contract check for the Vercel-primary architecture.
 *
 * This is intentionally dependency-free so it can run in CI before a build.
 * It fails if the retired Render proxy returns, if a decommissioned API prefix
 * can fall through to the SPA, or if a required local function is missing.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function fail(message) {
  failures.push(message);
}

const configPath = resolve(root, 'vercel.json');
if (!existsSync(configPath)) {
  console.error('routing: vercel.json is missing');
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];

if (config.version !== 2) {
  fail('vercel.json must be a version 2 configuration');
}

const destinations = rewrites.map((rule) => String(rule.destination ?? ''));
if (destinations.some((destination) => /onrender\.com/i.test(destination))) {
  fail('Render proxy destinations are decommissioned and must not appear in vercel.json');
}

const indexOf = (source) => rewrites.findIndex((rule) => rule.source === source);

const healthIndex = indexOf('/health');
if (healthIndex < 0 || rewrites[healthIndex].destination !== '/api/health') {
  fail('/health must rewrite to the local /api/health function');
}

const requiredGoneRoutes = [
  '/v1',
  '/v1/:path*',
  '/api/v1',
  '/api/v1/:path*',
  '/telemetry',
  '/telemetry/:path*',
  '/api/telemetry',
  '/api/telemetry/:path*',
];

for (const source of requiredGoneRoutes) {
  const index = indexOf(source);
  if (index < 0) {
    fail(`${source} must be explicitly routed to the decommissioned handler`);
    continue;
  }
  if (rewrites[index].destination !== '/api/gone') {
    fail(`${source} must rewrite to /api/gone`);
  }
}

const apiCatchAllIndex = indexOf('/api/(.*)');
if (apiCatchAllIndex < 0) {
  fail('the /api/(.*) rewrite is required');
} else if (rewrites[apiCatchAllIndex].destination !== '/api/$1') {
  fail('/api/(.*) must resolve to the local /api/$1 function tree');
}

const spaIndex = rewrites.findIndex((rule) => rule.source === '/(.*)');
if (spaIndex !== rewrites.length - 1) {
  fail('the SPA fallback /(.*) must be the last rewrite');
}
if (spaIndex >= 0 && rewrites[spaIndex].destination !== '/index.html') {
  fail('the SPA fallback must target /index.html');
}

for (const source of requiredGoneRoutes) {
  const index = indexOf(source);
  if (index >= 0 && apiCatchAllIndex >= 0 && index > apiCatchAllIndex) {
    fail(`${source} must be evaluated before /api/(.*)`);
  }
}

if (healthIndex >= 0 && spaIndex >= 0 && healthIndex > spaIndex) {
  fail('/health must be evaluated before the SPA fallback');
}

const requiredHeaders = new Map([
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'SAMEORIGIN'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Cache-Control', 'no-cache'],
]);

const headerRules = Array.isArray(config.headers) ? config.headers : [];
const globalHeaders = headerRules.find((rule) => rule.source === '/(.*)');
const headerMap = new Map(
  (globalHeaders?.headers ?? []).map((header) => [header.key, header.value]),
);

for (const [key, value] of requiredHeaders) {
  if (headerMap.get(key) !== value) {
    fail(`security header ${key} must remain ${JSON.stringify(value)}`);
  }
}

for (const file of ['api/health.ts', 'api/checkout.ts', 'api/gone.ts']) {
  if (!existsSync(resolve(root, file))) {
    fail(`required local function is missing: ${file}`);
  }
}

if (failures.length > 0) {
  console.error('routing: FAILED');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log('routing: OK');
console.log(`  rewrites=${rewrites.length}`);
console.log('  render_proxy=absent');
console.log('  decommissioned_routes=410');
console.log('  spa_fallback=last');
