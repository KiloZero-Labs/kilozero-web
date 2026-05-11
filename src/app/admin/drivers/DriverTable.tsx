// ── Download-all button (client component) ────────────────────────────────────

'use client';

import { useState, useTransition } from 'react';
import { FaChevronDown, FaChevronRight, FaSave, FaSpinner, FaDownload } from 'react-icons/fa';

const SYNC_ENDPOINT = 'https://us-central1-kilozero-prod.cloudfunctions.net/syncDrivers';

// ── Visual helpers ─────────────────────────────────────────────────────────────

function StabilityBadge({ rating }: { rating: number }) {
  const filled = Math.round(rating ?? 0);
  return (
    <span style={{ letterSpacing: '2px', color: '#f59e0b', fontSize: '0.9rem' }}>
      {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
    </span>
  );
}

function CapabilityPill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      backgroundColor: color, color: '#fff',
      padding: '0.2rem 0.55rem', borderRadius: '9999px',
      fontSize: '0.68rem', fontWeight: 700, marginRight: '0.3rem',
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{label}</span>
  );
}

function TypePill({ type }: { type: string }) {
  const isStatic = type === 'static';
  return (
    <span style={{
      backgroundColor: isStatic ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.15)',
      color: isStatic ? '#818cf8' : '#10b981',
      border: `1px solid ${isStatic ? '#818cf8' : '#10b981'}`,
      padding: '0.2rem 0.55rem', borderRadius: '4px',
      fontSize: '0.68rem', fontWeight: 700,
    }}>{isStatic ? 'Built-in' : 'Dynamic'}</span>
  );
}

function UUIDBlock({ label, uuids }: { label: string; uuids: string[] }) {
  if (!uuids || uuids.length === 0) return null;
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
      {uuids.map((u, i) => (
        <div key={i} style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#38bdf8' }}>{u}</div>
      ))}
    </div>
  );
}

function DownloadAllButton({ drivers }: { drivers: any[] }) {
  const handleDownload = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `kilozero-drivers-backup-${timestamp}.json`;
    const blob = new Blob(
      [JSON.stringify(drivers, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      title="Download all drivers as a local JSON backup"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.5rem 1.1rem', borderRadius: '7px', border: '1px solid #374151',
        background: 'rgba(16,185,129,0.1)', color: '#10b981',
        fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.1)')}
    >
      <FaDownload size={12} />
      Download All as JSON
    </button>
  );
}

// ── Dispatcher Tier Model ───────────────────────────────────────────────────

function DispatcherTierBadge({ tier, reason }: { tier: number, reason: string }) {
  let color = '#6B7280';
  let label = `TIER ${tier}`;
  
  if (tier === 0) { color = '#EF4444'; label = 'TIER 0 (CLOUD)'; }
  else if (tier === 1) { color = '#10B981'; label = 'TIER 1 (PAYLOAD)'; }
  else if (tier === 2) { color = '#0EA5E9'; label = 'TIER 2 (GATT)'; }
  else if (tier === 3) { color = '#8B5CF6'; label = 'TIER 3 (ALIAS)'; }
  else if (tier === 4) { color = '#6B7280'; label = 'TIER 4 (GENERIC)'; }
  else if (tier === 5) { color = '#EAB308'; label = 'TIER 5 (BETA)'; }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <span style={{
        backgroundColor: color, color: '#fff',
        padding: '0.2rem 0.5rem', borderRadius: '4px',
        fontSize: '0.65rem', fontWeight: 700, width: 'fit-content'
      }}>{label}</span>
      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{reason}</span>
    </div>
  );
}

// Legacy distribution tiers for Tier 0
type DistributionTier = 'unlisted' | 'optional' | 'auto_sync' | 'core';

