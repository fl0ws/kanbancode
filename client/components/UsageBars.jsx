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
      if (!data.error) setUsage(data);
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

  if (!usage) return null;
  const { session, weekly } = usage;
  if (!session && !weekly) return null;

  if (collapsed) {
    const pct = session?.percentUsed ?? weekly?.percentUsed ?? 0;
    const color = barColor(pct);
    return (
      <div
        style={styles.collapsedContainer}
        title={`Session: ${session?.percentUsed ?? '?'}% · Weekly: ${weekly?.percentUsed ?? '?'}%`}
      >
        <span className="material-symbols-outlined" style={{
          fontSize: 16,
          color,
        }}>speed</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-muted)' }}>speed</span>
        <span style={styles.title}>Usage</span>
        {loading && <span style={styles.loadingDot} />}
      </div>

      {session && (
        <UsageRow
          label="Session"
          percentUsed={session.percentUsed}
          resetInfo={session.resetInfo}
        />
      )}

      {weekly && (
        <UsageRow
          label="Weekly"
          percentUsed={weekly.percentUsed}
          resetInfo={weekly.resetInfo}
        />
      )}
    </div>
  );
}

function UsageRow({ label, percentUsed, resetInfo }) {
  const color = barColor(percentUsed);

  return (
    <div style={styles.row}>
      <div style={styles.labelRow}>
        <span style={styles.label}>{label}</span>
        <span style={{ ...styles.value, color }}>{percentUsed}%</span>
      </div>
      <div style={styles.track}>
        <div style={{ ...styles.bar, width: `${percentUsed}%`, background: color }} />
      </div>
      {resetInfo && (
        <span style={styles.resetLabel}>Resets {resetInfo}</span>
      )}
    </div>
  );
}

function barColor(pct) {
  if (pct >= 80) return 'var(--red)';
  if (pct >= 50) return 'var(--orange)';
  return 'var(--green)';
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
    marginBottom: 10,
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
  row: {
    marginBottom: 8,
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  value: {
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-headline)',
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
  resetLabel: {
    fontSize: 9,
    color: 'var(--text-muted)',
    marginTop: 3,
    display: 'block',
  },
  collapsedContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '6px 0',
    marginBottom: 4,
  },
};
