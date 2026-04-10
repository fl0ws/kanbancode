import React, { useRef, useEffect, useState } from 'react';

export default function LiveOutput({ output, isRunning, alwaysShow }) {
  const ref = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (ref.current && autoScroll) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [output, autoScroll]);

  function handleScroll() {
    if (!ref.current) return;
    const { scrollTop, scrollHeight, clientHeight } = ref.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }

  if (!alwaysShow && !output && !isRunning) return null;

  const isEmpty = !output && !isRunning;

  return (
    <div style={alwaysShow ? styles.fillContainer : styles.wrapper}>
      <div style={styles.header}>
        {isRunning && <span style={styles.pulse} />}
        <span style={styles.label}>
          {isRunning ? 'Thinking...' : 'Thoughts'}
        </span>
        {isRunning && <span style={styles.liveBadge}>LIVE</span>}
      </div>
      <pre ref={ref} style={alwaysShow ? styles.fillOutput : styles.output} onScroll={handleScroll}>
        {isEmpty ? 'No activity yet' : (output || (isRunning ? 'Waiting for output...' : ''))}
      </pre>
    </div>
  );
}

const styles = {
  wrapper: {
    marginBottom: 12,
    borderRadius: 'var(--radius-lg)',
    background: 'var(--purple-bg)',
    overflow: 'hidden',
  },
  fillContainer: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    background: 'var(--purple-bg)',
    borderRadius: 'var(--radius-lg)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    flexShrink: 0,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--purple)',
    animation: 'pulse 1.5s ease-in-out infinite',
    flexShrink: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--purple)',
    flex: 1,
  },
  liveBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--purple)',
    background: 'var(--purple-bg)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    letterSpacing: '0.05em',
  },
  output: {
    padding: 10,
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
    maxHeight: 240,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
  },
  fillOutput: {
    flex: 1,
    padding: 10,
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
    minHeight: 0,
  },
};
