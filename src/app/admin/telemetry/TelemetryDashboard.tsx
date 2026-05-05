'use client';

import { useState, useMemo } from 'react';
import { FaChevronDown, FaChevronRight, FaCheckCircle, FaTimesCircle, FaMicrochip, FaFlask, FaSearch, FaFilter, FaSortAmountDown, FaExternalLinkAlt } from 'react-icons/fa';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface Submission {
  id: string;
  fingerprint: string;
  deviceName: string;
  deviceId: string;
  driverId: string;
  scaleBrand: string;
  scaleModel: string;
  success: boolean;
  userRating: number;
  driverRating: number;
  failureMode: string;
  comment: string;
  trafficLogSize: number;
  hasDynamicSchema: boolean;
  status: string;
  timestamp: string;
}

interface DeviceGroup {
  fingerprint: string;
  brand: string;
  model: string;
  submissions: Submission[];
  totalSubmissions: number;
  successRate: number;
  avgRating: number;
  latestTimestamp: string;
  hasSchema: boolean;
}

type StatusFilter = 'all' | 'new' | 'reviewed' | 'archived';
type SortKey = 'latest' | 'count' | 'rating' | 'success';

// ─────────────────────────────────────────────────────────────────
// Visual Helpers
// ─────────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(rating ?? 0);
  return (
    <span style={{ letterSpacing: '2px', color: '#f59e0b', fontSize: '0.85rem' }}>
      {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
    </span>
  );
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
      padding: '0.15rem 0.55rem', borderRadius: '9999px',
      fontSize: '0.65rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{status}</span>
  );
}

function SuccessIndicator({ success }: { success: boolean }) {
  return success
    ? <FaCheckCircle style={{ color: '#22c55e', fontSize: '0.9rem' }} />
    : <FaTimesCircle style={{ color: '#ef4444', fontSize: '0.9rem' }} />;
}

function SuccessRateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 36 }}>{pct}%</span>
    </div>
  );
}

function formatDate(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ts; }
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

