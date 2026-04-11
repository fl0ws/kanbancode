import React, { useEffect, useState, useCallback } from 'react';

export default function UsageBars({ collapsed }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/usage');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setUsage(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount + every 5 minutes
  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  // Tick for countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!usage?.session) return null;

  const session = usage.session;
  const resetsAt = session.resetsAt ? session.resetsAt * 1000 : 0;
  const resetMinutes = resetsAt > now ? Math.ceil((resetsAt - now) / 60000) : 0;
  const resetLabel = resetMinutes >= 60
    ? `${Math.floor(resetMinutes / 60)}h ${resetMinutes % 60}m`
    : `${resetMinutes}m`;

  // Derive a rough progress from time elapsed in the window
  const windowMs = session.rateLimitType === 'five_hour' ? 5 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const remaining = resetsAt - now;
  const elapsed = windowMs - remaining;
  const pct = Math.max(0, Math.min(100, Math.round((elapsed / windowMs) * 100)));

  const isBlocked = session.status === 'blocked';
  const barColor = isBlocked ? 'var(--red)' : pct > 80 ? 'var(--orange)' : 'var(--green)';
  const statusLabel = isBlocked ? 'Rate limited' : session.isUsingOverage ? 'Overage' : 'OK';

  if (collapsed) {
    return (
      <div
        style={styles.collapsedContainer}
        title={`Session: ${statusLabel}${resetMinutes > 0 ? ` — resets in ${resetLabel}` : ''}`}
      >
        <span className="material-symbols-outlined" style={{
          fontSize: 16,
          color: barColor,
          fontVariationSettings: isBlocked ? "'FILL' 1" : "'FILL' 0",
        }}>{isBlocked ? 'speed' : 'speed'}</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-muted)' }}>speed</span>
        <span style={styles.title}>Rate Limit</span>
        {loading && <span style={styles.loadingDot} />}
      </div>

      {/* Status line */}
      <div style={styles.statusRow}>
        <span style={{ ...styles.statusDot, background: barColor }} />
        <span style={styles.statusText}>{statusLabel}</span>
        {resetMinutes > 0 && (
          <span style={styles.resetText}>resets in {resetLabel}</span>
        )}
      </div>

      {/* Session progress */}
      <div style={styles.track}>
        <div style={{ ...styles.bar, width: `${pct}%`, background: barColor }} />
      </div>

      <div style={styles.windowLabel}>
        {session.rateLimitType === 'five_hour' ? '5-hour' : 'Hourly'} window
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '12px 14px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    marginBottom: 6,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  title: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  loadingDot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: 'var(--green)',
    marginLeft: 'auto',
    animation: 'gentle-pulse 2s ease-in-out infinite',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  resetText: {
    fontSize: 10,
    color: 'var(--text-muted)',
    marginLeft: 'auto',
  },
  track: {
    width: '100%',
    height: 4,
    background: 'var(--bg-elevated)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.5s ease',
  },
  windowLabel: {
    fontSize: 9,
    color: 'var(--text-muted)',
    marginTop: 4,
  },

  // Collapsed
  collapsedContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '6px 0',
    marginBottom: 4,
  },
};
