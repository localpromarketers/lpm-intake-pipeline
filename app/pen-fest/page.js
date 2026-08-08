'use client';

import { useState } from 'react';

// ── Event details ───────────────────────────────────────────────
// Edit these in one place to update the whole page.
const EVENT = {
  name: 'Chesapeake Stationery & Pen Fest',
  tagline: 'The Bay’s celebration of fine pens, ink, and paper.',
  dates: 'October 17–18, 2026',
  daysShort: 'Sat & Sun',
  hours: '10:00 AM – 5:00 PM',
  venue: 'Havre de Grace Community Center',
  address: '100 Lagaret Ln, Havre de Grace, MD 21078',
  city: 'Havre de Grace, MD',
  admission: '$15 weekend pass · kids under 12 free',
  contactEmail: 'hello@chesapeakepenfest.com',
};

const HIGHLIGHTS = [
  { icon: '🖋️', title: '60+ Makers & Sellers', text: 'Fountain pens, artisan inks, wax seals, journals, and handmade paper from across the Mid-Atlantic.' },
  { icon: '💧', title: 'The Ink Testing Bar', text: 'Dip, swatch, and compare hundreds of inks side by side before you buy. Bring your own paper or use ours.' },
  { icon: '✍️', title: 'Live Calligraphy Demos', text: 'Watch pointed-pen, broad-edge, and brush lettering artists work — then try it yourself at the practice tables.' },
  { icon: '🎓', title: 'Hands-On Workshops', text: 'Beginner-friendly sessions in modern calligraphy, bookbinding, and pen maintenance. Small classes, real instructors.' },
  { icon: '🔧', title: 'Pen Doctor Clinic', text: 'Bring a scratchy nib or a stubborn vintage pen — on-site experts will tune, flush, and revive it.' },
  { icon: '🛶', title: 'Waterfront Town', text: 'Set in historic Havre de Grace at the head of the Chesapeake Bay — make a weekend of the boardwalk, cafés, and shops.' },
];

const SCHEDULE = [
  { time: '10:00 AM', label: 'Doors open · Exhibitor hall & Ink Testing Bar' },
  { time: '11:00 AM', label: 'Workshop: Modern Calligraphy for Absolute Beginners' },
  { time: '12:30 PM', label: 'Panel: Building a Handmade Stationery Business' },
  { time: '2:00 PM', label: 'Workshop: Introduction to Japanese Stab Bookbinding' },
  { time: '3:30 PM', label: 'Live demo: Restoring & tuning a vintage fountain pen' },
  { time: '4:30 PM', label: 'Raffle drawing & maker meet-and-greet' },
];

const FAQ = [
  { q: 'How much is admission?', a: `${EVENT.admission}. A single ticket covers both days. Workshops are ticketed separately and tend to sell out early.` },
  { q: 'Is it beginner-friendly?', a: 'Absolutely. Most attendees are just curious about pens, ink, or lettering. Vendors love talking to newcomers, and the practice tables are free to use.' },
  { q: 'Can I bring my kids?', a: 'Yes — under 12 get in free, and there’s a family lettering corner with washable supplies.' },
  { q: 'Where do I park?', a: 'Free parking is available at the venue with additional lots a short walk away in downtown Havre de Grace.' },
  { q: 'I make pens/ink/paper. How do I sell here?', a: 'Wonderful — scroll down to the vendor section and submit the exhibitor interest form. We’ll send you the booth kit with pricing and layout options.' },
];

// ── Palette (ink & paper) ───────────────────────────────────────
const C = {
  ink: '#12233b',       // deep navy ink
  ink2: '#1e3a5f',
  paper: '#faf6ee',     // warm cream
  paper2: '#f3ebdd',
  copper: '#b06a3b',    // warm accent
  copperDark: '#8f5230',
  teal: '#2f6f6a',      // chesapeake teal
  line: '#e4d9c6',
  muted: '#5b6b7c',
};

