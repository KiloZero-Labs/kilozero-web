import TelemetryDashboard from './TelemetryDashboard';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PROBE_ENDPOINT = 'https://us-central1-kilozero-prod.cloudfunctions.net/receiveProbe';

export default async function TelemetryPage() {
  const session = await auth();
  let submissions: any[] = [];
  let cloudError: string | null = null;

  try {
    const res = await fetch(PROBE_ENDPOINT, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.user?.email ? { 'X-Admin-Email': session.user.email } : {}),
      },
    });
    if (!res.ok) throw new Error(`Cloud fetch failed: ${res.statusText}`);
    const data = await res.json();
    submissions = data.submissions || [];
  } catch (err: any) {
    cloudError = err.message;
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Decoder Lab Reports</h1>
        <p>
          {submissions.length} submission{submissions.length !== 1 ? 's' : ''} from lab contributors
          {cloudError && (
            <span style={{ color: 'var(--danger)', marginLeft: '1rem' }}>
              ⚠ Cloud error: {cloudError}
            </span>
          )}
        </p>
      </div>

      <TelemetryDashboard submissions={submissions} />
    </div>
  );
}
