#!/usr/bin/env node
// Copy the harness role agents into a project's .claude/agents/.
//
// Deterministic and safe: a missing agent is added, an identical one is left
// alone, and one that differs (the team or LEARN refined it) is kept unless
// it is named with --replace.
//
// Usage:
//   node install-agents.mjs [--dry-run] [--to .claude/agents] [--from <dir>]
//                           [--replace <file.md>]...   (repeatable)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const AGENT_FILE = /^harness-[a-z-]+\.md$/;

export function plan(from, to, replace = []) {
  const actions = [];
  for (const name of readdirSync(from).filter((n) => AGENT_FILE.test(n)).sort()) {
    const source = readFileSync(join(from, name), 'utf-8');
    const target = join(to, name);
    if (!existsSync(target)) actions.push({ name, action: 'add', source });
    else if (readFileSync(target, 'utf-8') === source) actions.push({ name, action: 'same' });
    else if (replace.includes(name)) actions.push({ name, action: 'replace', source });
    else actions.push({ name, action: 'differs' });
  }
  return actions;
}

function args(name) {
  const out = [];
  process.argv.forEach((a, i) => { if (a === name && process.argv[i + 1]) out.push(process.argv[i + 1]); });
  return out;
}

function main() {
  const from = args('--from')[0] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'agents');
  const to = args('--to')[0] ?? '.claude/agents';
  const dryRun = process.argv.includes('--dry-run');
  const replace = args('--replace').map((n) => basename(n));
  for (const n of replace) {
    if (!AGENT_FILE.test(n)) {
      console.error(`install-agents: --replace takes a harness agent file name (harness-<role>.md), not "${n}". Nothing was written.`);
      process.exit(1);
    }
  }
  if (!existsSync(from)) {
    console.error(`install-agents: no agents found in ${from}. Nothing was written.`);
    process.exit(1);
  }
  const actions = plan(from, to, replace);
  const label = { add: dryRun ? 'would add' : 'added', replace: dryRun ? 'would replace' : 'replaced', same: 'up to date', differs: 'kept, differs from the shipped version (diff it; --replace to take the shipped one)' };
  for (const a of actions) console.log(`  ${a.action === 'add' || a.action === 'replace' ? '+' : '='} ${join(to, a.name)}: ${label[a.action]}`);
  if (dryRun) return;
  const writes = actions.filter((a) => a.source);
  if (writes.length) mkdirSync(to, { recursive: true });
  for (const a of writes) writeFileSync(join(to, a.name), a.source);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
