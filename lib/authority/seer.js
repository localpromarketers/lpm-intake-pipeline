// SEER import layer — rolls a SEER export up into Authority Radar's 12 signals.
//
// SEER (Relationalseo) can report at three granularities; this importer accepts
// any mix of them and rolls everything up to the 12 category signals + the
// Authority Index:
//   • OS-tool scores        — { tools: { EntityOS: 72, GBPOS: { score: 80 } } }
//       a tool's score is distributed across the categories it diagnoses,
//       weighted by how many of that category's classifiers the tool evaluates.
//   • category scores       — { categories: { local_spatial: 64 } }  (direct)
//   • classifier scores     — { classifiers: { topical_authority: 55 } }
//       rolled into that classifier's category.
//   • weights               — { weights: { local_spatial: 16 } }  (recalibration)
//
// Keys may also appear at the top level. Everything is matched against the real
// SEER taxonomy (seer-taxonomy.js); unrecognized fields are reported as
// warnings, never guessed. SEER = measured, so it overrides the engine's
// estimate for every signal it covers.

import { SIGNALS } from './framework.js';
import {
  TOOLS,
  CATEGORIES,
  CLASSIFIERS,
  TOOL_CATEGORY_COVERAGE,
  AUX_TOOLS,
} from './seer-taxonomy.js';

export const SEER_SCHEMA_DOC = `{
  "source": "SEER",
  "business": "Summit Plumbing Co.",        // optional
  "tools": {                                 // 9 OS diagnostics; 0-100; any subset
    "EntityOS": 72, "GBPOS": { "score": 80, "measured": "…" },
    "PageOS": 61, "CredentialOS": 90, "BacklinkOS": 48,
    "DriftOS": 64, "DiagnosticOS": 58, "RewriteOS": 55, "VisionOS": 40
  },
  "categories": { "local_spatial": 66 },     // optional direct category (signal) scores
  "classifiers": { "review_velocity": 40 },  // optional classifier-level scores
  "weights": { "external_reputation": 15 }   // optional index recalibration (renormalized to 100)
}`;

// Weight of each contribution source in the per-category weighted mean.
const W_CATEGORY = 4; // a direct category score is authoritative
const W_CLASSIFIER = 2; // a specific classifier reading
// tools contribute with weight = classifiers-covered count (see below)

// All lookups are keyed by slug (alphanumeric only) so ids with underscores,
// display labels, and mixed casing all resolve the same way.
function slug(s) {
  return String(s).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

const VALID_CATEGORY = new Set(CATEGORIES.map((c) => c.id));
const CATEGORY_BY_KEY = {};
for (const c of CATEGORIES) {
  CATEGORY_BY_KEY[slug(c.id)] = c.id;
  CATEGORY_BY_KEY[slug(c.label)] = c.id;
}
const TOOL_BY_KEY = {};
for (const t of TOOLS) {
  TOOL_BY_KEY[slug(t.id)] = t;
  TOOL_BY_KEY[slug(t.name)] = t;
}
const CLASSIFIER_BY_KEY = {};
for (const cls of CLASSIFIERS) {
  CLASSIFIER_BY_KEY[slug(cls.id)] = cls;
  CLASSIFIER_BY_KEY[slug(cls.name)] = cls;
}
const AUX_KEYS = new Set(AUX_TOOLS.flatMap((t) => [slug(t.id), slug(t.name)]));
function clampScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}
function readEntry(rawVal) {
  if (typeof rawVal === 'number') {
    const s = clampScore(rawVal);
    return s == null ? null : { score: s };
  }
  if (rawVal && typeof rawVal === 'object') {
    const s = clampScore(rawVal.score ?? rawVal.value ?? rawVal.rating);
    if (s == null) return null;
    const out = { score: s };
    const measured = rawVal.measured || rawVal.note || rawVal.detail;
    if (measured) out.measured = String(measured);
    if (rawVal.gap) out.gap = String(rawVal.gap);
    return out;
  }
  return null;
}

