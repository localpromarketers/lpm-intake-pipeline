#!/usr/bin/env node
/**
 * Scan a Claude data export from the terminal.
 *
 *   node scripts/scan-conversations.mjs ~/Downloads/claude-export
 *   node scripts/scan-conversations.mjs ./conversations.json --since 2026-06-01
 *
 * Writes tasks.md and tasks.json next to each other. Useful when the export is
 * too large to comfortably load in a browser tab, or for a scheduled re-scan.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

import { parseExportFiles, projectSummary } from '../lib/scanner/parse.mjs';
import { buildTranscript, hasActionSignal } from '../lib/scanner/transcript.mjs';
import { extractTasks, DEFAULT_MODEL, DEFAULT_EFFORT } from '../lib/scanner/extract.mjs';
import { mergeTasks, toRecord } from '../lib/scanner/merge.mjs';
import { toCsv, toMarkdown } from '../lib/scanner/render.mjs';

function parseArgs(argv) {
  const options = {
    inputs: [],
    since: null,
    limit: Infinity,
    concurrency: 4,
    outDir: process.cwd(),
    skipQuiet: false,
    model: process.env.TASK_SCANNER_MODEL || DEFAULT_MODEL,
    effort: process.env.TASK_SCANNER_EFFORT || DEFAULT_EFFORT,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--since': options.since = next(); break;
      case '--limit': options.limit = Number(next()); break;
      case '--concurrency': options.concurrency = Number(next()); break;
      case '--out': options.outDir = next(); break;
      case '--model': options.model = next(); break;
      case '--effort': options.effort = next(); break;
      case '--skip-quiet': options.skipQuiet = true; break;
      case '--dry-run': options.dryRun = true; break;
      case '--help': case '-h': options.help = true; break;
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown flag: ${arg}`);
        options.inputs.push(arg);
    }
  }
  return options;
}

const USAGE = `Scan Claude conversations for outstanding tasks.

Usage:
  node scripts/scan-conversations.mjs <export-dir-or-file...> [options]

Options:
  --since <ISO date>   Only scan conversations updated on or after this date
  --limit <n>          Scan at most n conversations (newest first)
  --concurrency <n>    Parallel requests (default 4)
  --skip-quiet         Skip conversations with no action-like language
  --model <id>         Override the model (default ${DEFAULT_MODEL})
  --effort <level>     low | medium | high | xhigh | max (default ${DEFAULT_EFFORT})
  --out <dir>          Where to write tasks.md / tasks.json / tasks.csv
  --dry-run            Parse and report what would be scanned, spend nothing
`;

/** Collect the JSON/JSONL files from a path, whether it is a file or a dir. */
async function collectFiles(inputPath) {
  const stat = await fs.stat(inputPath);
  if (stat.isFile()) {
    return [{ name: path.basename(inputPath), text: await fs.readFile(inputPath, 'utf8') }];
  }

  const files = [];
  for (const entry of await fs.readdir(inputPath, { withFileTypes: true })) {
    const full = path.join(inputPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full)));
    } else if (/\.(json|jsonl)$/i.test(entry.name)) {
      files.push({ name: entry.name, text: await fs.readFile(full, 'utf8') });
    }
  }
  return files;
}

/** Run `worker` over `items` with a fixed number of workers in flight. */
async function pooled(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, run)
  );
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help || options.inputs.length === 0) {
    console.log(USAGE);
    process.exit(options.help ? 0 : 1);
  }

  const files = (await Promise.all(options.inputs.map(collectFiles))).flat();
  const { conversations, warnings } = parseExportFiles(files);
  for (const warning of warnings) console.warn(`  warning: ${warning}`);

  let selected = conversations;
  if (options.since) {
    selected = selected.filter((c) => String(c.updatedAt || '') >= options.since);
  }
  if (options.skipQuiet) {
    selected = selected.filter(hasActionSignal);
  }
  if (Number.isFinite(options.limit)) {
    selected = selected.slice(0, options.limit);
  }

  console.log(`Parsed ${conversations.length} conversation(s); scanning ${selected.length}.`);
  for (const project of projectSummary(selected).slice(0, 12)) {
    console.log(`  ${project.count.toString().padStart(4)}  ${project.name}`);
  }

  const prepared = selected.map((conversation) => ({
    conversation,
    transcript: buildTranscript(conversation),
  }));

  const estimatedInput = prepared.reduce(
    (sum, item) => sum + Math.ceil(item.transcript.text.length / 4),
    0
  );
  console.log(`Estimated input: ~${estimatedInput.toLocaleString()} tokens across ${prepared.length} request(s).`);

  if (options.dryRun) {
    console.log('Dry run — nothing sent.');
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set.');
    process.exit(1);
  }

  const client = new Anthropic();
  let done = 0;
  const failures = [];

  const results = await pooled(prepared, options.concurrency, async (item) => {
    try {
      const result = await extractTasks({
        client,
        conversation: item.conversation,
        transcript: item.transcript,
        model: options.model,
        effort: options.effort,
      });
      done += 1;
      process.stdout.write(
        `\r  scanned ${done}/${prepared.length} (${result.tasks.length} task(s) in "${item.conversation.title.slice(0, 40)}")`.padEnd(100)
      );
      return { item, result };
    } catch (err) {
      failures.push({ title: item.conversation.title, error: err.message });
      done += 1;
      return null;
    }
  });

  process.stdout.write('\n');

  let tasks = [];
  let usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  for (const entry of results) {
    if (!entry) continue;
    usage.inputTokens += entry.result.usage.inputTokens;
    usage.outputTokens += entry.result.usage.outputTokens;
    usage.cacheReadTokens += entry.result.usage.cacheReadTokens;
    tasks = mergeTasks(
      tasks,
      entry.result.tasks.map((task) => toRecord(task, entry.item.conversation))
    );
  }

  const generatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
  await fs.mkdir(options.outDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(options.outDir, 'tasks.md'), toMarkdown(tasks, { generatedAt })),
    fs.writeFile(path.join(options.outDir, 'tasks.csv'), toCsv(tasks)),
    fs.writeFile(
      path.join(options.outDir, 'tasks.json'),
      JSON.stringify({ generatedAt, model: options.model, tasks }, null, 2)
    ),
  ]);

  console.log(`\n${tasks.length} task(s) after deduplication → ${options.outDir}/tasks.md`);
  console.log(
    `Tokens: ${usage.inputTokens.toLocaleString()} in (${usage.cacheReadTokens.toLocaleString()} cached), ${usage.outputTokens.toLocaleString()} out.`
  );

  if (failures.length) {
    console.warn(`\n${failures.length} conversation(s) failed:`);
    for (const failure of failures.slice(0, 10)) {
      console.warn(`  ${failure.title}: ${failure.error}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
