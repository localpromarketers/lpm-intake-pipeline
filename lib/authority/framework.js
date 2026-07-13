// Authority Radar framework — grounded in SEER's classifier taxonomy.
//
// The signals here ARE SEER's 12 classifier categories (see seer-taxonomy.js),
// weighted for how much each drives an AI answer engine's decision to recommend
// a local home-services business. Weights sum to 100. Each signal carries the
// count of underlying SEER classifiers so the report traces back to the model.

import {
  CATEGORIES as SEER_CATEGORIES,
  CATEGORY_COUNT,
} from './seer-taxonomy.js';

export const CATEGORIES = {
  plumbing: {
    label: 'Plumbing', emoji: '🔧',
    jobs: ['a burst pipe', 'a water heater replacement', 'a clogged main line'], emergency: true,
  },
  hvac: {
    label: 'HVAC', emoji: '🌡️',
    jobs: ['an AC that stopped cooling', 'a furnace replacement', 'a full system tune-up'], emergency: true,
  },
  electrical: {
    label: 'Electrical', emoji: '⚡',
    jobs: ['a panel upgrade', 'recurring breaker trips', 'EV charger installation'], emergency: true,
  },
  roofing: {
    label: 'Roofing', emoji: '🏠',
    jobs: ['storm damage', 'a full roof replacement', 'a persistent leak'], emergency: false,
  },
  landscaping: {
    label: 'Landscaping', emoji: '🌿',
    jobs: ['a full yard redesign', 'weekly maintenance', 'a new irrigation system'], emergency: false,
  },
};

// Signal copy + weight, keyed to SEER category ids. Weights sum to 100.
const SIGNAL_META = {
  identity_entity: {
    weight: 14,
    short: 'Whether engines resolve a clear, coherent business entity — topical authority, Knowledge Graph mapping, brand strength, consistent identity.',
    why: 'Before an engine can recommend you it has to be confident who you are. A coherent entity — one specialty, consistent identity, mapped into the Knowledge Graph — is the foundation every other signal rests on.',
  },
  local_spatial: {
    weight: 13,
    short: 'Proven presence in the geography you claim — proximity, neighborhood specificity, service-radius realism, local proof.',
    why: 'Home services is inherently local. Engines heavily weight verified spatial grounding; claiming a service area without localized proof causes "geographic ghosting" and you drop out at the city line.',
  },
  trust_credentials: {
    weight: 12,
    short: 'E-E-A-T and verifiable credentials — licenses, bonding/insurance, certifications, association membership, grounded claims.',
    why: 'Engines are risk-aware for home services. Verifiable, cross-linked credentials (state license #, NATE/EPA, BBB) turn self-claims into trust the model will repeat.',
  },
  content_utility: {
    weight: 12,
    short: 'Helpful, high-information content — first-party evidence, cost transparency, comparative utility, information gain over the corpus.',
    why: 'Retrieval engines ground answers in the page that best helps the buyer. Content with real experience, pricing and unique data gets cited; sales collateral gets suppressed.',
  },
  linguistic_authenticity: {
    weight: 6,
    short: 'Human, specific writing — lexical diversity, technical precision, regional idiom; low cliché/AI-pattern density.',
    why: 'AI-detection classifiers dampen generic, templated or machine-written copy. Authentic, specific language reads as genuine expertise rather than filler.',
  },
  visual_intelligence: {
    weight: 5,
    short: 'Authentic imagery — real team and project photos, not stock or AI-generated; passes visual authenticity checks.',
    why: 'Computer-vision classifiers flag stock and AI images, failing the experience check. Real photos of real work are proof engines can see.',
  },
  external_reputation: {
    weight: 12,
    short: 'Market reputation — review volume/velocity/sentiment, NAP consistency, press mentions, branded search, AI-inclusion.',
    why: 'Independent, corroborating reputation is the strongest external proxy. Reviews that confirm your claims, plus press and branded demand, are what an engine cites when it names you.',
  },
  link_authority: {
    weight: 8,
    short: 'Relational link authority — relevant, entity-validating backlinks; low toxicity; SGE-extractable citations.',
    why: 'Links from topically-related, trusted entities validate your identity in the graph and give engines an independent path to connect you to the query.',
  },
  technical_infra: {
    weight: 6,
    short: 'Machine-legibility — schema/structured data, crawlability, clean sectioning, GBP↔schema sync, AI-overview readiness.',
    why: 'Structured, crawlable, well-marked-up pages hand the engine your answer pre-parsed, making you easy to assemble into a recommendation.',
  },
  integrity_risk: {
    weight: 4,
    short: 'Absence of suppression triggers — scaled/templated content, doorway city pages, fake personas, review manipulation.',
    why: 'These are penalties, not perks: a single domain-level dampener (scaled content, spam risk) can cap everything else. Staying clean removes the ceiling.',
  },
  behavioral_validation: {
    weight: 4,
    short: 'User-interaction quality — intent capture speed, action visibility, low conversion friction, emergency-intent readiness.',
    why: 'NavBoost-class systems watch whether users are satisfied. Fast, frictionless paths (especially for urgent jobs) validate that you actually serve the intent.',
  },
  temporal_dynamics: {
    weight: 4,
    short: 'Freshness & stability — update velocity, review momentum, quality trajectory, business longevity, no service decay.',
    why: 'Engines favor businesses that read as alive and improving. Recent activity and a rising (not decaying) review trajectory are the tiebreakers.',
  },
};

