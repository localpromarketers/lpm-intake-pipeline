'use client';

import { useState } from 'react';

const CATEGORY_OPTIONS = [
  { key: 'plumbing', label: 'Plumbing', emoji: '🔧' },
  { key: 'hvac', label: 'HVAC', emoji: '🌡️' },
  { key: 'electrical', label: 'Electrical', emoji: '⚡' },
  { key: 'roofing', label: 'Roofing', emoji: '🏠' },
  { key: 'landscaping', label: 'Landscaping', emoji: '🌿' },
];

const VISIBILITY = {
  top_pick: { label: 'Top pick', color: '#16a34a', bg: '#dcfce7', icon: '★' },
  mentioned: { label: 'Mentioned', color: '#c2410c', bg: '#ffedd5', icon: '•' },
  not_recommended: { label: 'Not surfaced', color: '#6b7280', bg: '#f3f4f6', icon: '—' },
};

const PRIORITY_STYLE = {
  'Quick Win': { color: '#15803d', bg: '#dcfce7' },
  Foundational: { color: '#1d4ed8', bg: '#dbeafe' },
  Compounding: { color: '#6d28d9', bg: '#ede9fe' },
};

const SEER_EXAMPLE = JSON.stringify(
  {
    source: 'SEER',
    business: 'Summit Plumbing Co.',
    tools: {
      EntityOS: { score: 72, measured: 'Entity resolved; sameAs sparse' },
      DiagnosticOS: { score: 58, measured: 'Local-intent classifier under-firing' },
      DriftOS: { score: 64 },
      PageOS: { score: 61 },
      RewriteOS: { score: 55 },
      VisionOS: { score: 40, measured: '3 hero images flagged AI-generated' },
      BacklinkOS: { score: 48 },
      CredentialOS: { score: 90, measured: 'License CO #12345, NATE + EPA' },
      GBPOS: { score: 77 },
    },
    classifiers: {
      review_velocity: 42,
      nap_consistency: 80,
      thin_city_pages: 35,
      geographic_authority: 38,
      team_photo_uniqueness: 30,
      proper_noun_density: 44,
    },
    weights: { external_reputation: 15, local_spatial: 15 },
  },
  null,
  2
);

const SCAN_STEPS = [
  'Generating the queries real buyers ask AI engines…',
  'Simulating how answer engines rank your category…',
  'Extracting the authority signals behind each pick…',
  'Scoring your business against the signal framework…',
  'Building your path to the go-to recommendation…',
];

