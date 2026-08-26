/**
 * Task extraction: one conversation transcript in, structured tasks out.
 * Shared by the /api/tasks/scan route and the CLI scanner.
 */

export const DEFAULT_MODEL = 'claude-opus-5';
export const DEFAULT_EFFORT = 'medium';

export const STATUSES = ['todo', 'in_progress', 'blocked', 'done'];
export const PRIORITIES = ['high', 'medium', 'low'];
export const OWNERS = ['you', 'claude', 'other', 'unknown'];
export const CATEGORIES = [
  'build',
  'fix',
  'decide',
  'write',
  'research',
  'follow_up',
  'admin',
];

export const TASK_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'One sentence describing what this conversation was about.',
    },
    tasks: {
      type: 'array',
      description: 'Outstanding work items. Empty when the conversation has none.',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description:
              'The action, phrased as an imperative under 90 characters. E.g. "Wire the intake form to Supabase storage".',
          },
          detail: {
            type: 'string',
            description:
              'One or two sentences of context: what it involves and why it came up.',
          },
          status: { type: 'string', enum: STATUSES },
          priority: { type: 'string', enum: PRIORITIES },
          owner: { type: 'string', enum: OWNERS },
          category: { type: 'string', enum: CATEGORIES },
          due: {
            type: 'string',
            description:
              'Deadline exactly as stated ("by Friday", "before launch", "2026-09-01"). Empty string when none was given.',
          },
          evidence: {
            type: 'string',
            description:
              'A verbatim quote of at most 200 characters from the transcript that establishes this task.',
          },
        },
        required: [
          'title',
          'detail',
          'status',
          'priority',
          'owner',
          'category',
          'due',
          'evidence',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'tasks'],
  additionalProperties: false,
};

export const SYSTEM_PROMPT = `You read transcripts of conversations between a person and Claude, and pull out the work that is still outstanding.

The person you are helping has many of these conversations across many projects and has lost track of what they committed to. Your job is to give them back a trustworthy list — not a summary of the conversation.

What counts as a task:
- Work the person said they would do, or was asked to do.
- Work Claude proposed and the person accepted, or left unanswered.
- Decisions that were deferred ("let's figure out pricing later").
- Things explicitly blocked or waiting on someone else.
- Concrete follow-ups implied by unfinished work ("this still needs tests").

What does NOT count:
- Anything finished inside the conversation with no remaining follow-up.
- Claude's generic suggestions the person ignored or moved past.
- Restating what the conversation was about.
- Hypotheticals, examples, and sample data that were never adopted.
- Steps in an explanation or tutorial the person only asked about.

Rules:
- Every task must be grounded in the transcript. Quote the line that establishes it in "evidence". If you cannot quote it, do not report it.
- Write titles the person can act on months later without rereading the thread. Name the specific thing, not "follow up on the discussion".
- Merge near-duplicates within a conversation into one task.
- status: "done" only when the transcript shows it finished but a record is still useful; "blocked" when something external is in the way; "in_progress" when work has visibly started; otherwise "todo".
- priority: "high" for stated urgency, deadlines, or things other work depends on; "low" for nice-to-haves and someday ideas; "medium" otherwise.
- owner: "you" for the person, "claude" for work delegated to Claude that was never delivered, "other" for a named third party, "unknown" when unclear.
- The transcript may contain gap markers like "…[earlier messages omitted]…". Do not infer tasks across a gap.
- Returning zero tasks is the correct answer for conversations that were pure Q&A, research, or brainstorming. Do not invent work to fill the list.`;

function buildUserPrompt(conversation, transcript) {
  const header = [
    `Project: ${conversation.projectName || 'No project'}`,
    `Conversation: ${conversation.title}`,
    conversation.updatedAt ? `Last active: ${conversation.updatedAt}` : null,
    transcript.truncated
      ? 'Note: this transcript was condensed; gaps are marked inline.'
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `${header}\n\n--- TRANSCRIPT ---\n${transcript.text}\n--- END TRANSCRIPT ---\n\nExtract the outstanding tasks from this conversation.`;
}

/** Coerce a model-returned task into the shape the rest of the app expects. */
function sanitizeTask(task) {
  const oneOf = (value, allowed, fallback) =>
    allowed.includes(value) ? value : fallback;

  return {
    title: String(task.title || '').trim().slice(0, 200),
    detail: String(task.detail || '').trim(),
    status: oneOf(task.status, STATUSES, 'todo'),
    priority: oneOf(task.priority, PRIORITIES, 'medium'),
    owner: oneOf(task.owner, OWNERS, 'unknown'),
    category: oneOf(task.category, CATEGORIES, 'follow_up'),
    due: String(task.due || '').trim(),
    evidence: String(task.evidence || '').trim().slice(0, 400),
  };
}

/**
 * Run one extraction.
 *
 * @param {object} args
 * @param {import('@anthropic-ai/sdk').default} args.client Anthropic SDK client.
 * @param {object} args.conversation Normalized conversation metadata.
 * @param {object} args.transcript Result of buildTranscript().
 */
export async function extractTasks({
  client,
  conversation,
  transcript,
  model = DEFAULT_MODEL,
  effort = DEFAULT_EFFORT,
}) {
  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // Stable across every conversation in a scan, so it caches.
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: {
      effort,
      format: { type: 'json_schema', schema: TASK_SCHEMA },
    },
    messages: [
      { role: 'user', content: buildUserPrompt(conversation, transcript) },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(
      `Model declined to process this conversation (${response.stop_details?.category || 'unspecified'}).`
    );
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) throw new Error('Model returned no text content.');

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error('Model returned malformed JSON.');
  }

  return {
    summary: String(parsed.summary || '').trim(),
    tasks: (Array.isArray(parsed.tasks) ? parsed.tasks : [])
      .map(sanitizeTask)
      .filter((task) => task.title.length > 0),
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      cacheReadTokens: response.usage?.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage?.cache_creation_input_tokens ?? 0,
    },
  };
}
