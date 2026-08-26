/**
 * Condenses a conversation into a transcript small enough to scan cheaply
 * without dropping the parts that actually carry commitments.
 */

/**
 * Phrases that tend to surround a commitment, a decision, or an open loop.
 * Used to rank messages when a conversation is too long to send whole — and
 * to flag conversations that look like pure Q&A.
 */
const ACTION_PATTERNS = [
  /\bto-?dos?\b/i,
  /\baction items?\b/i,
  /\bnext steps?\b/i,
  /\bfollow(?:ing)?[ -]up\b/i,
  /\bi(?:'| wi)ll\b/i,
  /\bwe(?:'| wi)ll\b/i,
  /\byou(?:'| wi)ll need\b/i,
  /\b(?:need|needs|needed) to\b/i,
  /\b(?:should|must|have to|has to) \w+/i,
  /\bmake sure\b/i,
  /\bdon'?t forget\b/i,
  /\bremember to\b/i,
  /\bstill (?:need|have|to)\b/i,
  /\bwaiting (?:on|for)\b/i,
  /\bblocked (?:on|by)\b/i,
  /\bpending\b/i,
  /\bdeadline\b/i,
  /\bdue (?:by|on|date)\b/i,
  /\bby (?:mon|tues|wednes|thurs|fri|satur|sun)day\b/i,
  /\bnext week\b/i,
  /\bonce (?:you|we|that)\b/i,
  /\blet'?s \w+/i,
  /\bcan you \w+/i,
  /\bTODO\b/,
  /\bFIXME\b/,
  /^\s*[-*]\s*\[[ x]\]/m, // markdown checkboxes
];

/** How many action phrases a message contains. */
export function actionScore(text) {
  let score = 0;
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.test(text)) score += 1;
  }
  return score;
}

/** Whether a conversation shows any sign of containing commitments. */
export function hasActionSignal(conversation) {
  return conversation.messages.some((message) => actionScore(message.text) > 0);
}

/** Truncate around the middle so both the setup and the conclusion survive. */
function clip(text, limit) {
  if (text.length <= limit) return text;
  const head = Math.floor(limit * 0.6);
  const tail = limit - head - 20;
  return `${text.slice(0, head)}\n…[trimmed]…\n${text.slice(-tail)}`;
}

const DEFAULT_MAX_CHARS = 48000;
const DEFAULT_MAX_MESSAGE_CHARS = 4000;

/**
 * Build the transcript sent to the model.
 *
 * When the conversation fits the budget it is sent verbatim. When it does not,
 * messages are ranked (action language, recency, and human turns score higher),
 * the top-ranked set that fits is kept, and dropped runs are replaced by an
 * explicit elision marker so the model knows the transcript is not continuous.
 */
export function buildTranscript(conversation, options = {}) {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const maxMessageChars = options.maxMessageChars ?? DEFAULT_MAX_MESSAGE_CHARS;

  const messages = conversation.messages.map((message, index) => ({
    index,
    role: message.role,
    text: clip(message.text.trim(), maxMessageChars),
  }));

  const render = (message) =>
    `${message.role === 'human' ? 'PERSON' : 'CLAUDE'}: ${message.text}`;

  const full = messages.map(render).join('\n\n');
  if (full.length <= maxChars) {
    return { text: full, truncated: false, messagesKept: messages.length };
  }

  const total = messages.length;
  const scored = messages.map((message) => {
    const recency = message.index / Math.max(total - 1, 1); // 0 → 1, newest last
    const score =
      actionScore(message.text) * 10 +
      recency * 6 +
      (message.role === 'human' ? 3 : 0) +
      // The closing exchange is where "so what's left" usually lives.
      (message.index >= total - 4 ? 8 : 0) +
      // Keep the opening so the model knows what the thread is about.
      (message.index <= 1 ? 5 : 0);
    return { message, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const keep = new Set();
  let used = 0;
  for (const { message } of scored) {
    const cost = render(message).length + 2;
    if (used + cost > maxChars) continue;
    keep.add(message.index);
    used += cost;
  }

  const pieces = [];
  let gap = false;
  for (const message of messages) {
    if (keep.has(message.index)) {
      if (gap) pieces.push('…[earlier messages omitted]…');
      pieces.push(render(message));
      gap = false;
    } else {
      gap = true;
    }
  }
  if (gap) pieces.push('…[later messages omitted]…');

  return { text: pieces.join('\n\n'), truncated: true, messagesKept: keep.size };
}

/** Very rough token estimate for cost previews (~4 chars per token). */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate a conversation's transcript size without building it.
 *
 * buildTranscript() sorts and re-renders every message; running it across a
 * whole export just to price a scan blocks the UI on large imports. Summing
 * lengths and clamping to the budget gets within a few percent for free.
 */
export function estimateTranscriptTokens(conversation, options = {}) {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const maxMessageChars = options.maxMessageChars ?? DEFAULT_MAX_MESSAGE_CHARS;

  let chars = 0;
  for (const message of conversation.messages) {
    chars += Math.min(message.text.length, maxMessageChars) + 10; // speaker label
    if (chars >= maxChars) return Math.ceil(maxChars / 4);
  }
  return Math.ceil(chars / 4);
}
