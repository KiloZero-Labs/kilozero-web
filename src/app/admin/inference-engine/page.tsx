import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SYNC_ENGINE_ENDPOINT = 'https://us-central1-kilozero-prod.cloudfunctions.net/syncEngine';

async function fetchEngineConfig(env: 'dev' | 'release', email?: string) {
  try {
    const res = await fetch(`${SYNC_ENGINE_ENDPOINT}?env=${env}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(email ? { 'X-Admin-Email': email } : {}),
      },
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
    return await res.json();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error fetching ${env} config:`, msg);
    return null;
  }
}

export default async function InferenceEngineDashboardPage() {
  const session = await auth();
  const email = session?.user?.email ?? undefined;

  const devConfig = await fetchEngineConfig('dev', email);
  const releaseConfig = await fetchEngineConfig('release', email);

  return (
    <div style={{ padding: '20px' }}>
      <div className="admin-header" style={{ marginBottom: '30px' }}>
        <h1>Inference Engine Configuration</h1>
        <p>Monitor and review active BLE decoding thresholds deployed on the server</p>
      </div>

      {/* Overview Block */}
      <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#1e293b', marginTop: 0, marginBottom: '10px' }}>Inference Engine Overview</h2>
        <p style={{ fontSize: '0.95rem', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
          The KiloZero **Inference Engine** is a client-side BLE protocol parser. It processes captured scale transmission signals to dynamically resolve the matching driver, unit, decimal format, and electrode impedance configurations. The settings below control the mathematical filter parameters used during pairing.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Environment Card: Dev */}
        <div style={{ flex: '1 1 350px', backgroundColor: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.3rem', color: '#1e293b', margin: 0 }}>Dev Environment</h2>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#e2e8f0', color: '#475569' }}>Staging</span>
          </div>

          {devConfig ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block' }}>Accuracy Gate</span>
                <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{devConfig.accuracyGate}</strong>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0 0' }}>Max weight variance ratio allowed during signal stabilization.</p>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block' }}>Tolerance</span>
                <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{devConfig.tolerance}</strong>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0 0' }}>Demographic margin coefficient for expected impedance checks.</p>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block' }}>BIA Tolerance Factor</span>
                <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{devConfig.biaToleranceFactor ?? '0.10'}</strong>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0 0' }}>Hydration curve multiplier limiting valid impedance variance.</p>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block' }}>Multipliers</span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {devConfig.multipliers.map((m: number) => (
                    <span key={m} style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 'bold' }}>
                      {m}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '6px 0 0 0' }}>Candidate decimal multipliers checked by the resolution state machine.</p>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '15px', marginTop: '10px', fontSize: '0.8rem', color: '#94a3b8' }}>
                <div>Last Updated: {devConfig.updatedAt ? new Date(devConfig.updatedAt).toLocaleString() : 'N/A'}</div>
                <div>Author: {devConfig.updatedBy || 'System'}</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8' }}>
              No configuration deployed. App will fall back to local defaults.
            </div>
          )}
        </div>

        {/* Environment Card: Release */}
        <div style={{ flex: '1 1 350px', backgroundColor: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.3rem', color: '#1e293b', margin: 0 }}>Release Environment</h2>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d' }}>Production</span>
          </div>

          {releaseConfig ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block' }}>Accuracy Gate</span>
                <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{releaseConfig.accuracyGate}</strong>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0 0' }}>Max weight variance ratio allowed during signal stabilization.</p>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block' }}>Tolerance</span>
                <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{releaseConfig.tolerance}</strong>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0 0' }}>Demographic margin coefficient for expected impedance checks.</p>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block' }}>BIA Tolerance Factor</span>
                <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{releaseConfig.biaToleranceFactor ?? '0.10'}</strong>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0 0' }}>Hydration curve multiplier limiting valid impedance variance.</p>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block' }}>Multipliers</span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {releaseConfig.multipliers.map((m: number) => (
                    <span key={m} style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 'bold' }}>
                      {m}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '6px 0 0 0' }}>Candidate decimal multipliers checked by the resolution state machine.</p>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '15px', marginTop: '10px', fontSize: '0.8rem', color: '#94a3b8' }}>
                <div>Last Updated: {releaseConfig.updatedAt ? new Date(releaseConfig.updatedAt).toLocaleString() : 'N/A'}</div>
                <div>Author: {releaseConfig.updatedBy || 'System'}</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8' }}>
              No configuration deployed. App will fall back to local defaults.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
