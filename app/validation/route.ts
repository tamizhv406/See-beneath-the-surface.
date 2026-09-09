import { NextResponse } from 'next/server';
import { getValidation } from '@/lib/ocean-service';

export async function GET() {
  const data = await getValidation();
  return NextResponse.json(data);
}
