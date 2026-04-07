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
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    overflow: 'hidden',
  },
  fillContainer: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'var(--bg-input)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--green, #3fb950)',
    animation: 'pulse 1.5s ease-in-out infinite',
    flexShrink: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    flex: 1,
  },
  liveBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--purple, #7C4DFF)',
    background: 'var(--purple-light-bg, rgba(124,77,255,0.1))',
    padding: '2px 6px',
    borderRadius: 4,
    letterSpacing: '0.05em',
  },
  output: {
    padding: 10,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--text-muted)',
    background: 'var(--bg-elevated)',
    maxHeight: 240,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    fontStyle: 'italic',
  },
  fillOutput: {
    flex: 1,
    padding: 10,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--text-muted)',
    background: 'var(--bg-elevated)',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    fontStyle: 'italic',
    minHeight: 0,
  },
};