export default function TelemetryDashboard({ submissions }: { submissions: Submission[] }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('latest');

  // ── Group by device fingerprint ──
  const groups: DeviceGroup[] = useMemo(() => {
    const groupMap = new Map<string, Submission[]>();

    for (const sub of submissions) {
      const key = sub.fingerprint || `${sub.scaleBrand}::${sub.scaleModel}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(sub);
    }

    return Array.from(groupMap.entries()).map(([fingerprint, subs]) => {
      const successCount = subs.filter(s => s.success).length;
      const ratings = subs.map(s => s.userRating).filter(r => r > 0);
      return {
        fingerprint,
        brand: subs[0].scaleBrand || 'Unknown',
        model: subs[0].scaleModel || 'Unknown',
        submissions: subs,
        totalSubmissions: subs.length,
        successRate: subs.length > 0 ? successCount / subs.length : 0,
        avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
        latestTimestamp: subs[0].timestamp,
        hasSchema: subs.some(s => s.hasDynamicSchema),
      };
    });
  }, [submissions]);

  // ── Filter & Sort ──
  const filteredGroups = useMemo(() => {
    let result = groups;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(g =>
        g.brand.toLowerCase().includes(q) ||
        g.model.toLowerCase().includes(q) ||
        g.fingerprint.toLowerCase().includes(q) ||
        g.submissions.some(s => s.deviceName.toLowerCase().includes(q) || s.driverId.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(g => g.submissions.some(s => s.status === statusFilter));
    }

    // Sort
    const sorters: Record<SortKey, (a: DeviceGroup, b: DeviceGroup) => number> = {
      latest: (a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime(),
      count: (a, b) => b.totalSubmissions - a.totalSubmissions,
      rating: (a, b) => b.avgRating - a.avgRating,
      success: (a, b) => b.successRate - a.successRate,
    };
    result = [...result].sort(sorters[sortKey]);

    return result;
  }, [groups, searchQuery, statusFilter, sortKey]);

  // ── Summary stats ──
  const totalSubs = submissions.length;
  const totalDevices = groups.length;
  const newCount = submissions.filter(s => s.status === 'new').length;
  const overallSuccess = totalSubs > 0
    ? Math.round(submissions.filter(s => s.success).length / totalSubs * 100)
    : 0;

  const toggleGroup = (fp: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(fp) ? next.delete(fp) : next.add(fp);
      return next;
    });
  };

  return (
    <div>
      {/* ── Summary Cards ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.75rem', marginBottom: '1.25rem',
      }}>
        {[
          { label: 'Total Submissions', value: totalSubs, icon: <FaFlask style={{ color: '#3b82f6' }} /> },
          { label: 'Unique Devices', value: totalDevices, icon: <FaMicrochip style={{ color: '#8b5cf6' }} /> },
          { label: 'Awaiting Review', value: newCount, icon: <FaSearch style={{ color: '#f59e0b' }} /> },
          { label: 'Overall Success', value: `${overallSuccess}%`, icon: <FaCheckCircle style={{ color: '#22c55e' }} /> },
        ].map((card) => (
          <div key={card.label} style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 10,
            padding: '0.85rem 1rem', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <div style={{ fontSize: '1.1rem' }}>{card.icon}</div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{card.value}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', gap: '0.75rem', marginBottom: '1rem',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <FaSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }} />
          <input
            type="text"
            placeholder="Search brand, model, driver..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <FaFilter style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }} />
          {(['all', 'new', 'reviewed', 'archived'] as StatusFilter[]).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{
              padding: '0.35rem 0.7rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
              background: statusFilter === f ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: statusFilter === f ? '#fff' : 'var(--text-muted)',
              border: 'none', cursor: 'pointer', textTransform: 'capitalize',
            }}>{f}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <FaSortAmountDown style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }} />
          {([
            { key: 'latest' as SortKey, label: 'Latest' },
            { key: 'count' as SortKey, label: 'Count' },
            { key: 'rating' as SortKey, label: 'Rating' },
            { key: 'success' as SortKey, label: 'Success' },
          ]).map(s => (
            <button key={s.key} onClick={() => setSortKey(s.key)} style={{
              padding: '0.35rem 0.7rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
              background: sortKey === s.key ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: sortKey === s.key ? '#fff' : 'var(--text-muted)',
              border: 'none', cursor: 'pointer',
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* ── Device Groups ── */}
      {filteredGroups.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem', color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {submissions.length === 0
            ? '📡 No probe submissions yet. Waiting for beta testers...'
            : '🔍 No submissions match your filters.'
          }
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredGroups.map(group => {
            const isExpanded = expandedGroups.has(group.fingerprint);
            return (
              <div key={group.fingerprint} style={{
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                overflow: 'hidden', background: 'rgba(255,255,255,0.02)',
              }}>
                {/* ── Group Header ── */}
                <div
                  onClick={() => toggleGroup(group.fingerprint)}
                  style={{
                    display: 'grid', gridTemplateColumns: '24px 2fr 1fr 1fr 1fr 80px',
                    alignItems: 'center', padding: '0.75rem 1rem', cursor: 'pointer',
                    transition: 'background 0.15s',
                    background: isExpanded ? 'rgba(59,130,246,0.06)' : 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = isExpanded ? 'rgba(59,130,246,0.06)' : 'transparent')}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                  </span>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {group.brand}
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                        {group.model}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {group.fingerprint}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {group.totalSubmissions}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      submissions
                    </div>
                  </div>

                  <div>
                    <SuccessRateBar rate={group.successRate} />
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <StarRating rating={group.avgRating} />
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>avg rating</div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                    {group.hasSchema && (
                      <span title="Has discovered schema" style={{
                        backgroundColor: '#8b5cf6', color: '#fff',
                        padding: '0.15rem 0.45rem', borderRadius: '9999px',
                        fontSize: '0.6rem', fontWeight: 700,
                      }}>SCHEMA</span>
                    )}
                  </div>
                </div>

                {/* ── Expanded: Individual Submissions ── */}
                {isExpanded && (
                  <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    padding: '0.5rem',
                  }}>
                    {/* Column headers */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '24px 2fr 1fr 1fr 1fr 1.5fr 50px',
                      padding: '0.3rem 0.75rem', fontSize: '0.6rem', fontWeight: 700,
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      <span />
                      <span>Device / Driver</span>
                      <span>Status</span>
                      <span>Result</span>
                      <span>Rating</span>
                      <span>Notes</span>
                      <span></span>
                    </div>

                    {group.submissions.map(sub => {
                      const isDetailExpanded = expandedSubmission === sub.id;
                      return (
                        <div key={sub.id}>
                          <div
                            onClick={() => setExpandedSubmission(isDetailExpanded ? null : sub.id)}
                            style={{
                              display: 'grid', gridTemplateColumns: '24px 2fr 1fr 1fr 1fr 1.5fr 50px',
                              alignItems: 'center', padding: '0.5rem 0.75rem', cursor: 'pointer',
                              borderRadius: 6, transition: 'background 0.1s',
                              background: isDetailExpanded ? 'rgba(139,92,246,0.06)' : 'transparent',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                            onMouseLeave={e => (e.currentTarget.style.background = isDetailExpanded ? 'rgba(139,92,246,0.06)' : 'transparent')}
                          >
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                              {isDetailExpanded ? <FaChevronDown /> : <FaChevronRight />}
                            </span>

                            <div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                {sub.deviceName}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {sub.driverId} · {formatDate(sub.timestamp)}
                              </div>
                            </div>

                            <div><StatusBadge status={sub.status} /></div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <SuccessIndicator success={sub.success} />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {sub.success ? 'Pass' : 'Fail'}
                              </span>
                            </div>

                            <div><StarRating rating={sub.userRating} /></div>

                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sub.failureMode || sub.comment || '—'}
                            </div>

                            <div style={{ textAlign: 'center' }}>
                              <a
                                href={`/admin/telemetry/${sub.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Open in new window"
                                style={{
                                  color: '#3b82f6', fontSize: '0.75rem',
                                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                  textDecoration: 'none', opacity: 0.7,
                                  transition: 'opacity 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                              >
                                <FaExternalLinkAlt size={10} />
                              </a>
                            </div>
                          </div>

                          {/* ── Submission Detail Panel ── */}
                          {isDetailExpanded && (
                            <div style={{
                              margin: '0 0.75rem 0.5rem 2.5rem',
                              padding: '0.75rem 1rem',
                              background: 'rgba(0,0,0,0.2)', borderRadius: 8,
                              border: '1px solid rgba(255,255,255,0.06)',
                              fontSize: '0.75rem',
                            }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div><strong style={{ color: 'var(--text-muted)' }}>Submission ID:</strong> <code style={{ fontSize: '0.7rem' }}>{sub.id}</code></div>
                                <div><strong style={{ color: 'var(--text-muted)' }}>MAC:</strong> <code style={{ fontSize: '0.7rem' }}>{sub.deviceId}</code></div>
                                <div><strong style={{ color: 'var(--text-muted)' }}>Driver:</strong> {sub.driverId}</div>
                                <div><strong style={{ color: 'var(--text-muted)' }}>Driver Rating:</strong> <StarRating rating={sub.driverRating} /></div>
                                <div><strong style={{ color: 'var(--text-muted)' }}>Traffic Log:</strong> {sub.trafficLogSize} packets</div>
                                <div><strong style={{ color: 'var(--text-muted)' }}>Schema:</strong> {sub.hasDynamicSchema ? '✅ Discovered' : '—'}</div>
                              </div>
                              {sub.failureMode && (
                                <div style={{ marginTop: '0.5rem' }}>
                                  <strong style={{ color: 'var(--text-muted)' }}>Failure Mode:</strong> {sub.failureMode}
                                </div>
                              )}
                              {sub.comment && (
                                <div style={{ marginTop: '0.3rem' }}>
                                  <strong style={{ color: 'var(--text-muted)' }}>Comment:</strong> {sub.comment}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
