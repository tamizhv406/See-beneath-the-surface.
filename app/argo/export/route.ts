import { NextRequest, NextResponse } from 'next/server';
import { getArgoProfiles } from '@/lib/ocean-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('date_from') || '2024-01-01';
  const dateTo = searchParams.get('date_to') || '2024-01-31';
  const parameter = searchParams.get('parameter') || 'all';

  const profiles = await getArgoProfiles(dateFrom, dateTo, parameter, 50000);
  if (!profiles.length) {
    return new NextResponse('No data', { status: 404 });
  }

  const keys = Object.keys(profiles[0]);
  const csvRows = [
    keys.join(','),
    ...profiles.map(p => keys.map(k => JSON.stringify(p[k] ?? '')).join(',')),
  ];

  return new NextResponse(csvRows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=argo_${dateFrom}_${dateTo}.csv`,
    },
  });
}
