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

  // Parse the unified drivers list
  const unifiedDrivers: any[] = [];

  // Tier 0: Dynamic Cloud Overrides
  for (const [key, driver] of Object.entries(cloudDrivers)) {
    if (driver.isDynamic) {
      // Parse brand and model for dynamic drivers
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
    }
  }

  // Tiers 1-4: signature_registry.json
  try {
    const registry = require('../../../../../src/frontend/assets/signature_registry.json');

    // Tier 1
    for (const [manufId, drivers] of Object.entries(registry.tier1_payload)) {
      for (const d of (drivers as any[])) {
        unifiedDrivers.push({ ...d, id: d.driverId, tier: 1, reason: `Tier 1: Payload Fingerprint (${manufId})` });
      }
    }
    // Tier 2
    for (const [uuid, configs] of Object.entries(registry.tier2_gatt)) {
      for (const d of (configs as any[])) {
        unifiedDrivers.push({ ...d, id: d.driverId, tier: 2, reason: `Tier 2: UUID + Name Combo (${uuid})` });
      }
    }
    // Tier 3
    for (const [aliasPattern, d] of Object.entries(registry.tier3_alias)) {
      unifiedDrivers.push({ ...(d as any), id: (d as any).driverId, tier: 3, reason: `Tier 3: Name Alias (${aliasPattern})` });
    }
    // Tier 4 is generic, we can push a synthetic one
    unifiedDrivers.push({
      id: 'Generic_GATT_V1',
      title: 'Generic Standard BLE (GATT)',
      supportedHardware: ['Standard 181d BLE Scales (Multiple Brands)'],
      brand: 'Generic',
      model: 'Standard BLE Scale',
      capabilities: ['weight'],
      schema: null,
      protocol: 'Generic GATT (181d)',
      tier: 4,
      reason: 'Tier 4: Generic BLE Standard (181d)'
    });
    // Tier 5 is heuristic, we can push a synthetic one
    unifiedDrivers.push({
      id: 'TIER5_BETA_TRIAL',
      title: 'Beta Trial Fuzzer (Heuristics)',
      supportedHardware: ['Unknown hardware matching "scale", "bmi", "weight", etc.'],
      brand: 'Unknown',
      model: 'Beta Trial Fuzzer',
      capabilities: ['weight'],
      schema: null,
      protocol: 'OUI/Heuristic',
      tier: 5,
      reason: 'Tier 5: Beta Fuzzer Heuristics'
    });

  } catch (err: any) {
    console.error('Failed to load signature_registry.json:', err);
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
