import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { prompt, context } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const systemPrompt = `You are a professional website copywriter specializing in local service businesses. 
You write compelling, benefit-focused copy that converts visitors into customers.
Keep your tone ${context?.tone || 'PROFESSIONAL'} and write for a local audience.
Never use generic filler — every sentence should be specific and useful.
Return only the requested copy, no preamble or explanation.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    return NextResponse.json({ text });
  } catch (err) {
    console.error('AI route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
