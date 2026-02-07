'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, getSubmissionByToken, updateSubmission, upsertServices, upsertTestimonials, upsertBusinessHours } from '../../../lib/supabase';

const STEPS = [
  { id: 1, title: 'Business Identity', subtitle: 'Tell us who you are' },
  { id: 2, title: 'Contact & Location', subtitle: 'Where clients can find you' },
  { id: 3, title: 'Online Presence', subtitle: 'Your current digital footprint' },
  { id: 4, title: 'Services Offered', subtitle: 'What you do best' },
  { id: 5, title: 'Service Areas', subtitle: 'Where you work' },
  { id: 6, title: 'Brand & Design', subtitle: 'How you want to look' },
  { id: 7, title: 'Website Copy', subtitle: 'Your story in your words' },
  { id: 8, title: 'Social Proof', subtitle: 'Reviews, certifications & portfolio' },
  { id: 9, title: 'Business Hours', subtitle: 'When you\'re available' },
  { id: 10, title: 'Review & Submit', subtitle: 'Double-check everything' },
];

const DEFAULT_HOURS = [
  { day_of_week: 'Monday', open_time: '08:00', close_time: '17:00', is_closed: false },
  { day_of_week: 'Tuesday', open_time: '08:00', close_time: '17:00', is_closed: false },
  { day_of_week: 'Wednesday', open_time: '08:00', close_time: '17:00', is_closed: false },
  { day_of_week: 'Thursday', open_time: '08:00', close_time: '17:00', is_closed: false },
  { day_of_week: 'Friday', open_time: '08:00', close_time: '17:00', is_closed: false },
  { day_of_week: 'Saturday', open_time: '09:00', close_time: '14:00', is_closed: false },
  { day_of_week: 'Sunday', open_time: '', close_time: '', is_closed: true },
];

const HOME_SERVICE_CATEGORIES = [
  'Plumbing', 'HVAC', 'Electrical', 'Roofing', 'Landscaping',
  'Painting', 'Remodeling', 'Pest Control', 'Cleaning', 'Other'
];