const TIERS: { value: DistributionTier; label: string; color: string; description: string }[] = [
  { value: 'unlisted',   label: 'Unlisted',          color: '#6B7280', description: 'Not distributed — internal only' },
  { value: 'optional',   label: 'Opt-in Download',   color: '#10b981', description: 'Beta users can download via Driver Library' },
  { value: 'auto_sync',  label: 'Auto Sync',         color: '#0ea5e9', description: 'Pushed to devices automatically on boot' },
  { value: 'core',       label: 'Core Installation', color: '#f59e0b', description: 'Compiled filter — active in all builds' },
];

function getTier(optionalDownload: boolean, pushAtStartup: boolean, isCoreDriver: boolean): DistributionTier {
  if (isCoreDriver)     return 'core';
  if (pushAtStartup)    return 'auto_sync';
  if (optionalDownload) return 'optional';
  return 'unlisted';
}

function deriveTierFlags(tier: DistributionTier) {
  return {
    optionalDownload: tier !== 'unlisted',
    pushAtStartup:    tier === 'auto_sync' || tier === 'core',
    isCoreDriver:     tier === 'core',
  };
}

// ── Driver row with accordion ──────────────────────────────────────────────────

function DriverRow({ driverKey, initialData, adminEmail }: { driverKey: string; initialData: any; adminEmail: string }) {
  const [expanded, setExpanded] = useState(false);
  const [tier, setTier] = useState<DistributionTier>(
    getTier(
      initialData.optionalDownload ?? false,
      initialData.pushAtStartup ?? false,
      initialData.isCoreDriver ?? false,
    )
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [, startTransition] = useTransition();

  const d = initialData;

  const handleTierChange = (value: DistributionTier) => {
    setTier(value);
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const flags = deriveTierFlags(tier);
      const updated = { ...d, mac: driverKey, ...flags };
      const res = await fetch(SYNC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Verified server-side against ADMIN_WHITELIST via verifyWebAdminSession()
          ...(adminEmail ? { 'X-Admin-Email': adminEmail } : {}),
        },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('ok');
      setIsDirty(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${isDirty ? 'rgba(14,165,233,0.4)' : 'var(--border)'}`,
      borderRadius: '10px',
      marginBottom: '0.75rem',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* ── Main row (always visible) ──────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto auto auto',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.9rem 1.25rem',
        cursor: 'pointer',
      }}>
        {/* Title / MAC */}
        <div onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <FaChevronRight />
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{d.title || d.brand || 'Unknown Driver'}</div>
            {d.mac && !driverKey.startsWith('STATIC::') && (
              <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--primary)', marginTop: '0.2rem' }}>{driverKey}</div>
            )}
          </div>
        </div>

        {/* Type + Link Mode */}
        <div onClick={() => setExpanded(e => !e)} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
          <TypePill type={d.type} />
          <span style={{ color: d.linkMode === 'BROADCAST' ? '#f59e0b' : '#38bdf8', fontWeight: 600, fontSize: '0.75rem' }}>{d.linkMode}</span>
        </div>

        {/* Capabilities + Stability */}
        <div onClick={() => setExpanded(e => !e)} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
          <div>
            {(d.capabilities || []).includes('weight') && <CapabilityPill label="Weight" color="#0ea5e9" />}
            {(d.capabilities || []).includes('bodyFat') && <CapabilityPill label="Body Fat" color="#8b5cf6" />}
          </div>
          <StabilityBadge rating={d.stabilityRating} />
        </div>

        {/* Dispatcher Tier Badge */}
        <DispatcherTierBadge tier={d.tier} reason={d.reason} />

        {/* Distribution Tier Dropdown (Only for Tier 0 Dynamic Drivers) */}
        {d.tier === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '175px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distribution (OTA)</div>
            <select
              value={tier}
              onChange={e => handleTierChange(e.target.value as DistributionTier)}
              style={{
                background: 'var(--surface-hover)',
                border: `1px solid ${isDirty ? 'rgba(14,165,233,0.5)' : 'var(--border)'}`,
                borderRadius: '6px',
                color: TIERS.find(t => t.value === tier)?.color ?? 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.82rem',
                padding: '0.45rem 0.65rem',
                cursor: 'pointer',
                outline: 'none',
                width: '100%',
              }}
            >
              {TIERS.map(t => (
                <option key={t.value} value={t.value} style={{ color: t.color, background: '#1a1a2e' }}>
                  {t.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {TIERS.find(t => t.value === tier)?.description}
            </div>
          </div>
        ) : (
          <div style={{ minWidth: '175px' }}></div>
        )}

        {/* Save Button (Only for Tier 0) */}
        {d.tier === 0 ? (
          <button
            onClick={handleSave}
            disabled={!isDirty || saveStatus === 'saving'}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1rem', borderRadius: '6px', border: 'none',
              fontWeight: 600, fontSize: '0.8rem', cursor: isDirty ? 'pointer' : 'not-allowed',
              background: saveStatus === 'ok' ? '#10b981'
                : saveStatus === 'error' ? '#ef4444'
                : isDirty ? '#0ea5e9' : 'var(--surface-hover)',
              color: isDirty || saveStatus !== 'idle' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s',
              opacity: !isDirty && saveStatus === 'idle' ? 0.5 : 1,
              minWidth: '110px', justifyContent: 'center',
            }}
          >
            {saveStatus === 'saving' ? <><FaSpinner style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
              : saveStatus === 'ok' ? '✓ Saved'
              : saveStatus === 'error' ? '✗ Error'
              : <><FaSave /> Save</>}
          </button>
        ) : (
          <div style={{ minWidth: '110px' }}></div>
        )}
      </div>

      {/* ── Accordion body ────────────────────────────────────────── */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '1rem 1.5rem',
          background: 'rgba(15, 23, 42, 0.4)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '1.5rem',
        }}>
          {/* Hardware & Protocol */}
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Supported Hardware</div>
              {d.supportedHardware && d.supportedHardware.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                  {d.supportedHardware.map((hw: string, i: number) => (
                    <li key={i}>{hw}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>—</div>
              )}
            </div>
            
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Protocol</div>
              <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{d.protocol || '—'}</div>
            </div>
          </div>

          {/* UUIDs */}
          <div>
            <UUIDBlock label="Service UUIDs" uuids={d.serviceUUIDs} />
            <UUIDBlock label="Notify UUIDs" uuids={d.notifyUUIDs} />
            <UUIDBlock label="Write UUIDs" uuids={d.writeUUIDs} />
          </div>

          {/* Schema + Notes */}
          <div>
            {d.schema && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Dynamic Schema</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#a5f3fc', lineHeight: 1.7 }}>
                  {Object.entries(d.schema).map(([k, v]) => (
                    <div key={k}><span style={{ color: 'var(--text-muted)' }}>{k}: </span>{String(v)}</div>
                  ))}
                </div>
              </div>
            )}
            {d.notes && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Notes</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{d.notes}</div>
              </div>
            )}
            {d.approvedBy && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Approved by <span style={{ color: '#0ea5e9' }}>{d.approvedBy}</span>
                {d.approvedAt && <> · {new Date(d.approvedAt).toLocaleDateString()}</>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface HardwareItem {
  hardwareName: string;
  driver: any;
}

function HardwareRow({ item }: { item: HardwareItem }) {
  const { hardwareName, driver: d } = item;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      marginBottom: '0.5rem',
      display: 'grid',
      gridTemplateColumns: '1.5fr 1fr auto auto',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.75rem 1.25rem',
    }}>
      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{hardwareName}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.title || d.brand}</div>
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        {(d.capabilities || []).includes('weight') && <CapabilityPill label="Weight" color="#0ea5e9" />}
        {(d.capabilities || []).includes('bodyFat') && <CapabilityPill label="Body Fat" color="#8b5cf6" />}
      </div>
      <DispatcherTierBadge tier={d.tier} reason={d.reason} />
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function DriverTable({ drivers, adminEmail }: { drivers: any[]; adminEmail: string }) {
  const [viewMode, setViewMode] = useState<'driver' | 'hardware'>('driver');
  const [filterTier, setFilterTier] = useState<number | 'all'>('all');
  const [filterCapability, setFilterCapability] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'tier_asc' | 'tier_desc' | 'name_asc'>('tier_asc');

  let filtered = drivers.filter(d => {
    if (filterTier !== 'all' && d.tier !== filterTier) return false;
    if (filterCapability !== 'all' && !(d.capabilities || []).includes(filterCapability)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (sortOrder === 'tier_asc') return a.tier - b.tier;
    if (sortOrder === 'tier_desc') return b.tier - a.tier;
    if (sortOrder === 'name_asc') return (a.brand || '').localeCompare(b.brand || '');
    return 0;
  });

  const hardwareList: HardwareItem[] = [];
  if (viewMode === 'hardware') {
    filtered.forEach(d => {
      (d.supportedHardware || []).forEach((hw: string) => {
        hardwareList.push({ hardwareName: hw, driver: d });
      });
    });
    hardwareList.sort((a, b) => a.hardwareName.localeCompare(b.hardwareName));
  }

  return (
    <div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'var(--surface-hover)', borderRadius: '8px', padding: '0.25rem', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setViewMode('driver')}
              style={{
                padding: '0.4rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                background: viewMode === 'driver' ? '#0ea5e9' : 'transparent',
                color: viewMode === 'driver' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
            >
              Organize by Driver
            </button>
            <button
              onClick={() => setViewMode('hardware')}
              style={{
                padding: '0.4rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                background: viewMode === 'hardware' ? '#0ea5e9' : 'transparent',
                color: viewMode === 'hardware' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
            >
              Organize by Hardware
            </button>
          </div>
          
          {drivers.length > 0 && (
            <DownloadAllButton drivers={drivers} />
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <select value={filterTier} onChange={e => setFilterTier(e.target.value === 'all' ? 'all' : Number(e.target.value))} style={filterSelectStyle}>
            <option value="all">All Tiers</option>
            <option value={0}>Tier 0 (Cloud)</option>
            <option value={1}>Tier 1 (Payload)</option>
            <option value={2}>Tier 2 (GATT Combo)</option>
            <option value={3}>Tier 3 (Alias)</option>
            <option value={4}>Tier 4 (Generic)</option>
            <option value={5}>Tier 5 (Beta Heuristics)</option>
          </select>
          <select value={filterCapability} onChange={e => setFilterCapability(e.target.value)} style={filterSelectStyle}>
            <option value="all">All Capabilities</option>
            <option value="weight">Weight</option>
            <option value="bodyFat">Body Fat (BIA)</option>
          </select>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} style={filterSelectStyle}>
            <option value="tier_asc">Sort: Tier (0 → 5)</option>
            <option value="tier_desc">Sort: Tier (5 → 0)</option>
            <option value="name_asc">Sort: Name (A → Z)</option>
          </select>
        </div>
      </div>

      {viewMode === 'driver' ? (
        filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No drivers match the current filters.
          </div>
        ) : (
          filtered.map(d => (
            <DriverRow key={d.id} driverKey={d.id} initialData={d} adminEmail={adminEmail} />
          ))
        )
      ) : (
        hardwareList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No hardware matches the current filters.
          </div>
        ) : (
          hardwareList.map((item, idx) => (
            <HardwareRow key={idx} item={item} />
          ))
        )
      )}
    </div>
  );
}

const filterSelectStyle = {
  background: 'var(--surface-hover)',
  border: '1px solid var(--border)',
  color: 'var(--text-muted)',
  padding: '0.4rem 0.6rem',
  borderRadius: '6px',
  outline: 'none',
  fontSize: '0.8rem',
  fontWeight: 600
};
