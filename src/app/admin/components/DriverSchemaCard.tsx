'use client';

import React from 'react';

/**
 * DriverSchemaCard — Unified visual display for KiloZeroDriverSchema.
 * 
 * Used on both /admin/drivers (core registry) and /admin/telemetry/[id] 
 * (decoder-discovered schemas). Renders a structured, color-coded breakdown
 * of all schema parameters in a consistent format regardless of source.
 * 
 * Accepts any object shape — safely renders only fields that exist.
 */

interface DriverSchemaCardProps {
  /** The schema object (KiloZeroDriverSchema, DynamicDriverSchema, or legacy V1 shape) */
  schema: Record<string, any>;
  /** Label shown above the card (e.g. "Core Driver Schema", "Decoded Schema") */
  title?: string;
  /** Accent color for the title and left border */
  accentColor?: string;
  /** If true, renders compactly without outer padding (for embedding in existing layouts) */
  compact?: boolean;
}

// ── Schema field groups ──────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  format?: (val: any) => string;
}

const fmtHex = (v: any) => `0x${v}`;
const fmtBytes = (v: any) => `${v} bytes`;
const fmtByte = (v: any) => `Byte ${v}`;
const fmtMask = (v: any) => `0x${typeof v === 'number' ? v.toString(16).padStart(2, '0') : v}`;
const fmtMs = (v: any) => `${v}ms`;
const fmtLockValue = (v: any) => Array.isArray(v) ? v.map((x: number) => `0x${x.toString(16).padStart(2, '0')}`).join(', ') : `0x${typeof v === 'number' ? v.toString(16).padStart(2, '0') : v}`;

interface SectionDef {
  title: string;
  color: string;
  icon: string;
  fields: FieldDef[];
  /** Only render this section if at least one of these keys exists */
  requireAny: string[];
}

const SECTIONS: SectionDef[] = [
  {
    title: 'Pipeline',
    color: '#f59e0b',
    icon: '⚡',
    fields: [
      { key: 'pipeline', label: 'Mode' },
      { key: 'packetGuardHex', label: 'Packet Guard', format: fmtHex },
      { key: 'initHandshakeHex', label: 'Init Handshake', format: fmtHex },
      { key: 'initHandshakeTemplate', label: 'Handshake Template' },
    ],
    requireAny: ['pipeline', 'packetGuardHex'],
  },
  {
    title: 'Weight Extraction',
    color: '#38bdf8',
    icon: '⚖️',
    fields: [
      { key: 'weightByteOffset', label: 'Offset', format: fmtByte },
      { key: 'weightByteLength', label: 'Length', format: fmtBytes },
      { key: 'weightEndian', label: 'Endianness' },
      { key: 'weightMultiplier', label: 'Divisor (÷)' },
    ],
    requireAny: ['weightByteOffset'],
  },
  {
    title: 'Stability Detection',
    color: '#10b981',
    icon: '🔒',
    fields: [
      { key: 'stabilityByteOffset', label: 'Offset', format: fmtByte },
      { key: 'stabilityByteValue', label: 'Lock Value', format: fmtLockValue },
      { key: 'stabilityByteMask', label: 'Bitmask', format: fmtMask },
    ],
    requireAny: ['stabilityByteOffset', 'stabilityByteValue'],
  },
  {
    title: 'BIA / Impedance',
    color: '#8b5cf6',
    icon: '🧬',
    fields: [
      { key: 'impedanceByteOffset', label: 'Offset', format: fmtByte },
      { key: 'impedanceByteLength', label: 'Length', format: fmtBytes },
      { key: 'impedanceEndian', label: 'Endianness' },
      { key: 'requireImpedanceForStability', label: 'Hold for BIA', format: (v) => v ? 'Yes' : 'No' },
      { key: 'impedanceTimeoutMs', label: 'Timeout', format: fmtMs },
    ],
    requireAny: ['impedanceByteOffset'],
  },
  {
    title: 'Body Fat (Pre-Computed)',
    color: '#ec4899',
    icon: '📊',
    fields: [
      { key: 'bfByteOffset', label: 'Offset', format: fmtByte },
      { key: 'bfEndian', label: 'Endianness' },
      { key: 'bfMultiplier', label: 'Divisor (÷)' },
    ],
    requireAny: ['bfByteOffset'],
  },
];

// ── Legacy V1 field mapping ──────────────────────────────────────────

