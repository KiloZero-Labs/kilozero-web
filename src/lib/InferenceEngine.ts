import { TelemetryEvent } from './BluetoothManager';
import { DynamicDriverSchema, KiloZeroDriverSchema, ScaleDriver } from './types';
import { createDriverFromKiloZeroSchema } from './adapters/DynamicDriverAdapter';
import { Buffer } from 'buffer';

// ─────────────────────────────────────────────────────────────────
// Inference Engine Schema Version
// MAJOR: breaking schema shape changes, new required fields
// MINOR: algorithm improvements, new optional fields, bug fixes
// ─────────────────────────────────────────────────────────────────
export const INFERENCE_SCHEMA_VERSION = '2.5.1';

export const INFERENCE_SCHEMA_CHANGELOG: { version: string; date: string; type: 'major' | 'minor' | 'patch'; summary: string }[] = [
  { version: '2.5.1', date: '2026-05-04', type: 'patch', summary: 'Fix: cloud submission now includes all 3 capture phases; stability detection guard lowered to 3 packets with unclustered fallback; schema version shown in AlphaFeedbackModal' },
  { version: '2.5.0', date: '2026-05-04', type: 'minor', summary: 'Extended capture idle timeout to 12s for BIA scales; impedance-found auto-upgrades bodyFat capability; stream-pause visual indicator' },
  { version: '2.4.0', date: '2026-05-04', type: 'minor', summary: '2.5% accuracy gate on all matches; candidate ranking replaces first-match; tolerance loop removed from dictionary' },
  { version: '2.3.0', date: '2026-05-03', type: 'minor', summary: 'Dual-unit search (kg+lbs); brute-force divisor sweep; differential entropy byte classification; proportionality test' },
  { version: '2.2.0', date: '2026-05-03', type: 'minor', summary: 'Frame header clustering; GATT topology logging; discovery weight re-entry' },
  { version: '2.1.0', date: '2026-05-02', type: 'minor', summary: 'Impedance sweep (150–900Ω); stability detection via transition analysis' },
  { version: '2.0.0', date: '2026-05-01', type: 'major', summary: 'V2 multi-phase pipeline: baseline/reference/discovery captures, KiloZeroDriverSchema output' },
  { version: '1.1.0', date: '2026-04-28', type: 'minor', summary: '3-byte weight support (×1000); Etekcity LE 24-bit encoding' },
  { version: '1.0.0', date: '2026-04-15', type: 'major', summary: 'Initial inference engine: 2-byte search with ×10/×100/×200 multipliers, DynamicDriverSchema output' },
];

export class InferenceEngine {
  /**
   * Generates a functional ScaleDriver from a DynamicDriverSchema (legacy v1 path).
   */
  public static generateDriverFromSchema(schema: DynamicDriverSchema): ScaleDriver {
    return {
      id: `Dynamic Driver (${schema.mac})`,
      linkMode: 'GATT',
      isDynamic: true,
      dynamicSchema: schema,
      capabilities: ['weight'],
      matches: (device) => device.id === schema.mac,
      notifyUUIDs: [schema.characteristic],
      onNotify: (characteristicUUID, base64Data) => {
        if (characteristicUUID.toLowerCase() !== schema.characteristic.toLowerCase()) {
           return { status: 'pending' };
        }

        try {
           const hex = Buffer.from(base64Data, 'base64').toString('hex').toUpperCase();
           if (hex.length < (schema.weightByteOffset + 2) * 2) {
               return { status: 'pending' };
           }

           const be1 = hex.substring(schema.weightByteOffset * 2, schema.weightByteOffset * 2 + 2);
           const be2 = hex.substring(schema.weightByteOffset * 2 + 2, schema.weightByteOffset * 2 + 4);

           let intValue = 0;
           if (schema.endian === 'BE') {
               intValue = parseInt(be1 + be2, 16);
           } else {
               intValue = parseInt(be2 + be1, 16);
           }

           const finalWeight = intValue / schema.multiplier;

           // If weight is near 0, the user has stepped off or it's resetting
           if (finalWeight < 2) return { status: 'pending' };

           return {
               status: 'complete',
               payload: {
                   weightKg: schema.unit === 'kg' ? finalWeight : null,
                   weightLbs: schema.unit === 'lbs' ? finalWeight : null,
                   bodyFatPercent: null,
                   userIndex: 1
               }
           };

        } catch (e) {
           return { status: 'pending' };
        }
      }
    };
  }

  /**
   * Generates a functional ScaleDriver from a KiloZeroDriverSchema (v2 path).
   * Uses the DynamicDriverAdapter runtime interpreter.
   */
  public static generateDriverFromKiloZeroSchema(schema: KiloZeroDriverSchema): ScaleDriver {
    return createDriverFromKiloZeroSchema(schema);
  }

  /**
   * Bridges a legacy DynamicDriverSchema into the new KiloZeroDriverSchema format.
   * Used during the migration period while cloud Firestore may contain v1 schemas.
   */
  public static migrateToKiloZeroSchema(legacy: DynamicDriverSchema): KiloZeroDriverSchema {
    return {
      id: `migrated::${legacy.mac}`,
      brand: legacy.name,
      source: 'cloud',
      macPrefix: legacy.mac,
      pipeline: 'GATT_CONTINUOUS',
      notifyUUIDs: [legacy.characteristic],
      weightByteOffset: legacy.weightByteOffset,
      weightByteLength: 2,
      weightEndian: legacy.endian,
      weightMultiplier: legacy.multiplier,
      capabilities: ['weight'],
      stabilityRating: 1,
    };
  }

