import { NextRequest, NextResponse } from 'next/server';
import { getArgoSingleProfile } from '@/lib/ocean-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string; cycle: string }> }
) {
  const { platform, cycle } = await params;
  const detail = getArgoSingleProfile(platform, cycle);
  return NextResponse.json(detail);
}
