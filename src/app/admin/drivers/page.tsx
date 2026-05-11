import DriverTable from './DriverTable';
import { auth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export default async function DriversPage() {
  const session = await auth();
  let cloudDrivers: Record<string, any> = {};
  let cloudError: string | null = null;

  try {
    const res = await fetch('https://us-central1-kilozero-prod.cloudfunctions.net/syncDrivers?scope=catalog', {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.user?.email ? { 'X-Admin-Email': session.user.email } : {}),
      },
    });
    if (!res.ok) throw new Error(`Cloud fetch failed: ${res.statusText}`);
    cloudDrivers = await res.json();
  } catch (err: any) {
    cloudError = err.message;
  }

  // Parse the unified drivers list entirely from the cloud
  const unifiedDrivers: any[] = [];

  for (const [key, driver] of Object.entries(cloudDrivers)) {
    if (driver.isDynamic || driver.tier === 0) {
      // Tier 0: Dynamic Cloud Overrides (Parse legacy fallback fields)
      const brands = (driver.brand || 'Unknown').split('/').map((b: string) => b.trim());
      const models = (driver.model || 'Unknown').split('/').map((m: string) => m.trim());
      
      const hw = [];
      for (const b of brands) {
        for (const m of models) {
          hw.push(`${b} ${m}`);
        }
      }

      const generatedTitle = `${brands[0]} ${models[0] !== 'Unknown' ? models[0] : ''} (Cloud Override)`.trim();

      unifiedDrivers.push({
        ...driver,
        id: key,
        tier: 0,
        title: generatedTitle,
        supportedHardware: hw,
        reason: 'Tier 0: Cloud Override',
      });
    } else {
      // Tiers 1-5: Static offline drivers synced to Firestore
      unifiedDrivers.push({
        ...driver,
        id: key
      });
    }
  }

  const count = unifiedDrivers.length;

  return (
    <div>
      <div className="admin-header">
        <h1>Driver Registry</h1>
        <p>
          {count} driver{count !== 1 ? 's' : ''} in unified 5-Tier registry
          {cloudError && (
            <span style={{ color: 'var(--danger)', marginLeft: '1rem' }}>
              ⚠ Cloud error: {cloudError}
            </span>
          )}
        </p>
      </div>

      <DriverTable drivers={unifiedDrivers} adminEmail={session?.user?.email ?? ''} />
    </div>
  );
}
