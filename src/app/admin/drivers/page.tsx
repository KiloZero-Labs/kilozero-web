import DriverTable from './DriverTable';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DriversPage() {
  const session = await auth();
  let drivers: Record<string, any> = {};
  let cloudError: string | null = null;

  try {
    // Use ?scope=catalog to fetch ALL drivers, not just pushAtStartup ones
    const res = await fetch('https://us-central1-kilozero-prod.cloudfunctions.net/syncDrivers?scope=catalog', {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        // Verified server-side against ADMIN_WHITELIST via verifyWebAdminSession()
        ...(session?.user?.email ? { 'X-Admin-Email': session.user.email } : {}),
      },
    });
    if (!res.ok) throw new Error(`Cloud fetch failed: ${res.statusText}`);
    drivers = await res.json();
  } catch (err: any) {
    cloudError = err.message;
  }

  const count = Object.keys(drivers).length;

  return (
    <div>
      <div className="admin-header">
        <h1>Driver Registry</h1>
        <p>
          {count} driver{count !== 1 ? 's' : ''} in GCloud production registry (full catalog)
          {cloudError && (
            <span style={{ color: 'var(--danger)', marginLeft: '1rem' }}>
              ⚠ Cloud error: {cloudError}
            </span>
          )}
        </p>
      </div>

      <DriverTable drivers={drivers} adminEmail={session?.user?.email ?? ''} />
    </div>
  );
}
