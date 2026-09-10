import { NextRequest, NextResponse } from 'next/server';
import { getArgoProfiles } from '@/lib/ocean-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const singleDate = searchParams.get('date') || undefined;
  const dateFrom = singleDate || searchParams.get('date_from') || undefined;
  const dateTo = singleDate || searchParams.get('date_to') || undefined;
  const parameter = searchParams.get('parameter') || 'all';
  const depth = searchParams.get('depth') ? parseFloat(searchParams.get('depth')!) : undefined;
  const limit = parseInt(searchParams.get('limit') || '2500', 10);

  const profiles = getArgoProfiles(dateFrom, dateTo, parameter, depth, limit);
  return NextResponse.json({ profiles, count: profiles.length });
}
