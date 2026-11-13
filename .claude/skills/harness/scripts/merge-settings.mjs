#!/usr/bin/env node
// Merge the harness defaults into a project's .claude/settings.json.
//
// Deterministic and additive: it never removes or rewrites a key the project
// already has; it only adds deny rules and the keys below when they're missing.
//
// Usage:
//   node merge-settings.mjs [--dry-run] [--file .claude/settings.json]
//                           [--marketplace-url <git url>] [--ref <branch or tag>]
//                           [--marketplace-name <name>]   (default: harness-marketplace)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MARKETPLACE = 'harness-marketplace';
export const PLUGIN_ID = `harness@${MARKETPLACE}`;

export const DENY = [
  'Bash(git push)',
  'Bash(git push *)',
  'Read(**/.env)',
  'Read(**/.env.local)',
  'Read(**/.env.*.local)',
  'Read(**/.env.production)',
  'Read(**/.env.development)',
  'Read(**/.env.staging)',
  'Read(**/.env.test)',
  'Read(**/*.pem)',
  'Read(**/*.key)',
  'Read(**/*.p12)',
  'Read(**/*.pfx)',
  'Read(**/id_rsa)',
  'Read(**/id_ed25519)',
  'Read(~/.ssh/**)',
  'Read(~/.aws/**)',
];

export function merge(current, { marketplaceUrl, ref, marketplace = MARKETPLACE } = {}) {
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(current ?? {})) throw new Error('the settings file must contain a JSON object');
  const next = structuredClone(current ?? {});
  const added = [];
  for (const k of ['permissions', 'extraKnownMarketplaces', 'enabledPlugins']) {
    if (next[k] !== undefined && !isObj(next[k])) throw new Error(`"${k}" must be an object`);
  }
  if (next.permissions?.deny !== undefined && !Array.isArray(next.permissions.deny)) throw new Error('"permissions.deny" must be an array');

  next.permissions ??= {};
  const deny = next.permissions.deny ?? [];
  for (const rule of DENY) {
    if (!deny.includes(rule)) { deny.push(rule); added.push(`permissions.deny: ${rule}`); }
  }
  next.permissions.deny = deny;

  if (next.showClearContextOnPlanAccept === undefined) {
    next.showClearContextOnPlanAccept = true;
    added.push('showClearContextOnPlanAccept: true');
  }

  if (marketplaceUrl) {
    next.extraKnownMarketplaces ??= {};
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(marketplace)) throw new Error('the marketplace name may use only letters, digits, ".", "_" and "-"');
    if (!next.extraKnownMarketplaces[marketplace]) {
      next.extraKnownMarketplaces[marketplace] = { source: { source: 'git', url: marketplaceUrl, ...(ref ? { ref } : {}) } };
      added.push(`extraKnownMarketplaces.${marketplace}: ${marketplaceUrl}${ref ? `#${ref}` : ''}`);
    }
    next.enabledPlugins ??= {};
    const id = `harness@${marketplace}`;
    if (next.enabledPlugins[id] === undefined) {
      next.enabledPlugins[id] = true;
      added.push(`enabledPlugins.${id}: true`);
    }
  }
  return { next, added };
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function main() {
  const file = arg('--file') ?? '.claude/settings.json';
  const dryRun = process.argv.includes('--dry-run');
  const marketplaceUrl = arg('--marketplace-url');
  if (marketplaceUrl && !/^(https:\/\/|git@|ssh:\/\/)/.test(marketplaceUrl)) {
    console.error('merge-settings: --marketplace-url must be an https, ssh or git@ URL.');
    process.exit(1);
  }
  let current = {};
  if (existsSync(file)) {
    try {
      current = JSON.parse(readFileSync(file, 'utf-8'));
    } catch (err) {
      console.error(`merge-settings: ${file} isn't valid JSON (${err.message}). Fix it first; nothing was written.`);
      process.exit(1);
    }
  }
  let next;
  let added;
  try {
    ({ next, added } = merge(current, { marketplaceUrl, ref: arg('--ref'), marketplace: arg('--marketplace-name') ?? MARKETPLACE }));
  } catch (err) {
    console.error(`merge-settings: ${file}: ${err.message}. Nothing was written.`);
    process.exit(1);
  }
  if (!added.length) {
    console.log(`${file}: already up to date.`);
    return;
  }
  console.log(`${dryRun ? 'Would add' : 'Added'} to ${file}:`);
  for (const a of added) console.log(`  + ${a}`);
  if (!dryRun) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
