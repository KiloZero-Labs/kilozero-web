import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const PROBE_ENDPOINT = 'https://us-central1-kilozero-prod.cloudfunctions.net/receiveProbe';

/**
 * GET /api/telemetry/[id]
 * Server-side proxy for fetching full submission detail from the cloud function.
 * Avoids CORS issues that occur when the browser fetches directly.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  try {
    const res = await fetch(`${PROBE_ENDPOINT}?scope=detail&id=${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.user?.email ? { 'X-Admin-Email': session.user.email } : {}),
      },
    });

    if (res.status === 404) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `Cloud fetch failed: ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
