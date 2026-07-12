// Authority Radar engine (server-side only).
//
// Given a business (name, category, location, website, notes), it discovers how
// AI answer engines would treat it: which buyer queries it wins or loses, how it
// scores on each authority signal, and the prioritized roadmap to move from
// "shows up once" to "the go-to recommendation in its category."
//
// It prefers a real Claude analysis (ANTHROPIC_API_KEY). Without a key it falls
// back to a deterministic heuristic so the tool is always demoable — clearly
// flagged as `mode: 'estimated'` so nobody mistakes it for a live probe.

import {
  SIGNALS,
  SIGNAL_MAP,
  CATEGORIES,
  buildQueries,
  tierFor,
} from './framework.js';
import { normalizeSeerData, effectiveWeights } from './seer.js';

const MODEL = 'claude-sonnet-4-5-20250929';

// ── Public entry point ─────────────────────────────────────────────────────
export async function runAuthorityScan(input) {
  const business = normalizeInput(input);
  const category = CATEGORIES[business.category];
  if (!category) {
    throw new Error(`Unknown home-services category: ${business.category}`);
  }
  const queries = buildQueries(business.category, business.location);

  // SEER (Relationalseo) measured data, if supplied, is authoritative and
  // overrides the engine's own estimates. It may also recalibrate weights.
  const seer = normalizeSeerData(input.seerData);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let raw;
  let baseMode;
  if (apiKey) {
    try {
      raw = await analyzeWithClaude(apiKey, business, category, queries);
      baseMode = 'ai';
    } catch (err) {
      console.error('Authority AI analysis failed, using heuristic:', err);
      raw = heuristicAnalysis(business, category, queries);
      baseMode = 'estimated';
    }
  } else {
    raw = heuristicAnalysis(business, category, queries);
    baseMode = 'estimated';
  }

  // Mode reflects what actually drove the scores: SEER when it contributed,
  // otherwise the base engine (ai / estimated).
  const mode = seer.valid ? 'seer' : baseMode;
  return assembleResult(business, queries, raw, mode, seer, baseMode);
}

function normalizeInput(input) {
  return {
    businessName: (input.businessName || '').trim() || 'This business',
    category: (input.category || 'plumbing').trim(),
    location: (input.location || '').trim() || 'the local area',
    website: (input.website || '').trim(),
    notes: (input.notes || '').trim(),
  };
}