function normalizeSchema(raw: Record<string, any>): Record<string, any> {
  // If the schema is wrapped in a .schema or .dynamicSchema property, unwrap
  const s = raw.schema || raw.dynamicSchema || raw;
  
  // Map legacy V1 field names to KiloZeroDriverSchema equivalents
  const mapped: Record<string, any> = { ...s };
  
  // V1 legacy: { unit, multiplier, endian, characteristic, weightByteOffset }
  if (s.multiplier !== undefined && mapped.weightMultiplier === undefined) {
    mapped.weightMultiplier = s.multiplier;
  }
  if (s.endian !== undefined && mapped.weightEndian === undefined) {
    mapped.weightEndian = s.endian;
  }
  if (s.characteristic !== undefined && !mapped.notifyUUIDs) {
    mapped.notifyUUIDs = [s.characteristic];
  }
  
  return mapped;
}

// ── Render ──────────────────────────────────────────────────────────

export default function DriverSchemaCard({ schema, title = 'Driver Schema', accentColor = '#38bdf8', compact = false }: DriverSchemaCardProps) {
  const s = normalizeSchema(schema);
  
  // Even if all values are null, we still render the full schema skeleton
  // so the user can see what parameters exist and which are unconfigured.

  // Identity row
  const identityFields: [string, string][] = [];
  if (s.id) identityFields.push(['ID', s.id]);
  if (s.brand) identityFields.push(['Brand', s.brand]);
  if (s.model) identityFields.push(['Model', s.model]);
  if (s.source) identityFields.push(['Source', s.source]);
  if (s.namePrefix) identityFields.push(['Name Prefix', s.namePrefix]);
  if (s.macPrefix) identityFields.push(['MAC Prefix', s.macPrefix]);
  if (s.stabilityRating !== undefined) identityFields.push(['Rating', '★'.repeat(Math.round(s.stabilityRating)) + '☆'.repeat(5 - Math.round(s.stabilityRating))]);
  if (s.capabilities) identityFields.push(['Capabilities', Array.isArray(s.capabilities) ? s.capabilities.join(', ') : s.capabilities]);

  return (
    <div style={{
      background: compact ? 'transparent' : 'rgba(255,255,255,0.03)',
      borderRadius: compact ? 0 : 10,
      padding: compact ? '0.5rem 0' : '1rem',
      border: compact ? 'none' : `1px solid ${accentColor}30`,
      borderLeft: compact ? 'none' : `3px solid ${accentColor}`,
    }}>
      {/* Title */}
      <div style={{
        fontSize: '0.75rem', fontWeight: 700, color: accentColor,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: '0.75rem',
      }}>
        {title}
      </div>

      {/* Identity fields (if any) */}
      {identityFields.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem',
        }}>
          {identityFields.map(([label, value]) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 6, padding: '0.25rem 0.5rem',
              display: 'flex', gap: '0.35rem', alignItems: 'baseline',
            }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
              <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Protocol Sections — always show all */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 260px))',
        gap: '0.5rem',
      }}>
        {SECTIONS.map(section => {
          return (
            <div key={section.title} style={{
              background: 'rgba(0,0,0,0.25)',
              borderRadius: 8,
              padding: '0.6rem 0.75rem',
              border: `1px solid ${section.color}20`,
            }}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 700, color: section.color,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                marginBottom: '0.4rem',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}>
                <span>{section.icon}</span> {section.title}
              </div>
              {section.fields.map(field => {
                const val = s[field.key];
                const isEmpty = val === undefined || val === null;
                const display = isEmpty ? '—' : (field.format ? field.format(val) : String(val));
                return (
                  <div key={field.key} style={{
                    display: 'flex', gap: '0.5rem', alignItems: 'baseline',
                    padding: '0.15rem 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{field.label}</span>
                    <span style={{
                      fontSize: '0.68rem',
                      color: isEmpty ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                      fontFamily: 'monospace', fontWeight: isEmpty ? 400 : 600,
                    }}>{display}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* GATT UUIDs (if present) */}
      {(s.serviceUUIDs || s.notifyUUIDs || s.writeUUIDs) && (
        <div style={{
          marginTop: '0.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 260px))',
          gap: '0.5rem',
        }}>
          {[
            { label: 'Service UUIDs', uuids: s.serviceUUIDs, color: '#6366f1' },
            { label: 'Notify UUIDs', uuids: s.notifyUUIDs, color: '#22c55e' },
            { label: 'Write UUIDs', uuids: s.writeUUIDs, color: '#f59e0b' },
          ].filter(g => g.uuids && g.uuids.length > 0).map(group => (
            <div key={group.label} style={{
              background: 'rgba(0,0,0,0.25)', borderRadius: 8,
              padding: '0.6rem 0.75rem', border: `1px solid ${group.color}20`,
            }}>
              <div style={{
                fontSize: '0.65rem', fontWeight: 700, color: group.color,
                textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem',
              }}>{group.label}</div>
              {group.uuids.map((uuid: string, i: number) => (
                <div key={i} style={{
                  fontFamily: 'monospace', fontSize: '0.65rem', color: '#a5f3fc',
                  lineHeight: 1.6,
                }}>{uuid}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
