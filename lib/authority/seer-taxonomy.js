// SEER classifier taxonomy — the grounding data for Authority Radar.
//
// This is Schieler DeLand's (Relationalseo) SEER model captured as data: the 12
// classifier CATEGORIES that answer engines / Google systems evaluate, the 9
// diagnostic OS TOOLS, and all 205 named CLASSIFIERS with the category they
// belong to and which tools evaluate them.
//
// Authority Radar's 8-ish signals are superseded by these 12 categories (see
// framework.js), so the product speaks SEER's language: a SEER scan can drive
// the scores at tool, category, or individual-classifier granularity, and every
// signal in the report traces back to real SEER classifiers.
//
// Tool codes (compact): E=EntityOS d=DiagnosticOS r=DriftOS P=PageOS
// W=RewriteOS V=VisionOS B=BacklinkOS C=CredentialOS G=GBPOS

export const TOOLS = [
  { code: 'E', id: 'entityos', name: 'EntityOS', purpose: 'Resolve and map knowledge-graph entities' },
  { code: 'd', id: 'diagnosticos', name: 'DiagnosticOS', purpose: 'Diagnose which classifier signals are suppressing the entity' },
  { code: 'r', id: 'driftos', name: 'DriftOS', purpose: 'Detect entity drift across ranking factors' },
  { code: 'P', id: 'pageos', name: 'PageOS', purpose: 'Evaluate on-page content integrity and entity alignment' },
  { code: 'W', id: 'rewriteos', name: 'RewriteOS', purpose: 'Analyze content entropy and rewrite with entity grounding' },
  { code: 'V', id: 'visionos', name: 'VisionOS', purpose: 'Detect AI-generated images and visual authenticity signals' },
  { code: 'B', id: 'backlinkos', name: 'BacklinkOS', purpose: 'Evaluate backlink quality and relational authority' },
  { code: 'C', id: 'credentialos', name: 'CredentialOS', purpose: 'Audit E-E-A-T signals and credential authority' },
  { code: 'G', id: 'gbpos', name: 'GBPOS', purpose: 'Diagnose Google Business Profile and local signals' },
];

// Tools SEER exposes that are context, not a core diagnostic scored into signals.
export const AUX_TOOLS = [
  { id: 'chatgptos', name: 'ChatGPT-OS', note: 'LLM inclusion (beta)' },
  { id: 'serpoverlap', name: 'SERP Overlap', note: 'keyword cannibalization / overlap' },
  { id: 'competitorscope', name: 'CompetitorScope', note: 'competitor landscape & ranking gaps' },
];

const TOOL_BY_CODE = Object.fromEntries(TOOLS.map((t) => [t.code, t]));

// The 12 categories, in SEER's order. Copy/weights for scoring live in framework.js.
export const CATEGORIES = [
  { id: 'identity_entity', label: 'Identity & Entity Foundations' },
  { id: 'local_spatial', label: 'Local & Spatial Grounding' },
  { id: 'trust_credentials', label: 'Trust, Credentials & Legal' },
  { id: 'content_utility', label: 'Content Utility & Experience' },
  { id: 'linguistic_authenticity', label: 'Linguistic Authenticity & AI Detection' },
  { id: 'visual_intelligence', label: 'Visual Intelligence & Realism' },
  { id: 'external_reputation', label: 'External Signals & Market Reputation' },
  { id: 'link_authority', label: 'Link Profile & Off-Page Authority' },
  { id: 'technical_infra', label: 'Technical Infrastructure & Logic' },
  { id: 'integrity_risk', label: 'Integrity Risk & Anti-Abuse' },
  { id: 'behavioral_validation', label: 'Behavioral Validation & User Interaction' },
  { id: 'temporal_dynamics', label: 'Temporal Dynamics & Stability' },
];

