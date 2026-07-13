import { NextResponse } from 'next/server';
import { runAuthorityScan } from '../../../../lib/authority/engine';
import { CATEGORIES } from '../../../../lib/authority/framework';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    const { businessName, category, location } = body || {};

    if (!businessName || !businessName.trim()) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 });
    }
    if (!category || !CATEGORIES[category]) {
      return NextResponse.json(
        { error: 'A valid home-services category is required' },
        { status: 400 }
      );
    }
    if (!location || !location.trim()) {
      return NextResponse.json({ error: 'A city or service area is required' }, { status: 400 });
    }

    const result = await runAuthorityScan(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Authority scan error:', err);
    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 });
  }
}
