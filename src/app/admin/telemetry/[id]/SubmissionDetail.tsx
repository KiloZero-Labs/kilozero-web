'use client';

import React, { useState, useMemo } from 'react';
import { FaCheckCircle, FaTimesCircle, FaChevronRight } from 'react-icons/fa';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface TrafficEntry {
  timestamp: number;
  type: 'EVENT' | 'TX' | 'RX' | 'ERROR';
  payload: string;
  phase?: 'baseline' | 'reference' | 'discovery';
}

interface Submission {
  id: string;
  fingerprint: string;
  deviceName: string;
  bleLocalName: string;
  bleName: string;
  deviceId: string;
  scaleBrand: string;
  scaleModel: string;
  suggestedDriverName: string;
  measuredWeightKg: number | null;
  referenceWeightKg: number | null;
  referenceBfPercent: number | null;
  success: boolean;
  dynamicSchema: any;
  userRating: number;
  driverRating: number;
  failureMode: string;
  comment: string;
  deviceMeta: {
    phoneBrand: string;
    phoneModel: string;
    osName: string;
    osVersion: string;
    appVersion: string;
    appBuildNumber: string;
  };
  trafficLog: TrafficEntry[];
  trafficLogSize: number;
  hasDynamicSchema: boolean;
  proberSchemaVersion?: string;
  status: string;
  timestamp: string;
  driverId: string;
}

