import { NextResponse } from 'next/server';

// Interest capture for the Chesapeake Stationery & Pen Fest landing page.
// Accepts both attendee ("notify me") and vendor ("apply to exhibit") signups.
//
// This handler validates input and returns success so the landing page works
// out of the box. To persist leads, wire one of the options noted below —
// the codebase already has Supabase configured (see lib/supabase.js).
export async function POST(request) {
  try {
    const body = await request.json();
    const { type, name, email } = body;

    if (!['attendee', 'vendor'].includes(type)) {
      return NextResponse.json({ error: 'Invalid signup type' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    // --- Persistence hook -------------------------------------------------
    // Create a `pen_fest_leads` table in Supabase, then uncomment:
    //
    //   import { supabase } from '../../../lib/supabase';
    //   await supabase.from('pen_fest_leads').insert({
    //     type, name, email,
    //     business_name: body.business_name || null,
    //     product_category: body.product_category || null,
    //     message: body.message || null,
    //   });
    //
    // Or forward to an email/CRM webhook. For now we just log the lead.
    // ----------------------------------------------------------------------
    console.log('[pen-fest] new %s lead: %s <%s>', type, name, email);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Pen fest signup error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
