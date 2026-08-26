'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { parseExportFiles, projectSummary } from '../../lib/scanner/parse.mjs';
import {
  buildTranscript,
  estimateTranscriptTokens,
  hasActionSignal,
} from '../../lib/scanner/transcript.mjs';
import { effectiveStatus, mergeTasks, sortTasks, toRecord } from '../../lib/scanner/merge.mjs';
import { toCsv, toMarkdown } from '../../lib/scanner/render.mjs';
import { clearState, loadState, saveState } from '../../lib/scanner/store.mjs';

const CONCURRENCY = 4;
const TOKEN_KEY = 'lpm.task-scanner.token';

const STATUS_LABEL = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  dismissed: 'Dismissed',
};

const CATEGORY_LABEL = {
  build: 'Build',
  fix: 'Fix',
  decide: 'Decide',
  write: 'Write',
  research: 'Research',
  follow_up: 'Follow up',
  admin: 'Admin',
};

const DATE_WINDOWS = [
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: '365', label: 'Last year', days: 365 },
  { id: 'all', label: 'Everything', days: null },
];

function windowCutoff(windowId) {
  const found = DATE_WINDOWS.find((w) => w.id === windowId);
  if (!found?.days) return null;
  return new Date(Date.now() - found.days * 86400000).toISOString();
}

