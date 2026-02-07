'use client';

import { useState, useEffect } from 'react';
import { supabase, getAllSubmissions, getFullSubmission, updateSubmission } from '../../lib/supabase';

const STATUS_LABELS = {
  draft: '📝 Draft',
  submitted: '📩 Submitted',
  in_review: '👀 In Review',
  building: '🔨 Building',
  ready_for_qc: '🔍 Ready for QC',
  client_preview: '👁️ Client Preview',
  approved: '✅ Approved',
  published: '🚀 Published',
  archived: '📦 Archived',
};

const STATUS_FLOW = ['submitted', 'in_review', 'building', 'ready_for_qc', 'client_preview', 'approved', 'published'];

export default function AdminDashboard() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function loadSubmissions() {
    setLoading(true);
    const data = await getAllSubmissions();
    setSubmissions(data);
    setLoading(false);
  }

  async function openDetail(id) {
    setSelected(id);
    setDetailLoading(true);
    const full = await getFullSubmission(id);
    setDetail(full);
    setDetailLoading(false);
  }

  async function changeStatus(id, newStatus) {
    await updateSubmission(id, { status: newStatus });
    await loadSubmissions();
    if (detail?.id === id) {
      setDetail({ ...detail, status: newStatus });
    }
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function timeSince(d) {
    if (!d) return '';
    const mins = Math.floor((Date.now() - new Date(d)) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  const filtered = submissions.filter(s => {
    const matchSearch = !search || (s.business_name || '').toLowerCase().includes(search.toLowerCase()) || (s.email || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: submissions.length,
    submitted: submissions.filter(s => s.status === 'submitted').length,
    building: submissions.filter(s => ['building', 'ready_for_qc'].includes(s.status)).length,
    published: submissions.filter(s => s.status === 'published').length,
  };

  return (
    <div className="admin-layout">
      {/* Header */}
      <div className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🚀</span>
          <div>
            <h1>LPM Pipeline</h1>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Local Pro Marketers — Client Intake Dashboard</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => {
            const baseUrl = window.location.origin;
            navigator.clipboard.writeText(`${baseUrl}/`);
            alert('Intake link copied! Send this to your client.');
          }}>
            📋 Copy Intake Link
          </button>
        </div>
      </div>

      <div className="admin-content">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{counts.total}</div>
            <div className="stat-label">Total Submissions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#2563eb' }}>{counts.submitted}</div>
            <div className="stat-label">Awaiting Review</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#7c3aed' }}>{counts.building}</div>
            <div className="stat-label">In Build</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#16a34a' }}>{counts.published}</div>
            <div className="stat-label">Published</div>
          </div>
        </div>

        {/* Table + Detail split */}
        <div style={{ display: 'flex', gap: 24 }}>
          {/* Submissions List */}
          <div className="table-card" style={{ flex: selected ? '0 0 480px' : 1, transition: 'flex 0.2s' }}>
            <div className="table-header">
              <h2>Submissions</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, width: 160 }}
                />
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                >
                  <option value="all">All Status</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="icon">📭</div>
                <h3>No submissions yet</h3>
                <p>Send a client your intake link to get started</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr
                      key={s.id}
                      onClick={() => openDetail(s.id)}
                      style={{ background: selected === s.id ? '#f9fafb' : 'transparent' }}
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{s.business_name || 'Unnamed'}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{s.email || '—'}</div>
                      </td>
                      <td>
                        <span className={`status-badge ${s.status}`}>
                          {STATUS_LABELS[s.status] || s.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: '#6b7280' }}>
                        {timeSince(s.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Detail Panel */}
          {selected && (
            <div style={{ flex: 1, minWidth: 0 }}>
              {detailLoading ? (
                <div className="step-card" style={{ textAlign: 'center', padding: 60 }}>Loading...</div>
              ) : detail ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Header card */}
                  <div className="step-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{detail.business_name || 'Unnamed Business'}</h2>
                        <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0' }}>
                          {detail.business_category} • {detail.city}, {detail.state} • {formatDate(detail.created_at)}
                        </p>
                      </div>
                      <button
                        style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}
                        onClick={() => { setSelected(null); setDetail(null); }}
                      >✕</button>
                    </div>

                    {/* Status changer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Status:</span>
                      <span className={`status-badge ${detail.status}`}>{STATUS_LABELS[detail.status]}</span>
                      <span style={{ color: '#d1d5db' }}>→</span>
                      {STATUS_FLOW.filter(s => s !== detail.status).slice(0, 3).map(s => (
                        <button
                          key={s}
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '4px 12px' }}
                          onClick={() => changeStatus(detail.id, s)}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>

                    {/* Duda integration */}
                    {detail.status === 'in_review' || detail.status === 'submitted' ? (
                      <div style={{ marginTop: 16, padding: 16, background: '#ede9fe', borderRadius: 10 }}>
                        <button
                          className="btn btn-ai"
                          onClick={() => {
                            changeStatus(detail.id, 'building');
                            alert('🔨 Build Site triggered! (Duda API integration coming in Phase 2)');
                          }}
                        >
                          🔨 Build Site in Duda
                        </button>
                        <p style={{ fontSize: 12, color: '#6d28d9', marginTop: 8, marginBottom: 0 }}>
                          This will create a Duda site, push content, and populate collections.
                        </p>
                      </div>
                    ) : null}

                    {detail.duda_site_url && (
                      <div style={{ marginTop: 12 }}>
                        <a href={detail.duda_site_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontSize: 14 }}>
                          🔗 Preview Site
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Contact info */}
                  <div className="step-card">
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Contact</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 14 }}>
                      {[
                        ['Phone', detail.primary_phone],
                        ['Email', detail.email],
                        ['Address', [detail.street, detail.city, detail.state, detail.zip].filter(Boolean).join(', ')],
                        ['Website', detail.existing_website],
                      ].map(([label, val]) => val ? (
                        <div key={label}>
                          <span style={{ color: '#6b7280', fontWeight: 500 }}>{label}: </span>
                          <span style={{ color: '#111827' }}>{val}</span>
                        </div>
                      ) : null)}
                    </div>
                  </div>

                  {/* Services */}
                  {detail.services?.length > 0 && (
                    <div className="step-card">
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Services ({detail.services.length})</h3>
                      {detail.services.map((s, i) => (
                        <div key={i} style={{ padding: '10px 0', borderBottom: i < detail.services.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{s.service_name}</div>
                          {s.ai_description && <p style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{s.ai_description}</p>}
                          {!s.ai_description && s.description && <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{s.description}</p>}
                          {s.price_range && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>{s.price_range}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Generated Copy */}
                  {(detail.hero_headline || detail.about_us || detail.why_choose_us) && (
                    <div className="step-card">
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Website Copy</h3>
                      {detail.hero_headline && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>HERO HEADLINE</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{detail.hero_headline}</div>
                          {detail.hero_subheadline && <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>{detail.hero_subheadline}</div>}
                        </div>
                      )}
                      {detail.about_us && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>ABOUT US</div>
                          <div style={{ fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{detail.about_us}</div>
                        </div>
                      )}
                      {detail.why_choose_us && (
                        <div>
                          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>WHY CHOOSE US</div>
                          <div style={{ fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{detail.why_choose_us}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Testimonials */}
                  {detail.testimonials?.length > 0 && (
                    <div className="step-card">
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Testimonials ({detail.testimonials.length})</h3>
                      {detail.testimonials.map((t, i) => (
                        <div key={i} style={{ padding: '12px 0', borderBottom: i < detail.testimonials.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                          <p style={{ fontSize: 14, color: '#374151', fontStyle: 'italic', margin: 0 }}>"{t.quote_text}"</p>
                          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>— {t.author_name || 'Anonymous'}{t.author_city ? `, ${t.author_city}` : ''}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Intake link */}
                  <div className="step-card" style={{ background: '#f9fafb' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Client Access Link</h3>
                    <code style={{ fontSize: 12, color: '#6b7280', wordBreak: 'break-all' }}>
                      {typeof window !== 'undefined' ? `${window.location.origin}/intake/${detail.access_token}` : ''}
                    </code>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
