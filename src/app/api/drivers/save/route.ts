import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ADMIN_WHITELIST } from '@/lib/auth';

const SYNC_ENDPOINT = 'https://us-central1-kilozero-prod.cloudfunctions.net/syncDrivers';

/**
 * Server-side proxy for saving driver modality changes.
 * Authenticates the user via NextAuth session, then forwards
 * the request to the Cloud Function with the correct admin credential.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;

  if (!email || !ADMIN_WHITELIST.includes(email.toLowerCase())) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'You are not authorized to modify drivers.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const res = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Email': email,
      },
      body: JSON.stringify(body),
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Proxy Error', message: err.message },
      { status: 502 }
    );
  }
}
