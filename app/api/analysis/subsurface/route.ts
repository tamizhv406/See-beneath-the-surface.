import { NextRequest, NextResponse } from 'next/server';
import { getSubsurface } from '@/lib/ocean-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '8.5');
  const lon = parseFloat(searchParams.get('lon') || '74.2');

  const data = await getSubsurface(lat, lon);
  if (!data) {
    return NextResponse.json({ error: 'Subsurface analysis unavailable' }, { status: 404 });
  }
  return NextResponse.json(data);
}
