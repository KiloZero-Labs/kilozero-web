'use client';

import React, { useState } from 'react';

export default function EverydayTelemetryDashboard({ stats, driverStats }: { stats: any[], driverStats: any[] }) {
  const [filter, setFilter] = useState('all');

  const filteredStats = stats.filter(s => {
    if (filter === 'success') return s.success;
    if (filter === 'failed') return !s.success;
    return true;
  });

  return (
    <div className="telemetry-dashboard">
      <div className="stats-cards" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div className="stat-card" style={{ padding: '1.5rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', flex: 1 }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#166534' }}>Total Successes</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#15803d' }}>
            {stats.filter(s => s.success).length}
          </p>
        </div>
        <div className="stat-card" style={{ padding: '1.5rem', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', flex: 1 }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#991b1b' }}>Total Failures</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#b91c1c' }}>
            {stats.filter(s => !s.success).length}
          </p>
        </div>
        <div className="stat-card" style={{ padding: '1.5rem', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', flex: 1 }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#075985' }}>Total Drivers Tested</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0, color: '#0369a1' }}>
            {driverStats.length}
          </p>
        </div>
      </div>

      <div className="driver-performance" style={{ marginBottom: '2rem' }}>
        <h2>Driver Reliability Ranking</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Driver ID</th>
              <th>Success Rate</th>
              <th>Total Weigh-Ins</th>
              <th>Successes</th>
              <th>Failures</th>
            </tr>
          </thead>
          <tbody>
            {driverStats.map(ds => (
              <tr key={ds.driverId}>
                <td style={{ fontWeight: 'bold' }}>{ds.driverId}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '100px', backgroundColor: '#e5e7eb', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${ds.successRate}%`, backgroundColor: ds.successRate >= 90 ? '#10b981' : ds.successRate >= 70 ? '#f59e0b' : '#ef4444', height: '100%' }} />
                    </div>
                    <span>{ds.successRate}%</span>
                  </div>
                </td>
                <td>{ds.total}</td>
                <td>{ds.success}</td>
                <td>{ds.total - ds.success}</td>
              </tr>
            ))}
            {driverStats.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>No telemetry data received yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="recent-weigh-ins">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Recent Weigh-Ins</h2>
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
          >
            <option value="all">All Weigh-Ins</option>
            <option value="success">Successes Only</option>
            <option value="failed">Failures Only</option>
          </select>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Contributor</th>
              <th>Device</th>
              <th>Driver ID</th>
              <th>Result</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {filteredStats.map(s => (
              <tr key={s.id}>
                <td>{new Date(s.timestamp).toLocaleString()}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.85em', color: '#6b7280' }}>
                  {s.contributorId.substring(0, 8)}...
                </td>
                <td>
                  {s.deviceName || 'Unknown'} <br/>
                  <span style={{ fontSize: '0.8em', color: '#6b7280' }}>{s.deviceId}</span>
                </td>
                <td>{s.driverId}</td>
                <td>
                  {s.success ? (
                    <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.85em', fontWeight: 'bold' }}>Success</span>
                  ) : (
                    <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.85em', fontWeight: 'bold' }}>Failed</span>
                  )}
                </td>
                <td>
                  {s.parsedWeightKg ? `${s.parsedWeightKg.toFixed(1)} kg` : 'N/A'}
                </td>
              </tr>
            ))}
            {filteredStats.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280' }}>No records match filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
