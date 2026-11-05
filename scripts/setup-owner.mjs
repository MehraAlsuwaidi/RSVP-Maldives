#!/usr/bin/env node
/**
 * Sets up the event owner's dashboard login.
 *
 *   npm run setup:owner         → stores secrets on the deployed Worker (wrangler secret put)
 *   npm run setup:owner:local   → writes .dev.vars for local development
 *
 * The password is typed (hidden) and only its PBKDF2 hash leaves this machine.
 * Re-run at any time to change the password; doing so also signs out every
 * existing owner session because SESSION_SECRET is regenerated.
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import readline from 'node:readline';

const ITERATIONS = 100000; // Cloudflare Workers' PBKDF2 maximum
const local = process.argv.includes('--local');

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (s) => {
      if (!muted) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

async function getPassword() {
  if (process.env.OWNER_PASSWORD) return process.env.OWNER_PASSWORD; // non-interactive (CI / tests)
  const first = await askHidden('Choose the owner password (min. 12 characters): ');
  const second = await askHidden('Type it again to confirm: ');
  if (first !== second) throw new Error('The passwords did not match.');
  return first;
}

const password = await getPassword();
if (password.length < 12) {
  console.error('Please use at least 12 characters (a short phrase works well).');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
const ownerHash = ['pbkdf2-sha256', ITERATIONS, salt.toString('base64'), hash.toString('base64')].join('$');
const sessionSecret = randomBytes(32).toString('base64url');

if (local) {
  writeFileSync('.dev.vars', `OWNER_PASSWORD_HASH="${ownerHash}"\nSESSION_SECRET="${sessionSecret}"\n`, { mode: 0o600 });
  console.log('Wrote .dev.vars for local development (git-ignored).');
} else {
  for (const [name, value] of [
    ['OWNER_PASSWORD_HASH', ownerHash],
    ['SESSION_SECRET', sessionSecret],
  ]) {
    const res = spawnSync('npx', ['wrangler', 'secret', 'put', name], { input: value, stdio: ['pipe', 'inherit', 'inherit'] });
    if (res.status !== 0) {
      console.error(`Could not store ${name}. Is wrangler logged in and the Worker deployed?`);
      process.exit(res.status || 1);
    }
  }
  console.log('Owner login is ready. Share the /admin/ link and give the owner the password in person or by phone.');
}
