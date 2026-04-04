import React, { useRef, useEffect, useState } from 'react';

export default function LiveOutput({ output, isRunning }) {
  const ref = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (ref.current && autoScroll && !collapsed) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [output, collapsed, autoScroll]);

  function handleScroll() {
    if (!ref.current) return;
    const { scrollTop, scrollHeight, clientHeight } = ref.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }

  if (!output && !isRunning) return null;

  return (
    <div style={styles.wrapper}>
      <div style={styles.bubble}>
        <button style={styles.header} onClick={() => setCollapsed(!collapsed)}>
          <div style={styles.headerLeft}>
            {isRunning && <span style={styles.pulse} />}
            <span style={styles.chevron}>{collapsed ? '\u25b6' : '\u25bc'}</span>
            <span style={styles.label}>
              {isRunning ? 'Thinking...' : 'Thoughts'}
            </span>
          </div>
          {isRunning && (
            <span style={styles.liveBadge}>LIVE</span>
          )}
        </button>
        {!collapsed && (
          <pre ref={ref} style={styles.output} onScroll={handleScroll}>
            {output || (isRunning ? 'Waiting for output...' : '')}
          </pre>
        )}
      </div>

      {/* Thought bubble tail — three dots descending */}
      <div style={styles.tailWrap}>
        <div style={{ ...styles.tailDot, ...styles.tailDot3 }} />
        <div style={{ ...styles.tailDot, ...styles.tailDot2 }} />
        <div style={{ ...styles.tailDot, ...styles.tailDot1 }} />
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    marginBottom: 12,
    position: 'relative',
  },
  tailWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
    paddingLeft: 18,
    marginTop: 4,
  },
  tailDot: {
    borderRadius: '50%',
    background: '#EEEEEE',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#E0E0E0',
  },
  tailDot1: {
    width: 6,
    height: 6,
    marginLeft: 8,
  },
  tailDot2: {
    width: 10,
    height: 10,
    marginLeft: 3,
  },
  tailDot3: {
    width: 14,
    height: 14,
  },
  bubble: {
    background: '#EEEEEE',
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '8px 14px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#212121',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#7C4DFF',
    animation: 'pulse 1.5s ease-in-out infinite',
    flexShrink: 0,
  },
  chevron: {
    fontSize: 10,
    color: '#9E9E9E',
    width: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#757575',
    fontStyle: 'italic',
  },
  liveBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: '#7C4DFF',
    background: '#EDE7F6',
    padding: '2px 6px',
    borderRadius: 4,
    letterSpacing: '0.05em',
  },
  output: {
    padding: '4px 14px 12px',
    fontSize: 12,
    lineHeight: 1.5,
    color: '#616161',
    background: 'transparent',
    maxHeight: 240,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    fontStyle: 'italic',
  },
};
