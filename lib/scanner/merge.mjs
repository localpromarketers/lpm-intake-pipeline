/**
 * Cross-conversation deduplication.
 *
 * The same commitment usually surfaces in several threads ("still need to wire
 * up the Duda API"). Without merging, a scan of 200 conversations produces a
 * list nobody will read. Matching is deterministic rather than model-driven so
 * a rescan produces the same grouping as the last one.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into',
  'is', 'it', 'of', 'on', 'or', 'that', 'the', 'then', 'this', 'to', 'up',
  'with', 'we', 'you', 'your', 'our',
]);

/** Meaningful, stemmed-ish tokens from a title. */
function tokenize(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
      // Crude plural/gerund folding so "adding tests" ≈ "add test".
      .map((word) => word.replace(/(ing|ies|es|s)$/, ''))
      .filter(Boolean)
  );
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** Stable id from project + normalized title, so rescans line up. */
export function taskId(projectName, title) {
  const basis = `${projectName || 'none'}::${[...tokenize(title)].sort().join('-')}`;
  let hash = 5381;
  for (let i = 0; i < basis.length; i += 1) {
    hash = ((hash << 5) + hash + basis.charCodeAt(i)) >>> 0;
  }
  return `t_${hash.toString(36)}`;
}

const SIMILARITY_THRESHOLD = 0.6;
const STATUS_RANK = { done: 0, todo: 1, in_progress: 2, blocked: 3 };
const PRIORITY_RANK = { low: 0, medium: 1, high: 2 };

/** Wrap a freshly extracted task with its provenance. */
export function toRecord(task, conversation) {
  const projectName = conversation.projectName || 'No project';
  return {
    id: taskId(projectName, task.title),
    title: task.title,
    detail: task.detail,
    status: task.status,
    priority: task.priority,
    owner: task.owner,
    category: task.category,
    due: task.due,
    projectName,
    projectId: conversation.projectId || null,
    firstSeen: conversation.updatedAt || null,
    lastSeen: conversation.updatedAt || null,
    sources: [
      {
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        url: conversation.url,
        updatedAt: conversation.updatedAt || null,
        evidence: task.evidence,
      },
    ],
    // User-controlled fields, never overwritten by a rescan.
    userStatus: null,
    notes: '',
  };
}

function mergeInto(target, incoming) {
  const seen = new Set(target.sources.map((s) => `${s.conversationId}:${s.evidence}`));
  for (const source of incoming.sources) {
    const key = `${source.conversationId}:${source.evidence}`;
    if (!seen.has(key)) {
      target.sources.push(source);
      seen.add(key);
    }
  }
  target.sources.sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  );

  // The most recent mention wins on the mutable fields; the most severe wins
  // on status and priority so an "it's blocked" mention is never buried.
  const incomingIsNewer =
    String(incoming.lastSeen || '') > String(target.lastSeen || '');

  if (incomingIsNewer) {
    target.lastSeen = incoming.lastSeen;
    target.detail = incoming.detail || target.detail;
    if (incoming.due) target.due = incoming.due;
    target.owner = incoming.owner !== 'unknown' ? incoming.owner : target.owner;
  }
  if (String(incoming.firstSeen || '') && String(incoming.firstSeen) < String(target.firstSeen || '￿')) {
    target.firstSeen = incoming.firstSeen;
  }
  if (STATUS_RANK[incoming.status] > STATUS_RANK[target.status]) {
    target.status = incoming.status;
  }
  if (PRIORITY_RANK[incoming.priority] > PRIORITY_RANK[target.priority]) {
    target.priority = incoming.priority;
  }
  return target;
}

/**
 * Merge new records into an existing list.
 * Existing user edits (`userStatus`, `notes`) always survive.
 */
export function mergeTasks(existing, incoming) {
  const result = existing.map((task) => ({
    ...task,
    sources: [...task.sources],
    _tokens: tokenize(task.title),
  }));
  const byId = new Map(result.map((task) => [task.id, task]));

  for (const record of incoming) {
    const candidate = { ...record, _tokens: tokenize(record.title) };

    const exact = byId.get(candidate.id);
    if (exact) {
      mergeInto(exact, candidate);
      continue;
    }

    // Fall back to fuzzy matching within the same project only — the same
    // wording across two projects is usually two different pieces of work.
    let best = null;
    let bestScore = 0;
    for (const task of result) {
      if (task.projectName !== candidate.projectName) continue;
      const score = jaccard(task._tokens, candidate._tokens);
      if (score > bestScore) {
        bestScore = score;
        best = task;
      }
    }

    if (best && bestScore >= SIMILARITY_THRESHOLD) {
      mergeInto(best, candidate);
    } else {
      result.push(candidate);
      byId.set(candidate.id, candidate);
    }
  }

  return result.map(({ _tokens, ...task }) => task);
}

/** Effective status, respecting a user override. */
export function effectiveStatus(task) {
  if (task.userStatus === 'done') return 'done';
  if (task.userStatus === 'dismissed') return 'dismissed';
  if (task.userStatus === 'open') return task.status === 'done' ? 'todo' : task.status;
  return task.status;
}

const SORT_PRIORITY = { high: 0, medium: 1, low: 2 };
const SORT_STATUS = { blocked: 0, in_progress: 1, todo: 2, done: 3, dismissed: 4 };

/** Most-actionable first: open before closed, urgent before not, recent before stale. */
export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const statusDelta =
      SORT_STATUS[effectiveStatus(a)] - SORT_STATUS[effectiveStatus(b)];
    if (statusDelta !== 0) return statusDelta;

    const priorityDelta = SORT_PRIORITY[a.priority] - SORT_PRIORITY[b.priority];
    if (priorityDelta !== 0) return priorityDelta;

    if (a.sources.length !== b.sources.length) {
      return b.sources.length - a.sources.length; // repeatedly mentioned = nagging
    }
    return String(b.lastSeen || '').localeCompare(String(a.lastSeen || ''));
  });
}
