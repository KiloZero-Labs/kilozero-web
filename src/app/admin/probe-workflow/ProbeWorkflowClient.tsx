'use client';

import { useState } from 'react';
import { FaDownload, FaUpload, FaChevronDown, FaChevronRight } from 'react-icons/fa';

// ── KiloZeroDriverSchema type (mirrors types.ts) ──
const SCHEMA_FIELDS = [
  { section: 'Identity', fields: [
    { name: 'id', type: 'string', desc: 'e.g. "renpho::es-cs20m" or "discovered::FA:C6:..."' },
    { name: 'brand', type: 'string?', desc: 'Scale manufacturer' },
    { name: 'model', type: 'string?', desc: 'Scale model' },
    { name: 'source', type: "'static' | 'cloud' | 'discovered'", desc: 'Origin of this driver' },
  ]},
  { section: 'Matching', fields: [
    { name: 'namePrefix', type: 'string?', desc: 'BLE advertised name prefix' },
    { name: 'macPrefix', type: 'string?', desc: 'For MAC-locked discovered drivers' },
  ]},
  { section: 'Pipeline', fields: [
    { name: 'pipeline', type: "'BROADCAST' | 'GATT_CONTINUOUS' | 'GATT_REQUEST_RESPONSE'", desc: 'Communication mode' },
    { name: 'serviceUUIDs', type: 'string[]?', desc: 'GATT service UUIDs' },
    { name: 'notifyUUIDs', type: 'string[]?', desc: 'Notify characteristic UUIDs' },
    { name: 'writeUUIDs', type: 'string[]?', desc: 'Write characteristic UUIDs' },
    { name: 'initHandshakeHex', type: 'string?', desc: 'Wake-up payload hex' },
  ]},
  { section: 'Weight Extraction', fields: [
    { name: 'weightByteOffset', type: 'number', desc: 'Byte index of weight field' },
    { name: 'weightByteLength', type: '2 | 3', desc: 'Width of weight integer' },
    { name: 'weightEndian', type: "'BE' | 'LE'", desc: 'Byte order' },
    { name: 'weightMultiplier', type: 'number', desc: 'Divisor (10, 100, 200, 1000, etc.)' },
  ]},
  { section: 'Stability Detection', fields: [
    { name: 'stabilityByteOffset', type: 'number?', desc: 'Byte that signals measurement lock' },
    { name: 'stabilityByteValue', type: 'number?', desc: 'Value meaning "stable"' },
    { name: 'stabilityByteMask', type: 'number?', desc: 'Bitmask before comparison (default: 0xFF)' },
  ]},
  { section: 'Impedance / BIA', fields: [
    { name: 'impedanceByteOffset', type: 'number?', desc: 'Byte index of impedance field' },
    { name: 'impedanceByteLength', type: '2 | 4?', desc: 'Width of impedance integer' },
    { name: 'impedanceEndian', type: "'BE' | 'LE'?", desc: 'Impedance byte order' },
    { name: 'impedanceTransform', type: 'ImpedanceTransform?', desc: 'Linear transform for proprietary scales' },
  ]},
  { section: 'Metadata', fields: [
    { name: 'stabilityRating', type: 'number?', desc: '0-5 maturity rating' },
    { name: 'capabilities', type: "('weight' | 'bodyFat')[]", desc: 'What this driver can extract' },
    { name: 'discoveredAt', type: 'string?', desc: 'ISO timestamp of discovery' },
    { name: 'contributorCount', type: 'number?', desc: 'Devices that contributed to this schema' },
  ]},
];

const V2_PHASES = [
  { id: '1', title: 'Hold & Wake', icon: '📱', color: '#6366f1',
    desc: 'User holds phone, steps on scale to wake BLE, selects device, steps off.' },
  { id: '1b', title: 'Baseline Capture', icon: '😴', color: '#3b82f6',
    desc: 'Scale sleeping. ~10s idle capture establishes the noise floor.' },
  { id: '2', title: 'Reference Measurement', icon: '⚖️', color: '#8b5cf6',
    desc: 'User steps on. Captures weight packets. User enters display values (weight, BF%).' },
  { id: '2b', title: 'Differential Entropy', icon: '📊', color: '#ec4899',
    desc: 'classifyBytes() compares baseline vs reference variance per byte position → HEADER / MEASUREMENT / STATUS / COUNTER.' },
  { id: '3', title: 'Weight Byte Hunt', icon: '🔍', color: '#f59e0b',
    desc: 'Dictionary search (×10,×100,×200,×1000) with 2.5% accuracy gate → brute-force divisor sweep fallback. Dual-unit (kg+lbs).' },
  { id: '4', title: 'Cross-Validation', icon: '🔬', color: '#22c55e',
    desc: 'User steps on again. Discovery capture must find weight at same offset/endian/multiplier. Optional proportionality test.' },
  { id: '5', title: 'BF & Impedance', icon: '⚡', color: '#0ea5e9',
    desc: 'BF% search (×10, ×100). Impedance sweep (150–900Ω range, 2-byte & 4-byte, BE/LE).' },
  { id: '6', title: 'Stability Detection', icon: '🏁', color: '#10b981',
    desc: 'Transition analysis: find byte that changes late and stays constant (e.g. 0x00→0x01). Canonical stability signal.' },
];