export default function IntakeForm({ params }) {
  const { token } = params;
  const [submission, setSubmission] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [aiLoading, setAiLoading] = useState({});
  const [form, setForm] = useState({});

  // Load submission on mount
  useEffect(() => {
    async function load() {
      const data = await getSubmissionByToken(token);
      if (data) {
        setSubmission(data);
        setForm(data);
        // Load related data
        const [svc, test, hrs] = await Promise.all([
          supabase.from('services').select('*').eq('submission_id', data.id).order('sort_order'),
          supabase.from('testimonials').select('*').eq('submission_id', data.id).order('sort_order'),
          supabase.from('business_hours').select('*').eq('submission_id', data.id).order('sort_order'),
        ]);
        if (svc.data?.length) setServices(svc.data);
        if (test.data?.length) setTestimonials(test.data);
        if (hrs.data?.length) setHours(hrs.data);
      } else {
        // Invalid token
        window.location.href = '/';
        return;
      }
      setLoading(false);
    }
    load();
  }, [token]);

  // Auto-save on field changes (debounced)
  const autoSave = useCallback(async (updatedFields) => {
    if (!submission?.id) return;
    setSaving(true);
    await updateSubmission(submission.id, updatedFields);
    setTimeout(() => setSaving(false), 800);
  }, [submission?.id]);

  function updateField(field, value) {
    const updated = { ...form, [field]: value };
    setForm(updated);
    // Debounce save
    clearTimeout(window._saveTimer);
    window._saveTimer = setTimeout(() => autoSave({ [field]: value }), 1000);
  }

  // Save services/testimonials/hours when navigating away from their steps
  async function saveRelatedData() {
    if (!submission?.id) return;
    if (step === 4) await upsertServices(submission.id, services);
    if (step === 8) await upsertTestimonials(submission.id, testimonials);
    if (step === 9) await upsertBusinessHours(submission.id, hours);
  }

  async function nextStep() {
    await saveRelatedData();
    if (step < 10) setStep(step + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function prevStep() {
    await saveRelatedData();
    if (step > 1) setStep(step - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit() {
    await saveRelatedData();
    await updateSubmission(submission.id, { 
      status: 'submitted', 
      submitted_at: new Date().toISOString() 
    });
    setStep(11); // Show confirmation
  }

  // AI generation helper
  async function generateAI(field, prompt) {
    setAiLoading(prev => ({ ...prev, [field]: true }));
    try {
      const res = await fetch('/api/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context: form }),
      });
      const data = await res.json();
      if (data.text) {
        updateField(field, data.text);
      }
    } catch (err) {
      console.error('AI generation error:', err);
    }
    setAiLoading(prev => ({ ...prev, [field]: false }));
  }

  if (loading) {
    return (
      <div className="intake-container" style={{ textAlign: 'center', paddingTop: 100 }}>
        <div className="ai-loading" style={{ justifyContent: 'center' }}>
          <div className="spinner"></div>
          Loading your form...
        </div>
      </div>
    );
  }

  // Confirmation screen after submission
  if (step === 11) {
    return (
      <div className="intake-container" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 60, marginBottom: 20 }}>✅</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>You're All Set!</h1>
        <p style={{ fontSize: 16, color: '#6b7280', maxWidth: 480, margin: '0 auto 32px' }}>
          We've received your information for <strong>{form.business_name || 'your business'}</strong>. 
          Our team will review everything and start building your website. 
          You'll receive a preview link within 2-3 business days.
        </p>
        <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 12, padding: 20, maxWidth: 400, margin: '0 auto' }}>
          <p style={{ fontSize: 14, color: '#166534' }}>
            💡 Bookmark this page — you can come back to edit your submission anytime before we start building.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="intake-container">
      {/* Header */}
      <div className="intake-header">
        <h1>🚀 Website Intake Form</h1>
        <p>{form.business_name || 'New Client'}</p>
      </div>

      {/* Progress */}
      <div className="progress-label">Step {step} of 10 — {STEPS[step - 1].title}</div>
      <div className="progress-bar">
        {STEPS.map(s => (
          <div 
            key={s.id} 
            className={`progress-step ${s.id < step ? 'completed' : ''} ${s.id === step ? 'active' : ''}`}
            onClick={() => { saveRelatedData(); setStep(s.id); }}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="step-card">
        <h2 className="step-title">{STEPS[step - 1].title}</h2>
        <p className="step-subtitle">{STEPS[step - 1].subtitle}</p>

        {/* ── STEP 1: Business Identity ── */}
        {step === 1 && (
          <>
            <div className="form-group">
              <label>Business Name *</label>
              <input
                type="text"
                value={form.business_name || ''}
                onChange={e => updateField('business_name', e.target.value)}
                placeholder="e.g., Smith & Sons Plumbing"
              />
            </div>
            <div className="form-group">
              <label>Business Category *</label>
              <select
                value={form.business_category || ''}
                onChange={e => updateField('business_category', e.target.value)}
              >
                <option value="">Select a category...</option>
                {HOME_SERVICE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Describe your business in a few sentences</label>
              <textarea
                value={form.raw_description || ''}
                onChange={e => updateField('raw_description', e.target.value)}
                placeholder="What do you do? Who do you serve? What makes you different?"
                rows={4}
              />
            </div>
            {form.raw_description && form.raw_description.length > 20 && (
              <div>
                <button
                  className="btn btn-ai"
                  onClick={() => generateAI('polished_description',
                    `Polish this business description into a professional 2-3 paragraph About Us section for a ${form.business_category || 'home services'} company called "${form.business_name}": ${form.raw_description}`
                  )}
                  disabled={aiLoading.polished_description}
                >
                  {aiLoading.polished_description ? (
                    <><div className="spinner" style={{ borderColor: '#e9d5ff', borderTopColor: 'white' }}></div> Generating...</>
                  ) : '✨ Polish with AI'}
                </button>
                {form.polished_description && (
                  <div className="ai-output" style={{ marginTop: 12 }}>
                    <label>AI-Generated Description</label>
                    <textarea
                      value={form.polished_description}
                      onChange={e => updateField('polished_description', e.target.value)}
                      rows={6}
                      style={{ background: 'transparent', border: '1px solid #e9d5ff' }}
                    />
                  </div>
                )}
              </div>
            )}
            <div className="form-row" style={{ marginTop: 20 }}>
              <div className="form-group">
                <label>Year Established <span className="optional">optional</span></label>
                <input
                  type="text"
                  value={form.year_established || ''}
                  onChange={e => updateField('year_established', e.target.value)}
                  placeholder="e.g., 2010"
                />
              </div>
              <div className="form-group">
                <label>Owner Name(s) <span className="optional">optional</span></label>
                <input
                  type="text"
                  value={form.owner_names || ''}
                  onChange={e => updateField('owner_names', e.target.value)}
                  placeholder="e.g., John Smith"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>License # <span className="optional">optional</span></label>
                <input
                  type="text"
                  value={form.license_number || ''}
                  onChange={e => updateField('license_number', e.target.value)}
                  placeholder="e.g., MHIC #123456"
                />
              </div>
              <div className="form-group">
                <label>Insurance Info <span className="optional">optional</span></label>
                <input
                  type="text"
                  value={form.insurance_info || ''}
                  onChange={e => updateField('insurance_info', e.target.value)}
                  placeholder="e.g., Fully insured & bonded"
                />
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: Contact & Location ── */}
        {step === 2 && (
          <>
            <div className="form-group">
              <label>Street Address</label>
              <input
                type="text"
                value={form.street || ''}
                onChange={e => updateField('street', e.target.value)}
                placeholder="123 Main Street"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>City *</label>
                <input
                  type="text"
                  value={form.city || ''}
                  onChange={e => updateField('city', e.target.value)}
                  placeholder="Havre de Grace"
                />
              </div>
              <div className="form-group">
                <label>State</label>
                <input
                  type="text"
                  value={form.state || 'MD'}
                  onChange={e => updateField('state', e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>ZIP Code *</label>
                <input
                  type="text"
                  value={form.zip || ''}
                  onChange={e => updateField('zip', e.target.value)}
                  placeholder="21078"
                />
              </div>
              <div className="form-group">
                <label>Primary Phone *</label>
                <input
                  type="tel"
                  value={form.primary_phone || ''}
                  onChange={e => updateField('primary_phone', e.target.value)}
                  placeholder="(410) 555-1234"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Secondary Phone <span className="optional">optional</span></label>
                <input
                  type="tel"
                  value={form.secondary_phone || ''}
                  onChange={e => updateField('secondary_phone', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={e => updateField('email', e.target.value)}
                  placeholder="john@smithplumbing.com"
                />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.emergency_service || false}
                  onChange={e => updateField('emergency_service', e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                We offer 24/7 emergency service
              </label>
            </div>
          </>
        )}

        {/* ── STEP 3: Online Presence ── */}
        {step === 3 && (
          <>
            <div className="form-group">
              <label>Existing Website <span className="optional">if any</span></label>
              <input
                type="url"
                value={form.existing_website || ''}
                onChange={e => updateField('existing_website', e.target.value)}
                placeholder="https://www.yourbusiness.com"
              />
            </div>
            <div className="form-group">
              <label>Google Business Profile URL <span className="optional">important for SEO</span></label>
              <input
                type="url"
                value={form.gbp_url || ''}
                onChange={e => updateField('gbp_url', e.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Facebook</label>
                <input
                  type="url"
                  value={form.facebook || ''}
                  onChange={e => updateField('facebook', e.target.value)}
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div className="form-group">
                <label>Instagram</label>
                <input
                  type="url"
                  value={form.instagram || ''}
                  onChange={e => updateField('instagram', e.target.value)}
                  placeholder="https://instagram.com/..."
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>YouTube <span className="optional">optional</span></label>
                <input
                  type="url"
                  value={form.youtube || ''}
                  onChange={e => updateField('youtube', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>LinkedIn <span className="optional">optional</span></label>
                <input
                  type="url"
                  value={form.linkedin || ''}
                  onChange={e => updateField('linkedin', e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Nextdoor <span className="optional">optional</span></label>
              <input
                type="url"
                value={form.nextdoor || ''}
                onChange={e => updateField('nextdoor', e.target.value)}
              />
            </div>
          </>
        )}

        {/* ── STEP 4: Services ── */}
        {step === 4 && (
          <>
            {services.map((svc, i) => (
              <div key={i} className="repeating-item">
                <button className="remove-btn" onClick={() => setServices(services.filter((_, j) => j !== i))}>✕</button>
                <div className="form-group">
                  <label>Service Name *</label>
                  <input
                    type="text"
                    value={svc.service_name || ''}
                    onChange={e => {
                      const updated = [...services];
                      updated[i] = { ...updated[i], service_name: e.target.value };
                      setServices(updated);
                    }}
                    placeholder="e.g., Water Heater Installation"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={svc.category || ''}
                      onChange={e => {
                        const updated = [...services];
                        updated[i] = { ...updated[i], category: e.target.value };
                        setServices(updated);
                      }}
                    >
                      <option value="">Select...</option>
                      {HOME_SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Price Range <span className="optional">optional</span></label>
                    <input
                      type="text"
                      value={svc.price_range || ''}
                      onChange={e => {
                        const updated = [...services];
                        updated[i] = { ...updated[i], price_range: e.target.value };
                        setServices(updated);
                      }}
                      placeholder="e.g., $150-$500"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={svc.description || ''}
                    onChange={e => {
                      const updated = [...services];
                      updated[i] = { ...updated[i], description: e.target.value };
                      setServices(updated);
                    }}
                    placeholder="What does this service include?"
                    rows={3}
                  />
                </div>
                {svc.description && svc.description.length > 15 && (
                  <button
                    className="btn btn-ai"
                    style={{ fontSize: 13, padding: '8px 16px' }}
                    onClick={async () => {
                      setAiLoading(prev => ({ ...prev, [`svc_${i}`]: true }));
                      try {
                        const res = await fetch('/api/ai-generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            prompt: `Write a professional 2-3 sentence service description for a ${form.business_category || 'home services'} company's "${svc.service_name}" service. Raw input from owner: "${svc.description}". Business name: "${form.business_name}". Make it customer-facing and benefit-focused.`,
                            context: form,
                          }),
                        });
                        const data = await res.json();
                        if (data.text) {
                          const updated = [...services];
                          updated[i] = { ...updated[i], ai_description: data.text };
                          setServices(updated);
                        }
                      } catch (err) { console.error(err); }
                      setAiLoading(prev => ({ ...prev, [`svc_${i}`]: false }));
                    }}
                    disabled={aiLoading[`svc_${i}`]}
                  >
                    {aiLoading[`svc_${i}`] ? '⏳ Generating...' : '✨ Polish with AI'}
                  </button>
                )}
                {svc.ai_description && (
                  <div className="ai-output" style={{ marginTop: 8 }}>
                    <label>AI-Polished Version</label>
                    <textarea
                      value={svc.ai_description}
                      onChange={e => {
                        const updated = [...services];
                        updated[i] = { ...updated[i], ai_description: e.target.value };
                        setServices(updated);
                      }}
                      rows={3}
                      style={{ background: 'transparent', border: '1px solid #e9d5ff' }}
                    />
                  </div>
                )}
              </div>
            ))}
            <button className="add-btn" onClick={() => setServices([...services, { service_name: '', category: form.business_category || '', description: '' }])}>
              + Add Service
            </button>
          </>
        )}

        {/* ── STEP 5: Service Areas ── */}
        {step === 5 && (
          <>
            <div className="form-group">
              <label>Primary City *</label>
              <input
                type="text"
                value={form.primary_city || ''}
                onChange={e => updateField('primary_city', e.target.value)}
                placeholder="e.g., Havre de Grace"
              />
            </div>
            <div className="form-group">
              <label>Additional Cities/Towns You Serve</label>
              <textarea
                value={form.additional_cities || ''}
                onChange={e => updateField('additional_cities', e.target.value)}
                placeholder="List each city on a separate line, e.g.:&#10;Aberdeen&#10;Bel Air&#10;Edgewood&#10;Perryville"
                rows={5}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>County</label>
                <input
                  type="text"
                  value={form.county || ''}
                  onChange={e => updateField('county', e.target.value)}
                  placeholder="e.g., Harford County"
                />
              </div>
              <div className="form-group">
                <label>Service Radius</label>
                <input
                  type="text"
                  value={form.service_radius || ''}
                  onChange={e => updateField('service_radius', e.target.value)}
                  placeholder="e.g., 30 miles"
                />
              </div>
            </div>
          </>
        )}

        {/* ── STEP 6: Brand & Design ── */}
        {step === 6 && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Primary Brand Color</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={form.primary_color || '#1a5276'}
                    onChange={e => updateField('primary_color', e.target.value)}
                    style={{ width: 48, height: 40, padding: 2, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={form.primary_color || '#1a5276'}
                    onChange={e => updateField('primary_color', e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Secondary Color</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={form.secondary_color || '#e74c3c'}
                    onChange={e => updateField('secondary_color', e.target.value)}
                    style={{ width: 48, height: 40, padding: 2, cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={form.secondary_color || '#e74c3c'}
                    onChange={e => updateField('secondary_color', e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Tone of Voice</label>
              <select
                value={form.tone || 'PROFESSIONAL'}
                onChange={e => updateField('tone', e.target.value)}
              >
                <option value="CONVERSATIONAL">Conversational — Friendly and approachable</option>
                <option value="PROFESSIONAL">Professional — Trustworthy and established</option>
                <option value="FORMAL">Formal — Corporate and authoritative</option>
                <option value="FRIENDLY">Friendly — Warm and neighborly</option>
              </select>
            </div>
            <div className="form-group">
              <label>Design Style Preference <span className="optional">optional</span></label>
              <input
                type="text"
                value={form.design_style || ''}
                onChange={e => updateField('design_style', e.target.value)}
                placeholder="e.g., Clean & modern, Traditional, Bold & colorful"
              />
            </div>
            <div className="form-group">
              <label>Tagline <span className="optional">optional — we can generate one</span></label>
              <input
                type="text"
                value={form.tagline || ''}
                onChange={e => updateField('tagline', e.target.value)}
                placeholder="e.g., Your Trusted Local Plumber Since 2010"
              />
              <button
                className="btn btn-ai"
                style={{ marginTop: 8, fontSize: 13, padding: '8px 16px' }}
                onClick={() => generateAI('ai_tagline_options',
                  `Generate 5 short, punchy taglines for a ${form.business_category || 'home services'} company called "${form.business_name}". ${form.raw_description ? 'About: ' + form.raw_description : ''} ${form.city ? 'Located in ' + form.city + ', ' + form.state : ''}. Return as a numbered list.`
                )}
                disabled={aiLoading.ai_tagline_options}
              >
                {aiLoading.ai_tagline_options ? '⏳ Generating...' : '✨ Generate Tagline Ideas'}
              </button>
              {form.ai_tagline_options && (
                <div className="ai-output" style={{ marginTop: 8 }}>
                  <label>AI Tagline Suggestions — pick your favorite and paste above</label>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#374151', marginTop: 8 }}>
                    {form.ai_tagline_options}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── STEP 7: Website Copy ── */}
        {step === 7 && (
          <>
            <div className="form-group">
              <label>What makes you different from competitors?</label>
              <textarea
                value={form.what_makes_different || ''}
                onChange={e => updateField('what_makes_different', e.target.value)}
                placeholder="Why should a customer choose you over the other guys?"
                rows={3}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Warranties/Guarantees <span className="optional">optional</span></label>
                <input
                  type="text"
                  value={form.warranties || ''}
                  onChange={e => updateField('warranties', e.target.value)}
                  placeholder="e.g., 100% satisfaction guarantee"
                />
              </div>
              <div className="form-group">
                <label>Financing Available? <span className="optional">optional</span></label>
                <input
                  type="text"
                  value={form.financing || ''}
                  onChange={e => updateField('financing', e.target.value)}
                  placeholder="e.g., 0% financing for 12 months"
                />
              </div>
            </div>

            {(form.raw_description || form.what_makes_different) && (
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: 20, marginTop: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>✨ Generate website copy from your answers:</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-ai"
                    style={{ fontSize: 13, padding: '8px 16px' }}
                    onClick={() => generateAI('hero_headline',
                      `Write a compelling hero headline (max 10 words) for a ${form.business_category} company called "${form.business_name}" in ${form.city || 'Maryland'}. ${form.what_makes_different ? 'Key differentiator: ' + form.what_makes_different : ''}`
                    )}
                    disabled={aiLoading.hero_headline}
                  >
                    {aiLoading.hero_headline ? '⏳' : '✨'} Hero Headline
                  </button>
                  <button
                    className="btn btn-ai"
                    style={{ fontSize: 13, padding: '8px 16px' }}
                    onClick={() => generateAI('hero_subheadline',
                      `Write a hero subheadline (1-2 sentences) for "${form.business_name}", a ${form.business_category} company. Headline: "${form.hero_headline || ''}". Include a call to action.`
                    )}
                    disabled={aiLoading.hero_subheadline}
                  >
                    {aiLoading.hero_subheadline ? '⏳' : '✨'} Subheadline
                  </button>
                  <button
                    className="btn btn-ai"
                    style={{ fontSize: 13, padding: '8px 16px' }}
                    onClick={() => generateAI('about_us',
                      `Write a warm, professional "About Us" section (2-3 paragraphs) for "${form.business_name}", a ${form.business_category} company in ${form.city || ''}, ${form.state || 'MD'}. ${form.raw_description ? 'Owner description: ' + form.raw_description : ''} ${form.year_established ? 'Established: ' + form.year_established : ''} ${form.owner_names ? 'Owners: ' + form.owner_names : ''}`
                    )}
                    disabled={aiLoading.about_us}
                  >
                    {aiLoading.about_us ? '⏳' : '✨'} About Us
                  </button>
                  <button
                    className="btn btn-ai"
                    style={{ fontSize: 13, padding: '8px 16px' }}
                    onClick={() => generateAI('why_choose_us',
                      `Write 4-6 "Why Choose Us" bullet points for "${form.business_name}", a ${form.business_category} company. ${form.what_makes_different ? 'Differentiators: ' + form.what_makes_different : ''} ${form.license_number ? 'Licensed: ' + form.license_number : ''} ${form.insurance_info ? 'Insurance: ' + form.insurance_info : ''} ${form.warranties ? 'Warranty: ' + form.warranties : ''} ${form.year_established ? 'Since: ' + form.year_established : ''} Return as a numbered list with emoji bullets.`
                    )}
                    disabled={aiLoading.why_choose_us}
                  >
                    {aiLoading.why_choose_us ? '⏳' : '✨'} Why Choose Us
                  </button>
                  <button
                    className="btn btn-ai"
                    style={{ fontSize: 13, padding: '8px 16px' }}
                    onClick={() => generateAI('cta_text',
                      `Suggest 3 call-to-action button text options for a ${form.business_category} company website. ${form.emergency_service ? 'They offer 24/7 emergency service.' : ''} Return as numbered list.`
                    )}
                    disabled={aiLoading.cta_text}
                  >
                    {aiLoading.cta_text ? '⏳' : '✨'} CTA Text
                  </button>
                </div>
              </div>
            )}

            {/* Display generated copy */}
            {['hero_headline', 'hero_subheadline', 'about_us', 'why_choose_us', 'cta_text'].map(field => (
              form[field] ? (
                <div key={field} className="ai-output" style={{ marginTop: 12 }}>
                  <label>{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                  <textarea
                    value={form[field]}
                    onChange={e => updateField(field, e.target.value)}
                    rows={field === 'about_us' || field === 'why_choose_us' ? 6 : 2}
                    style={{ background: 'transparent', border: '1px solid #e9d5ff', marginTop: 6 }}
                  />
                </div>
              ) : null
            ))}
          </>
        )}

        {/* ── STEP 8: Social Proof ── */}
        {step === 8 && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Google Review Count <span className="optional">approx.</span></label>
                <input
                  type="text"
                  value={form.google_review_count || ''}
                  onChange={e => updateField('google_review_count', e.target.value)}
                  placeholder="e.g., 87"
                />
              </div>
              <div className="form-group">
                <label>Google Star Rating</label>
                <input
                  type="text"
                  value={form.google_star_rating || ''}
                  onChange={e => updateField('google_star_rating', e.target.value)}
                  placeholder="e.g., 4.8"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Certifications & Memberships <span className="optional">optional</span></label>
              <textarea
                value={form.certifications || ''}
                onChange={e => updateField('certifications', e.target.value)}
                placeholder="e.g., BBB A+ Rated, EPA Certified, Angi Super Service Award"
                rows={2}
              />
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 28, marginBottom: 12 }}>Customer Testimonials</h3>
            {testimonials.map((t, i) => (
              <div key={i} className="repeating-item">
                <button className="remove-btn" onClick={() => setTestimonials(testimonials.filter((_, j) => j !== i))}>✕</button>
                <div className="form-group">
                  <label>Quote *</label>
                  <textarea
                    value={t.quote_text || ''}
                    onChange={e => {
                      const updated = [...testimonials];
                      updated[i] = { ...updated[i], quote_text: e.target.value };
                      setTestimonials(updated);
                    }}
                    placeholder="What the customer said..."
                    rows={3}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Customer Name</label>
                    <input
                      type="text"
                      value={t.author_name || ''}
                      onChange={e => {
                        const updated = [...testimonials];
                        updated[i] = { ...updated[i], author_name: e.target.value };
                        setTestimonials(updated);
                      }}
                      placeholder="e.g., Sarah M."
                    />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={t.author_city || ''}
                      onChange={e => {
                        const updated = [...testimonials];
                        updated[i] = { ...updated[i], author_city: e.target.value };
                        setTestimonials(updated);
                      }}
                      placeholder="e.g., Bel Air"
                    />
                  </div>
                </div>
              </div>
            ))}
            <button className="add-btn" onClick={() => setTestimonials([...testimonials, { quote_text: '', author_name: '', author_city: '', rating: 5 }])}>
              + Add Testimonial
            </button>
          </>
        )}

        {/* ── STEP 9: Business Hours ── */}
        {step === 9 && (
          <>
            {hours.map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                borderBottom: i < hours.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}>
                <span style={{ width: 100, fontSize: 14, fontWeight: 600, color: '#374151' }}>
                  {h.day_of_week}
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={h.is_closed}
                    onChange={e => {
                      const updated = [...hours];
                      updated[i] = { ...updated[i], is_closed: e.target.checked };
                      setHours(updated);
                    }}
                  />
                  Closed
                </label>
                {!h.is_closed && (
                  <>
                    <input
                      type="time"
                      value={h.open_time || ''}
                      onChange={e => {
                        const updated = [...hours];
                        updated[i] = { ...updated[i], open_time: e.target.value };
                        setHours(updated);
                      }}
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
                    />
                    <span style={{ color: '#9ca3af' }}>to</span>
                    <input
                      type="time"
                      value={h.close_time || ''}
                      onChange={e => {
                        const updated = [...hours];
                        updated[i] = { ...updated[i], close_time: e.target.value };
                        setHours(updated);
                      }}
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
                    />
                  </>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── STEP 10: Review ── */}
        {step === 10 && (
          <>
            <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <p style={{ fontSize: 14, color: '#166534', margin: 0 }}>
                ✅ Review your information below. You can click any section in the progress bar above to go back and edit.
              </p>
            </div>

            {[
              { label: 'Business', items: [
                ['Name', form.business_name], ['Category', form.business_category], ['City', form.city], ['Phone', form.primary_phone], ['Email', form.email],
              ]},
              { label: 'Services', items: services.map(s => [s.service_name, s.ai_description || s.description || '']) },
              { label: 'Service Areas', items: [
                ['Primary', form.primary_city], ['Additional', form.additional_cities], ['Radius', form.service_radius],
              ]},
              { label: 'Copy', items: [
                ['Hero', form.hero_headline], ['Tagline', form.tagline],
              ]},
            ].map(section => (
              <div key={section.label} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{section.label}</h3>
                {section.items.filter(([_, v]) => v).map(([k, v], i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
                    <span style={{ color: '#6b7280', minWidth: 100, fontWeight: 500 }}>{k}</span>
                    <span style={{ color: '#111827' }}>{typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '...' : v}</span>
                  </div>
                ))}
                {section.items.filter(([_, v]) => v).length === 0 && (
                  <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>No data entered</p>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── Navigation ── */}
        <div className="nav-buttons">
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={prevStep}>← Back</button>
          ) : <div />}
          {step < 10 ? (
            <button className="btn btn-primary" onClick={nextStep}>Continue →</button>
          ) : (
            <button className="btn btn-primary" onClick={handleSubmit} style={{ background: '#15803d' }}>
              ✅ Submit Intake Form
            </button>
          )}
        </div>
      </div>

      {/* Auto-save indicator */}
      <div className={`autosave ${saving ? 'visible' : ''}`}>
        ✓ Saved
      </div>
    </div>
  );
}