type TabKey = 'summary' | 'analysis' | 'raw';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function formatTimestamp(ts: string) {
  try {
    return new Date(ts).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return ts; }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    'new': { bg: '#3b82f6', text: '#fff' },
    'reviewed': { bg: '#f59e0b', text: '#000' },
    'archived': { bg: '#6b7280', text: '#fff' },
  };
  const c = colors[status] || colors['new'];
  return (
    <span style={{
      backgroundColor: c.bg, color: c.text,
      padding: '0.2rem 0.6rem', borderRadius: '9999px',
      fontSize: '0.7rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{status}</span>
  );
}

const TYPE_COLORS: Record<string, string> = {
  RX: '#22c55e',
  TX: '#3b82f6',
  EVENT: '#f59e0b',
  ERROR: '#ef4444',
};

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

export default function SubmissionDetail({ submission }: { submission: Submission }) {
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [expandedSchema, setExpandedSchema] = useState(false);

  const sub = submission;
  const traffic = sub.trafficLog || [];
  const rxPackets = traffic.filter(t => t.type === 'RX');
  const txPackets = traffic.filter(t => t.type === 'TX');
  const events = traffic.filter(t => t.type === 'EVENT');
  const errors = traffic.filter(t => t.type === 'ERROR');

  // ── Analysis computations ──
  const analysis = useMemo(() => {
    const insights: { icon: string; label: string; detail: string; color: string }[] = [];

    // Packet stats
    insights.push({
      icon: '📡', label: 'Packet Volume',
      detail: `${rxPackets.length} RX, ${txPackets.length} TX, ${events.length} events, ${errors.length} errors`,
      color: '#3b82f6',
    });

    // Duration
    if (traffic.length >= 2) {
      const first = traffic[0].timestamp;
      const last = traffic[traffic.length - 1].timestamp;
      const durationSec = ((last - first) / 1000).toFixed(1);
      insights.push({
        icon: '⏱', label: 'Capture Duration',
        detail: `${durationSec}s`,
        color: '#8b5cf6',
      });
    }

    // Unique characteristics
    const chars = new Set(rxPackets.map(p => {
      const match = p.payload.match(/\[([^\]]+)\]/);
      return match ? match[1] : 'unknown';
    }));
    insights.push({
      icon: '📋', label: 'Characteristics',
      detail: `${chars.size} unique: ${[...chars].join(', ')}`,
      color: '#0ea5e9',
    });

    // Payload length consistency
    const lengths = rxPackets.map(p => {
      const hex = p.payload.replace(/\[[^\]]+\]\s*/, '').replace(/\s/g, '');
      return hex.length / 2;
    }).filter(l => l > 0);
    if (lengths.length > 0) {
      const uniqueLens = [...new Set(lengths)];
      const modeLen = uniqueLens.sort((a, b) =>
        lengths.filter(l => l === b).length - lengths.filter(l => l === a).length
      )[0];
      insights.push({
        icon: '📏', label: 'Frame Size',
        detail: uniqueLens.length === 1
          ? `Fixed ${modeLen} bytes`
          : `Variable: ${uniqueLens.join(', ')} bytes (mode: ${modeLen})`,
        color: uniqueLens.length === 1 ? '#22c55e' : '#f59e0b',
      });
    }

    // Weight result
    if (sub.referenceWeightKg != null) {
      const unit = sub.measuredWeightKg ? 'kg' : 'kg';
      insights.push({
        icon: '⚖️', label: 'Reference Weight',
        detail: `${sub.referenceWeightKg.toFixed(2)} ${unit}`,
        color: '#10b981',
      });
    }

    // BF result
    if (sub.referenceBfPercent != null) {
      insights.push({
        icon: '📊', label: 'Reference BF%',
        detail: `${sub.referenceBfPercent.toFixed(1)}%`,
        color: '#ec4899',
      });
    }

    // Schema version
    if (sub.proberSchemaVersion) {
      insights.push({
        icon: '🏷', label: 'Prober Schema',
        detail: `v${sub.proberSchemaVersion}`,
        color: '#6366f1',
      });
    }

    // Stream pauses
    const pauseEvents = events.filter(e => e.payload.includes('STREAM_PAUSED'));
    if (pauseEvents.length > 0) {
      insights.push({
        icon: '⏸', label: 'Stream Pauses',
        detail: `${pauseEvents.length} pause(s) detected — BIA scale likely`,
        color: '#f59e0b',
      });
    }

    // Errors
    if (errors.length > 0) {
      insights.push({
        icon: '⚠️', label: 'Errors',
        detail: errors.map(e => e.payload).join('; '),
        color: '#ef4444',
      });
    }

    return insights;
  }, [sub, traffic, rxPackets, txPackets, events, errors]);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'summary', label: 'Summary', icon: '📋' },
    { key: 'analysis', label: 'Analysis', icon: '🔬' },
    { key: 'raw', label: 'Raw Data', icon: '📦' },
  ];

  return (
    <div>
      {/* ── Tab Bar ── */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '1rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem',
      }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '0.5rem 1rem', borderRadius: '8px 8px 0 0',
            border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
            background: activeTab === tab.key ? 'rgba(59,130,246,0.15)' : 'transparent',
            color: activeTab === tab.key ? '#3b82f6' : 'var(--text-muted)',
            borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
            transition: 'all 0.2s',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Summary Tab ── */}
      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Result badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            background: sub.success ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${sub.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            borderRadius: 12, padding: '1rem 1.25rem',
          }}>
            {sub.success
              ? <FaCheckCircle style={{ color: '#22c55e', fontSize: '1.5rem' }} />
              : <FaTimesCircle style={{ color: '#ef4444', fontSize: '1.5rem' }} />
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                {sub.success ? 'Driver Found' : 'No Driver Match'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {sub.failureMode || 'No failure details'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <StatusBadge status={sub.status} />
            </div>
          </div>

          {/* Info grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '0.75rem',
          }}>
            {/* Device Info */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 10,
              padding: '1rem', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 0, marginBottom: '0.75rem' }}>
                Scale Info
              </h3>
              {[
                ['Brand', sub.scaleBrand || '—'],
                ['Model', sub.scaleModel || '—'],
                ['BLE Name', sub.deviceName || '—'],
                ['Local Name', sub.bleLocalName || '—'],
                ['MAC', sub.deviceId],
                ['Driver ID', sub.driverId || '—'],
                ['Fingerprint', sub.fingerprint || '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Phone Info */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 10,
              padding: '1rem', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 0, marginBottom: '0.75rem' }}>
                Device Meta
              </h3>
              {sub.deviceMeta ? [
                ['Phone', `${sub.deviceMeta.phoneBrand} ${sub.deviceMeta.phoneModel}`],
                ['OS', `${sub.deviceMeta.osName} ${sub.deviceMeta.osVersion}`],
                ['App Version', sub.deviceMeta.appVersion],
                ['Build', sub.deviceMeta.appBuildNumber],
                ['Schema Ver', sub.proberSchemaVersion || '—'],
                ['Submitted', formatTimestamp(sub.timestamp)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{value}</span>
                </div>
              )) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No device meta available</div>
              )}
            </div>

            {/* Measurement */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 10,
              padding: '1rem', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 0, marginBottom: '0.75rem' }}>
                Measurement
              </h3>
              {[
                ['Reference Weight', sub.referenceWeightKg != null ? `${sub.referenceWeightKg.toFixed(2)} kg` : '—'],
                ['Measured Weight', sub.measuredWeightKg != null ? `${sub.measuredWeightKg.toFixed(2)} kg` : '—'],
                ['Reference BF%', sub.referenceBfPercent != null ? `${sub.referenceBfPercent.toFixed(1)}%` : '—'],
                ['User Rating', `${'★'.repeat(Math.round(sub.userRating || 0))}${'☆'.repeat(5 - Math.round(sub.userRating || 0))}`],
                ['Traffic Log', `${sub.trafficLogSize || traffic.length} packets`],
                ['Has Schema', sub.hasDynamicSchema ? '✅ Yes' : '❌ No'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Discovered Schema */}
          {sub.dynamicSchema && (
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 10,
              padding: '1rem', border: '1px solid rgba(139,92,246,0.2)',
            }}>
              <div onClick={() => setExpandedSchema(e => !e)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', transition: 'transform 0.2s', display: 'inline-block', transform: expandedSchema ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  <FaChevronRight />
                </span>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  Discovered Schema
                </h3>
              </div>
              {expandedSchema && (
                <pre style={{
                  marginTop: '0.75rem', padding: '0.75rem',
                  background: 'rgba(0,0,0,0.3)', borderRadius: 6,
                  fontSize: '0.72rem', lineHeight: 1.6, color: '#e2e8f0',
                  overflow: 'auto', maxHeight: 400,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                }}>{JSON.stringify(sub.dynamicSchema, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Analysis Tab ── */}
      {activeTab === 'analysis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {analysis.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              background: 'rgba(255,255,255,0.03)', borderRadius: 10,
              padding: '0.85rem 1rem', border: '1px solid rgba(255,255,255,0.06)',
              borderLeft: `3px solid ${item.color}`,
            }}>
              <span style={{ fontSize: '1.2rem', minWidth: '1.8rem', textAlign: 'center' }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.detail}</div>
              </div>
            </div>
          ))}

          {/* GATT topology from events */}
          {events.filter(e => e.payload.includes('Found Service') || e.payload.includes('Char:')).length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 10,
              padding: '1rem', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 0, marginBottom: '0.5rem' }}>
                GATT Topology
              </h3>
              <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.7, color: '#a5f3fc' }}>
                {events
                  .filter(e => e.payload.includes('Found Service') || e.payload.includes('Char:') || e.payload.includes('Monitoring') || e.payload.includes('GATT_TOPOLOGY'))
                  .map((e, i) => (
                    <div key={i} style={{ color: e.payload.includes('Service') ? '#8b5cf6' : e.payload.includes('Monitoring') ? '#22c55e' : '#a5f3fc' }}>
                      {e.payload}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Raw Data Tab ── */}
      {activeTab === 'raw' && (() => {
        // Phase detection: prefer explicit `phase` field, fallback to EVENT marker inference
        const hasExplicitPhases = traffic.some(e => e.phase);
        const PHASE_META: Record<string, { label: string; color: string }> = {
          baseline:  { label: '📊 Baseline Capture', color: '#6366f1' },
          reference: { label: '⚖️ Reference Capture', color: '#0ea5e9' },
          discovery: { label: '🔍 Discovery Capture', color: '#22c55e' },
        };

        const phaseMarkers: { idx: number; label: string; color: string }[] = [];

        if (hasExplicitPhases) {
          // Primary: use explicit phase field
          let lastPhase: string | undefined;
          traffic.forEach((entry, i) => {
            if (entry.phase && entry.phase !== lastPhase) {
              const meta = PHASE_META[entry.phase] || { label: entry.phase, color: '#6B7280' };
              phaseMarkers.push({ idx: i, label: meta.label, color: meta.color });
              lastPhase = entry.phase;
            }
          });
        } else {
          // Fallback: infer from EVENT payloads (legacy data)
          traffic.forEach((entry, i) => {
            if (entry.type === 'EVENT') {
              const p = entry.payload.toLowerCase();
              if (p.includes('baseline') || p.includes('idle capture') || p.includes('phase 1') || p.includes('capture_baseline')) {
                phaseMarkers.push({ idx: i, label: '📊 Baseline Capture', color: '#6366f1' });
              } else if (p.includes('reference') || p.includes('weigh-in') || p.includes('phase 2') || p.includes('capture_reference') || p.includes('step on')) {
                phaseMarkers.push({ idx: i, label: '⚖️ Reference Capture', color: '#0ea5e9' });
              } else if (p.includes('discovery') || p.includes('phase 3') || p.includes('capture_discovery') || p.includes('final')) {
                phaseMarkers.push({ idx: i, label: '🔍 Discovery Capture', color: '#22c55e' });
              } else if (p.includes('connected') || p.includes('gatt')) {
                phaseMarkers.push({ idx: i, label: '🔗 Connection', color: '#f59e0b' });
              }
            }
          });
        }

        // Build a map: packet index → phase label for the separator row
        const phaseSeparators = new Map<number, { label: string; color: string }>();
        phaseMarkers.forEach(m => phaseSeparators.set(m.idx, { label: m.label, color: m.color }));

        // Phase summary counts
        const phaseCounts = phaseMarkers.map((m, mi) => {
          const nextIdx = mi < phaseMarkers.length - 1 ? phaseMarkers[mi + 1].idx : traffic.length;
          const slice = traffic.slice(m.idx, nextIdx);
          return { label: m.label, color: m.color, total: slice.length, rx: slice.filter(e => e.type === 'RX').length };
        });

        // Time reference for relative timestamps
        const t0 = traffic.length > 0 ? traffic[0].timestamp : 0;

        return (
          <div>
            {/* Phase summary banner */}
            {phaseCounts.length > 0 && (
              <div style={{
                display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem',
              }}>
                {phaseCounts.map((pc, i) => (
                  <div key={i} style={{
                    background: `${pc.color}15`, border: `1px solid ${pc.color}40`,
                    borderRadius: 8, padding: '0.4rem 0.75rem',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: pc.color }}>{pc.label}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {pc.total} entries · {pc.rx} RX
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {traffic.length} entries — color coded by type
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                {Object.entries(TYPE_COLORS).map(([type, color]) => (
                  <span key={type} style={{ fontSize: '0.65rem', color, fontWeight: 600 }}>
                    ● {type} ({traffic.filter(t => t.type === type).length})
                  </span>
                ))}
              </div>
            </div>

            <div style={{
              background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '0.5rem',
              maxHeight: '70vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '0.7rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, background: '#111' }}>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600, width: '3rem' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600, width: '5.5rem' }}>Δ Time</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600, width: '4rem' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {traffic.map((entry, i) => {
                    const color = TYPE_COLORS[entry.type] || '#888';
                    const dt = ((entry.timestamp - t0) / 1000).toFixed(2);
                    const separator = phaseSeparators.get(i);

                    return (
                      <React.Fragment key={i}>
                        {separator && (
                          <tr>
                            <td colSpan={4} style={{
                              padding: '0.5rem 0.5rem 0.3rem',
                              borderTop: `2px solid ${separator.color}50`,
                              background: `${separator.color}08`,
                            }}>
                              <span style={{
                                fontSize: '0.72rem', fontWeight: 700, color: separator.color,
                                letterSpacing: '0.03em',
                              }}>
                                {separator.label}
                              </span>
                            </td>
                          </tr>
                        )}
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '0.3rem 0.5rem', color: '#4a5568' }}>{i + 1}</td>
                          <td style={{ padding: '0.3rem 0.5rem', color: '#6B7280' }}>+{dt}s</td>
                          <td style={{ padding: '0.3rem 0.5rem', color, fontWeight: 700 }}>{entry.type}</td>
                          <td style={{ padding: '0.3rem 0.5rem', color: '#e2e8f0', wordBreak: 'break-all' }}>{entry.payload}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
