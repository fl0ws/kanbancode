import React, { useState, useEffect, useRef } from 'react';

export default function SlashCommandOverlay({ commands, onSelect, onClose, filter, anchorRef }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);
  const overlayRef = useRef(null);
  const [pos, setPos] = useState({ bottom: 0, left: 0, width: 300 });

  const filtered = commands.filter(cmd =>
    cmd.name.includes(filter.toLowerCase()) || cmd.description.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Position the overlay above the anchor element
  useEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [anchorRef, filter]);

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

  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  const style = anchorRef ? {
    position: 'fixed',
    bottom: pos.bottom,
    left: pos.left,
    width: pos.width,
    zIndex: 300,
  } : {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 4,
    zIndex: 300,
  };

  return (
    <div ref={overlayRef} style={style}>
      <div ref={listRef} style={styles.list}>
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
            <span style={styles.name}><span style={styles.slash}>/</span>{cmd.name}</span>
            <span style={styles.desc}>{cmd.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  list: {
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-dropdown)',
    maxHeight: 200,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: 4,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    borderRadius: 'var(--radius-md)',
  },
  itemActive: {
    background: 'var(--bg-elevated)',
  },
  name: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    flexShrink: 0,
  },
  slash: {
    color: 'var(--green)',
  },
  desc: {
    fontSize: 11,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