// All 205 classifiers, grouped by category id. Tuples: [id, name, toolCodes].
const RAW = {
  identity_entity: [
    ['topical_authority', 'Topical Authority', 'EdrG'],
    ['knowledge_graph', 'Knowledge Graph Entity Mapping', 'rBCG'],
    ['brand_authority', 'Brand Signal Strength', 'dEG'],
    ['entity_association', 'Entity Association Strength', 'rBCG'],
    ['entity_coherence', 'Entity Coherence', 'PW'],
    ['keyword_cannibalization', 'Keyword Cannibalization', 'Pd'],
    ['broken_entity_trust', 'Broken Entity Trust', 'ECG'],
    ['knowledge_graph_alignment', 'Knowledge Graph Alignment', 'ErC'],
    ['entity_reinforcement', 'Entity Reinforcement', 'EP'],
    ['brand_voice_dilution', 'Brand Voice Dilution', 'Er'],
    ['service_dilution_drift', 'Service Dilution Drift', 'r'],
    ['entity_association_weakness', 'Entity Association Weakness', 'r'],
    ['cross_service_cannibalization', 'Cross-Service Cannibalization', 'r'],
    ['brand_vs_commodity_ratio', 'Brand vs Commodity Ratio', 'rd'],
    ['specialization_drift', 'Specialization Drift', 'r'],
    ['entity_recognition_strength', 'Entity Recognition Strength', 'B'],
    ['primary_niche_match', 'Primary Niche Match', 'B'],
    ['semantic_keyword_overlap', 'Semantic Keyword Overlap', 'B'],
    ['entity_co_occurrence', 'Entity Co-occurrence', 'B'],
    ['audience_overlap_probability', 'Audience Overlap Probability', 'B'],
    ['knowledge_graph_proximity', 'Knowledge Graph Proximity', 'B'],
    ['entity_node_reinforcement', 'Entity Node Reinforcement', 'B'],
    ['category_drift', 'Category Drift', 'dr'],
  ],
  local_spatial: [
    ['local_prominence', 'Local Prominence & Proximity', 'ErPG'],
    ['geographic_authority', 'Geographic Authority', 'ErPG'],
    ['neighborhood_granularity', 'Neighborhood Granularity', 'PEG'],
    ['local_benchmark_data', 'Local Benchmark Data', 'PE'],
    ['hyper_local_landmarks', 'Hyper-Local Landmarks', 'PEG'],
    ['service_radius_mapping', 'Service Radius Mapping', 'EGP'],
    ['community_involvement', 'Community Involvement', 'ErG'],
    ['physical_presence_signals', 'Physical Presence Signals', 'EGC'],
    ['staff_bio_localization', 'Staff Bio Localization', 'PE'],
    ['regional_competitor_context', 'Regional Competitor Context', 'Pd'],
    ['phone_area_code_verification', 'Phone Area Code Verification', 'EGP'],
    ['neighborhood_review_clustering', 'Neighborhood Review Clustering', 'EG'],
    ['site_reputation_proximity', 'Site Reputation Proximity', 'BE'],
    ['city_modifier_legitimacy', 'City Modifier Legitimacy', 'EP'],
    ['local_embedding', 'Local Embedding', 'EG'],
    ['geographic_ghosting', 'Geographic Ghosting', 'rG'],
    ['primary_category_accuracy', 'Primary Category Accuracy', 'G'],
    ['semantic_bio_match', 'Semantic Bio Match', 'G'],
    ['attribute_accuracy', 'Attribute Accuracy', 'G'],
    ['centroid_proximity', 'Centroid Proximity', 'G'],
    ['service_area_overlap', 'Service Area Overlap', 'G'],
    ['neighborhood_hyperlocalism', 'Neighborhood Hyperlocalism', 'G'],
    ['hyperlocal_backlinks', 'Hyperlocal Backlinks', 'GB'],
    ['entity_proximity_decay', 'Entity Proximity Decay', 'd'],
  ],
  trust_credentials: [
    ['regulatory_compliance', 'Regulatory Compliance', 'CG'],
    ['technical_certifications', 'Technical Certifications', 'Cr'],
    ['missing_privacy_terms', 'Missing Privacy & Terms', 'Pd'],
    ['credential_verifiability', 'Credential Verifiability', 'CE'],
    ['reputation_alignment', 'Reputation Alignment', 'EGd'],
    ['policy_transparency', 'Policy Transparency', 'Pd'],
    ['license_crosslinking', 'License Crosslinking', 'CP'],
    ['grounded_claims', 'Grounded Claims', 'EdC'],
    ['regulatory_licensing_status', 'Regulatory Licensing Status', 'C'],
    ['bonding_and_insurance', 'Bonding & Insurance', 'C'],
    ['trade_association_membership', 'Trade Association Membership', 'C'],
    ['operational_competency', 'Operational Competency', 'C'],
    ['safety_compliance', 'Safety & Compliance', 'C'],
    ['third_party_validation', 'Third-Party Validation', 'C'],
    ['digital_credential_visibility', 'Digital Credential Visibility', 'CP'],
    ['verification_tier', 'Verification Tier', 'G'],
  ],
  content_utility: [
    ['helpful_content', 'Helpful Content System', 'drP'],
    ['eeat_experience', 'E-E-A-T Experience Signals', 'drPCG'],
    ['information_gain', 'Information Gain', 'drP'],
    ['content_integrity', 'Content Integrity & Decay', 'PrG'],
    ['first_party_evidence', 'First-Party Evidence', 'PW'],
    ['information_density_ratio', 'Information Density Ratio', 'PW'],
    ['personal_experience_narrative', 'Personal Experience Narrative', 'Pdr'],
    ['sourcing_integrity', 'Sourcing Integrity', 'Pd'],
    ['primary_citation_quality', 'Primary Citation Quality', 'Pd'],
    ['comparative_utility', 'Comparative Utility', 'Pd'],
    ['niche_expertise_vocabulary', 'Niche Expertise Vocabulary', 'PW'],
    ['cost_transparency', 'Cost Transparency', 'Pd'],
    ['case_study_granularity', 'Case Study Granularity', 'Pdr'],
    ['opinionated_stance', 'Opinionated Stance', 'PW'],
    ['content_decay_veto', 'Content Decay', 'Pr'],
    ['excessive_cta_saturation', 'Excessive CTA Saturation', 'Pd'],
    ['thin_city_pages', 'Thin City Pages', 'Pdr'],
    ['auto_generated_faq', 'Auto-Generated FAQ', 'Pd'],
    ['obfuscated_pricing', 'Obfuscated Pricing', 'Pd'],
    ['first_party_data_use', 'First-Party Data Use', 'Pd'],
    ['topical_coverage', 'Topical Coverage', 'Ed'],
    ['ungrounded_claims', 'Ungrounded Claims', 'EdC'],
    ['contradiction_detection', 'Contradiction Detection', 'EdG'],
    ['cross_source_alignment', 'Cross-Source Alignment', 'EdGC'],
    ['pricing_opacity', 'Pricing Opacity', 'EP'],
    ['commercial_bias_drift', 'Commercial Bias Drift', 'r'],
    ['service_menu_depth', 'Service Menu Depth', 'G'],
    ['information_gain_deficiency', 'Information Gain Deficiency', 'd'],
  ],
  linguistic_authenticity: [
    ['lexical_diversity', 'Lexical Diversity', 'PW'],
    ['syntactic_burstiness', 'Syntactic Burstiness', 'PW'],
    ['semantic_drift', 'Semantic Drift', 'PW'],
    ['cliche_density', 'Cliche Density', 'PW'],
    ['idiomatic_regionalism', 'Idiomatic Regionalism', 'PW'],
    ['proper_noun_density', 'Proper Noun Density', 'PEW'],
    ['technical_precision', 'Technical Precision', 'PW'],
    ['emotional_variance', 'Emotional Variance', 'PW'],
    ['nuance_preservation', 'Nuance Preservation', 'PW'],
    ['pattern_repetition', 'Pattern Repetition', 'PW'],
    ['pronominal_frequency', 'Pronominal Frequency', 'PW'],
    ['passive_voice_saturation', 'Passive Voice Saturation', 'PW'],
    ['rhetorical_question_ratio', 'Rhetorical Question Ratio', 'PW'],
    ['verb_tense_consistency', 'Verb Tense Consistency', 'PW'],
    ['adverbial_fluff', 'Adverbial Fluff', 'PW'],
    ['prompt_leakage', 'Prompt Leakage', 'PWV'],
    ['perplexity_volatility', 'Perplexity Volatility', 'PW'],
  ],
  visual_intelligence: [
    ['human_presence_signals', 'Human Presence Signals', 'PEV'],
    ['team_photo_uniqueness', 'Team Photo Uniqueness', 'VP'],
    ['visual_age', 'Visual Age', 'PE'],
    ['visual_hierarchy', 'Visual Hierarchy', 'EP'],
    ['visual_authenticity_gap', 'Visual Authenticity Gap', 'rV'],
    ['photo_diversity', 'Photo Diversity', 'G'],
    ['watermark_detection', 'Watermark Detection', 'V'],
    ['frequency_domain_noise', 'Frequency Domain Noise', 'V'],
    ['high_key_uniformity', 'High-Key Uniformity', 'V'],
    ['bokeh_depth_estimation', 'Bokeh Depth Estimation', 'V'],
    ['micro_expression_mismatch', 'Micro Expression Mismatch', 'V'],
    ['gaze_vector_analysis', 'Gaze Vector Analysis', 'V'],
    ['sanitation_score', 'Sanitation Score', 'V'],
    ['product_placement_detection', 'Product Placement Detection', 'V'],
    ['generic_intent_vector', 'Generic Intent Vector', 'V'],
  ],
  external_reputation: [
    ['navboost', 'User Interaction Signals (NavBoost)', 'drG'],
    ['trust_integrity', 'Trust & Popularity Integrity', 'dCBG'],
    ['sentiment_trust', 'Review Sentiment & Trust', 'ErCG'],
    ['branded_search_connection', 'Branded Search Connection', 'Ed'],
    ['review_sentiment_asymmetry', 'Review Sentiment Asymmetry', 'r'],
    ['citation_utility', 'Citation Utility', 'B'],
    ['review_volume', 'Review Volume', 'G'],
    ['review_velocity', 'Review Velocity', 'G'],
    ['sentiment_consistency', 'Sentiment Consistency', 'G'],
    ['reviewer_trust', 'Reviewer Trust', 'G'],
    ['response_latency', 'Response Latency', 'G'],
    ['response_quality', 'Response Quality', 'G'],
    ['nap_consistency', 'NAP Consistency', 'GE'],
    ['press_mentions', 'Press Mentions', 'GE'],
    ['gemini_inclusion', 'Gemini/AI Inclusion', 'G'],
    ['citation_velocity_asymmetry', 'Citation Velocity Asymmetry', 'd'],
  ],
  link_authority: [
    ['link_value', 'Link Value & Authority Transfer', 'B'],
    ['toxicity_safety', 'Link Toxicity & Safety', 'B'],
    ['entity_link_authenticity', 'Entity Link Authenticity', 'EBC'],
    ['domain_age_maturity', 'Domain Age & Maturity', 'B'],
    ['historical_indexing_stability', 'Historical Indexing Stability', 'B'],
    ['anchor_text_relevance', 'Anchor Text Relevance', 'B'],
    ['surrounding_text_sentiment', 'Surrounding Text Sentiment', 'B'],
    ['pbn_pattern_signals', 'PBN Pattern Signals', 'B'],
    ['automated_content_likelihood', 'Automated Content Likelihood', 'B'],
    ['link_scheme_pattern', 'Link Scheme Pattern', 'B'],
    ['doorway_page_identification', 'Doorway Page Identification', 'B'],
    ['aggressive_exact_match_anchor', 'Aggressive Exact Match Anchor', 'B'],
    ['sge_extraction_potential', 'SGE Extraction Potential', 'B'],
    ['trust_by_association', 'Trust by Association', 'B'],
    ['composite_link_value', 'Composite Link Value', 'B'],
  ],
  technical_infra: [
    ['schema_grounding', 'Schema & Structured Data', 'PrG'],
    ['schema_grounding_depth', 'Schema Grounding Depth', 'Pr'],
    ['sge_compatibility', 'SGE/AI Overview Compatibility', 'Pd'],
    ['content_sectioning_clarity', 'Content Sectioning Clarity', 'P'],
    ['breadcrumb_logic', 'Breadcrumb Logic', 'P'],
    ['canonical_signal_health', 'Canonical Signal Health', 'P'],
    ['api_integration_readiness', 'API Integration Readiness', 'P'],
    ['structured_faq_schema', 'Structured FAQ Schema', 'P'],
    ['semantic_html', 'Semantic HTML', 'P'],
    ['crawlability', 'Crawlability', 'EP'],
    ['indexation_depth', 'Indexation Depth', 'EP'],
    ['internal_linking_coherence', 'Internal Linking Coherence', 'EP'],
    ['tech_stack_currency', 'Tech Stack Currency', 'PE'],
    ['technical_depth_deficit', 'Technical Depth Deficit', 'r'],
    ['schema_sync', 'Schema Sync', 'GP'],
  ],
  integrity_risk: [
    ['scaled_content', 'Scaled Content System', 'dr'],
    ['content_scraping_traces', 'Content Scraping Traces', 'Pd'],
    ['fake_expert_personas', 'Fake Expert Personas', 'PEV'],
    ['review_velocity_anomaly', 'Review Velocity Anomaly', 'EG'],
    ['lead_generation_front', 'Lead Generation Front', 'PdE'],
    ['service_page_uniqueness', 'Service Page Uniqueness', 'EP'],
    ['template_overreliance', 'Template Overreliance', 'Ed'],
    ['review_manipulation', 'Review Manipulation', 'EG'],
    ['spam_detection_risk', 'Spam Detection Risk', 'G'],
    ['scaled_content_risk', 'Scaled Content Risk', 'd'],
  ],
  behavioral_validation: [
    ['intent_capture_speed', 'Intent Capture Speed', 'EP'],
    ['action_visibility', 'Action Visibility', 'EP'],
    ['trust_before_ask', 'Trust Before Ask', 'EP'],
    ['choice_simplicity', 'Choice Simplicity', 'EP'],
    ['form_field_entropy', 'Form Field Entropy', 'EP'],
    ['mobile_nav_depth', 'Mobile Navigation Depth', 'EP'],
    ['sticky_element_overlap', 'Sticky Element Overlap', 'EP'],
    ['conversion_leakage', 'Conversion Leakage', 'EP'],
    ['emergency_intent_friction', 'Emergency Intent Friction', 'r'],
    ['search_ctr', 'Search CTR', 'G'],
    ['direction_requests', 'Direction Requests', 'G'],
    ['booking_conversion', 'Booking Conversion', 'G'],
  ],
  temporal_dynamics: [
    ['temporal_freshness', 'Query Deserves Freshness', 'rPG'],
    ['update_velocity', 'Update Velocity', 'rPE'],
    ['content_rotation', 'Content Rotation', 'rPE'],
    ['blog_post_recency', 'Blog Post Recency', 'rPE'],
    ['stale_internal_links', 'Stale Internal Links', 'P'],
    ['review_momentum', 'Review Momentum', 'EG'],
    ['quality_trajectory', 'Quality Trajectory', 'EG'],
    ['service_decay_signal', 'Service Decay Signal', 'EG'],
    ['business_stability', 'Business Stability', 'ECG'],
    ['ownership_changes', 'Ownership Changes', 'EG'],
    ['seasonal_stagnation', 'Seasonal Stagnation', 'r'],
    ['post_recency', 'Post Recency', 'G'],
    ['hours_integrity', 'Hours Integrity', 'G'],
    ['q_and_a_freshness', 'Q&A Freshness', 'G'],
  ],
};

// Flatten into a rich classifier list + lookup.
export const CLASSIFIERS = [];
export const CLASSIFIER_BY_ID = {};
for (const cat of CATEGORIES) {
  for (const [id, name, codes] of RAW[cat.id]) {
    const tools = codes.split('').map((c) => TOOL_BY_CODE[c]?.id).filter(Boolean);
    const entry = { id, name, category: cat.id, tools };
    CLASSIFIERS.push(entry);
    CLASSIFIER_BY_ID[id] = entry;
  }
}

// Per-category classifier count.
export const CATEGORY_COUNT = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, RAW[c.id].length])
);

// Tool -> category coverage weight = # of that category's classifiers the tool
// evaluates. Used to distribute a single OS-tool score across the categories it
// diagnoses. Derived, so it can never drift from the classifier data above.
export const TOOL_CATEGORY_COVERAGE = {};
for (const t of TOOLS) TOOL_CATEGORY_COVERAGE[t.id] = {};
for (const cls of CLASSIFIERS) {
  for (const toolId of cls.tools) {
    const m = TOOL_CATEGORY_COVERAGE[toolId];
    m[cls.category] = (m[cls.category] || 0) + 1;
  }
}

export const TOTAL_CLASSIFIERS = CLASSIFIERS.length; // 205