export function normalizeSeerData(input) {
  const result = {
    valid: false,
    signalScores: {}, // category id -> 0-100
    evidence: {}, // category id -> { whatEnginesSee, gap }
    weightOverrides: null,
    coveredKeys: [],
    toolsUsed: [],
    classifiersUsed: 0,
    categoriesDirect: 0,
    competitorContext: null,
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

  // Collect candidate [key, value] entries from the typed buckets + top level.
  const RESERVED = new Set(['tools', 'categories', 'signals', 'classifiers', 'weights', 'source', 'business']);
  const entries = [];
  const collect = (obj, kind) => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj)) {
        if (!RESERVED.has(slug(k))) entries.push([k, v, kind]);
      }
    }
  };
  collect(data.tools, 'tool');
  collect(data.categories, 'category');
  collect(data.signals, 'category');
  collect(data.classifiers, 'classifier');
  collect(data, 'auto'); // top-level, type inferred

  const contributions = {}; // catId -> [{ score, weight, from }]
  const evidenceBits = {}; // catId -> { measured:[], gap:[] }
  const toolsUsed = new Set();
  let classifiersUsed = 0;
  let categoriesDirect = 0;

  const addContribution = (catId, score, weight, from, ev) => {
    (contributions[catId] ||= []).push({ score, weight, from });
    if (ev && (ev.measured || ev.gap)) {
      const b = (evidenceBits[catId] ||= { measured: [], gap: [] });
      if (ev.measured) b.measured.push(`${from}: ${ev.measured}`);
      if (ev.gap) b.gap.push(ev.gap);
    }
  };

  for (const [rawKey, rawVal, kind] of entries) {
    const k = slug(rawKey);

    // Aux tools (CompetitorScope, SERP Overlap, ChatGPT-OS): context, not scored.
    if (AUX_KEYS.has(k)) {
      const entry = readEntry(rawVal);
      if (entry) result.competitorContext = { key: rawKey, ...entry };
      continue;
    }

    // 1) OS tool?
    const tool = (kind === 'tool' || kind === 'auto') ? TOOL_BY_KEY[k] : null;
    if (tool) {
      const entry = readEntry(rawVal);
      if (!entry) {
        result.warnings.push(`SEER tool "${rawKey}" had no usable score — skipped.`);
        continue;
      }
      toolsUsed.add(tool.name);
      const coverage = TOOL_CATEGORY_COVERAGE[tool.id] || {};
      // Attach the tool's measured note to the category it diagnoses most.
      const primaryCat = Object.entries(coverage).sort((a, b) => b[1] - a[1])[0]?.[0];
      for (const [catId, count] of Object.entries(coverage)) {
        addContribution(catId, entry.score, count, tool.name, catId === primaryCat ? entry : null);
      }
      continue;
    }

    // 2) Category (signal) direct?
    const catId = (kind === 'category' || kind === 'auto') ? CATEGORY_BY_KEY[k] : null;
    if (catId && VALID_CATEGORY.has(catId)) {
      const entry = readEntry(rawVal);
      if (!entry) {
        result.warnings.push(`SEER category "${rawKey}" had no usable score — skipped.`);
        continue;
      }
      categoriesDirect++;
      addContribution(catId, entry.score, W_CATEGORY, 'SEER', entry);
      continue;
    }

    // 3) Individual classifier?
    const cls = CLASSIFIER_BY_KEY[k] || null;
    if (cls) {
      const entry = readEntry(rawVal);
      if (!entry) {
        result.warnings.push(`SEER classifier "${rawKey}" had no usable score — skipped.`);
        continue;
      }
      classifiersUsed++;
      addContribution(cls.category, entry.score, W_CLASSIFIER, cls.name, entry);
      continue;
    }

    result.warnings.push(`Unrecognized SEER field "${rawKey}" — skipped.`);
  }

  // Roll up to per-category scores (weighted mean).
  for (const [catId, contribs] of Object.entries(contributions)) {
    const wsum = contribs.reduce((a, c) => a + c.weight, 0) || 1;
    result.signalScores[catId] = Math.round(
      contribs.reduce((a, c) => a + c.score * c.weight, 0) / wsum
    );
    const bits = evidenceBits[catId];
    if (bits) {
      result.evidence[catId] = {
        ...(bits.measured.length ? { whatEnginesSee: bits.measured.slice(0, 2).join(' · ') } : {}),
        ...(bits.gap.length ? { gap: bits.gap.slice(0, 2).join(' ') } : {}),
      };
    }
  }

  // Optional weight calibration (category-level).
  if (data.weights && typeof data.weights === 'object') {
    const overrides = {};
    let any = false;
    for (const [rawKey, rawVal] of Object.entries(data.weights)) {
      const catId = CATEGORY_BY_KEY[slug(rawKey)];
      const w = Number(rawVal);
      if (catId && Number.isFinite(w) && w >= 0) {
        overrides[catId] = w;
        any = true;
      } else if (!catId) {
        result.warnings.push(`Unrecognized SEER weight field "${rawKey}" — skipped.`);
      }
    }
    if (any) result.weightOverrides = overrides;
  }

  result.coveredKeys = Object.keys(result.signalScores);
  result.toolsUsed = [...toolsUsed];
  result.classifiersUsed = classifiersUsed;
  result.categoriesDirect = categoriesDirect;
  result.valid = result.coveredKeys.length > 0;
  if (!result.valid && !result.warnings.length) {
    result.warnings.push('SEER data contained no recognizable tool, category, or classifier scores.');
  }
  return result;
}

// Merge SEER weight overrides onto default framework weights, renormalized to 100.
export function effectiveWeights(weightOverrides) {
  const base = Object.fromEntries(SIGNALS.map((s) => [s.key, s.weight]));
  if (!weightOverrides) return { weights: base, calibrated: false };
  const merged = { ...base, ...weightOverrides };
  const total = Object.values(merged).reduce((a, b) => a + b, 0) || 1;
  const weights = {};
  for (const key of Object.keys(base)) weights[key] = (merged[key] / total) * 100;
  return { weights, calibrated: true };
}
