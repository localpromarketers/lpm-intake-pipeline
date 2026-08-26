# Conversation task scanner

Scans your Claude conversations, pulls out the work that is still outstanding,
and keeps one deduplicated list across every project.

- **Web UI:** `/tasks`
- **CLI:** `npm run scan -- <path-to-export>`

## Getting your conversation data

Claude has no API for reading your projects or conversations, so the scanner
works from the official data export.

1. On claude.ai, open **Settings → Privacy → Export data**.
2. Claude emails you a download link, usually within a few minutes.
3. The zip contains `conversations.json`, `projects.json` and `users.json`.

Drop the whole zip into `/tasks`, or point the CLI at the unzipped folder.

### Claude Code sessions

Session logs under `~/.claude/projects/<slug>/*.jsonl` work too — drop the
`.jsonl` files in alongside (or instead of) the export. They are grouped under
`Claude Code: <directory name>`.

### A caveat about project grouping

Not every export includes a project reference on every conversation. The parser
probes `project_uuid`, `project_id` and a nested `project` object; anything with
none of them is grouped under **No project** and the count is reported after
parsing. This is a limit of the export, not of the scanner.

## How it works

```
export file ──▶ parse ──▶ condense ──▶ extract ──▶ deduplicate ──▶ list
              (browser)  (browser)    (Claude)     (browser)    (localStorage)
```

1. **Parse** — `lib/scanner/parse.mjs` normalizes both formats into a common
   conversation shape. Runs entirely in the browser.
2. **Condense** — `lib/scanner/transcript.mjs` builds a transcript within a
   character budget. Long conversations are not truncated to the first N
   characters; messages are ranked by action language, recency, and speaker,
   and dropped runs are marked inline so the model knows the transcript has
   gaps.
3. **Extract** — `lib/scanner/extract.mjs` sends one transcript per request with
   a JSON schema (`output_config.format`), so every response comes back in the
   same shape. The system prompt is cached across the scan.
4. **Deduplicate** — `lib/scanner/merge.mjs` merges the same commitment
   surfacing in several threads. Matching is deterministic (token overlap within
   a project), so a rescan produces the same grouping as the last one. The most
   severe status and priority win; every source conversation is kept as
   evidence.
5. **Store** — the list lives in `localStorage`. Conversation content is never
   written to a database. Check-offs, notes and dismissals survive a rescan.

## Privacy

Parsing, deduplication and storage are local to your browser. The only data that
leaves the machine is the condensed transcript of each conversation you choose to
scan, sent to the Claude API for extraction. Nothing is persisted server-side.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Required. |
| `TASK_SCANNER_MODEL` | `claude-opus-5` | Model used for extraction. |
| `TASK_SCANNER_EFFORT` | `medium` | `low` \| `medium` \| `high` \| `xhigh` \| `max`. |
| `TASK_SCANNER_TOKEN` | unset | When set, `/api/tasks/scan` requires a matching `x-scanner-token` header. The UI prompts for it. |

Set `TASK_SCANNER_TOKEN` on any deployment reachable from the internet —
without it, anyone who finds the URL can spend your API credits.

## Cost

The UI shows an estimate before you scan. A typical conversation condenses to
5–15k input tokens, so at Opus 5 list pricing ($5/$25 per million) expect
roughly **$0.05–0.12 per conversation**. Three things bring that down:

- **Time window** — scan the last 90 days rather than everything.
- **Skip quiet conversations** — on by default; drops pure Q&A threads.
- **A smaller model** — `TASK_SCANNER_MODEL=claude-haiku-4-5` costs about a
  fifth as much per token.

## CLI

```bash
node scripts/scan-conversations.mjs ~/Downloads/claude-export --dry-run
node scripts/scan-conversations.mjs ~/Downloads/claude-export --since 2026-06-01
```

| Flag | Effect |
| --- | --- |
| `--since <ISO date>` | Only conversations updated on or after this date |
| `--limit <n>` | At most n conversations, newest first |
| `--concurrency <n>` | Parallel requests (default 4) |
| `--skip-quiet` | Skip conversations with no action-like language |
| `--model` / `--effort` | Override model and reasoning effort |
| `--out <dir>` | Where to write `tasks.md`, `tasks.csv`, `tasks.json` |
| `--dry-run` | Report what would be scanned; spend nothing |

`--dry-run` is worth running first on a large export — it prints the
conversation count, per-project breakdown, and token estimate.

## Limits worth knowing

- **The list is only as good as the transcripts.** Work agreed verbally or in
  another tool will not appear.
- **Very long conversations are condensed**, so a commitment buried in the
  middle of a 300-message thread can be missed. The ranking favors action
  language and the closing exchange, which is where they usually live.
- **The model errs toward omission.** It is instructed to return nothing for
  pure Q&A rather than invent tasks — a quiet result usually means a quiet
  conversation.
- **Storage is per-browser.** Export to Markdown or CSV if you want the list
  anywhere else.
