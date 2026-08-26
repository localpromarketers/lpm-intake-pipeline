/**
 * Parsers for Claude conversation data.
 *
 * Two supported inputs:
 *   1. A claude.ai data export (Settings → Privacy → Export data). The zip
 *      contains `conversations.json`, `projects.json` and `users.json`.
 *   2. Claude Code session logs (`~/.claude/projects/<slug>/<session>.jsonl`).
 *
 * The export format has drifted between versions, so every field read here is
 * probed across the names Anthropic has used rather than assumed.
 */

const HUMAN_ROLES = new Set(['human', 'user']);

/** Pull the first present key from an object. */
function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

/** Flatten a message body into plain text, dropping tool traffic and images. */
function blocksToText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  const parts = [];
  for (const block of content) {
    if (typeof block === 'string') {
      parts.push(block);
    } else if (block?.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text);
    } else if (block?.type === 'thinking' && typeof block.thinking === 'string') {
      // Reasoning is not a commitment — skip it.
      continue;
    } else if (block?.type === 'tool_use') {
      parts.push(`[used tool: ${block.name}]`);
    }
  }
  return parts.join('\n').trim();
}

function normalizeRole(raw) {
  const role = String(raw || '').toLowerCase();
  return HUMAN_ROLES.has(role) ? 'human' : 'assistant';
}

/**
 * A conversation's project reference has lived under several keys, and in some
 * exports only inside a nested object. Probe all of them.
 */
function readProjectRef(conversation) {
  const nested = conversation.project;
  if (nested && typeof nested === 'object') {
    return {
      id: pick(nested, 'uuid', 'id') || null,
      name: pick(nested, 'name', 'title') || null,
    };
  }
  if (typeof nested === 'string') return { id: nested, name: null };

  const id = pick(conversation, 'project_uuid', 'project_id', 'projectUuid', 'projectId');
  return { id: id || null, name: null };
}

/** Parse `projects.json` into an id → name lookup. */
export function parseProjects(raw) {
  const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const byId = new Map();
  if (!Array.isArray(list)) return byId;

  for (const project of list) {
    const id = pick(project, 'uuid', 'id');
    if (!id) continue;
    byId.set(id, {
      id,
      name: pick(project, 'name', 'title') || 'Untitled project',
      description: pick(project, 'description') || '',
      updatedAt: pick(project, 'updated_at', 'updatedAt', 'created_at') || null,
    });
  }
  return byId;
}

/** Parse `conversations.json` into normalized conversations. */
export function parseConversations(raw, projectsById = new Map()) {
  const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(list)) {
    throw new Error('conversations.json did not contain a JSON array.');
  }

  return list.map((conversation, index) => {
    const id = pick(conversation, 'uuid', 'id') || `conversation-${index}`;
    const ref = readProjectRef(conversation);
    const known = ref.id ? projectsById.get(ref.id) : null;

    const rawMessages =
      pick(conversation, 'chat_messages', 'messages', 'chatMessages') || [];

    const messages = (Array.isArray(rawMessages) ? rawMessages : [])
      .map((message) => ({
        role: normalizeRole(pick(message, 'sender', 'role')),
        text: blocksToText(message.content) || String(pick(message, 'text') || ''),
        createdAt: pick(message, 'created_at', 'createdAt', 'timestamp') || null,
      }))
      .filter((message) => message.text.trim().length > 0);

    return {
      id,
      source: 'claude-export',
      title: pick(conversation, 'name', 'title') || 'Untitled conversation',
      projectId: ref.id,
      projectName: known?.name || ref.name || null,
      createdAt: pick(conversation, 'created_at', 'createdAt') || null,
      updatedAt:
        pick(conversation, 'updated_at', 'updatedAt', 'created_at') || null,
      url: `https://claude.ai/chat/${id}`,
      messages,
    };
  });
}