// The signal set, in SEER's category order.
export const SIGNALS = SEER_CATEGORIES.map((c) => ({
  key: c.id,
  label: c.label,
  weight: SIGNAL_META[c.id].weight,
  short: SIGNAL_META[c.id].short,
  why: SIGNAL_META[c.id].why,
  classifierCount: CATEGORY_COUNT[c.id],
}));

export const SIGNAL_MAP = Object.fromEntries(SIGNALS.map((s) => [s.key, s]));

// Buyer-intent query templates. weightsInto references SEER category ids.
export const QUERY_TEMPLATES = [
  {
    type: 'best_overall',
    weightsInto: ['external_reputation', 'identity_entity', 'link_authority'],
    build: (c, city) => `Who is the best ${c.label.toLowerCase()} company in ${city}?`,
  },
  {
    type: 'reliable_for_job',
    weightsInto: ['trust_credentials', 'content_utility', 'external_reputation'],
    build: (c, city) =>
      `Can you recommend a reliable ${c.label.toLowerCase()} company near ${city} for ${c.jobs[0]}?`,
  },
  {
    type: 'best_reviews',
    weightsInto: ['external_reputation', 'behavioral_validation', 'temporal_dynamics'],
    build: (c, city) => `Which ${c.label.toLowerCase()} company in ${city} has the best reviews?`,
  },
  {
    type: 'compare_top',
    weightsInto: ['content_utility', 'identity_entity', 'technical_infra'],
    build: (c, city) => `Compare the top-rated ${c.label.toLowerCase()} companies in ${city}.`,
  },
  {
    type: 'transparent_pricing',
    weightsInto: ['content_utility', 'external_reputation', 'linguistic_authenticity'],
    build: (c, city) =>
      `Who offers the most transparent, upfront pricing for ${c.label.toLowerCase()} in ${city}?`,
  },
  {
    type: 'trust_credentials',
    weightsInto: ['trust_credentials', 'identity_entity', 'integrity_risk'],
    build: (c, city) =>
      `Which ${c.label.toLowerCase()} companies in ${city} are licensed, insured and well-established?`,
  },
];

export const EMERGENCY_TEMPLATE = {
  type: 'emergency',
  weightsInto: ['local_spatial', 'behavioral_validation', 'external_reputation'],
  build: (c, city) =>
    `I have ${c.jobs[c.jobs.length - 1]} in ${city} right now — who should I call for emergency ${c.label.toLowerCase()} service?`,
};

export function buildQueries(categoryKey, city) {
  const c = CATEGORIES[categoryKey];
  if (!c) return [];
  const queries = QUERY_TEMPLATES.map((t) => ({
    type: t.type, weightsInto: t.weightsInto, text: t.build(c, city),
  }));
  if (c.emergency) {
    queries.push({
      type: EMERGENCY_TEMPLATE.type,
      weightsInto: EMERGENCY_TEMPLATE.weightsInto,
      text: EMERGENCY_TEMPLATE.build(c, city),
    });
  }
  return queries;
}

export const TIERS = [
  { min: 0, name: 'Invisible', blurb: 'Answer engines don\'t surface this business yet. It shows up once, if at all — never as the recommendation.' },
  { min: 35, name: 'Emerging', blurb: 'Occasionally mentioned in a list, but rarely the pick. The foundational signals are partly there.' },
  { min: 60, name: 'Contender', blurb: 'A frequent option in AI answers. Close to go-to, but out-signaled by one or two rivals on key queries.' },
  { min: 80, name: 'Go-To Authority', blurb: 'The default recommendation in its category. Named first, cited by reason, hard to dislodge.' },
];

export function tierFor(index) {
  let tier = TIERS[0];
  for (const t of TIERS) if (index >= t.min) tier = t;
  return tier;
}