const SECTION_COLORS: Record<string, string> = {
  'Identity': '#6366f1', 'Matching': '#8b5cf6', 'Pipeline': '#3b82f6',
  'Weight Extraction': '#f59e0b', 'Stability Detection': '#10b981',
  'Impedance / BIA': '#0ea5e9', 'Metadata': '#6B7280',
};

interface ChangelogEntry { version: string; date: string; type: string; summary: string; }

interface Props {
  engineSource: string;
  engineError: string;
  schemaVersion: string;
  changelog: ChangelogEntry[];
}

const TYPE_COLORS: Record<string, string> = { major: '#ef4444', minor: '#0ea5e9', patch: '#6B7280' };

export default function ProbeWorkflowClient({ engineSource, engineError, schemaVersion, changelog }: Props) {
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [schemaExpanded, setSchemaExpanded] = useState(true);
  const [changelogExpanded, setChangelogExpanded] = useState(true);

  const handleDownload = () => {
    if (!engineSource) return;
    const blob = new Blob([engineSource], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `InferenceEngine-${new Date().toISOString().slice(0,10)}.ts`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ts,.js,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      alert(`Upload to GCloud not yet wired.\n\nFile: ${file.name}\nSize: ${text.length} chars\n\nThis will POST to the syncDrivers endpoint once the cloud function is extended.`);
    };
    input.click();
  };

  return (
    <div>
      <div className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{ margin: 0 }}>Probe Workflow</h1>
          {schemaVersion && (
            <span style={{
              background: 'rgba(14,165,233,0.15)', color: '#0ea5e9',
              border: '1px solid rgba(14,165,233,0.3)',
              padding: '0.25rem 0.65rem', borderRadius: 6,
              fontWeight: 700, fontSize: '0.82rem', fontFamily: 'monospace',
            }}>
              v{schemaVersion}
            </span>
          )}
        </div>
        <p>Protocol-agnostic BLE scale discovery — multi-phase inference with entropy analysis &amp; cross-validation</p>
      </div>

      {/* ── V2 Pipeline Overview ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '1.5rem' }}>
        {V2_PHASES.map((p) => (
          <div key={p.id} style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 10,
            padding: '0.85rem', border: `1px solid ${p.color}33`,
            borderTop: `3px solid ${p.color}`,
          }}>
            <div style={{ fontSize: '0.6rem', color: p.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>
              Step {p.id}
            </div>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.2rem' }}>{p.icon}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{p.title}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.desc}</div>
          </div>
        ))}
      </div>

      {/* ── KiloZeroDriverSchema Reference ── */}
      <section style={{
        background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '1.25rem',
        border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1rem',
      }}>
        <div onClick={() => setSchemaExpanded(e => !e)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', transition: 'transform 0.2s', display: 'inline-block', transform: schemaExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <FaChevronRight />
          </span>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            📋 KiloZeroDriverSchema (v2)
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {SCHEMA_FIELDS.reduce((a, s) => a + s.fields.length, 0)} fields across {SCHEMA_FIELDS.length} sections
          </span>
        </div>

        {schemaExpanded && (
          <div style={{ marginTop: '1rem' }}>
            {SCHEMA_FIELDS.map((section) => (
              <div key={section.section} style={{ marginBottom: '1rem' }}>
                <div style={{
                  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: SECTION_COLORS[section.section] || '#888',
                  marginBottom: '0.4rem', borderBottom: `1px solid ${SECTION_COLORS[section.section] || '#888'}22`,
                  paddingBottom: '0.3rem',
                }}>
                  {section.section}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.15rem' }}>
                  {section.fields.map((f) => (
                    <div key={f.name} style={{
                      display: 'grid', gridTemplateColumns: '180px 220px 1fr',
                      gap: '0.75rem', padding: '0.3rem 0.5rem', borderRadius: 4,
                      fontSize: '0.78rem', lineHeight: 1.5,
                    }}>
                      <span style={{ fontFamily: 'monospace', color: '#a5f3fc', fontWeight: 600 }}>{f.name}</span>
                      <span style={{ fontFamily: 'monospace', color: '#fbbf24', fontSize: '0.72rem' }}>{f.type}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{f.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── InferenceEngine Source Code ── */}
      <section style={{
        background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '1.25rem',
        border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div onClick={() => setCodeExpanded(e => !e)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', transition: 'transform 0.2s', display: 'inline-block', transform: codeExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              <FaChevronRight />
            </span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              🧠 InferenceEngine.ts
            </h2>
            {engineSource && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {engineSource.split('\n').length} lines · {(engineSource.length / 1024).toFixed(1)} KB
              </span>
            )}
          </div>

          {/* Upload / Download buttons */}
          <button onClick={handleDownload} disabled={!engineSource} title="Download InferenceEngine.ts" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid #374151',
            background: 'rgba(16,185,129,0.1)', color: '#10b981',
            fontWeight: 600, fontSize: '0.78rem', cursor: engineSource ? 'pointer' : 'not-allowed',
            opacity: engineSource ? 1 : 0.4, transition: 'all 0.2s',
          }}>
            <FaDownload size={11} /> Download
          </button>
          <button onClick={handleUpload} title="Upload updated InferenceEngine to GCloud" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.45rem 0.9rem', borderRadius: 6, border: '1px solid #374151',
            background: 'rgba(14,165,233,0.1)', color: '#0ea5e9',
            fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.2s',
          }}>
            <FaUpload size={11} /> Upload to GCloud
          </button>
        </div>

        {engineError && (
          <div style={{ color: '#ef4444', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(239,68,68,0.1)', borderRadius: 6, marginBottom: '0.5rem' }}>
            ⚠ Could not read source: {engineError}
          </div>
        )}

        {codeExpanded && engineSource && (
          <div style={{
            background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '1rem',
            maxHeight: '600px', overflow: 'auto', position: 'relative',
          }}>
            <pre style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: '0.72rem', lineHeight: 1.7, color: '#e2e8f0',
              margin: 0, whiteSpace: 'pre',
            }}>
              {engineSource.split('\n').map((line, i) => (
                <div key={i} style={{ display: 'flex' }}>
                  <span style={{ color: '#4a5568', width: '3.5rem', textAlign: 'right', paddingRight: '1rem', userSelect: 'none', flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </div>
              ))}
            </pre>
          </div>
        )}
      </section>

      {/* ── Schema Version Changelog ── */}
      {changelog.length > 0 && (
        <section style={{
          background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '1.25rem',
          border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1rem',
        }}>
          <div onClick={() => setChangelogExpanded(e => !e)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', transition: 'transform 0.2s', display: 'inline-block', transform: changelogExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              <FaChevronRight />
            </span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              📝 Schema Changelog
            </h2>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {changelog.length} releases
            </span>
          </div>

          {changelogExpanded && (
            <div style={{ marginTop: '1rem', position: 'relative', paddingLeft: '1.5rem' }}>
              {/* Timeline line */}
              <div style={{ position: 'absolute', left: '0.45rem', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1 }} />

              {changelog.map((entry, i) => {
                const isCurrent = i === 0;
                const typeColor = TYPE_COLORS[entry.type] || '#6B7280';
                return (
                  <div key={entry.version} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                    marginBottom: '0.75rem', position: 'relative',
                    opacity: isCurrent ? 1 : 0.7,
                  }}>
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute', left: '-1.25rem', top: '0.2rem',
                      width: 10, height: 10, borderRadius: '50%',
                      background: isCurrent ? typeColor : 'rgba(255,255,255,0.15)',
                      border: `2px solid ${typeColor}`,
                      boxShadow: isCurrent ? `0 0 6px ${typeColor}66` : 'none',
                    }} />

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: isCurrent ? '#fff' : 'var(--text-muted)' }}>
                          v{entry.version}
                        </span>
                        <span style={{
                          background: `${typeColor}22`, color: typeColor,
                          border: `1px solid ${typeColor}55`,
                          padding: '0.1rem 0.4rem', borderRadius: 4,
                          fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          {entry.type}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {entry.date}
                        </span>
                        {isCurrent && (
                          <span style={{
                            background: 'rgba(16,185,129,0.15)', color: '#10b981',
                            border: '1px solid rgba(16,185,129,0.3)',
                            padding: '0.1rem 0.4rem', borderRadius: 4,
                            fontSize: '0.6rem', fontWeight: 700,
                          }}>CURRENT</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {entry.summary}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Post-Probe Lifecycle ── */}
      <section style={{
        background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '1.25rem',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.75rem 0' }}>
          📦 Post-Probe Lifecycle
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {[
            { step: '1', label: 'Schema Generated', desc: 'KiloZeroDriverSchema saved locally', color: '#3b82f6' },
            { step: '2', label: 'Telemetry Sent', desc: 'onProbeComplete callback at wizard end', color: '#8b5cf6' },
            { step: '3', label: 'Cloud Review', desc: 'Admin reviews in Beta Telemetry', color: '#f59e0b' },
            { step: '4', label: 'N=5 Graduation', desc: '5 matching schemas \u2192 promoted', color: '#22c55e' },
            { step: '5', label: 'OTA Distribution', desc: 'Graduated driver pushed to all', color: '#ef4444' },
          ].map((s) => (
            <div key={s.step} style={{
              padding: '0.75rem 0.5rem', borderRadius: 8,
              background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.color}22`,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: s.color,
                color: '#fff', fontWeight: 700, fontSize: '0.7rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 0.4rem',
              }}>{s.step}</div>
              <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{s.label}</div>
              <div style={{ fontSize: '0.65rem' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
