/** Output formats for a scanned task list. */

import { effectiveStatus, sortTasks } from './merge.mjs';

const STATUS_BOX = {
  todo: '[ ]',
  in_progress: '[~]',
  blocked: '[!]',
  done: '[x]',
  dismissed: '[-]',
};

const PRIORITY_TAG = { high: '**high**', medium: 'medium', low: 'low' };

function groupByProject(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const key = task.projectName || 'No project';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

/**
 * Markdown checklist grouped by project.
 * `options.includeDismissed` and `options.includeDone` default to false.
 */
export function toMarkdown(tasks, options = {}) {
  const {
    includeDone = false,
    includeDismissed = false,
    title = 'Tasks from Claude conversations',
    generatedAt = null,
  } = options;

  const visible = tasks.filter((task) => {
    const status = effectiveStatus(task);
    if (status === 'dismissed') return includeDismissed;
    if (status === 'done') return includeDone;
    return true;
  });

  const lines = [`# ${title}`, ''];
  if (generatedAt) lines.push(`_Generated ${generatedAt}_`, '');
  lines.push(`${visible.length} open item(s) across ${groupByProject(visible).length} project(s).`, '');

  for (const [project, group] of groupByProject(visible)) {
    lines.push(`## ${project}`, '');
    for (const task of sortTasks(group)) {
      const status = effectiveStatus(task);
      const meta = [PRIORITY_TAG[task.priority]];
      if (task.due) meta.push(`due: ${task.due}`);
      if (status === 'blocked') meta.push('blocked');
      if (task.owner === 'other') meta.push('owner: someone else');
      if (task.sources.length > 1) meta.push(`mentioned ${task.sources.length}×`);

      lines.push(`- ${STATUS_BOX[status]} **${task.title}** — ${meta.join(' · ')}`);
      if (task.detail) lines.push(`  - ${task.detail}`);
      for (const source of task.sources.slice(0, 3)) {
        const link = source.url
          ? `[${source.conversationTitle}](${source.url})`
          : source.conversationTitle;
        lines.push(`  - From: ${link}`);
      }
      if (task.notes) lines.push(`  - Note: ${task.notes}`);
    }
    lines.push('');
  }

  if (visible.length === 0) {
    lines.push('_Nothing outstanding._', '');
  }

  return lines.join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for importing into a spreadsheet or another task tracker. */
export function toCsv(tasks) {
  const header = [
    'project',
    'title',
    'detail',
    'status',
    'priority',
    'owner',
    'category',
    'due',
    'mentions',
    'last_seen',
    'sources',
    'notes',
  ];

  const rows = sortTasks(tasks).map((task) =>
    [
      task.projectName,
      task.title,
      task.detail,
      effectiveStatus(task),
      task.priority,
      task.owner,
      task.category,
      task.due,
      task.sources.length,
      task.lastSeen || '',
      task.sources.map((s) => s.url || s.conversationTitle).join(' | '),
      task.notes,
    ].map(csvCell).join(',')
  );

  return [header.join(','), ...rows].join('\n');
}