export default function AuthorityRadar() {
  const [form, setForm] = useState({
    businessName: '',
    category: 'plumbing',
    location: '',
    website: '',
    notes: '',
    seerData: '',
  });
  const [scanning, setScanning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function runScan(e) {
    e.preventDefault();
    setError('');
    if (!form.businessName.trim() || !form.location.trim()) {
      setError('Business name and city / service area are required.');
      return;
    }
    setScanning(true);
    setResult(null);
    setStepIdx(0);
    const ticker = setInterval(
      () => setStepIdx((i) => Math.min(i + 1, SCAN_STEPS.length - 1)),
      1100
    );

    try {
      const res = await fetch('/api/authority/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setResult(data);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      clearInterval(ticker);
      setScanning(false);
    }
  }

  function reset() {
    setResult(null);
    setError('');
  }

  return (
    <div className="ar-page">
      <header className="ar-topbar">
        <div className="ar-topbar-inner">
          <a href="/" className="ar-brand">
            <span className="ar-brand-mark">◎</span> Authority Radar
          </a>
          <span className="ar-brand-tag">Local Pro Marketers · AEO Intelligence</span>
        </div>
      </header>

      <main className="ar-main">
        {!result && !scanning && (
          <IntakeForm form={form} update={update} runScan={runScan} error={error} />
        )}
        {scanning && <Scanning step={SCAN_STEPS[stepIdx]} businessName={form.businessName} />}
        {result && !scanning && <Results result={result} onReset={reset} />}
      </main>
    </div>
  );
}

function IntakeForm({ form, update, runScan, error }) {
  return (
    <div className="ar-intro">
      <div className="ar-hero">
        <h1>
          Discover the authority signals AI engines use to pick the
          <span className="ar-hl"> go-to home-services business.</span>
        </h1>
        <p>
          When a customer asks ChatGPT, Gemini or Perplexity “who’s the best {form.category || 'plumber'}{' '}
          near me?”, the model isn’t guessing — it’s reading signals. Authority Radar probes those
          queries, reverse-engineers the signals behind the winners, and hands you the roadmap to go
          from <em>showing up once</em> to <em>being the recommendation.</em>
        </p>
      </div>

      <form className="ar-card" onSubmit={runScan}>
        <div className="form-group">
          <label>Business name</label>
          <input
            value={form.businessName}
            onChange={(e) => update('businessName', e.target.value)}
            placeholder="e.g. Summit Plumbing Co."
          />
        </div>

        <div className="form-group">
          <label>Home-services category</label>
          <div className="ar-cat-grid">
            {CATEGORY_OPTIONS.map((c) => (
              <button
                type="button"
                key={c.key}
                className={`ar-cat ${form.category === c.key ? 'active' : ''}`}
                onClick={() => update('category', c.key)}
              >
                <span className="ar-cat-emoji">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>City / service area</label>
            <input
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="e.g. Denver, CO"
            />
          </div>
          <div className="form-group">
            <label>
              Website <span className="optional">optional</span>
            </label>
            <input
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
              placeholder="summitplumbing.com"
            />
          </div>
        </div>

        <div className="form-group">
          <label>
            What’s already true about this business?{' '}
            <span className="optional">optional — reviews, licenses, certs, press, content</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="e.g. 320 Google reviews at 4.8★, licensed & insured (CO #12345), NATE-certified, featured in Denver Post best-of, 24/7 emergency service, blog with cost guides…"
          />
        </div>

        <SeerImport
          value={form.seerData}
          onChange={(v) => update('seerData', v)}
        />

        {error && <div className="ar-error">{error}</div>}

        <button type="submit" className="btn btn-primary ar-scan-btn">
          ◎ Run Authority Scan
        </button>
        <p className="ar-fineprint">
          Probes {form.category === 'roofing' || form.category === 'landscaping' ? 6 : 7} buyer
          queries across SEER’s 12 classifier categories (205 classifiers). Takes ~10 seconds.
        </p>
      </form>
    </div>
  );
}

function SeerImport({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const has = value && value.trim().length > 0;
  return (
    <div className={`ar-seer ${has ? 'has-data' : ''}`}>
      <button
        type="button"
        className="ar-seer-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ar-seer-title">
          <span className="ar-seer-dot" /> Import SEER data
          <span className="ar-seer-sub">
            Relationalseo · measured signals override estimates {has ? '· loaded' : '· optional'}
          </span>
        </span>
        <span className="ar-seer-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="ar-seer-body">
          <p className="ar-seer-help">
            Paste a SEER export (JSON) — OS-tool scores (EntityOS, GBPOS…), category scores, or
            individual classifier scores. SEER’s measured data replaces the engine’s estimate for
            every signal it covers, and any <code>weights</code> recalibrate the Authority Index.
            Unrecognized fields are reported, never guessed.
          </p>
          <textarea
            className="ar-seer-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder='{ "source": "SEER", "tools": { "EntityOS": 72, "GBPOS": { "score": 80 } }, "weights": { "local_spatial": 15 } }'
            spellCheck={false}
          />
          <div className="ar-seer-actions">
            <button type="button" className="ar-seer-link" onClick={() => onChange(SEER_EXAMPLE)}>
              Load example
            </button>
            {has && (
              <button type="button" className="ar-seer-link" onClick={() => onChange('')}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Scanning({ step, businessName }) {
  return (
    <div className="ar-scanning">
      <div className="ar-radar">
        <div className="ar-radar-sweep" />
        <div className="ar-radar-ring r1" />
        <div className="ar-radar-ring r2" />
        <div className="ar-radar-ring r3" />
        <div className="ar-radar-core">◎</div>
      </div>
      <h2>Scanning {businessName || 'your business'}…</h2>
      <p className="ar-scan-step">{step}</p>
    </div>
  );
}

function Results({ result, onReset }) {
  const {
    business,
    mode,
    authorityIndex,
    tier,
    tierBlurb,
    summary,
    signals,
    queries,
    visibilityRate,
    topPicks,
    recommendedCount,
    roadmap,
    seer,
  } = result;
  const seerCovered = seer?.coveredSignals || [];

  return (
    <div className="ar-results">
      <div className="ar-results-head">
        <div>
          <div className="ar-eyebrow">Authority report</div>
          <h1>
            {business.businessName}{' '}
            <span className="ar-muted">· {business.location}</span>
          </h1>
        </div>
        <button className="btn btn-secondary" onClick={onReset}>
          ← New scan
        </button>
      </div>

      {mode === 'estimated' && (
        <div className="ar-note">
          Estimated read-out — running without a live AI key, so scores are derived from the
          framework and the details you provided. Add <code>ANTHROPIC_API_KEY</code> for a live
          answer-engine probe.
        </div>
      )}

      {seer?.applied && (
        <div className="ar-note seer">
          <strong>SEER-calibrated.</strong> Measured data from SEER (Relationalseo) is driving{' '}
          {seerCovered.length} of {signals.length} signals
          {seer.calibratedWeights ? ' and recalibrating the signal weights' : ''}.
          {(seer.toolsUsed?.length > 0 || seer.classifiersUsed > 0) && (
            <span>
              {' '}Rolled up from
              {seer.toolsUsed?.length > 0 && ` ${seer.toolsUsed.length} OS tool${seer.toolsUsed.length > 1 ? 's' : ''} (${seer.toolsUsed.join(', ')})`}
              {seer.classifiersUsed > 0 && `${seer.toolsUsed?.length ? ' and' : ''} ${seer.classifiersUsed} classifier score${seer.classifiersUsed > 1 ? 's' : ''}`}.
            </span>
          )}{' '}
          SEER-driven signals are tagged <span className="ar-src-tag seer">SEER</span> below.
          {seer.competitorContext && (
            <div className="ar-seer-warnings" style={{ color: '#4338ca' }}>
              CompetitorScope context received (not scored into the index).
            </div>
          )}
          {seer.warnings?.length > 0 && (
            <div className="ar-seer-warnings">
              {seer.warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Score hero */}
      <section className="ar-score-hero">
        <Gauge value={authorityIndex} tier={tier} />
        <div className="ar-score-copy">
          <div className="ar-tier-badge">{tier}</div>
          <p className="ar-tier-blurb">{tierBlurb}</p>
          {summary && <p className="ar-summary">{summary}</p>}
          <div className="ar-kpis">
            <Kpi value={`${visibilityRate}%`} label="Buyer queries you appear in" />
            <Kpi value={`${topPicks}/${queries.length}`} label="Queries you're the top pick" />
            <Kpi value={`${recommendedCount}/${queries.length}`} label="Queries you're surfaced at all" />
          </div>
        </div>
      </section>

      {/* Query visibility */}
      <section className="ar-section">
        <h2 className="ar-h2">How you show up in AI answers</h2>
        <p className="ar-section-sub">
          The exact questions buyers ask answer engines in your category — and whether you’d be
          recommended today.
        </p>
        <div className="ar-queries">
          {queries.map((q, i) => {
            const v = VISIBILITY[q.visibility];
            return (
              <div className="ar-query" key={i}>
                <div className="ar-query-badge" style={{ color: v.color, background: v.bg }}>
                  <span className="ar-query-icon">{v.icon}</span> {v.label}
                </div>
                <div className="ar-query-body">
                  <div className="ar-query-text">“{q.text}”</div>
                  {q.rationale && <div className="ar-query-rationale">{q.rationale}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Signal scorecard */}
      <section className="ar-section">
        <h2 className="ar-h2">Authority signal scorecard</h2>
        <p className="ar-section-sub">
          SEER’s 12 classifier categories, scored for your business. Higher-weight categories move
          your ranking the most; the count is how many underlying SEER classifiers feed each one.
        </p>
        <div className="ar-signals">
          {signals.map((s) => (
            <SignalRow key={s.key} s={s} />
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="ar-section">
        <h2 className="ar-h2">Your path to go-to recommendation</h2>
        <p className="ar-section-sub">
          Prioritized moves — most valuable first — to raise your Authority Index and win the
          queries that matter.
        </p>
        <div className="ar-roadmap">
          {roadmap.map((r, i) => {
            const p = PRIORITY_STYLE[r.priority] || PRIORITY_STYLE.Foundational;
            return (
              <div className="ar-move" key={i}>
                <div className="ar-move-num">{i + 1}</div>
                <div className="ar-move-body">
                  <div className="ar-move-top">
                    <span className="ar-priority" style={{ color: p.color, background: p.bg }}>
                      {r.priority}
                    </span>
                    {r.signalLabel && <span className="ar-move-signal">{r.signalLabel}</span>}
                  </div>
                  <div className="ar-move-title">{r.title}</div>
                  {r.why && <div className="ar-move-why">{r.why}</div>}
                  <div className="ar-move-meta">
                    <span>Effort: <strong>{r.effort}</strong></span>
                    <span>Impact: <strong>{r.impact}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="ar-footer-cta">
        <button className="btn btn-secondary" onClick={onReset}>
          Scan another business
        </button>
      </div>
    </div>
  );
}

function Gauge({ value, tier }) {
  const r = 68;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#65a30d' : pct >= 35 ? '#f59e0b' : '#ef4444';
  return (
    <div className="ar-gauge">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 90 90)"
        />
      </svg>
      <div className="ar-gauge-center">
        <div className="ar-gauge-value" style={{ color }}>
          {value}
        </div>
        <div className="ar-gauge-label">Authority Index</div>
      </div>
    </div>
  );
}

function Kpi({ value, label }) {
  return (
    <div className="ar-kpi">
      <div className="ar-kpi-value">{value}</div>
      <div className="ar-kpi-label">{label}</div>
    </div>
  );
}

function SignalRow({ s }) {
  const barColor = s.status === 'strong' ? '#16a34a' : s.status === 'partial' ? '#f59e0b' : '#ef4444';
  return (
    <div className="ar-signal">
      <div className="ar-signal-head">
        <div className="ar-signal-name">
          {s.label}
          <span className="ar-signal-weight">weight {s.weight}</span>
          {s.classifierCount != null && (
            <span className="ar-signal-weight">{s.classifierCount} classifiers</span>
          )}
          {s.source === 'seer' && <span className="ar-src-tag seer">SEER</span>}
        </div>
        <div className="ar-signal-score" style={{ color: barColor }}>
          {s.score}
        </div>
      </div>
      <div className="ar-bar">
        <div className="ar-bar-fill" style={{ width: `${s.score}%`, background: barColor }} />
      </div>
      {s.whatEnginesSee && (
        <div className="ar-signal-detail">
          <span className="ar-signal-tag">Engines see</span> {s.whatEnginesSee}
        </div>
      )}
      {s.gap && (
        <div className="ar-signal-detail">
          <span className="ar-signal-tag gap">Gap</span> {s.gap}
        </div>
      )}
      {s.weakClassifiers?.length > 0 && (
        <div className="ar-drag">
          <div className="ar-drag-label">SEER classifiers dragging this down</div>
          <div className="ar-drag-chips">
            {s.weakClassifiers.map((c) => (
              <div
                key={c.id}
                className="ar-drag-chip"
                title={c.tools?.length ? `Evaluated by ${c.tools.join(', ')}` : c.name}
              >
                <span className="ar-drag-score">{c.score}</span>
                <span className="ar-drag-name">{c.name}</span>
                {c.tools?.length > 0 && <span className="ar-drag-tools">{c.tools.join(' · ')}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