function formatDate(value) {
  if (!value) return 'unknown date';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'unknown date'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Read dropped/selected files, expanding a Claude export zip if given one. */
async function readInputFiles(fileList) {
  const files = [];
  for (const file of fileList) {
    if (/\.zip$/i.test(file.name)) {
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter(
        (entry) => !entry.dir && /\.(json|jsonl)$/i.test(entry.name)
      );
      for (const entry of entries) {
        files.push({ name: entry.name.split('/').pop(), text: await entry.async('string') });
      }
    } else if (/\.(json|jsonl)$/i.test(file.name)) {
      files.push({ name: file.name, text: await file.text() });
    }
  }
  return files;
}

export default function TasksPage() {
  const [state, setState] = useState({ tasks: [], scannedAt: null, scannedCount: 0 });
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [parseWarnings, setParseWarnings] = useState([]);
  const [parsing, setParsing] = useState(false);

  const [dateWindow, setDateWindow] = useState('90');
  const [skipQuiet, setSkipQuiet] = useState(true);
  const [excludedProjects, setExcludedProjects] = useState(() => new Set());

  const [scan, setScan] = useState(null); // { total, done, failed, current }
  const [scannerToken, setScannerToken] = useState('');
  const [tokenRequired, setTokenRequired] = useState(false);
  const cancelRef = useRef(false);

  const [filterText, setFilterText] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  // Tasks ticked off during this visit stay on screen, struck through, so the
  // click has visible confirmation and is easy to undo. They drop out on reload.
  const [justClosed, setJustClosed] = useState(() => new Set());

  // Restore the previous scan before the first paint the user notices.
  useEffect(() => {
    setState(loadState());
    setScannerToken(window.sessionStorage.getItem(TOKEN_KEY) || '');
    setHydrated(true);
  }, []);

  const persist = useCallback((next) => {
    setState(next);
    const result = saveState(next);
    setStorageError(result.ok ? null : result.error);
  }, []);

  // ── Import ────────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (fileList) => {
    setParsing(true);
    setParseWarnings([]);
    try {
      const files = await readInputFiles([...fileList]);
      if (files.length === 0) {
        setParseWarnings(['No .json or .jsonl files found in that drop.']);
        setConversations([]);
        return;
      }
      const result = parseExportFiles(files);
      // Computed once here rather than inside the filter memo — scanning every
      // message with every action pattern on each keystroke would stall a
      // large export.
      setConversations(
        result.conversations.map((conversation) => ({
          ...conversation,
          hasAction: hasActionSignal(conversation),
        }))
      );
      setParseWarnings(result.warnings);
      setExcludedProjects(new Set());
    } catch (err) {
      setParseWarnings([`Could not read those files: ${err.message}`]);
      setConversations([]);
    } finally {
      setParsing(false);
    }
  }, []);

  const projects = useMemo(() => projectSummary(conversations), [conversations]);

  const selected = useMemo(() => {
    const cutoff = windowCutoff(dateWindow);
    return conversations.filter((conversation) => {
      if (cutoff && String(conversation.updatedAt || '') < cutoff) return false;
      if (excludedProjects.has(conversation.projectName || 'No project')) return false;
      if (skipQuiet && !conversation.hasAction) return false;
      return true;
    });
  }, [conversations, dateWindow, excludedProjects, skipQuiet]);

  const estimate = useMemo(() => {
    let inputTokens = 0;
    for (const conversation of selected) {
      inputTokens += estimateTranscriptTokens(conversation);
    }
    // Opus 5 list pricing; output is small and estimated generously.
    const outputTokens = selected.length * 700;
    return {
      inputTokens,
      outputTokens,
      cost: (inputTokens / 1e6) * 5 + (outputTokens / 1e6) * 25,
    };
  }, [selected]);

  // ── Scan ──────────────────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    if (selected.length === 0) return;
    cancelRef.current = false;

    const queue = [...selected];
    const progress = { total: queue.length, done: 0, failed: 0, current: '' };
    setScan({ ...progress });

    let collected = [];
    let cursor = 0;

    async function worker() {
      while (cursor < queue.length && !cancelRef.current) {
        const conversation = queue[cursor++];
        progress.current = conversation.title;
        setScan({ ...progress });

        try {
          const response = await fetch('/api/tasks/scan', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(scannerToken ? { 'x-scanner-token': scannerToken } : {}),
            },
            body: JSON.stringify({
              conversation: {
                id: conversation.id,
                title: conversation.title,
                projectName: conversation.projectName,
                updatedAt: conversation.updatedAt,
              },
              transcript: buildTranscript(conversation),
            }),
          });

          if (response.status === 401) {
            // This deployment is gated. Stop the whole run rather than burning
            // through the queue collecting identical failures.
            cancelRef.current = true;
            setTokenRequired(true);
            throw new Error('Unauthorized');
          }

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${response.status}`);
          }

          const result = await response.json();
          collected = mergeTasks(
            collected,
            result.tasks.map((task) => toRecord(task, conversation))
          );
        } catch {
          progress.failed += 1;
        } finally {
          progress.done += 1;
          setScan({ ...progress });
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker)
    );

    // Merge onto whatever was already there so earlier check-offs survive.
    persist({
      tasks: mergeTasks(state.tasks, collected),
      scannedAt: new Date().toISOString(),
      scannedCount: progress.done - progress.failed,
    });
    setScan(null);
  }, [selected, state.tasks, persist, scannerToken]);

  // ── Task edits ────────────────────────────────────────────────────────
  const updateTask = useCallback(
    (id, patch) => {
      persist({
        ...state,
        tasks: state.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
      });
    },
    [state, persist]
  );

  const toggleExpanded = useCallback((id) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Display ───────────────────────────────────────────────────────────
  const visibleTasks = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    return state.tasks.filter((task) => {
      const status = effectiveStatus(task);
      if (status === 'dismissed' && !justClosed.has(task.id)) return false;
      if (status === 'done' && !showDone && !justClosed.has(task.id)) return false;
      if (!needle) return true;
      return (
        task.title.toLowerCase().includes(needle) ||
        task.detail.toLowerCase().includes(needle) ||
        (task.projectName || '').toLowerCase().includes(needle)
      );
    });
  }, [state.tasks, filterText, showDone, justClosed]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const task of visibleTasks) {
      const key = task.projectName || 'No project';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(task);
    }
    return [...groups.entries()]
      .map(([name, tasks]) => [name, sortTasks(tasks)])
      .sort((a, b) => b[1].length - a[1].length);
  }, [visibleTasks]);

  const counts = useMemo(() => {
    const open = state.tasks.filter((task) => {
      const status = effectiveStatus(task);
      return status !== 'done' && status !== 'dismissed';
    });
    return {
      open: open.length,
      high: open.filter((task) => task.priority === 'high').length,
      blocked: open.filter((task) => effectiveStatus(task) === 'blocked').length,
      total: state.tasks.length,
    };
  }, [state.tasks]);

  const stamp = () => new Date().toISOString().slice(0, 10);

  if (!hydrated) return null;

  return (
    <div className="scanner-page">
      <header className="scanner-header">
        <h1>Conversation task scanner</h1>
        <p>
          Reads your Claude conversations, pulls out what is still outstanding, and
          keeps one list across every project.
        </p>
      </header>

      {counts.total > 0 && (
        <div className="scanner-stats">
          <div className="scanner-stat">
            <strong>{counts.open}</strong>
            <span>open</span>
          </div>
          <div className="scanner-stat">
            <strong>{counts.high}</strong>
            <span>high priority</span>
          </div>
          <div className="scanner-stat">
            <strong>{counts.blocked}</strong>
            <span>blocked</span>
          </div>
          <div className="scanner-stat">
            <strong>{grouped.length}</strong>
            <span>projects</span>
          </div>
        </div>
      )}

      {storageError && (
        <div className="scanner-note scanner-note--warn">
          Could not save to this browser ({storageError}). Export your list before
          leaving the page.
        </div>
      )}

      <section className="scanner-card">
        <h2>1. Load your conversations</h2>
        <details className="scanner-help">
          <summary>How do I get the file?</summary>
          <p>
            Claude has no API for reading your projects, so the scanner works from
            the official data export.
          </p>
          <ol>
            <li>
              On claude.ai, open <strong>Settings → Privacy → Export data</strong>.
            </li>
            <li>Claude emails you a link, usually within a few minutes.</li>
            <li>
              Drop the whole <code>.zip</code> below, or just{' '}
              <code>conversations.json</code> and <code>projects.json</code>.
            </li>
          </ol>
          <p>
            Claude Code session logs work too — drop any <code>.jsonl</code> file
            from <code>~/.claude/projects/</code>.
          </p>
        </details>

        <label
          className="scanner-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleFiles(event.dataTransfer.files);
          }}
        >
          <input
            type="file"
            multiple
            accept=".zip,.json,.jsonl"
            onChange={(event) => handleFiles(event.target.files)}
            hidden
          />
          <span className="scanner-drop__icon">📥</span>
          <span>
            {parsing
              ? 'Reading…'
              : conversations.length > 0
                ? `${conversations.length} conversations loaded — drop again to replace`
                : 'Drop your export here, or click to choose files'}
          </span>
          <small>Nothing is uploaded at this step; parsing happens in your browser.</small>
        </label>

        {parseWarnings.map((warning) => (
          <div key={warning} className="scanner-note">
            {warning}
          </div>
        ))}
      </section>

      {conversations.length > 0 && (
        <section className="scanner-card">
          <h2>2. Choose what to scan</h2>

          <div className="scanner-controls">
            <div className="scanner-field">
              <span>Time window</span>
              <select value={dateWindow} onChange={(event) => setDateWindow(event.target.value)}>
                {DATE_WINDOWS.map((window) => (
                  <option key={window.id} value={window.id}>
                    {window.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="scanner-check">
              <input
                type="checkbox"
                checked={skipQuiet}
                onChange={(event) => setSkipQuiet(event.target.checked)}
              />
              <span>Skip conversations with no action language (cheaper)</span>
            </label>
          </div>

          <div className="scanner-projects">
            {projects.map((project) => {
              const excluded = excludedProjects.has(project.name);
              return (
                <button
                  key={project.name}
                  type="button"
                  className={`scanner-chip${excluded ? ' scanner-chip--off' : ''}`}
                  onClick={() =>
                    setExcludedProjects((current) => {
                      const next = new Set(current);
                      if (next.has(project.name)) next.delete(project.name);
                      else next.add(project.name);
                      return next;
                    })
                  }
                >
                  {project.name} <em>{project.count}</em>
                </button>
              );
            })}
          </div>

          <div className="scanner-estimate">
            <strong>{selected.length}</strong> conversation(s) selected · about{' '}
            <strong>{estimate.inputTokens.toLocaleString()}</strong> input tokens ·
            estimated API cost{' '}
            <strong>${estimate.cost < 0.01 ? '<0.01' : estimate.cost.toFixed(2)}</strong>
            <small>
              Estimate assumes Claude Opus 5 list pricing. Set{' '}
              <code>TASK_SCANNER_MODEL</code> to a smaller model to spend less.
            </small>
          </div>

          {tokenRequired && (
            <div className="scanner-note scanner-note--warn">
              <p style={{ marginBottom: 8 }}>
                This deployment requires an access token (the server&apos;s{' '}
                <code>TASK_SCANNER_TOKEN</code>).
              </p>
              <input
                type="password"
                className="scanner-search"
                placeholder="Access token"
                value={scannerToken}
                onChange={(event) => {
                  setScannerToken(event.target.value);
                  window.sessionStorage.setItem(TOKEN_KEY, event.target.value);
                }}
              />
            </div>
          )}

          {scan ? (
            <div className="scanner-progress">
              <div className="scanner-progress__bar">
                <div style={{ width: `${(scan.done / scan.total) * 100}%` }} />
              </div>
              <div className="scanner-progress__label">
                Scanned {scan.done} of {scan.total}
                {scan.failed > 0 && ` · ${scan.failed} failed`}
                {scan.current && <em> — {scan.current}</em>}
              </div>
              <button
                type="button"
                className="scanner-btn scanner-btn--ghost"
                onClick={() => {
                  cancelRef.current = true;
                }}
              >
                Stop after current
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="scanner-btn"
              onClick={runScan}
              disabled={selected.length === 0}
            >
              Scan {selected.length} conversation(s)
            </button>
          )}
        </section>
      )}

      {state.tasks.length > 0 && (
        <section className="scanner-card">
          <div className="scanner-results-head">
            <h2>3. Your list</h2>
            <div className="scanner-actions">
              <button
                type="button"
                className="scanner-btn scanner-btn--ghost"
                onClick={() =>
                  download(
                    `tasks-${stamp()}.md`,
                    toMarkdown(state.tasks, { generatedAt: new Date().toLocaleString() }),
                    'text/markdown'
                  )
                }
              >
                Markdown
              </button>
              <button
                type="button"
                className="scanner-btn scanner-btn--ghost"
                onClick={() => download(`tasks-${stamp()}.csv`, toCsv(state.tasks), 'text/csv')}
              >
                CSV
              </button>
              <button
                type="button"
                className="scanner-btn scanner-btn--ghost"
                onClick={() =>
                  download(
                    `tasks-${stamp()}.json`,
                    JSON.stringify(state, null, 2),
                    'application/json'
                  )
                }
              >
                JSON
              </button>
              <button
                type="button"
                className="scanner-btn scanner-btn--ghost scanner-btn--danger"
                onClick={() => {
                  if (!window.confirm('Delete the saved task list from this browser?')) return;
                  clearState();
                  setState({ tasks: [], scannedAt: null, scannedCount: 0 });
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {state.scannedAt && (
            <p className="scanner-meta">
              Last scan {formatDate(state.scannedAt)} · {state.scannedCount} conversation(s)
            </p>
          )}

          <div className="scanner-controls">
            <input
              type="search"
              className="scanner-search"
              placeholder="Filter tasks…"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
            />
            <label className="scanner-check">
              <input
                type="checkbox"
                checked={showDone}
                onChange={(event) => setShowDone(event.target.checked)}
              />
              <span>Show completed</span>
            </label>
          </div>

          {grouped.length === 0 && (
            <p className="scanner-meta">Nothing matches that filter.</p>
          )}

          {grouped.map(([project, tasks]) => (
            <div key={project} className="scanner-group">
              <h3>
                {project} <em>{tasks.length}</em>
              </h3>
              {tasks.map((task) => {
                const status = effectiveStatus(task);
                const isOpen = expanded.has(task.id);
                return (
                  <div
                    key={task.id}
                    className={`scanner-task scanner-task--${status} scanner-task--p-${task.priority}`}
                  >
                    <input
                      type="checkbox"
                      checked={status === 'done'}
                      onChange={(event) => {
                        updateTask(task.id, {
                          userStatus: event.target.checked ? 'done' : 'open',
                        });
                        setJustClosed((current) => new Set(current).add(task.id));
                      }}
                      aria-label={`Mark "${task.title}" done`}
                    />

                    <div className="scanner-task__body">
                      <button
                        type="button"
                        className="scanner-task__title"
                        onClick={() => toggleExpanded(task.id)}
                      >
                        {task.title}
                      </button>

                      <div className="scanner-task__meta">
                        <span className={`scanner-tag scanner-tag--${task.priority}`}>
                          {task.priority}
                        </span>
                        <span className="scanner-tag">{CATEGORY_LABEL[task.category]}</span>
                        {status !== 'todo' && (
                          <span className="scanner-tag">{STATUS_LABEL[status]}</span>
                        )}
                        {status === 'dismissed' && (
                          <button
                            type="button"
                            className="scanner-undo"
                            onClick={() => updateTask(task.id, { userStatus: 'open' })}
                          >
                            undo
                          </button>
                        )}
                        {task.due && <span className="scanner-tag scanner-tag--due">{task.due}</span>}
                        {task.owner === 'other' && <span className="scanner-tag">someone else</span>}
                        {task.sources.length > 1 && (
                          <span className="scanner-tag">mentioned {task.sources.length}×</span>
                        )}
                      </div>

                      {isOpen && (
                        <div className="scanner-task__detail">
                          {task.detail && <p>{task.detail}</p>}
                          <ul>
                            {task.sources.map((source) => (
                              <li key={`${source.conversationId}-${source.evidence.slice(0, 24)}`}>
                                {source.url ? (
                                  <a href={source.url} target="_blank" rel="noreferrer">
                                    {source.conversationTitle}
                                  </a>
                                ) : (
                                  <span>{source.conversationTitle}</span>
                                )}
                                <span className="scanner-task__when">
                                  {' '}
                                  · {formatDate(source.updatedAt)}
                                </span>
                                {source.evidence && (
                                  <blockquote>“{source.evidence}”</blockquote>
                                )}
                              </li>
                            ))}
                          </ul>
                          <textarea
                            className="scanner-notes"
                            placeholder="Add a note…"
                            value={task.notes}
                            onChange={(event) =>
                              updateTask(task.id, { notes: event.target.value })
                            }
                          />
                          <button
                            type="button"
                            className="scanner-btn scanner-btn--ghost scanner-btn--small"
                            onClick={() => {
                              updateTask(task.id, { userStatus: 'dismissed' });
                              setJustClosed((current) => new Set(current).add(task.id));
                            }}
                          >
                            Not a real task — dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
