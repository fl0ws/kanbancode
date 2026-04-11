import React, { useEffect, useState } from 'react';
import { fetchAnalytics } from '../api.js';
import { useStore } from '../store.js';

function formatCycleTime(minutes) {
  if (!minutes || minutes <= 0) return '—';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function getDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2);
}

export default function VelocityInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const activeProjectId = useStore(s => s.activeProjectId);

  useEffect(() => {
    setLoading(true);
    fetchAnalytics(activeProjectId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeProjectId]);

  // Refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAnalytics(activeProjectId).then(setData).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [activeProjectId]);

  if (loading && !data) return null;
  if (!data) return null;

  const days = getLast7Days();
  const dailyMap = {};
  for (const d of data.dailyCompleted || []) dailyMap[d.day] = d.count;
  const dailyCounts = days.map(d => dailyMap[d] || 0);
  const maxCount = Math.max(...dailyCounts, 1);

  const totalActive = Object.values(data.columnCounts || {}).reduce((a, b) => a + b, 0);
  const changeSign = data.weekOverWeekChange > 0 ? '+' : '';
  const changeColor = data.weekOverWeekChange > 0 ? 'var(--tertiary)' : data.weekOverWeekChange < 0 ? 'var(--red)' : 'var(--text-muted)';

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        {/* ── Chart Panel ── */}
        <div style={styles.chartPanel}>
          <div style={styles.chartDecoration} />
          <h3 style={styles.chartTitle}>Velocity Insights</h3>

          {/* Bar chart */}
          <div style={styles.chart}>
            {dailyCounts.map((count, i) => (
              <div key={i} style={styles.barCol}>
                <div style={styles.barTrack}>
                  <div style={{
                    ...styles.bar,
                    height: `${(count / maxCount) * 100}%`,
                    background: count > 0
                      ? (i === dailyCounts.length - 1 ? 'var(--green)' : 'var(--green)')
                      : 'var(--bg-highest)',
                    opacity: count > 0 ? (0.3 + (count / maxCount) * 0.7) : 0.3,
                  }} />
                </div>
                <span style={styles.barLabel}>{getDayLabel(days[i])}</span>
              </div>
            ))}
          </div>

          {/* Chart footer */}
          <div style={styles.chartFooter}>
            <div style={styles.chartStat}>
              <span style={styles.chartStatLabel}>Weekly Throughput</span>
              <span style={{ ...styles.chartStatChange, color: changeColor }}>
                {changeSign}{data.weekOverWeekChange}% vs last week
              </span>
            </div>
          </div>
        </div>

        {/* ── Stats Cards ── */}
        <div style={styles.statsCol}>
          <StatCard
            icon="task_alt"
            label="Completed"
            value={data.completedCount}
            sub={`${data.thisWeekCompleted} this week`}
            color="var(--tertiary)"
          />
          <StatCard
            icon="timer"
            label="Avg. Cycle Time"
            value={formatCycleTime(data.avgCycleMinutes)}
            sub="created → done"
            color="var(--green)"
          />
          <StatCard
            icon="repeat"
            label="Avg. Claude Rounds"
            value={data.avgClaudeRounds ? data.avgClaudeRounds.toFixed(1) : '—'}
            sub="responses per task"
            color="var(--purple)"
          />
          <StatCard
            icon="dashboard"
            label="Active Tasks"
            value={totalActive}
            sub={`${data.totalTasks} total`}
            color="var(--orange)"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={styles.statCard}>
      <span className="material-symbols-outlined" style={{
        fontSize: 20,
        color,
        fontVariationSettings: "'FILL' 1",
      }}>{icon}</span>
      <div style={styles.statContent}>
        <span style={styles.statValue}>{value}</span>
        <span style={styles.statLabel}>{label}</span>
      </div>
      <span style={styles.statSub}>{sub}</span>
    </div>
  );
}

const styles = {
  container: {
    padding: '0 28px 28px',
    height: '100%',
    overflowY: 'auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: 20,
    alignItems: 'start',
  },

  // ── Chart Panel ──
  chartPanel: {
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: '24px 28px',
    position: 'relative',
    overflow: 'hidden',
  },
  chartDecoration: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: 'var(--green)',
    opacity: 0.03,
    filter: 'blur(40px)',
    pointerEvents: 'none',
  },
  chartTitle: {
    fontFamily: 'var(--font-headline)',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 20,
    position: 'relative',
  },
  chart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 3,
    height: 180,
    marginBottom: 16,
    position: 'relative',
  },
  barCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    height: '100%',
  },
  barTrack: {
    flex: 1,
    width: '100%',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  bar: {
    width: 8,
    minHeight: 4,
    borderRadius: 4,
    transition: 'height 0.4s ease, opacity 0.3s',
  },
  barLabel: {
    fontSize: 9,
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  chartFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartStat: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  chartStatLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  chartStatChange: {
    fontSize: 12,
    fontWeight: 500,
  },

  // ── Stats Column ──
  statsCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  statCard: {
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  statValue: {
    fontFamily: 'var(--font-headline)',
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginTop: 2,
  },
  statSub: {
    fontSize: 10,
    color: 'var(--text-muted)',
  },
};
