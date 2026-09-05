import { NextResponse } from 'next/server';
import { getDataQuality } from '@/lib/ocean-service';

export async function GET() {
  const data = getDataQuality();
  return NextResponse.json(data);
}