function SignupForm({ type }) {
  const isVendor = type === 'vendor';
  const [form, setForm] = useState({ name: '', email: '', business_name: '', product_category: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/pen-fest-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('done');
    } catch {
      setError('Network error. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="pf-form-done">
        <div style={{ fontSize: 40, marginBottom: 12 }}>{isVendor ? '📮' : '🎉'}</div>
        <h3 style={{ fontSize: 20, color: C.ink, marginBottom: 8 }}>
          {isVendor ? 'Thanks — your interest is in!' : 'You’re on the list!'}
        </h3>
        <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
          {isVendor
            ? 'We’ll follow up with the exhibitor booth kit, pricing, and next steps. Keep an eye on your inbox.'
            : 'We’ll email you when tickets, workshops, and the full maker list go live. See you on the Bay.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="pf-form">
      <div className="pf-field-row">
        <div className="pf-field">
          <label>Name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="pf-field">
          <label>Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={e => update('email', e.target.value)}
            placeholder="you@email.com"
          />
        </div>
      </div>

      {isVendor && (
        <>
          <div className="pf-field-row">
            <div className="pf-field">
              <label>Business / shop name</label>
              <input
                type="text"
                value={form.business_name}
                onChange={e => update('business_name', e.target.value)}
                placeholder="e.g. Tidewater Ink Co."
              />
            </div>
            <div className="pf-field">
              <label>What do you make/sell?</label>
              <select value={form.product_category} onChange={e => update('product_category', e.target.value)}>
                <option value="">Select a category…</option>
                <option>Fountain pens & nibs</option>
                <option>Inks</option>
                <option>Paper & notebooks</option>
                <option>Wax seals & accessories</option>
                <option>Calligraphy / lettering</option>
                <option>Bookbinding</option>
                <option>Vintage & restoration</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div className="pf-field">
            <label>Tell us about your booth <span style={{ color: C.muted, fontWeight: 400 }}>(optional)</span></label>
            <textarea
              value={form.message}
              onChange={e => update('message', e.target.value)}
              placeholder="Product range, table size you'd want, website or social links…"
            />
          </div>
        </>
      )}

      {status === 'error' && (
        <div className="pf-error">{error}</div>
      )}

      <button type="submit" className="pf-btn pf-btn-primary" disabled={status === 'loading'}>
        {status === 'loading'
          ? 'Sending…'
          : isVendor ? 'Apply to Exhibit' : 'Notify Me About Tickets'}
      </button>
      <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 4 }}>
        No spam — just event news. Unsubscribe anytime.
      </p>
    </form>
  );
}

export default function PenFest() {
  const [audience, setAudience] = useState('attendee'); // attendee | vendor
  const [openFaq, setOpenFaq] = useState(0);

  function scrollToSignup(which) {
    setAudience(which);
    document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="pf">
      {/* NAV */}
      <header className="pf-nav">
        <div className="pf-nav-inner">
          <div className="pf-brand">
            <span className="pf-brand-mark">✒️</span>
            <span>Chesapeake Pen Fest</span>
          </div>
          <nav className="pf-nav-links">
            <a href="#about">About</a>
            <a href="#experience">Experience</a>
            <a href="#vendors">Vendors</a>
            <button className="pf-btn pf-btn-sm pf-btn-copper" onClick={() => scrollToSignup('attendee')}>
              Get Tickets
            </button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="pf-hero">
        <div className="pf-hero-inner">
          <div className="pf-eyebrow">{EVENT.daysShort} · {EVENT.dates} · {EVENT.city}</div>
          <h1 className="pf-hero-title">{EVENT.name}</h1>
          <p className="pf-hero-tagline">{EVENT.tagline}</p>
          <p className="pf-hero-sub">
            A two-day gathering for pen lovers, ink obsessives, paper hoarders, and the makers who
            keep the craft alive — on the historic waterfront of Havre de Grace, Maryland.
          </p>
          <div className="pf-hero-cta">
            <button className="pf-btn pf-btn-primary pf-btn-lg" onClick={() => scrollToSignup('attendee')}>
              Notify me about tickets
            </button>
            <button className="pf-btn pf-btn-outline pf-btn-lg" onClick={() => scrollToSignup('vendor')}>
              Become a vendor
            </button>
          </div>
        </div>
      </section>

      {/* QUICK FACTS */}
      <section className="pf-facts">
        <div className="pf-facts-inner">
          <div className="pf-fact">
            <span className="pf-fact-icon">📅</span>
            <div>
              <div className="pf-fact-label">When</div>
              <div className="pf-fact-value">{EVENT.dates}</div>
              <div className="pf-fact-sub">{EVENT.hours} both days</div>
            </div>
          </div>
          <div className="pf-fact">
            <span className="pf-fact-icon">📍</span>
            <div>
              <div className="pf-fact-label">Where</div>
              <div className="pf-fact-value">{EVENT.venue}</div>
              <div className="pf-fact-sub">{EVENT.address}</div>
            </div>
          </div>
          <div className="pf-fact">
            <span className="pf-fact-icon">🎟️</span>
            <div>
              <div className="pf-fact-label">Admission</div>
              <div className="pf-fact-value">$15 weekend pass</div>
              <div className="pf-fact-sub">Kids under 12 free</div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="pf-section">
        <div className="pf-section-inner pf-about">
          <div>
            <div className="pf-kicker">About the fest</div>
            <h2 className="pf-h2">A whole weekend devoted to the written word.</h2>
            <p className="pf-lead">
              The Chesapeake Stationery & Pen Fest brings together makers, collectors, and the merely
              curious for two days of fountain pens, small-batch inks, handmade paper, and the analog
              joy of putting pen to page.
            </p>
            <p className="pf-body">
              Whether you’ve been filling notebooks for decades or just fell down the fountain-pen
              rabbit hole last week, you’ll find your people here. Swatch inks at the testing bar,
              learn a new lettering style, get a beloved pen tuned back to life, and take home
              something made by hand — all in one of Maryland’s most charming waterfront towns.
            </p>
            <div className="pf-about-stats">
              <div><span className="pf-stat-num">60+</span><span className="pf-stat-lbl">makers & sellers</span></div>
              <div><span className="pf-stat-num">12</span><span className="pf-stat-lbl">workshops & demos</span></div>
              <div><span className="pf-stat-num">2</span><span className="pf-stat-lbl">days on the Bay</span></div>
            </div>
          </div>
          <div className="pf-about-card">
            <div className="pf-quote-mark">“</div>
            <p className="pf-quote">
              There’s nothing like watching someone discover their first bottle of shimmer ink.
              This is the community coming together to share what we love.
            </p>
            <div className="pf-quote-by">— Festival organizers</div>
          </div>
        </div>
      </section>

      {/* EXPERIENCE / HIGHLIGHTS */}
      <section id="experience" className="pf-section pf-section-alt">
        <div className="pf-section-inner">
          <div className="pf-center">
            <div className="pf-kicker">What to expect</div>
            <h2 className="pf-h2">Everything under one roof.</h2>
          </div>
          <div className="pf-grid">
            {HIGHLIGHTS.map(h => (
              <div key={h.title} className="pf-card">
                <div className="pf-card-icon">{h.icon}</div>
                <h3 className="pf-card-title">{h.title}</h3>
                <p className="pf-card-text">{h.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCHEDULE */}
      <section className="pf-section">
        <div className="pf-section-inner pf-schedule-wrap">
          <div className="pf-schedule-head">
            <div className="pf-kicker">A sample day</div>
            <h2 className="pf-h2">Plan your visit.</h2>
            <p className="pf-body">
              Programming runs all day, both days. Workshops are ticketed and limited — the full,
              finalized schedule drops closer to the event. Here’s the shape of a typical Saturday:
            </p>
          </div>
          <ol className="pf-timeline">
            {SCHEDULE.map(s => (
              <li key={s.time} className="pf-timeline-item">
                <span className="pf-timeline-time">{s.time}</span>
                <span className="pf-timeline-dot" />
                <span className="pf-timeline-label">{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* VENDORS */}
      <section id="vendors" className="pf-vendor">
        <div className="pf-vendor-inner">
          <div className="pf-vendor-copy">
            <div className="pf-kicker pf-kicker-light">Calling all makers</div>
            <h2 className="pf-h2 pf-h2-light">Sell your work to a room full of people who get it.</h2>
            <p className="pf-vendor-lead">
              Pen turners, ink alchemists, bookbinders, paper mills, calligraphers, and vintage
              restorers — the Chesapeake Pen Fest puts your table in front of an audience that’s here
              to buy, learn, and geek out.
            </p>
            <ul className="pf-vendor-list">
              <li>Affordable booth options for full-time makers and weekend hobbyists alike</li>
              <li>High-intent, enthusiast crowd from across the Mid-Atlantic</li>
              <li>Optional demo & workshop slots to showcase your craft</li>
              <li>Marketing push across our email list and social channels</li>
            </ul>
            <button className="pf-btn pf-btn-copper pf-btn-lg" onClick={() => scrollToSignup('vendor')}>
              Request the exhibitor kit
            </button>
          </div>
          <div className="pf-vendor-badges">
            {['🖊️ Pens', '💧 Inks', '📓 Paper', '🕯️ Wax seals', '✒️ Calligraphy', '📚 Bookbinding'].map(b => (
              <span key={b} className="pf-vendor-badge">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* SIGNUP */}
      <section id="signup" className="pf-section pf-section-alt">
        <div className="pf-section-inner pf-signup">
          <div className="pf-center">
            <div className="pf-kicker">Stay in the loop</div>
            <h2 className="pf-h2">
              {audience === 'vendor' ? 'Exhibit at the fest' : 'Be first to get tickets'}
            </h2>
            <p className="pf-body" style={{ maxWidth: 520, margin: '0 auto 8px' }}>
              We’re finalizing dates, tickets, and the maker lineup now. Drop your details and we’ll
              reach out the moment there’s news.
            </p>
          </div>

          <div className="pf-toggle">
            <button
              className={`pf-toggle-btn ${audience === 'attendee' ? 'active' : ''}`}
              onClick={() => setAudience('attendee')}
            >
              🎟️ I want to attend
            </button>
            <button
              className={`pf-toggle-btn ${audience === 'vendor' ? 'active' : ''}`}
              onClick={() => setAudience('vendor')}
            >
              🖋️ I want to exhibit
            </button>
          </div>

          <div className="pf-form-card">
            <SignupForm key={audience} type={audience} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pf-section">
        <div className="pf-section-inner pf-faq-wrap">
          <div className="pf-center">
            <div className="pf-kicker">Good to know</div>
            <h2 className="pf-h2">Frequently asked</h2>
          </div>
          <div className="pf-faq">
            {FAQ.map((item, i) => (
              <div key={i} className={`pf-faq-item ${openFaq === i ? 'open' : ''}`}>
                <button className="pf-faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                  <span>{item.q}</span>
                  <span className="pf-faq-toggle">{openFaq === i ? '–' : '+'}</span>
                </button>
                {openFaq === i && <p className="pf-faq-a">{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pf-footer">
        <div className="pf-footer-inner">
          <div>
            <div className="pf-brand pf-brand-light">
              <span className="pf-brand-mark">✒️</span>
              <span>{EVENT.name}</span>
            </div>
            <p className="pf-footer-meta">{EVENT.dates} · {EVENT.venue}, {EVENT.city}</p>
          </div>
          <div className="pf-footer-right">
            <a href={`mailto:${EVENT.contactEmail}`}>{EVENT.contactEmail}</a>
            <button className="pf-btn pf-btn-copper pf-btn-sm" onClick={() => scrollToSignup('attendee')}>
              Get event updates
            </button>
          </div>
        </div>
        <div className="pf-footer-fine">
          © 2026 {EVENT.name}. Dates and details subject to change — sign up to get confirmed news first.
        </div>
      </footer>

      <style>{`
        .pf {
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: ${C.paper};
          color: ${C.ink};
          overflow-x: hidden;
        }
        .pf a { color: inherit; text-decoration: none; }

        /* NAV */
        .pf-nav {
          position: sticky; top: 0; z-index: 50;
          background: rgba(250, 246, 238, 0.9);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid ${C.line};
        }
        .pf-nav-inner {
          max-width: 1120px; margin: 0 auto; padding: 14px 24px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .pf-brand {
          display: flex; align-items: center; gap: 10px;
          font-weight: 700; font-size: 18px; letter-spacing: -0.01em; color: ${C.ink};
        }
        .pf-brand-mark { font-size: 20px; }
        .pf-nav-links { display: flex; align-items: center; gap: 28px; }
        .pf-nav-links a { font-size: 15px; font-weight: 500; color: ${C.muted}; transition: color .15s; }
        .pf-nav-links a:hover { color: ${C.ink}; }

        /* BUTTONS */
        .pf-btn {
          font-family: inherit; font-weight: 600; border: none; cursor: pointer;
          border-radius: 10px; transition: all .15s; display: inline-flex;
          align-items: center; justify-content: center; gap: 8px; line-height: 1;
        }
        .pf-btn-sm { padding: 9px 16px; font-size: 14px; }
        .pf-btn-lg { padding: 15px 28px; font-size: 16px; }
        .pf-btn-primary:not(.pf-btn-lg):not(.pf-btn-sm) { padding: 13px 22px; font-size: 15px; }
        .pf-btn-primary { background: ${C.ink}; color: ${C.paper}; }
        .pf-btn-primary:hover { background: ${C.ink2}; transform: translateY(-1px); }
        .pf-btn-copper { background: ${C.copper}; color: #fff; }
        .pf-btn-copper:hover { background: ${C.copperDark}; transform: translateY(-1px); }
        .pf-btn-outline { background: transparent; color: ${C.ink}; box-shadow: inset 0 0 0 1.5px ${C.ink}; }
        .pf-btn-outline:hover { background: ${C.ink}; color: ${C.paper}; }
        .pf-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }

        /* HERO */
        .pf-hero {
          position: relative;
          background:
            radial-gradient(1200px 500px at 80% -10%, rgba(47,111,106,0.16), transparent 60%),
            radial-gradient(900px 500px at 0% 110%, rgba(176,106,59,0.14), transparent 55%),
            linear-gradient(180deg, ${C.paper} 0%, ${C.paper2} 100%);
        }
        .pf-hero-inner {
          max-width: 880px; margin: 0 auto; padding: 96px 24px 88px; text-align: center;
        }
        .pf-eyebrow {
          display: inline-block; font-size: 13px; font-weight: 600; letter-spacing: 0.06em;
          text-transform: uppercase; color: ${C.copperDark};
          background: rgba(176,106,59,0.1); padding: 7px 14px; border-radius: 999px; margin-bottom: 24px;
        }
        .pf-hero-title {
          font-size: 60px; font-weight: 700; line-height: 1.02; letter-spacing: -0.025em;
          color: ${C.ink}; margin-bottom: 20px;
        }
        .pf-hero-tagline { font-size: 22px; font-weight: 500; color: ${C.teal}; margin-bottom: 18px; }
        .pf-hero-sub {
          font-size: 17px; line-height: 1.6; color: ${C.muted};
          max-width: 620px; margin: 0 auto 36px;
        }
        .pf-hero-cta { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

        /* FACTS */
        .pf-facts { background: ${C.ink}; color: ${C.paper}; }
        .pf-facts-inner {
          max-width: 1120px; margin: 0 auto; padding: 32px 24px;
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
        }
        .pf-fact { display: flex; gap: 14px; align-items: flex-start; }
        .pf-fact-icon { font-size: 26px; line-height: 1.2; }
        .pf-fact-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.6; margin-bottom: 3px; }
        .pf-fact-value { font-size: 17px; font-weight: 600; }
        .pf-fact-sub { font-size: 13px; opacity: 0.65; margin-top: 2px; }

        /* SECTIONS */
        .pf-section { padding: 88px 0; }
        .pf-section-alt { background: ${C.paper2}; }
        .pf-section-inner { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
        .pf-center { text-align: center; max-width: 640px; margin: 0 auto 48px; }
        .pf-kicker {
          font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
          color: ${C.copper}; margin-bottom: 12px;
        }
        .pf-kicker-light { color: #e8b892; }
        .pf-h2 { font-size: 38px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; color: ${C.ink}; margin-bottom: 16px; }
        .pf-h2-light { color: ${C.paper}; }
        .pf-lead { font-size: 19px; line-height: 1.55; color: ${C.ink2}; margin-bottom: 18px; }
        .pf-body { font-size: 16px; line-height: 1.65; color: ${C.muted}; margin-bottom: 14px; }

        /* ABOUT */
        .pf-about { display: grid; grid-template-columns: 1.4fr 1fr; gap: 56px; align-items: center; }
        .pf-about-stats { display: flex; gap: 36px; margin-top: 32px; }
        .pf-about-stats > div { display: flex; flex-direction: column; }
        .pf-stat-num { font-size: 34px; font-weight: 700; color: ${C.copper}; line-height: 1; }
        .pf-stat-lbl { font-size: 13px; color: ${C.muted}; margin-top: 6px; }
        .pf-about-card {
          background: ${C.ink}; color: ${C.paper}; border-radius: 20px; padding: 40px 36px;
          position: relative; box-shadow: 0 20px 50px -20px rgba(18,35,59,0.5);
        }
        .pf-quote-mark { font-size: 72px; line-height: 0.6; color: ${C.copper}; height: 40px; }
        .pf-quote { font-size: 20px; line-height: 1.5; font-weight: 500; margin-bottom: 20px; }
        .pf-quote-by { font-size: 14px; opacity: 0.7; }

        /* GRID CARDS */
        .pf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .pf-card {
          background: ${C.paper}; border: 1px solid ${C.line}; border-radius: 16px; padding: 28px;
          transition: transform .18s, box-shadow .18s, border-color .18s;
        }
        .pf-section-alt .pf-card { background: #fff; }
        .pf-card:hover { transform: translateY(-4px); box-shadow: 0 18px 40px -24px rgba(18,35,59,0.45); border-color: ${C.copper}; }
        .pf-card-icon { font-size: 32px; margin-bottom: 14px; }
        .pf-card-title { font-size: 18px; font-weight: 700; color: ${C.ink}; margin-bottom: 8px; }
        .pf-card-text { font-size: 15px; line-height: 1.6; color: ${C.muted}; }

        /* SCHEDULE */
        .pf-schedule-wrap { display: grid; grid-template-columns: 1fr 1.2fr; gap: 56px; align-items: start; }
        .pf-schedule-head { position: sticky; top: 90px; }
        .pf-timeline { list-style: none; position: relative; }
        .pf-timeline::before {
          content: ''; position: absolute; left: 92px; top: 8px; bottom: 8px; width: 2px; background: ${C.line};
        }
        .pf-timeline-item {
          display: grid; grid-template-columns: 80px 24px 1fr; align-items: center;
          gap: 0; padding: 14px 0;
        }
        .pf-timeline-time { font-size: 14px; font-weight: 700; color: ${C.copper}; text-align: right; padding-right: 12px; }
        .pf-timeline-dot {
          width: 12px; height: 12px; border-radius: 50%; background: ${C.ink}; justify-self: center;
          box-shadow: 0 0 0 4px ${C.paper};
        }
        .pf-timeline-label { font-size: 15px; color: ${C.ink2}; font-weight: 500; padding-left: 12px; }

        /* VENDOR */
        .pf-vendor { background: ${C.ink}; color: ${C.paper}; padding: 88px 0; }
        .pf-vendor-inner {
          max-width: 1120px; margin: 0 auto; padding: 0 24px;
          display: grid; grid-template-columns: 1.3fr 1fr; gap: 56px; align-items: center;
        }
        .pf-vendor-lead { font-size: 18px; line-height: 1.6; color: rgba(250,246,238,0.85); margin-bottom: 22px; }
        .pf-vendor-list { list-style: none; margin-bottom: 30px; }
        .pf-vendor-list li {
          position: relative; padding-left: 30px; margin-bottom: 12px; font-size: 16px;
          color: rgba(250,246,238,0.9); line-height: 1.5;
        }
        .pf-vendor-list li::before {
          content: '✓'; position: absolute; left: 0; top: 0; color: ${C.copper}; font-weight: 700;
        }
        .pf-vendor-badges { display: flex; flex-wrap: wrap; gap: 12px; }
        .pf-vendor-badge {
          background: rgba(250,246,238,0.08); border: 1px solid rgba(250,246,238,0.15);
          padding: 14px 20px; border-radius: 12px; font-size: 16px; font-weight: 500;
        }

        /* SIGNUP */
        .pf-signup { max-width: 720px; }
        .pf-toggle {
          display: flex; gap: 8px; background: ${C.paper}; border: 1px solid ${C.line};
          padding: 6px; border-radius: 14px; max-width: 460px; margin: 0 auto 24px;
        }
        .pf-toggle-btn {
          flex: 1; padding: 12px; border: none; background: transparent; border-radius: 10px;
          font-family: inherit; font-size: 15px; font-weight: 600; color: ${C.muted}; cursor: pointer;
          transition: all .15s;
        }
        .pf-toggle-btn.active { background: ${C.ink}; color: ${C.paper}; }
        .pf-form-card {
          background: #fff; border: 1px solid ${C.line}; border-radius: 18px; padding: 32px;
          box-shadow: 0 20px 50px -30px rgba(18,35,59,0.4);
        }
        .pf-form { display: flex; flex-direction: column; gap: 16px; }
        .pf-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .pf-field { display: flex; flex-direction: column; }
        .pf-field label { font-size: 14px; font-weight: 600; color: ${C.ink2}; margin-bottom: 6px; }
        .pf-field input, .pf-field select, .pf-field textarea {
          width: 100%; padding: 11px 14px; border: 1px solid ${C.line}; border-radius: 10px;
          font-size: 15px; font-family: inherit; color: ${C.ink}; background: ${C.paper};
          transition: border-color .15s, box-shadow .15s;
        }
        .pf-field textarea { min-height: 92px; resize: vertical; }
        .pf-field input:focus, .pf-field select:focus, .pf-field textarea:focus {
          outline: none; border-color: ${C.copper}; box-shadow: 0 0 0 3px rgba(176,106,59,0.14);
        }
        .pf-error {
          background: #fdecec; border: 1px solid #f5c2c2; color: #b02a2a;
          padding: 10px 14px; border-radius: 10px; font-size: 14px;
        }
        .pf-form-done { text-align: center; padding: 24px 8px; }

        /* FAQ */
        .pf-faq-wrap { max-width: 760px; }
        .pf-faq { display: flex; flex-direction: column; gap: 12px; }
        .pf-faq-item { background: #fff; border: 1px solid ${C.line}; border-radius: 12px; overflow: hidden; }
        .pf-faq-item.open { border-color: ${C.copper}; }
        .pf-faq-q {
          width: 100%; display: flex; justify-content: space-between; align-items: center;
          padding: 18px 22px; background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: 16px; font-weight: 600; color: ${C.ink}; text-align: left;
        }
        .pf-faq-toggle { font-size: 22px; color: ${C.copper}; font-weight: 400; line-height: 1; }
        .pf-faq-a { padding: 0 22px 20px; font-size: 15px; line-height: 1.6; color: ${C.muted}; }

        /* FOOTER */
        .pf-footer { background: ${C.ink}; color: ${C.paper}; padding: 44px 0 28px; }
        .pf-footer-inner {
          max-width: 1120px; margin: 0 auto; padding: 0 24px;
          display: flex; justify-content: space-between; align-items: center; gap: 24px; flex-wrap: wrap;
        }
        .pf-brand-light { color: ${C.paper}; }
        .pf-footer-meta { font-size: 14px; opacity: 0.7; margin-top: 8px; }
        .pf-footer-right { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
        .pf-footer-right a { font-size: 15px; opacity: 0.85; }
        .pf-footer-right a:hover { opacity: 1; }
        .pf-footer-fine {
          max-width: 1120px; margin: 28px auto 0; padding: 20px 24px 0;
          border-top: 1px solid rgba(250,246,238,0.12); font-size: 13px; opacity: 0.55;
        }

        /* RESPONSIVE */
        @media (max-width: 860px) {
          .pf-hero-title { font-size: 42px; }
          .pf-hero-inner { padding: 64px 24px 56px; }
          .pf-facts-inner { grid-template-columns: 1fr; gap: 18px; }
          .pf-about { grid-template-columns: 1fr; gap: 36px; }
          .pf-grid { grid-template-columns: 1fr 1fr; }
          .pf-schedule-wrap { grid-template-columns: 1fr; gap: 32px; }
          .pf-schedule-head { position: static; }
          .pf-vendor-inner { grid-template-columns: 1fr; gap: 36px; }
          .pf-h2 { font-size: 30px; }
          .pf-section { padding: 60px 0; }
          .pf-vendor { padding: 60px 0; }
          .pf-nav-links a { display: none; }
        }
        @media (max-width: 560px) {
          .pf-hero-title { font-size: 34px; }
          .pf-hero-tagline { font-size: 18px; }
          .pf-grid { grid-template-columns: 1fr; }
          .pf-field-row { grid-template-columns: 1fr; }
          .pf-toggle { flex-direction: column; }
          .pf-timeline::before { left: 72px; }
          .pf-timeline-item { grid-template-columns: 62px 24px 1fr; }
          .pf-form-card { padding: 22px; }
        }
      `}</style>
    </div>
  );
}
