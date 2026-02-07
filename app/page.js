'use client';

import { useState } from 'react';
import { createSubmission } from '../lib/supabase';

export default function Home() {
  const [loading, setLoading] = useState(false);

  async function handleStart(vertical) {
    setLoading(true);
    const result = await createSubmission(vertical);
    if (result) {
      window.location.href = `/intake/${result.access_token}`;
    } else {
      alert('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="intake-container" style={{ paddingTop: 60 }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Let's Build Your Website
        </h1>
        <p style={{ fontSize: 16, color: '#6b7280', maxWidth: 480, margin: '0 auto' }}>
          Answer a few questions about your business and we'll create a professional 
          website tailored to your industry. Takes about 15 minutes.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 440, margin: '0 auto' }}>
        <button
          className="btn"
          onClick={() => handleStart('home_services')}
          disabled={loading}
          style={{
            padding: '20px 24px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            textAlign: 'left',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#16a34a'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
        >
          <span style={{ fontSize: 28 }}>🔧</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>Home Services</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Plumbing, HVAC, Electrical, Roofing, Landscaping</div>
          </div>
        </button>

        {['Healthcare', 'Professional Services', 'Retail', 'Restaurant & Hospitality'].map(v => (
          <div
            key={v}
            style={{
              padding: '20px 24px',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              opacity: 0.5,
            }}
          >
            <span style={{ fontSize: 28 }}>
              {v === 'Healthcare' ? '🏥' : v === 'Professional Services' ? '⚖️' : v === 'Retail' ? '🛍️' : '🍽️'}
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{v}</div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>Coming Soon</div>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', marginTop: 24, color: '#6b7280', fontSize: 14 }}>
          <div className="ai-loading" style={{ justifyContent: 'center' }}>
            <div className="spinner"></div>
            Setting up your form...
          </div>
        </div>
      )}
    </div>
  );
}
