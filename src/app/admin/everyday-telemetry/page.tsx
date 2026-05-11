import EverydayTelemetryDashboard from './EverydayTelemetryDashboard';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const TELEMETRY_ENDPOINT = 'https://us-central1-kilozero-prod.cloudfunctions.net/receiveEverydayTelemetry';

export default async function EverydayTelemetryPage() {
  const session = await auth();
  let stats: any[] = [];
  let cloudError: string | null = null;

  try {
    const res = await fetch(TELEMETRY_ENDPOINT, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.user?.email ? { 'X-Admin-Email': session.user.email } : {}),
      },
    });
    if (!res.ok) throw new Error(`Cloud fetch failed: ${res.statusText}`);
    const data = await res.json();
    stats = data.stats || [];
  } catch (err: any) {
    cloudError = err.message;
  }

  // Aggregate stats: Success Rate by Driver
  const driverStats: Record<string, { total: number; success: number }> = {};
  stats.forEach(s => {
    const dId = s.driverId || 'Unknown';
    if (!driverStats[dId]) driverStats[dId] = { total: 0, success: 0 };
    driverStats[dId].total++;
    if (s.success) driverStats[dId].success++;
  });

  const driverStatsArray = Object.entries(driverStats).map(([driverId, { total, success }]) => ({
    driverId,
    total,
    success,
    successRate: ((success / total) * 100).toFixed(1)
  })).sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="admin-header">
        <h1>Weigh-In Statistics (Beta Testers)</h1>
        <p>
          {stats.length} telemetry record{stats.length !== 1 ? 's' : ''} received
          {cloudError && (
            <span style={{ color: 'var(--danger)', marginLeft: '1rem' }}>
              ⚠ Cloud error: {cloudError}
            </span>
          )}
        </p>
      </div>

      <EverydayTelemetryDashboard stats={stats} driverStats={driverStatsArray} />
    </div>
  );
}
