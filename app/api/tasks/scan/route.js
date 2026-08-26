import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import {
  DEFAULT_EFFORT,
  DEFAULT_MODEL,
  extractTasks,
} from '../../../../lib/scanner/extract.mjs';

// One conversation per request: the client drives concurrency and progress,
// and no single request runs long enough to hit a platform timeout.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MODEL = process.env.TASK_SCANNER_MODEL || DEFAULT_MODEL;
const EFFORT = process.env.TASK_SCANNER_EFFORT || DEFAULT_EFFORT;

export async function POST(request) {
  // Scanning spends API credits, so the route is gated whenever a shared
  // secret is configured. Deployments without one stay open for local use.
  const requiredToken = process.env.TASK_SCANNER_TOKEN;
  if (requiredToken && request.headers.get('x-scanner-token') !== requiredToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { conversation, transcript } = body || {};
  if (!conversation?.id || !transcript?.text) {
    return NextResponse.json(
      { error: 'Expected { conversation: { id, title, ... }, transcript: { text } }.' },
      { status: 400 }
    );
  }

  try {
    const result = await extractTasks({
      client: new Anthropic({ apiKey }),
      conversation,
      transcript,
      model: MODEL,
      effort: EFFORT,
    });

    return NextResponse.json({ conversationId: conversation.id, ...result });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      // Surfaced separately so the client can back off instead of giving up.
      return NextResponse.json(
        { error: 'Rate limited by the Claude API.', retryable: true },
        { status: 429 }
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'Invalid ANTHROPIC_API_KEY.' }, { status: 500 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${err.status}): ${err.message}`, retryable: err.status >= 500 },
        { status: 502 }
      );
    }

    console.error('Task scan failed:', err);
    return NextResponse.json(
      { error: err.message || 'Scan failed.', retryable: false },
      { status: 500 }
    );
  }
}
