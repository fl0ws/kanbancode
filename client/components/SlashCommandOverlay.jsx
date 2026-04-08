import React, { useState, useEffect, useRef } from 'react';

export default function SlashCommandOverlay({ commands, onSelect, onClose, filter }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef(null);

  const filtered = commands.filter(cmd =>
    cmd.name.includes(filter.toLowerCase()) || cmd.description.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [filtered, selectedIndex]);

  // Scroll selected into view
  useEffect(() => {
    if (ref.current) {
      const el = ref.current.children[selectedIndex];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  return (
    <div style={styles.overlay}>
      <div ref={ref} style={styles.list}>
        {filtered.map((cmd, i) => (
          <div
            key={cmd.id}
            style={{
              ...styles.item,
              ...(i === selectedIndex ? styles.itemActive : {}),
            }}
            onClick={() => onSelect(cmd)}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            <span style={styles.name}>/{cmd.name}</span>
            <span style={styles.desc}>{cmd.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 4,
    zIndex: 10,
  },
  list: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.15))',
    maxHeight: 200,
    overflowY: 'auto',
    padding: '4px 0',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  itemActive: {
    background: 'var(--blue-bg)',
  },
  name: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--blue)',
    flexShrink: 0,
  },
  desc: {
    fontSize: 12,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
