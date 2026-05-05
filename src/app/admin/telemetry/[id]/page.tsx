import SubmissionDetail from './SubmissionDetail';
import { auth } from '@/lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const PROBE_ENDPOINT = 'https://us-central1-kilozero-prod.cloudfunctions.net/receiveProbe';

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  let submission: any = null;
  let cloudError: string | null = null;

  try {
    const res = await fetch(`${PROBE_ENDPOINT}?scope=detail&id=${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.user?.email ? { 'X-Admin-Email': session.user.email } : {}),
      },
    });
    if (res.status === 404) {
      submission = null;
    } else if (!res.ok) {
      throw new Error(`Cloud fetch failed: ${res.statusText}`);
    } else {
      submission = await res.json();
    }
  } catch (err: any) {
    cloudError = err.message;
  }

  return (
    <div>
      <div className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/admin/telemetry" style={{
            color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none',
            padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
            transition: 'all 0.2s',
          }}>← Back</Link>
          <h1 style={{ margin: 0 }}>Submission Detail</h1>
        </div>
        <p>
          {submission ? `${submission.scaleBrand || 'Unknown'} ${submission.scaleModel || ''} · ${submission.deviceName || submission.deviceId}` : 'Loading...'}
          {cloudError && (
            <span style={{ color: 'var(--danger)', marginLeft: '1rem' }}>
              ⚠ Cloud error: {cloudError}
            </span>
          )}
        </p>
      </div>

      {submission ? (
        <SubmissionDetail submission={submission} />
      ) : !cloudError ? (
        <div style={{
          textAlign: 'center', padding: '3rem', color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
        }}>
          🔍 Submission with ID &ldquo;{id}&rdquo; not found.
        </div>
      ) : null}
    </div>
  );
}
