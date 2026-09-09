import { NextRequest, NextResponse } from 'next/server';
import { getArgoProfiles } from '@/lib/ocean-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('date_from') || undefined;
  const dateTo = searchParams.get('date_to') || undefined;
  const parameter = searchParams.get('parameter') || 'all';
  const limit = parseInt(searchParams.get('limit') || '2500', 10);

  const profiles = await getArgoProfiles(dateFrom, dateTo, parameter, limit);
  return NextResponse.json({ profiles, count: profiles.length });
}