// ── Claude analysis ─────────────────────────────────────────────────────────
async function analyzeWithClaude(apiKey, business, category, queries) {
  const signalSpec = SIGNALS.map(
    (s) => `- ${s.key} ("${s.label}", weight ${s.weight}): ${s.short}`
  ).join('\n');

  const querySpec = queries
    .map((q, i) => `${i + 1}. [${q.type}] ${q.text}`)
    .join('\n');

  const system = `You are an expert in Answer Engine Optimization (AEO/GEO) for local home-services businesses. You understand exactly how large language models and AI answer engines (ChatGPT, Claude, Gemini, Perplexity, Google AI Overviews) decide which local businesses to recommend when a consumer asks for one.

You reason about eight authority signals that drive those recommendations:
${signalSpec}

You will be given a target business and a set of realistic buyer queries. Assess, as honestly and specifically as you can, how an AI answer engine would treat this business TODAY given only the information provided (treat unstated signals as unproven, not assumed-good). Be candid: most businesses that haven't done AEO work score low. Do not inflate.

Respond with ONLY a JSON object (no markdown, no prose) of this exact shape:
{
  "summary": "2-3 sentence honest assessment of where this business stands with AI answer engines and the single biggest lever to become the go-to recommendation.",
  "signals": [ { "key": "<one of the signal keys>", "score": <0-100 integer>, "whatEnginesSee": "<one sentence: what an engine can actually verify about this signal today>", "gap": "<one sentence: the specific missing piece>" } ],   // exactly one entry per signal key, all 8
  "queries": [ { "index": <1-based query number>, "visibility": "not_recommended" | "mentioned" | "top_pick", "rationale": "<one sentence on why the engine would or wouldn't surface this business for this query>" } ],  // one entry per query
  "roadmap": [ { "priority": "Quick Win" | "Foundational" | "Compounding", "title": "<imperative action, e.g. 'Get named in 3 local best-of roundups'>", "signalKey": "<signal this moves>", "why": "<one sentence tying it to becoming the recommended business>", "effort": "Low" | "Medium" | "High", "impact": "Low" | "Medium" | "High" } ]  // 5-7 items, ordered most valuable first
}`;

  const user = `TARGET BUSINESS
Name: ${business.businessName}
Category: ${category.label}
Location / service area: ${business.location}
Website: ${business.website || '(none provided)'}
What they told us about their signals (reviews, licenses, certifications, press, content, etc.):
${business.notes || '(nothing provided — assume these signals are unproven)'}

BUYER QUERIES TO ASSESS (these are what real customers ask AI engines):
${querySpec}

Produce the JSON assessment now.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  return parseJson(text);
}

function parseJson(text) {
  // Strip code fences and isolate the outermost JSON object.
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in model output');
  return JSON.parse(t.slice(start, end + 1));
}

// ── Heuristic fallback (deterministic, no API key needed) ───────────────────
// Reads the free-text notes for signal evidence and derives stable scores so
// the same input always yields the same read-out.
function heuristicAnalysis(business, category, queries) {
  const notes = business.notes.toLowerCase();
  const has = (...words) => words.some((w) => notes.includes(w));
  const seed = hash(business.businessName + business.location);
  // Small deterministic jitter (0-9) so different businesses differ a little.
  const jitter = (offset) => (seed >> offset) % 7;

  const evidence = {
    review_corpus: has('review', 'star', 'rating', 'google review', 'yelp'),
    editorial_mentions: has('press', 'featured', 'best of', 'award', 'magazine', 'news'),
    content_authority: has('blog', 'faq', 'guide', 'article', 'content', 'service page') || !!business.website,
    citation_consistency: has('directory', 'listing', 'nap', 'yelp', 'angi', 'bbb') || !!business.website,
    credentials_trust: has('licens', 'insur', 'certif', 'bonded', 'warranty', 'nate', 'epa', 'bbb'),
    structured_entity: has('schema', 'google business', 'gbp', 'structured') || !!business.website,
    sentiment_differentiators: has('on-time', 'transparent', 'upfront', 'guarantee', '24/7', 'emergency', 'family'),
    engagement_signals: has('respond', 'q&a', 'active', 'post'),
  };

  const signals = SIGNALS.map((s) => {
    const base = evidence[s.key] ? 55 : 22;
    const score = clamp(base + jitter(s.weight) * 3, 5, 92);
    return {
      key: s.key,
      score,
      whatEnginesSee: evidence[s.key]
        ? `Some evidence of ${s.label.toLowerCase()} was provided, but not enough for an engine to treat it as decisive.`
        : `No verifiable ${s.label.toLowerCase()} an answer engine could cite.`,
      gap: evidence[s.key]
        ? `Deepen and make ${s.label.toLowerCase()} publicly verifiable so engines can quote it.`
        : `Establish ${s.label.toLowerCase()} from scratch — this is currently invisible to AI engines.`,
    };
  });

  const scoreByKey = Object.fromEntries(signals.map((s) => [s.key, s.score]));
  const qResults = queries.map((q, i) => {
    const avg = q.weightsInto.reduce((a, k) => a + (scoreByKey[k] || 0), 0) / q.weightsInto.length;
    const visibility = avg >= 65 ? 'top_pick' : avg >= 42 ? 'mentioned' : 'not_recommended';
    const rationale =
      visibility === 'top_pick'
        ? `Strong on ${q.weightsInto.map((k) => SIGNAL_MAP[k].label).join(' & ')} — the engine has reasons to name it first.`
        : visibility === 'mentioned'
        ? `Enough presence to appear in a list, but a rival out-signals it on ${SIGNAL_MAP[q.weightsInto[0]].label}.`
        : `Too little verifiable ${SIGNAL_MAP[q.weightsInto[0]].label.toLowerCase()} for the engine to surface it here.`;
    return { index: i + 1, visibility, rationale };
  });

  const roadmap = buildHeuristicRoadmap(signals);
  const summary = `${business.businessName} currently reads to AI answer engines as ${
    average(signals.map((s) => s.score)) >= 60 ? 'a credible contender' : 'largely unproven'
  } in ${category.label} for ${business.location}. The fastest path to becoming the go-to recommendation is to make its strongest real-world signals publicly verifiable — starting with reviews and third-party mentions engines can cite.`;

  return { summary, signals, queries: qResults, roadmap };
}

function buildHeuristicRoadmap(signals) {
  const weakest = [...signals]
    .map((s) => ({ ...s, weight: SIGNAL_MAP[s.key].weight }))
    .sort((a, b) => a.score * (1 / a.weight) - b.score * (1 / b.weight))
    .sort((a, b) => b.weight - a.weight);

  const templates = {
    review_corpus: { priority: 'Quick Win', title: 'Launch a review-velocity system across Google, Yelp & Angi', effort: 'Low', impact: 'High', why: 'Review consensus is the strongest signal engines use; steady recent reviews compound fastest.' },
    editorial_mentions: { priority: 'Foundational', title: 'Earn placement in 3+ local "best-of" roundups & press', effort: 'Medium', impact: 'High', why: 'Editorial mentions give engines an independent source to cite when recommending you.' },
    content_authority: { priority: 'Compounding', title: 'Publish buyer-question service pages, FAQs & cost guides', effort: 'Medium', impact: 'Medium', why: 'Answering real buyer questions makes you the passage engines ground their answer in.' },
    citation_consistency: { priority: 'Quick Win', title: 'Unify Name/Address/Phone across every directory listing', effort: 'Low', impact: 'Medium', why: 'Consistent citations let engines trust you are one real, established business.' },
    credentials_trust: { priority: 'Quick Win', title: 'Publish license #, insurance, certifications & warranties', effort: 'Low', impact: 'Medium', why: 'Named trust tokens reduce buyer risk — exactly what engines surface for home services.' },
    structured_entity: { priority: 'Foundational', title: 'Complete the Google Business Profile & add LocalBusiness schema', effort: 'Medium', impact: 'Medium', why: 'Machine-legible data makes you easy to assemble into an answer.' },
    sentiment_differentiators: { priority: 'Compounding', title: 'Own one differentiator theme (e.g. upfront pricing) in reviews & copy', effort: 'Medium', impact: 'Medium', why: 'Owning a theme wins the narrow, high-intent queries that convert.' },
    engagement_signals: { priority: 'Quick Win', title: 'Respond to every review and keep the profile active', effort: 'Low', impact: 'Low', why: 'Responsiveness is the tiebreaker between otherwise similar picks.' },
  };

  return weakest.slice(0, 6).map((s) => ({ signalKey: s.key, ...templates[s.key] }));
}

// ── Assembly: compute weighted index, tier, visibility rate ─────────────────
function assembleResult(business, queries, raw, mode, seer, baseMode) {
  const signalById = {};
  for (const s of raw.signals || []) signalById[s.key] = s;

  // Effective (possibly SEER-calibrated) weights, rounded for display but kept
  // precise for the index math.
  const { weights: effWeights, calibrated } = effectiveWeights(
    seer && seer.valid ? seer.weightOverrides : null
  );

  const signals = SIGNALS.map((def) => {
    const got = signalById[def.key] || {};
    const seerScore = seer && seer.valid ? seer.signalScores[def.key] : undefined;
    const fromSeer = seerScore != null;
    const score = clamp(Math.round(fromSeer ? seerScore : got.score ?? 0), 0, 100);
    const seerEv = (seer && seer.evidence[def.key]) || {};
    return {
      key: def.key,
      label: def.label,
      weight: Math.round(effWeights[def.key] * 10) / 10,
      baseWeight: def.weight,
      why: def.why,
      short: def.short,
      score,
      source: fromSeer ? 'seer' : mode === 'seer' ? baseMode : mode,
      status: score >= 70 ? 'strong' : score >= 45 ? 'partial' : 'weak',
      whatEnginesSee: seerEv.whatEnginesSee || got.whatEnginesSee || '',
      gap: seerEv.gap || got.gap || '',
    };
  });

  // Index uses the precise effective weights (which sum to 100).
  const authorityIndex = Math.round(
    signals.reduce((a, s) => a + s.score * effWeights[s.key], 0) / 100
  );
  const tier = tierFor(authorityIndex);

  const qByIndex = {};
  for (const q of raw.queries || []) qByIndex[q.index] = q;
  const queryResults = queries.map((q, i) => {
    const got = qByIndex[i + 1] || {};
    return {
      text: q.text,
      type: q.type,
      visibility: normalizeVisibility(got.visibility),
      rationale: got.rationale || '',
    };
  });
  const recommended = queryResults.filter((q) => q.visibility !== 'not_recommended').length;
  const topPicks = queryResults.filter((q) => q.visibility === 'top_pick').length;
  const visibilityRate = queryResults.length
    ? Math.round((recommended / queryResults.length) * 100)
    : 0;

  // When SEER measured data drove the scores, regenerate the roadmap from the
  // final (SEER) scores so it can't contradict them; otherwise use the roadmap
  // the AI/heuristic produced alongside its scores.
  const roadmapSource =
    seer && seer.valid ? buildHeuristicRoadmap(signals) : raw.roadmap || [];
  const roadmap = roadmapSource.map((r) => ({
    priority: ['Quick Win', 'Foundational', 'Compounding'].includes(r.priority)
      ? r.priority
      : 'Foundational',
    title: r.title || '',
    signalKey: r.signalKey || '',
    signalLabel: SIGNAL_MAP[r.signalKey]?.label || '',
    why: r.why || '',
    effort: r.effort || 'Medium',
    impact: r.impact || 'Medium',
  }));

  return {
    business,
    mode,
    generatedAt: new Date().toISOString(),
    authorityIndex,
    tier: tier.name,
    tierBlurb: tier.blurb,
    summary: raw.summary || '',
    signals,
    queries: queryResults,
    visibilityRate,
    topPicks,
    recommendedCount: recommended,
    roadmap,
    seer: {
      applied: !!(seer && seer.valid),
      calibratedWeights: calibrated,
      coveredSignals: seer ? seer.coveredKeys : [],
      warnings: seer ? seer.warnings : [],
    },
  };
}

function normalizeVisibility(v) {
  return ['not_recommended', 'mentioned', 'top_pick'].includes(v) ? v : 'not_recommended';
}

// ── small utils ─────────────────────────────────────────────────────────────
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
function average(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