/** Parse one Claude Code `.jsonl` session log. */
export function parseClaudeCodeSession(text, fileName = 'session.jsonl') {
  const messages = [];
  let sessionId = null;
  let cwd = null;
  let firstAt = null;
  let lastAt = null;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue; // Partially written logs are normal; skip the bad line.
    }

    sessionId = sessionId || entry.sessionId || null;
    cwd = cwd || entry.cwd || null;
    if (entry.timestamp) {
      firstAt = firstAt || entry.timestamp;
      lastAt = entry.timestamp;
    }

    if (entry.type !== 'user' && entry.type !== 'assistant') continue;

    const body = entry.message || entry;
    const content = blocksToText(body.content);
    if (!content.trim()) continue;

    messages.push({
      role: normalizeRole(body.role || entry.type),
      text: content,
      createdAt: entry.timestamp || null,
    });
  }

  // `~/.claude/projects` slugifies the working directory, e.g.
  // `-home-user-lpm-intake-pipeline`. The last segment is the useful bit.
  const projectName = cwd
    ? cwd.split('/').filter(Boolean).pop()
    : fileName.replace(/\.jsonl$/, '');

  return {
    id: sessionId || fileName,
    source: 'claude-code',
    title: `Claude Code session — ${projectName}`,
    projectId: cwd || projectName,
    projectName: `Claude Code: ${projectName}`,
    createdAt: firstAt,
    updatedAt: lastAt,
    url: null,
    messages,
  };
}

/**
 * Turn a mixed bag of uploaded files into normalized conversations.
 * `files` is `[{ name, text }]`; order does not matter.
 */
export function parseExportFiles(files) {
  const warnings = [];
  let projectsById = new Map();

  const projectFile = files.find((file) => /projects\.json$/i.test(file.name));
  if (projectFile) {
    try {
      projectsById = parseProjects(projectFile.text);
    } catch (err) {
      warnings.push(`Could not read ${projectFile.name}: ${err.message}`);
    }
  }

  const conversations = [];

  for (const file of files) {
    if (file === projectFile) continue;

    try {
      if (/\.jsonl$/i.test(file.name)) {
        const session = parseClaudeCodeSession(file.text, file.name);
        if (session.messages.length) conversations.push(session);
      } else if (/conversations\.json$/i.test(file.name) || /\.json$/i.test(file.name)) {
        if (/users\.json$/i.test(file.name)) continue;
        conversations.push(...parseConversations(file.text, projectsById));
      }
    } catch (err) {
      warnings.push(`Could not read ${file.name}: ${err.message}`);
    }
  }

  const withMessages = conversations.filter((c) => c.messages.length > 0);
  const empty = conversations.length - withMessages.length;
  if (empty > 0) {
    warnings.push(`Skipped ${empty} conversation(s) with no readable messages.`);
  }

  // Exports rarely carry a project reference on every conversation. Say so
  // plainly rather than silently lumping everything under one heading.
  const unassigned = withMessages.filter((c) => !c.projectName).length;
  if (unassigned > 0 && projectsById.size > 0) {
    warnings.push(
      `${unassigned} conversation(s) had no project reference in the export and are grouped under "No project".`
    );
  }

  withMessages.sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  );

  return {
    conversations: withMessages,
    projects: [...projectsById.values()],
    warnings,
  };
}

/** Distinct project buckets present in a conversation list. */
export function projectSummary(conversations) {
  const buckets = new Map();
  for (const conversation of conversations) {
    const name = conversation.projectName || 'No project';
    const bucket = buckets.get(name) || { name, count: 0, lastActivity: null };
    bucket.count += 1;
    if (
      conversation.updatedAt &&
      (!bucket.lastActivity || conversation.updatedAt > bucket.lastActivity)
    ) {
      bucket.lastActivity = conversation.updatedAt;
    }
    buckets.set(name, bucket);
  }
  return [...buckets.values()].sort((a, b) => b.count - a.count);
}
