#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const LOG_PATH = path.resolve('docs/workflow/references/upstream-bugloginbrowser/upstream-intake-log.md');

function readBaseSha() {
  const arg = process.argv[2]?.trim();
  if (arg) return arg;

  if (!fs.existsSync(LOG_PATH)) return null;
  const content = fs.readFileSync(LOG_PATH, 'utf8');
  const match = content.match(/Last reviewed upstream SHA:\s*`([0-9a-f]{7,40})`/i);
  return match?.[1] ?? null;
}

function shorten(message = '') {
  const clean = message.replace(/\s+/g, ' ').trim();
  return clean.length > 100 ? `${clean.slice(0, 97)}...` : clean;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'buglogin-upstream-intake-script',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

function printRows(commits) {
  if (!commits.length) {
    console.log('No new commits found.');
    return;
  }

  console.log('| Date | SHA | Title | URL |');
  console.log('|------|-----|-------|-----|');
  for (const commit of commits) {
    const sha = commit.sha.slice(0, 12);
    const date = commit.commit?.author?.date?.slice(0, 10) ?? 'unknown';
    const title = shorten(commit.commit?.message?.split('\n')[0] ?? '');
    console.log(`| ${date} | ${sha} | ${title.replace(/\|/g, '\\|')} | ${commit.html_url} |`);
  }
}

async function main() {
  const baseSha = readBaseSha();

  if (!baseSha) {
    const url = 'https://api.github.com/repos/zhom/bugloginbrowser/commits?sha=main&per_page=20';
    const commits = await fetchJson(url);
    console.log('# Latest 20 commits on upstream main');
    printRows(commits);
    return;
  }

  const compareUrl = `https://api.github.com/repos/zhom/bugloginbrowser/compare/${baseSha}...main`;
  const compare = await fetchJson(compareUrl);

  const commits = compare.commits ?? [];
  console.log(`# Upstream commits since ${baseSha}`);
  console.log(`Ahead by: ${compare.ahead_by ?? commits.length}`);
  printRows(commits);

  if (compare.merge_base_commit?.sha) {
    console.log(`\nMerge base: ${compare.merge_base_commit.sha}`);
  }
  if (compare.status) {
    console.log(`Status: ${compare.status}`);
  }
}

main().catch((error) => {
  console.error(`Failed to fetch upstream commits: ${error.message}`);
  process.exit(1);
});
