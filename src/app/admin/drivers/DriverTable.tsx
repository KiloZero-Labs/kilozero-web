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

function DownloadAllButton({ drivers }: { drivers: Record<string, any> }) {
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

// ── Distribution tier model ───────────────────────────────────────────────────
// Each tier is a superset of the previous — sets all three flags atomically.

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
        {/* Brand / Model / MAC */}
        <div onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <FaChevronRight />
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{d.brand}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{d.model}</div>
            {d.mac && !driverKey.startsWith('STATIC::') && (
              <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--primary)', marginTop: '0.1rem' }}>{driverKey}</div>
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

        {/* Distribution Tier Dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '175px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distribution</div>
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


        {/* Save Button */}
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
          {/* Protocol */}
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Protocol</div>
            <div style={{ fontSize: '0.85rem' }}>{d.protocol || '—'}</div>
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

// ── Main export ────────────────────────────────────────────────────────────────

export default function DriverTable({ drivers, adminEmail }: { drivers: Record<string, any>; adminEmail: string }) {
  const keys = Object.keys(drivers);

  return (
    <div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Toolbar */}
      {keys.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <DownloadAllButton drivers={drivers} />
        </div>
      )}

      {keys.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No drivers found in the GCloud registry.
        </div>
      ) : (
        keys.map(key => (
          <DriverRow key={key} driverKey={key} initialData={drivers[key]} adminEmail={adminEmail} />
        ))
      )}
    </div>
  );
}
