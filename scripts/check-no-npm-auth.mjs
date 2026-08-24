#!/usr/bin/env node
/**
 * Refuse to publish with a credential line in any .npmrc.
 *
 * Trusted publishing works by npm noticing it has *no* credentials and doing
 * an OIDC exchange instead. An `_authToken=` line defeats that even when the
 * value is empty: npm reads the line as "auth is configured", never asks
 * GitHub for a token, and fails as ENEEDAUTH or a 404 - which reads like a
 * permissions problem and is not one.
 *
 * actions/setup-node writes exactly that line whenever it is given a
 * `registry-url`, so this is one option away at all times.
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const candidates = [
  process.env.NPM_CONFIG_USERCONFIG,
  join(homedir(), '.npmrc'),
  join(root, '.npmrc'),
].filter(Boolean);

const AUTH = /^\s*(\/\/.*:)?(_authToken|_auth|_password|username)\s*=/;

const problems = [];
for (const file of candidates) {
  if (!existsSync(file)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (AUTH.test(line)) problems.push(`${file}:${i + 1}: ${line.split('=')[0]}=...`);
  });
}

// The variable being set at all means something means to authenticate by
// token, including setup-node's own placeholder.
if (process.env.NODE_AUTH_TOKEN) problems.push('NODE_AUTH_TOKEN is set in the environment');

if (problems.length) {
  console.error('a credential is configured; OIDC will be skipped:');
  for (const p of problems) console.error(`  ${p}`);
  console.error('\nremove the credential, or the registry-url that generates it.');
  process.exit(1);
}

console.log(`no npm credential configured (${candidates.length} location(s) checked) - OIDC will be used`);
