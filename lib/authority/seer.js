// SEER import layer.
//
// SEER is Schieler DeLand's (Relationalseo) authority-measurement tool. Where
// Authority Radar's own engine *estimates* signal scores (from a model or a
// heuristic), SEER provides *measured* data — so when a SEER export is present
// it takes precedence, and its weight calibration can override our default
// priors.
//
// IMPORTANT: the exact field names in a real SEER export still need to be
// confirmed with Schieler. This module is deliberately forgiving: it accepts
// our canonical signal keys, a set of common aliases (see ALIASES), and both
// "flat" ({ review_corpus: 88 }) and "rich" ({ review_corpus: { score, note,
// gap } }) shapes. Anything it can't map is reported as a warning rather than
// silently dropped — nothing about SEER's real numbers is invented.

import { SIGNALS, SIGNAL_MAP } from './framework.js';

// Human-readable description of the shape Authority Radar expects. Map your
// SEER export to this — see docs/seer-import-example.json for a full example.
export const SEER_SCHEMA_DOC = `{
  "source": "SEER",
  "business": "Summit Plumbing Co.",           // optional, for confirmation
  "signals": {                                  // 0-100 per signal; any subset
    "review_corpus":        { "score": 88, "measured": "412 reviews · 4.8★ · 22 in last 30d", "gap": "..." },
    "editorial_mentions":   40,                 // shorthand: a bare number = score
    "citation_consistency": { "score": 72 }
    // ...any of the 8 canonical keys (or a known alias)
  },
  "weights": {                                  // optional weight calibration
    "review_corpus": 26, "editorial_mentions": 18
    // partial is fine; provided weights are renormalized to sum 100
  }
}`;

// Common alternate names → canonical signal key. Extend this when Schieler
// confirms SEER's actual field names.
const ALIASES = {
  reviews: 'review_corpus',
  review: 'review_corpus',
  review_velocity: 'review_corpus',
  ratings: 'review_corpus',
  mentions: 'editorial_mentions',
  editorial: 'editorial_mentions',
  press: 'editorial_mentions',
  backlinks: 'editorial_mentions',
  content: 'content_authority',
  topical_authority: 'content_authority',
  citations: 'citation_consistency',
  nap: 'citation_consistency',
  nap_consistency: 'citation_consistency',
  credentials: 'credentials_trust',
  trust: 'credentials_trust',
  licensing: 'credentials_trust',
  schema: 'structured_entity',
  structured_data: 'structured_entity',
  entity: 'structured_entity',
  gbp: 'structured_entity',
  sentiment: 'sentiment_differentiators',
  differentiators: 'sentiment_differentiators',
  engagement: 'engagement_signals',
  freshness: 'engagement_signals',
  responsiveness: 'engagement_signals',
};

const VALID_KEYS = new Set(SIGNALS.map((s) => s.key));

function resolveKey(k) {
  const norm = String(k).trim().toLowerCase();
  if (VALID_KEYS.has(norm)) return norm;
  return ALIASES[norm] || null;
}

function clampScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

// Parse a SEER export (object OR JSON string) into the normalized shape the
// engine consumes. Never throws on bad data — returns { valid, warnings, ... }.
export function normalizeSeerData(input) {
  const result = {
    valid: false,
    signalScores: {}, // key -> 0-100
    evidence: {}, // key -> { whatEnginesSee, gap }
    weightOverrides: null, // key -> weight (raw, pre-renormalization) or null
    coveredKeys: [],
    warnings: [],
    business: null,
  };
  if (input == null || input === '') return result;

  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (e) {
      result.warnings.push('SEER data was not valid JSON — ignored.');
      return result;
    }
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    result.warnings.push('SEER data must be a JSON object — ignored.');
    return result;
  }

  if (typeof data.business === 'string') result.business = data.business;

  // Signals may be under `signals`, or provided as top-level keys.
  const signals = (data.signals && typeof data.signals === 'object') ? data.signals : data;

  for (const [rawKey, rawVal] of Object.entries(signals)) {
    if (rawKey === 'weights' || rawKey === 'source' || rawKey === 'business') continue;
    const key = resolveKey(rawKey);
    if (!key) {
      result.warnings.push(`Unrecognized SEER field "${rawKey}" — skipped.`);
      continue;
    }
    let score = null;
    let evidence = {};
    if (typeof rawVal === 'number') {
      score = clampScore(rawVal);
    } else if (rawVal && typeof rawVal === 'object') {
      score = clampScore(rawVal.score ?? rawVal.value ?? rawVal.rating);
      const measured = rawVal.measured || rawVal.note || rawVal.detail;
      if (measured) evidence.whatEnginesSee = String(measured);
      if (rawVal.gap) evidence.gap = String(rawVal.gap);
    }
    if (score == null) {
      result.warnings.push(`SEER field "${rawKey}" had no usable score — skipped.`);
      continue;
    }
    result.signalScores[key] = score;
    if (evidence.whatEnginesSee || evidence.gap) result.evidence[key] = evidence;
  }

  // Optional weight calibration.
  if (data.weights && typeof data.weights === 'object') {
    const overrides = {};
    let any = false;
    for (const [rawKey, rawVal] of Object.entries(data.weights)) {
      const key = resolveKey(rawKey);
      const w = Number(rawVal);
      if (key && Number.isFinite(w) && w >= 0) {
        overrides[key] = w;
        any = true;
      } else if (!key) {
        result.warnings.push(`Unrecognized SEER weight field "${rawKey}" — skipped.`);
      }
    }
    if (any) result.weightOverrides = overrides;
  }

  result.coveredKeys = Object.keys(result.signalScores);
  result.valid = result.coveredKeys.length > 0;
  if (!result.valid && !result.warnings.length) {
    result.warnings.push('SEER data contained no recognizable signal scores.');
  }
  return result;
}

// Merge SEER weight overrides onto the default framework weights and renormalize
// so the effective weights still sum to 100. Signals SEER doesn't mention keep
// their default weight; the whole set is scaled to preserve a 0-100 index.
export function effectiveWeights(weightOverrides) {
  const base = Object.fromEntries(SIGNALS.map((s) => [s.key, s.weight]));
  if (!weightOverrides) return { weights: base, calibrated: false };
  const merged = { ...base, ...weightOverrides };
  const total = Object.values(merged).reduce((a, b) => a + b, 0) || 1;
  const weights = {};
  for (const key of Object.keys(base)) {
    weights[key] = (merged[key] / total) * 100;
  }
  return { weights, calibrated: true };
}
