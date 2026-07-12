// Authority Radar — the framework that defines HOW AI answer engines decide
// which home-services businesses to recommend.
//
// When someone asks ChatGPT / Claude / Gemini / Perplexity "who's the best
// plumber in Denver?", the model isn't guessing. It leans on a consistent set
// of authority signals it has absorbed from the open web: review consensus,
// third-party editorial mentions, citation consistency, content depth, entity
// clarity, credentials, sentiment themes, and engagement. This file encodes
// that signal set (with weights that sum to 100) plus the buyer-intent queries
// people actually type into answer engines for each home-services category.
//
// The engine (engine.js) scores a business against these signals and maps the
// gaps to a roadmap. Keeping the framework here — as plain data — means the
// same definitions drive the AI prompt, the heuristic fallback, and the UI.

export const CATEGORIES = {
  plumbing: {
    label: 'Plumbing',
    emoji: '🔧',
    jobs: ['a burst pipe', 'a water heater replacement', 'a clogged main line'],
    emergency: true,
  },
  hvac: {
    label: 'HVAC',
    emoji: '🌡️',
    jobs: ['an AC that stopped cooling', 'a furnace replacement', 'a full system tune-up'],
    emergency: true,
  },
  electrical: {
    label: 'Electrical',
    emoji: '⚡',
    jobs: ['a panel upgrade', 'recurring breaker trips', 'EV charger installation'],
    emergency: true,
  },
  roofing: {
    label: 'Roofing',
    emoji: '🏠',
    jobs: ['storm damage', 'a full roof replacement', 'a persistent leak'],
    emergency: false,
  },
  landscaping: {
    label: 'Landscaping',
    emoji: '🌿',
    jobs: ['a full yard redesign', 'weekly maintenance', 'a new irrigation system'],
    emergency: false,
  },
};

// The eight authority signals. weight values sum to 100.
export const SIGNALS = [
  {
    key: 'review_corpus',
    label: 'Review Corpus',
    weight: 22,
    short: 'Volume, rating, recency & velocity of reviews across Google, Yelp, Angi & the BBB.',
    why: 'Answer engines treat review consensus as the single strongest proxy for "is this business good." Depth and freshness matter as much as the star rating — a 4.9 with 400 recent reviews outranks a 5.0 with 12.',
  },
  {
    key: 'editorial_mentions',
    label: 'Third-Party Editorial Mentions',
    weight: 16,
    short: '"Best of" lists, local press, curated roundups and directory features that name the business.',
    why: 'LLMs quote and paraphrase editorial sources. Being named in "10 best HVAC companies in [city]" roundups is what turns a business from "known" into "recommended," because the model has independent corroboration to cite.',
  },
  {
    key: 'content_authority',
    label: 'Content & Topical Authority',
    weight: 14,
    short: 'Depth of service pages, FAQs and guides that directly answer buyer questions.',
    why: 'Retrieval-based engines pull the passages that best answer the query. A business that publishes clear, specific answers to "how much does a panel upgrade cost" becomes the source the model grounds its recommendation in.',
  },
  {
    key: 'citation_consistency',
    label: 'Citation & NAP Consistency',
    weight: 12,
    short: 'Consistent Name / Address / Phone across authoritative directories the models trust.',
    why: 'Conflicting listings fracture the entity. When name, address and phone are identical everywhere, the engine is confident it is talking about one real, established business — and confidence is what gets you named.',
  },
  {
    key: 'credentials_trust',
    label: 'Credentials & Trust Proof',
    weight: 12,
    short: 'Licenses, insurance, manufacturer certifications, warranties, BBB accreditation.',
    why: 'For home services, engines are risk-aware: they surface businesses that visibly reduce the buyer\'s risk. Named licenses (state #), NATE / EPA certs and written warranties are trust tokens the model can repeat.',
  },
  {
    key: 'structured_entity',
    label: 'Structured Data & Entity Clarity',
    weight: 10,
    short: 'Schema.org LocalBusiness/Service markup and a complete, consistent Google Business Profile.',
    why: 'Structured data hands the engine the answer pre-parsed: service area, hours, services, price ranges. A complete GBP and clean schema make a business machine-legible, so it is far more likely to be assembled into an answer.',
  },
  {
    key: 'sentiment_differentiators',
    label: 'Sentiment & Differentiators',
    weight: 8,
    short: 'The specific, repeated praise themes that win specific queries (on-time, upfront pricing, 24/7).',
    why: 'Engines match the query to the differentiator. "Transparent pricing" queries go to the business whose reviews repeatedly say "no surprise fees." Owning a theme is how you win narrow, high-intent questions.',
  },
  {
    key: 'engagement_signals',
    label: 'Engagement & Freshness',
    weight: 6,
    short: 'Owner responses to reviews, answered Q&A, and recency of activity.',
    why: 'Active businesses read as alive and accountable. Responded-to reviews and fresh posts signal an operating, responsive company — a tiebreaker the engine uses between otherwise similar picks.',
  },
];

export const SIGNAL_MAP = Object.fromEntries(SIGNALS.map((s) => [s.key, s]));

// Buyer-intent query templates. These are the questions real customers type
// into answer engines. Each targets a different mix of signals, which is why
// a business can win one query type and lose another.
export const QUERY_TEMPLATES = [
  {
    type: 'best_overall',
    weightsInto: ['review_corpus', 'editorial_mentions', 'citation_consistency'],
    build: (c, city) => `Who is the best ${c.label.toLowerCase()} company in ${city}?`,
  },
  {
    type: 'reliable_for_job',
    weightsInto: ['review_corpus', 'credentials_trust', 'content_authority'],
    build: (c, city) =>
      `Can you recommend a reliable ${c.label.toLowerCase()} company near ${city} for ${c.jobs[0]}?`,
  },
  {
    type: 'best_reviews',
    weightsInto: ['review_corpus', 'sentiment_differentiators', 'engagement_signals'],
    build: (c, city) => `Which ${c.label.toLowerCase()} company in ${city} has the best reviews?`,
  },
  {
    type: 'compare_top',
    weightsInto: ['editorial_mentions', 'content_authority', 'structured_entity'],
    build: (c, city) => `Compare the top-rated ${c.label.toLowerCase()} companies in ${city}.`,
  },
  {
    type: 'transparent_pricing',
    weightsInto: ['sentiment_differentiators', 'content_authority', 'review_corpus'],
    build: (c, city) =>
      `Who offers the most transparent, upfront pricing for ${c.label.toLowerCase()} in ${city}?`,
  },
  {
    type: 'trust_credentials',
    weightsInto: ['credentials_trust', 'citation_consistency', 'structured_entity'],
    build: (c, city) =>
      `Which ${c.label.toLowerCase()} companies in ${city} are licensed, insured and well-established?`,
  },
];

// Emergency query — only for categories where it applies.
export const EMERGENCY_TEMPLATE = {
  type: 'emergency',
  weightsInto: ['citation_consistency', 'structured_entity', 'review_corpus'],
  build: (c, city) =>
    `I have ${c.jobs[c.jobs.length - 1]} in ${city} right now — who should I call for emergency ${c.label.toLowerCase()} service?`,
};

export function buildQueries(categoryKey, city) {
  const c = CATEGORIES[categoryKey];
  if (!c) return [];
  const queries = QUERY_TEMPLATES.map((t) => ({
    type: t.type,
    weightsInto: t.weightsInto,
    text: t.build(c, city),
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