  /**
   * Scans a telemetry log to find the exact byte offsets corresponding to the user's target weight.
   * Searches BOTH unit interpretations (kg and lbs) since scales may transmit
   * in a different unit than the user's display setting.
   *
   * Every candidate match is DECODED and validated against the target weight
   * with a 2.5% accuracy gate to prevent false positives from coincidental
   * byte patterns at lower multipliers.
   */
  public static inferDriver(
    telemetryLog: TelemetryEvent[],
    targetWeight: number,
    mac: string,
    unit: 'kg' | 'lbs' = 'lbs'
  ): (DynamicDriverSchema & { weightByteLength?: 2 | 3 }) | null {
    if (!telemetryLog || telemetryLog.length === 0) return null;

    const rxEvents = telemetryLog.filter(e => e.type === 'RX');
    if (rxEvents.length === 0) return null;

    const payloads = rxEvents.map(e => ({ hex: this.extractHex(e.payload), char: this.extractChar(e.payload) }));

    // Build dual-unit search targets: as-entered + converted counterpart
    const KG_TO_LBS = 2.20462262185;
    const targets: { weight: number; wireUnit: 'kg' | 'lbs' }[] = [
      { weight: targetWeight, wireUnit: unit },
    ];
    if (unit === 'lbs') {
      targets.push({ weight: targetWeight / KG_TO_LBS, wireUnit: 'kg' });
    } else {
      targets.push({ weight: targetWeight * KG_TO_LBS, wireUnit: 'lbs' });
    }

    // Accuracy gate: decoded weight must be within 2.5% of target
    const ACCURACY_GATE = 0.025;

    // Collect ALL validated candidates, then pick the best one
    interface DriverCandidate {
      mac: string;
      endian: 'BE' | 'LE';
      unit: 'kg' | 'lbs';
      multiplier: number;
      weightByteOffset: number;
      characteristic: string;
      weightByteLength: 2 | 3;
      decodedWeight: number;
      error: number;       // abs(decoded - target) / target
      hitCount: number;     // how many packets this offset+multiplier matches
    }

    const candidates: DriverCandidate[] = [];

    for (const t of targets) {
      const variants = [
        { multiplier: 10, intValue: Math.round(t.weight * 10) },
        { multiplier: 100, intValue: Math.round(t.weight * 100) },
        { multiplier: 200, intValue: Math.round(t.weight * 200) },   // Xiaomi (kg mode)
        { multiplier: 1000, intValue: Math.round(t.weight * 1000) }, // Etekcity
      ];

      const tolerance = 2;

      for (const v of variants) {
        // Only test the exact value (offset=0) for the dictionary search
        // The tolerance loop was causing false positives; brute-force sweep handles variance
        const testVal = v.intValue;
        if (testVal <= 0) continue;

        // 16-bit (2-byte) search
        if (testVal <= 0xFFFF) {
          const hexString = testVal.toString(16).toUpperCase().padStart(4, '0');
          const be1 = hexString.substring(0, 2);
          const be2 = hexString.substring(2, 4);
          const bigEndian = `${be1}${be2}`;
          const littleEndian = `${be2}${be1}`;

          for (const p of payloads) {
            const hex = p.hex.toUpperCase();

            // Search BE — find ALL occurrences, not just the first
            let searchFrom = 0;
            while (searchFrom < hex.length) {
              const beIndex = hex.indexOf(bigEndian, searchFrom);
              if (beIndex === -1) break;
              if (beIndex % 2 === 0) {
                const decoded = testVal / v.multiplier;
                const error = Math.abs(decoded - t.weight) / t.weight;
                if (error <= ACCURACY_GATE) {
                  candidates.push({ mac, endian: 'BE', unit: t.wireUnit, multiplier: v.multiplier, weightByteOffset: beIndex / 2, characteristic: p.char, weightByteLength: 2, decodedWeight: decoded, error, hitCount: 1 });
                }
              }
              searchFrom = beIndex + 2;
            }

            // Search LE
            searchFrom = 0;
            while (searchFrom < hex.length) {
              const leIndex = hex.indexOf(littleEndian, searchFrom);
              if (leIndex === -1) break;
              if (leIndex % 2 === 0) {
                const decoded = testVal / v.multiplier;
                const error = Math.abs(decoded - t.weight) / t.weight;
                if (error <= ACCURACY_GATE) {
                  candidates.push({ mac, endian: 'LE', unit: t.wireUnit, multiplier: v.multiplier, weightByteOffset: leIndex / 2, characteristic: p.char, weightByteLength: 2, decodedWeight: decoded, error, hitCount: 1 });
                }
              }
              searchFrom = leIndex + 2;
            }
          }
        }

        // 24-bit (3-byte) search
        if (testVal > 0xFF && testVal <= 0xFFFFFF) {
          const hexString = testVal.toString(16).toUpperCase().padStart(6, '0');
          const b1 = hexString.substring(0, 2);
          const b2 = hexString.substring(2, 4);
          const b3 = hexString.substring(4, 6);
          const bigEndian3 = `${b1}${b2}${b3}`;
          const littleEndian3 = `${b3}${b2}${b1}`;

          for (const p of payloads) {
            const hex = p.hex.toUpperCase();

            let searchFrom = 0;
            while (searchFrom < hex.length) {
              const beIndex = hex.indexOf(bigEndian3, searchFrom);
              if (beIndex === -1) break;
              if (beIndex % 2 === 0) {
                const decoded = testVal / v.multiplier;
                const error = Math.abs(decoded - t.weight) / t.weight;
                if (error <= ACCURACY_GATE) {
                  candidates.push({ mac, endian: 'BE', unit: t.wireUnit, multiplier: v.multiplier, weightByteOffset: beIndex / 2, characteristic: p.char, weightByteLength: 3, decodedWeight: decoded, error, hitCount: 1 });
                }
              }
              searchFrom = beIndex + 2;
            }

            searchFrom = 0;
            while (searchFrom < hex.length) {
              const leIndex = hex.indexOf(littleEndian3, searchFrom);
              if (leIndex === -1) break;
              if (leIndex % 2 === 0) {
                const decoded = testVal / v.multiplier;
                const error = Math.abs(decoded - t.weight) / t.weight;
                if (error <= ACCURACY_GATE) {
                  candidates.push({ mac, endian: 'LE', unit: t.wireUnit, multiplier: v.multiplier, weightByteOffset: leIndex / 2, characteristic: p.char, weightByteLength: 3, decodedWeight: decoded, error, hitCount: 1 });
                }
              }
              searchFrom = leIndex + 2;
            }
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Deduplicate and count cross-packet hits
    const grouped = new Map<string, DriverCandidate>();
    for (const c of candidates) {
      const key = `${c.weightByteOffset}|${c.weightByteLength}|${c.endian}|${c.multiplier}|${c.unit}`;
      if (grouped.has(key)) {
        grouped.get(key)!.hitCount++;
      } else {
        grouped.set(key, { ...c });
      }
    }

    // Rank: prefer higher hitCount, then lower error, then higher multiplier (more precision)
    const ranked = [...grouped.values()].sort((a, b) => {
      if (b.hitCount !== a.hitCount) return b.hitCount - a.hitCount;
      if (a.error !== b.error) return a.error - b.error;
      return b.multiplier - a.multiplier; // Higher multiplier = more precision = preferred
    });

    const best = ranked[0];
    return {
      mac,
      endian: best.endian,
      unit: best.unit,
      multiplier: best.multiplier,
      weightByteOffset: best.weightByteOffset,
      characteristic: best.characteristic,
      weightByteLength: best.weightByteLength,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Clean divisor heuristic for brute-force sweep
  // ─────────────────────────────────────────────────────────────────

  /**
   * Returns true if the divisor is a "clean" engineering value —
   * one that a scale manufacturer would plausibly use.
   */
  private static isCleanDivisor(d: number): boolean {
    if (d <= 0 || !isFinite(d)) return false;
    // Exact powers of 10
    if ([1, 10, 100, 1000, 10000].includes(d)) return true;
    // Common engineering multiples
    if ([2, 5, 20, 50, 200, 500, 2000, 5000].includes(d)) return true;
    // Round integer with ≤ 2 significant digits
    if (d === Math.round(d) && d > 0 && d < 100000) {
      const sig = d.toString().replace(/0+$/, '');
      if (sig.length <= 2) return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────────
  // Brute-force universal weight search (fallback for unknown protocols)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Protocol-agnostic weight inference. Extracts every possible 2/3/4-byte
   * integer from every RX packet, divides by targetWeight, and accepts
   * candidates where the divisor is a clean engineering value.
   *
   * Searches both the user's entered unit AND the converted counterpart.
   */
  public static inferDriverUniversal(
    telemetryLog: TelemetryEvent[],
    targetWeight: number,
    mac: string,
    unit: 'kg' | 'lbs'
  ): (DynamicDriverSchema & { weightByteLength?: 2 | 3 }) | null {
    const rxEvents = telemetryLog.filter(e => e.type === 'RX');
    if (rxEvents.length === 0) return null;

    const payloads = rxEvents.map(e => ({ hex: this.extractHex(e.payload).toUpperCase(), char: this.extractChar(e.payload) }));

    // Dual-unit targets
    const KG_TO_LBS = 2.20462262185;
    const targets: { weight: number; wireUnit: 'kg' | 'lbs' }[] = [
      { weight: targetWeight, wireUnit: unit },
      unit === 'lbs'
        ? { weight: targetWeight / KG_TO_LBS, wireUnit: 'kg' }
        : { weight: targetWeight * KG_TO_LBS, wireUnit: 'lbs' },
    ];

    interface Candidate {
      offset: number;
      byteWidth: 2 | 3;
      endian: 'BE' | 'LE';
      multiplier: number;
      wireUnit: 'kg' | 'lbs';
      char: string;
      hitCount: number;
      divisorScore: number;
    }

    const candidates: Candidate[] = [];

    for (const t of targets) {
      if (t.weight <= 0) continue;

      for (const p of payloads) {
        const hex = p.hex;
        const byteCount = hex.length / 2;

        for (const byteWidth of [2, 3] as const) {
          for (let off = 0; off <= byteCount - byteWidth; off++) {
            for (const endian of ['BE', 'LE'] as const) {
              let rawInt = 0;
              if (byteWidth === 2) {
                const b0 = parseInt(hex.substring(off * 2, off * 2 + 2), 16);
                const b1 = parseInt(hex.substring(off * 2 + 2, off * 2 + 4), 16);
                rawInt = endian === 'BE' ? (b0 << 8) | b1 : b0 | (b1 << 8);
              } else {
                const b0 = parseInt(hex.substring(off * 2, off * 2 + 2), 16);
                const b1 = parseInt(hex.substring(off * 2 + 2, off * 2 + 4), 16);
                const b2 = parseInt(hex.substring(off * 2 + 4, off * 2 + 6), 16);
                rawInt = endian === 'BE' ? (b0 << 16) | (b1 << 8) | b2 : b0 | (b1 << 8) | (b2 << 16);
              }

              if (rawInt <= 0) continue;

              const divisor = rawInt / t.weight;
              if (this.isCleanDivisor(Math.round(divisor))) {
                const roundedDiv = Math.round(divisor);
                // Verify: does this divisor produce a weight within 2% of target?
                const decoded = rawInt / roundedDiv;
                const error = Math.abs(decoded - t.weight) / t.weight;
                if (error < 0.025) {
                  // Score: power of 10 > multiple of 5 > other; higher multiplier = more precision
                  let score = 0;
                  if ([10, 100, 1000].includes(roundedDiv)) score = 100;
                  else if ([20, 200, 50, 500].includes(roundedDiv)) score = 80;
                  else score = 50;
                  score += Math.min(roundedDiv, 1000) / 10; // Higher multiplier bonus (max +100)

                  candidates.push({
                    offset: off, byteWidth, endian, multiplier: roundedDiv,
                    wireUnit: t.wireUnit, char: p.char, hitCount: 1, divisorScore: score,
                  });
                }
              }
            }
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Deduplicate: group by (offset, byteWidth, endian, multiplier, wireUnit)
    const grouped = new Map<string, Candidate>();
    for (const c of candidates) {
      const key = `${c.offset}|${c.byteWidth}|${c.endian}|${c.multiplier}|${c.wireUnit}`;
      if (grouped.has(key)) {
        grouped.get(key)!.hitCount++;
      } else {
        grouped.set(key, { ...c });
      }
    }

    // Rank: hitCount (cross-packet consistency) × divisorScore
    const ranked = [...grouped.values()].sort((a, b) =>
      (b.hitCount * b.divisorScore) - (a.hitCount * a.divisorScore)
    );

    const best = ranked[0];
    return {
      mac,
      endian: best.endian,
      unit: best.wireUnit,
      multiplier: best.multiplier,
      weightByteOffset: best.offset,
      characteristic: best.char,
      weightByteLength: best.byteWidth,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Differential entropy byte classification
  // ─────────────────────────────────────────────────────────────────

  /**
   * Classifies each byte position as HEADER, MEASUREMENT, STATUS, COUNTER, or NOISE
   * by comparing per-byte variance between baseline (idle) and reference (active) captures.
   */
  private static classifyBytes(
    baselineHexes: string[],
    referenceHexes: string[]
  ): Map<number, 'HEADER' | 'MEASUREMENT' | 'STATUS' | 'COUNTER' | 'NOISE'> {
    const result = new Map<number, 'HEADER' | 'MEASUREMENT' | 'STATUS' | 'COUNTER' | 'NOISE'>();
    if (referenceHexes.length === 0) return result;

    const byteCount = Math.min(...referenceHexes.map(h => h.length)) / 2;

    for (let b = 0; b < byteCount; b++) {
      const baseVals = new Set<number>();
      const refVals: number[] = [];
      const refUniqueVals = new Set<number>();

      for (const h of baselineHexes) {
        if (h.length >= (b + 1) * 2) {
          baseVals.add(parseInt(h.substring(b * 2, b * 2 + 2), 16));
        }
      }

      for (const h of referenceHexes) {
        if (h.length >= (b + 1) * 2) {
          const v = parseInt(h.substring(b * 2, b * 2 + 2), 16);
          refVals.push(v);
          refUniqueVals.add(v);
        }
      }

      const baseVariance = baseVals.size;
      const refVariance = refUniqueVals.size;

      if (baseVariance <= 1 && refVariance <= 1) {
        result.set(b, 'HEADER');
      } else if (baseVariance <= 1 && refVariance >= 4) {
        result.set(b, 'MEASUREMENT');
      } else if (baseVariance <= 1 && refVariance >= 2 && refVariance <= 3) {
        result.set(b, 'STATUS');
      } else {
        // Check if monotonic (counter)
        let isMonotonic = refVals.length >= 3;
        for (let i = 1; i < refVals.length && isMonotonic; i++) {
          if (refVals[i] < refVals[i - 1]) isMonotonic = false;
        }
        result.set(b, isMonotonic && refVals.length >= 3 ? 'COUNTER' : 'NOISE');
      }
    }

    return result;
  }

  private static extractChar(message: string): string {
    const match = message.match(/^\[(.*?)\]/);
    return match ? match[1] : 'unknown';
  }

  private static extractHex(message: string): string {
    const match = message.match(/^\[.*?\]\s*(.*)$/);
    return match ? match[1].replace(/\s/g, '') : message;
  }

  // ─────────────────────────────────────────────────────────────────
  // Phase 4: Impedance Byte Hunt
  // ─────────────────────────────────────────────────────────────────

  /**
   * Sweeps the unknown bytes of RX payloads looking for an impedance value
   * that matches the target range (from calculateExpectedImpedance).
   *
   * Skips bytes already identified as the weight field.
   * Tests 16-bit and 32-bit integers in both endiannesses.
   *
   * Returns { offset, length, endian } on match, or null if not found.
   */
  public static inferImpedance(
    telemetryLog: TelemetryEvent[],
    targetRange: { low: number; high: number },
    weightByteOffset: number,
    weightByteLength: 2 | 3
  ): { impedanceByteOffset: number; impedanceByteLength: 2 | 4; impedanceEndian: 'BE' | 'LE' } | null {
    if (!telemetryLog || telemetryLog.length === 0) return null;

    const rxEvents = telemetryLog.filter(e => e.type === 'RX');
    if (rxEvents.length === 0) return null;

    // Collect all unique payloads
    const payloads = rxEvents.map(e => this.extractHex(e.payload));

    // Build the set of byte indices occupied by the weight field
    const weightIndices = new Set<number>();
    for (let i = 0; i < weightByteLength; i++) {
      weightIndices.add(weightByteOffset + i);
    }

    for (const hexStr of payloads) {
      const hex = hexStr.toUpperCase().replace(/\s/g, '');
      const byteCount = hex.length / 2;

      if (byteCount < 4) continue; // Too short to contain impedance

      // Convert hex to byte array for easier manipulation
      const bytes: number[] = [];
      for (let i = 0; i < byteCount; i++) {
        bytes.push(parseInt(hex.substring(i * 2, i * 2 + 2), 16));
      }

      // Try 16-bit candidates first (most common impedance encoding)
      for (let offset = 0; offset <= byteCount - 2; offset++) {
        // Skip if this overlaps the weight field
        if (weightIndices.has(offset) || weightIndices.has(offset + 1)) continue;

        // Big-endian 16-bit
        const be16 = (bytes[offset] << 8) | bytes[offset + 1];
        if (be16 >= targetRange.low && be16 <= targetRange.high) {
          return { impedanceByteOffset: offset, impedanceByteLength: 2, impedanceEndian: 'BE' };
        }

        // Little-endian 16-bit
        const le16 = bytes[offset] | (bytes[offset + 1] << 8);
        if (le16 >= targetRange.low && le16 <= targetRange.high) {
          return { impedanceByteOffset: offset, impedanceByteLength: 2, impedanceEndian: 'LE' };
        }
      }

      // Try 32-bit candidates (rare, but some scales use wider fields)
      for (let offset = 0; offset <= byteCount - 4; offset++) {
        // Skip if overlaps weight
        if (weightIndices.has(offset) || weightIndices.has(offset + 1) ||
            weightIndices.has(offset + 2) || weightIndices.has(offset + 3)) continue;

        const be32 = (bytes[offset] << 24) | (bytes[offset + 1] << 16) |
                     (bytes[offset + 2] << 8) | bytes[offset + 3];
        if (be32 >= targetRange.low && be32 <= targetRange.high) {
          return { impedanceByteOffset: offset, impedanceByteLength: 4, impedanceEndian: 'BE' };
        }

        const le32 = bytes[offset] | (bytes[offset + 1] << 8) |
                     (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
        if (le32 >= targetRange.low && le32 <= targetRange.high) {
          return { impedanceByteOffset: offset, impedanceByteLength: 4, impedanceEndian: 'LE' };
        }
      }
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Scale Discovery v2 — Multi-phase inference with baseline diffing
  // ─────────────────────────────────────────────────────────────────

  /**
   * V2 inference engine that uses baseline (idle) packets to isolate
   * active bytes, then cross-validates across reference and discovery
   * captures for higher confidence.
   */
  public static inferDriverV2(
    baselineTelemetry: TelemetryEvent[],
    referenceTelemetry: TelemetryEvent[],
    discoveryTelemetry: TelemetryEvent[],
    targetWeight: number,
    targetBf: number | null,
    mac: string,
    unit: 'kg' | 'lbs',
    discoveryWeight?: number
  ): { schema: KiloZeroDriverSchema | null; confidence: number; diagnostics: string[]; decodedWeight?: number; decodedBf?: number; wireUnit?: 'kg' | 'lbs' } {
    const diagnostics: string[] = [];
    let confidence = 0;

    // Step 1: Extract RX payloads from each phase
    const baselineRx = baselineTelemetry.filter(e => e.type === 'RX');
    const referenceRx = referenceTelemetry.filter(e => e.type === 'RX');
    const discoveryRx = discoveryTelemetry.filter(e => e.type === 'RX');

    diagnostics.push(`Baseline: ${baselineRx.length} RX, Reference: ${referenceRx.length} RX, Discovery: ${discoveryRx.length} RX`);

    if (referenceRx.length === 0) {
      diagnostics.push('FAIL: No RX packets in reference capture');
      return { schema: null, confidence: 0, diagnostics };
    }

    // Step 1b: Frame header clustering (GAP 1)
    // Group reference packets by their first 2 bytes to isolate measurement frames
    // from handshake/ACK/control frames
    const referenceHexes = referenceRx.map(e => this.extractHex(e.payload).toUpperCase());
    const referenceChars = referenceRx.map(e => this.extractChar(e.payload));
    const headerClusters = new Map<string, { hexes: string[]; chars: string[]; indices: number[] }>();

    for (let i = 0; i < referenceHexes.length; i++) {
      const hex = referenceHexes[i];
      if (hex.length < 4) continue;
      const header = hex.substring(0, 4); // First 2 bytes as cluster key
      if (!headerClusters.has(header)) headerClusters.set(header, { hexes: [], chars: [], indices: [] });
      const cluster = headerClusters.get(header)!;
      cluster.hexes.push(hex);
      cluster.chars.push(referenceChars[i]);
      cluster.indices.push(i);
    }

    // The largest cluster with consistent length is the measurement frame type
    const sortedClusters = [...headerClusters.entries()]
      .sort((a, b) => b[1].hexes.length - a[1].hexes.length);
    const primaryCluster = sortedClusters[0];
    const clusterHeader = primaryCluster ? primaryCluster[0] : '';
    const clusterHexes = primaryCluster ? primaryCluster[1].hexes : referenceHexes;
    const clusterChars = primaryCluster ? primaryCluster[1].chars : referenceChars;

    diagnostics.push(`Frame clustering: ${headerClusters.size} header types, primary=0x${clusterHeader} (${clusterHexes.length} packets)`);

    // Find the most common packet length in the primary cluster
    const lengthCounts: Record<number, number> = {};
    for (const h of clusterHexes) { const l = h.length; lengthCounts[l] = (lengthCounts[l] || 0) + 1; }
    const primaryLength = Object.entries(lengthCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const primaryLenNum = primaryLength ? parseInt(primaryLength) : 0;

    // Filter to primary-length packets within the cluster
    const filteredRef = clusterHexes.filter(h => h.length === primaryLenNum);
    const filteredChars = clusterChars.filter((_, i) => clusterHexes[i].length === primaryLenNum);
    const primaryChar = filteredChars[0] || 'unknown';

    diagnostics.push(`Primary packet length: ${primaryLenNum / 2} bytes (${filteredRef.length} packets), char: ${primaryChar}`);

    // Step 2b: Differential entropy analysis
    // Classify each byte as HEADER/MEASUREMENT/STATUS/COUNTER/NOISE
    const baselineHexes = baselineRx.slice(-10).map(e => this.extractHex(e.payload).toUpperCase());
    const byteClassification = this.classifyBytes(
      baselineHexes.filter(h => h.length === primaryLenNum),
      filteredRef
    );
    const measurementBytes: number[] = [];
    const statusBytes: number[] = [];
    byteClassification.forEach((cls, pos) => {
      if (cls === 'MEASUREMENT') measurementBytes.push(pos);
      if (cls === 'STATUS') statusBytes.push(pos);
    });
    diagnostics.push(`Entropy: ${measurementBytes.length} MEASUREMENT bytes [${measurementBytes.join(',')}], ${statusBytes.length} STATUS bytes [${statusBytes.join(',')}]`);

    // Step 3: Attempt weight inference — dictionary first, brute-force fallback
    let refResult = this.inferDriver(referenceTelemetry, targetWeight, mac, unit);
    let usedUniversal = false;

    if (!refResult) {
      diagnostics.push('Dictionary search failed. Trying brute-force divisor sweep...');
      refResult = this.inferDriverUniversal(referenceTelemetry, targetWeight, mac, unit);
      usedUniversal = true;
    }

    let weightOffset = -1;
    let weightEndian: 'BE' | 'LE' = 'LE';
    let weightMultiplier = 100;
    let weightByteLen: 2 | 3 = 2;
    let wireUnit: 'kg' | 'lbs' = unit;
    let decodedWeight: number | undefined;

    if (refResult) {
      weightOffset = refResult.weightByteOffset;
      weightEndian = refResult.endian;
      weightMultiplier = refResult.multiplier;
      weightByteLen = refResult.weightByteLength || 2;
      wireUnit = refResult.unit;
      confidence += usedUniversal ? 30 : 40; // Slightly lower confidence for brute-force
      const searchMethod = usedUniversal ? '(universal sweep)' : '(dictionary)';
      diagnostics.push(`✅ Weight found ${searchMethod}: offset=${weightOffset}, ${weightByteLen}B ${weightEndian}, ×${weightMultiplier}, wire=${wireUnit}`);
      if (wireUnit !== unit) {
        diagnostics.push(`  ℹ️ Unit mismatch: user entered ${unit}, scale transmits ${wireUnit}`);
      }

      // Decode the weight from a reference packet (supports 2-byte and 3-byte)
      if (filteredRef.length > 0) {
        const hex = filteredRef[filteredRef.length - 1];
        let intVal = 0;
        if (weightByteLen === 3) {
          const b1 = hex.substring(weightOffset * 2, weightOffset * 2 + 2);
          const b2 = hex.substring(weightOffset * 2 + 2, weightOffset * 2 + 4);
          const b3 = hex.substring(weightOffset * 2 + 4, weightOffset * 2 + 6);
          intVal = weightEndian === 'BE'
            ? parseInt(b1 + b2 + b3, 16)
            : parseInt(b3 + b2 + b1, 16);
        } else {
          const b1 = hex.substring(weightOffset * 2, weightOffset * 2 + 2);
          const b2 = hex.substring(weightOffset * 2 + 2, weightOffset * 2 + 4);
          intVal = weightEndian === 'BE' ? parseInt(b1 + b2, 16) : parseInt(b2 + b1, 16);
        }
        decodedWeight = intVal / weightMultiplier;
        diagnostics.push(`  Decoded weight from ref: ${decodedWeight.toFixed(1)} ${wireUnit}`);
      }
    } else {
      diagnostics.push('❌ Weight not found by dictionary or universal sweep');
    }

    // Step 4: Cross-validate with discovery capture + proportionality test
    if (refResult && discoveryRx.length > 0) {
      const discResult = this.inferDriver(discoveryTelemetry, targetWeight, mac, unit);
      if (discResult &&
          discResult.weightByteOffset === refResult.weightByteOffset &&
          discResult.endian === refResult.endian &&
          discResult.multiplier === refResult.multiplier) {
        confidence += 30;
        diagnostics.push('✅ Cross-validation: discovery capture confirms reference');

        // Proportionality test (if user provided a second weight reading)
        if (discoveryWeight && discoveryWeight > 0 && decodedWeight && decodedWeight > 0) {
          const expectedRatio = decodedWeight / discoveryWeight;
          // Extract raw integers from both captures for ratio comparison
          const discHexes = discoveryRx.map(e => this.extractHex(e.payload).toUpperCase())
            .filter(h => h.length === primaryLenNum);
          if (discHexes.length > 0 && filteredRef.length > 0) {
            const refHex = filteredRef[filteredRef.length - 1];
            const discHex = discHexes[discHexes.length - 1];
            const extractInt = (hex: string, off: number, len: 2 | 3, end: 'BE' | 'LE') => {
              if (len === 3) {
                const a = hex.substring(off * 2, off * 2 + 2);
                const b = hex.substring(off * 2 + 2, off * 2 + 4);
                const c = hex.substring(off * 2 + 4, off * 2 + 6);
                return end === 'BE' ? parseInt(a + b + c, 16) : parseInt(c + b + a, 16);
              }
              const a = hex.substring(off * 2, off * 2 + 2);
              const b = hex.substring(off * 2 + 2, off * 2 + 4);
              return end === 'BE' ? parseInt(a + b, 16) : parseInt(b + a, 16);
            };
            const refInt = extractInt(refHex, weightOffset, weightByteLen, weightEndian);
            const discInt = extractInt(discHex, weightOffset, weightByteLen, weightEndian);
            if (discInt > 0) {
              const actualRatio = refInt / discInt;
              if (Math.abs(actualRatio - expectedRatio) < 0.02) {
                confidence += 20;
                diagnostics.push(`✅ Proportionality: ref/disc ratio ${actualRatio.toFixed(4)} ≈ expected ${expectedRatio.toFixed(4)}`);
              } else {
                diagnostics.push(`⚠️ Proportionality: ratio mismatch (${actualRatio.toFixed(4)} vs ${expectedRatio.toFixed(4)})`);
              }
            }
          }
        }
      } else if (discResult) {
        confidence += 10;
        diagnostics.push('⚠️ Cross-validation: discovery found weight at different location');
      } else {
        diagnostics.push('⚠️ Cross-validation: discovery capture did not find weight');
      }
    }

    // Step 5: Search for body fat (if target provided) — 16-bit only (BF% is always < 65535)
    let bfOffset: number | undefined;
    let bfEndian: 'BE' | 'LE' | undefined;
    let bfMultiplier: number | undefined;
    let decodedBf: number | undefined;

    if (targetBf && targetBf > 0 && refResult && filteredRef.length > 0) {
      const bfVariants = [
        { multiplier: 10, intValue: Math.round(targetBf * 10) },
        { multiplier: 100, intValue: Math.round(targetBf * 100) },
      ];

      // Build exclusion set for weight bytes (now supports 2 or 3 byte width)
      const weightBytes = new Set<number>();
      for (let i = 0; i < weightByteLen; i++) weightBytes.add(weightOffset + i);

      for (const v of bfVariants) {
        let hexStr = v.intValue.toString(16).toUpperCase().padStart(4, '0');
        const be = hexStr;
        const le = hexStr.substring(2, 4) + hexStr.substring(0, 2);

        for (const hex of filteredRef) {
          // Search BE
          let idx = hex.indexOf(be);
          if (idx !== -1 && idx % 2 === 0 && !weightBytes.has(idx / 2) && !weightBytes.has(idx / 2 + 1)) {
            bfOffset = idx / 2;
            bfEndian = 'BE';
            bfMultiplier = v.multiplier;
            decodedBf = parseInt(be, 16) / v.multiplier;
            confidence += 15;
            diagnostics.push(`✅ Body fat found: offset=${bfOffset}, endian=BE, ×${v.multiplier}, decoded=${decodedBf.toFixed(1)}%`);
            break;
          }
          // Search LE
          idx = hex.indexOf(le);
          if (idx !== -1 && idx % 2 === 0 && !weightBytes.has(idx / 2) && !weightBytes.has(idx / 2 + 1)) {
            bfOffset = idx / 2;
            bfEndian = 'LE';
            bfMultiplier = v.multiplier;
            const b1 = le.substring(0, 2);
            const b2 = le.substring(2, 4);
            decodedBf = parseInt(b2 + b1, 16) / v.multiplier;
            confidence += 15;
            diagnostics.push(`✅ Body fat found: offset=${bfOffset}, endian=LE, ×${v.multiplier}, decoded=${decodedBf.toFixed(1)}%`);
            break;
          }
        }
        if (bfOffset !== undefined) break;
      }
      if (bfOffset === undefined) {
        diagnostics.push('⚠️ Body fat not found in reference packets');
      }
    }

    // Step 5b: Wire inferImpedance() for BIA-capable scales (GAP 4)
    // If we didn't find BF by direct value match, try impedance sweep
    // using an estimated impedance range derived from weight + BF%
    let impedanceResult: { impedanceByteOffset: number; impedanceByteLength: 2 | 4; impedanceEndian: 'BE' | 'LE' } | null = null;
    if (refResult && bfOffset === undefined) {
      // Typical BIA impedance range for a human body is 200-800 Ω
      // Even without a target BF%, we can sweep this physiological range
      const impedanceRange = { low: 150, high: 900 };
      diagnostics.push(`Sweeping impedance range: ${impedanceRange.low}–${impedanceRange.high} Ω`);

      impedanceResult = this.inferImpedance(
        referenceTelemetry,
        impedanceRange,
        weightOffset,
        weightByteLen
      );

      if (impedanceResult) {
        confidence += 10;
        diagnostics.push(`✅ Impedance candidate: offset=${impedanceResult.impedanceByteOffset}, ${impedanceResult.impedanceByteLength}B ${impedanceResult.impedanceEndian}`);
        diagnostics.push(`  ℹ️ BF% will be computed client-side via calculateLocalBia(weight, impedance, userProfile)`);
      } else {
        diagnostics.push('⚠️ No impedance byte found in physiological range');
      }
    }

    // Step 6: Transition-based stability detection (GAP 5)
    // Walk through packets chronologically and find bytes that transition
    // from one value to another and then remain constant — the "stable" signal
    let stabilityOffset: number | undefined;
    let stabilityValue: number | undefined;
    if (refResult && filteredRef.length >= 3) {
      const byteCount = primaryLenNum / 2;

      // Build exclusion set: weight + BF/impedance bytes
      const excludedBytes = new Set<number>();
      for (let i = 0; i < weightByteLen; i++) excludedBytes.add(weightOffset + i);
      if (bfOffset !== undefined) { excludedBytes.add(bfOffset); excludedBytes.add(bfOffset + 1); }
      if (impedanceResult) {
        for (let i = 0; i < impedanceResult.impedanceByteLength; i++) excludedBytes.add(impedanceResult.impedanceByteOffset + i);
      }

      // For each non-excluded byte position, track the last transition index
      // A "transition" = byte value changes between consecutive packets
      // The stability byte transitions late and then stays constant
      interface ByteTransition { lastTransitionIdx: number; finalValue: number; preTransitionValue: number; stableCount: number; }
      const transitions: (ByteTransition | null)[] = new Array(byteCount).fill(null);

      for (let bytePos = 0; bytePos < byteCount; bytePos++) {
        if (excludedBytes.has(bytePos)) continue;

        let lastTransIdx = -1;
        let preVal = -1;
        let stableRun = 0;

        for (let pktIdx = 1; pktIdx < filteredRef.length; pktIdx++) {
          const prevByte = parseInt(filteredRef[pktIdx - 1].substring(bytePos * 2, bytePos * 2 + 2), 16);
          const currByte = parseInt(filteredRef[pktIdx].substring(bytePos * 2, bytePos * 2 + 2), 16);

          if (currByte !== prevByte) {
            preVal = prevByte;
            lastTransIdx = pktIdx;
            stableRun = 0;
          } else {
            stableRun++;
          }
        }

        // Candidate: byte transitioned at least once, then stayed stable for 2+ packets
        // Common pattern: 0x00 → 0x01 (Etekcity data[19])
        if (lastTransIdx > 0 && stableRun >= 2) {
          const finalVal = parseInt(filteredRef[filteredRef.length - 1].substring(bytePos * 2, bytePos * 2 + 2), 16);
          transitions[bytePos] = { lastTransitionIdx: lastTransIdx, finalValue: finalVal, preTransitionValue: preVal, stableCount: stableRun };
        }
      }

      // Pick the best candidate: transitions latest (closest to end of stream) with
      // a simple value change (prefer 0→1 or 0→non-zero)
      let bestBytePos = -1;
      let bestScore = -1;

      for (let bytePos = 0; bytePos < byteCount; bytePos++) {
        const t = transitions[bytePos];
        if (!t) continue;

        // Score: later transition = higher score, 0→1 pattern = bonus
        let score = t.lastTransitionIdx;
        if (t.preTransitionValue === 0 && t.finalValue === 1) score += 100; // Canonical stability pattern
        if (t.preTransitionValue === 0 && t.finalValue > 0) score += 50;  // Zero→non-zero
        if (t.stableCount >= 3) score += 20; // Long stable tail = more confident

        if (score > bestScore) {
          bestScore = score;
          bestBytePos = bytePos;
        }
      }

      if (bestBytePos >= 0 && transitions[bestBytePos]) {
        stabilityOffset = bestBytePos;
        stabilityValue = transitions[bestBytePos]!.finalValue;
        confidence += 15;
        diagnostics.push(`✅ Stability flag: byte ${bestBytePos} (0x${transitions[bestBytePos]!.preTransitionValue.toString(16)}→0x${stabilityValue.toString(16)}, stable for ${transitions[bestBytePos]!.stableCount} packets)`);
      } else {
        diagnostics.push('⚠️ No stability byte candidate found in primary cluster');

        // Fallback: search ALL reference hexes (unclustered) for the stability transition
        // This catches scales where the stable-packet has a different header prefix
        const allRefSameLen = referenceHexes.filter(h => h.length === primaryLenNum);
        if (allRefSameLen.length >= 3 && allRefSameLen.length > filteredRef.length) {
          diagnostics.push(`  ↳ Fallback: searching ${allRefSameLen.length} unclustered packets...`);

          const fbTransitions: (ByteTransition | null)[] = new Array(byteCount).fill(null);
          for (let bytePos = 0; bytePos < byteCount; bytePos++) {
            if (excludedBytes.has(bytePos)) continue;
            let lastTransIdx = -1;
            let preVal = -1;
            let stableRun = 0;
            for (let pktIdx = 1; pktIdx < allRefSameLen.length; pktIdx++) {
              const prevByte = parseInt(allRefSameLen[pktIdx - 1].substring(bytePos * 2, bytePos * 2 + 2), 16);
              const currByte = parseInt(allRefSameLen[pktIdx].substring(bytePos * 2, bytePos * 2 + 2), 16);
              if (currByte !== prevByte) { preVal = prevByte; lastTransIdx = pktIdx; stableRun = 0; }
              else { stableRun++; }
            }
            if (lastTransIdx > 0 && stableRun >= 2) {
              const finalVal = parseInt(allRefSameLen[allRefSameLen.length - 1].substring(bytePos * 2, bytePos * 2 + 2), 16);
              fbTransitions[bytePos] = { lastTransitionIdx: lastTransIdx, finalValue: finalVal, preTransitionValue: preVal, stableCount: stableRun };
            }
          }

          let fbBest = -1;
          let fbBestScore = -1;
          for (let bytePos = 0; bytePos < byteCount; bytePos++) {
            const t = fbTransitions[bytePos];
            if (!t) continue;
            let score = t.lastTransitionIdx;
            if (t.preTransitionValue === 0 && t.finalValue === 1) score += 100;
            if (t.preTransitionValue === 0 && t.finalValue > 0) score += 50;
            if (t.stableCount >= 3) score += 20;
            if (score > fbBestScore) { fbBestScore = score; fbBest = bytePos; }
          }

          if (fbBest >= 0 && fbTransitions[fbBest]) {
            stabilityOffset = fbBest;
            stabilityValue = fbTransitions[fbBest]!.finalValue;
            confidence += 10; // Slightly lower confidence for fallback
            diagnostics.push(`  ✅ Fallback stability flag: byte ${fbBest} (0x${fbTransitions[fbBest]!.preTransitionValue.toString(16)}→0x${stabilityValue.toString(16)}, stable for ${fbTransitions[fbBest]!.stableCount} packets)`);
          }
        }
      }
    }

    diagnostics.push(`Final confidence: ${confidence}%`);

    if (!refResult) {
      return { schema: null, confidence, diagnostics };
    }

    // Build the KiloZeroDriverSchema
    const capabilities: ('weight' | 'bodyFat')[] = ['weight'];
    if (bfOffset !== undefined || impedanceResult) capabilities.push('bodyFat');

    const schema: KiloZeroDriverSchema = {
      id: `discovered::${mac}`,
      brand: '',
      source: 'discovered',
      macPrefix: mac,
      pipeline: 'GATT_CONTINUOUS',
      notifyUUIDs: [primaryChar],
      weightByteOffset: refResult.weightByteOffset,
      weightByteLength: weightByteLen,
      weightEndian: refResult.endian,
      weightMultiplier: refResult.multiplier,
      capabilities,
      stabilityRating: Math.min(5, Math.floor(confidence / 20)),
      discoveredAt: new Date().toISOString(),
      ...(stabilityOffset !== undefined && { stabilityByteOffset: stabilityOffset, stabilityByteValue: stabilityValue }),
      ...(impedanceResult && {
        impedanceByteOffset: impedanceResult.impedanceByteOffset,
        impedanceByteLength: impedanceResult.impedanceByteLength,
        impedanceEndian: impedanceResult.impedanceEndian,
      }),
      ...(bfOffset !== undefined && {
        impedanceByteOffset: bfOffset,
        impedanceByteLength: 2 as const,
        impedanceEndian: bfEndian,
      }),
    };

    return { schema, confidence, diagnostics, decodedWeight, decodedBf, wireUnit };
  }
}

