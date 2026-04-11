import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store.js';
import { moveTask, archiveTask, deleteTask, stopTask } from '../api.js';

export default function TaskCard({ task, color, isDragging = false }) {
  const setSelectedTask = useStore(s => s.setSelectedTask);
  const toggleCardSelection = useStore(s => s.toggleCardSelection);
  const selectedTaskId = useStore(s => s.selectedTaskId);
  const selectedCardIds = useStore(s => s.selectedCardIds);
  const poolStatus = useStore(s => s.poolStatus);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);

  const isSelected = selectedTaskId === task.id;
  const isMultiSelected = selectedCardIds.has(task.id);
  const isRunning = poolStatus.running?.includes(task.id);
  const isQueued = poolStatus.queued?.includes(task.id);
  const isDone = task.column === 'done';

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  function handleClick(e) {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      toggleCardSelection(task.id);
    } else {
      setSelectedTask(task.id);
    }
  }

  function clampMenu(x, y) {
    const menuW = 190, menuH = 260;
    const vw = window.innerWidth, vh = window.innerHeight;
    return {
      x: Math.min(x, vw - menuW - 8),
      y: Math.min(y, vh - menuH - 8),
    };
  }

  function handleContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos(clampMenu(e.clientX, e.clientY));
    setMenuOpen(true);
  }

  function handleDotsClick(e) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    // Prefer opening to the left of the button so it doesn't overflow on right-side columns
    const x = rect.left - 180;
    setMenuPos(clampMenu(Math.max(8, x), rect.bottom + 4));
    setMenuOpen(o => !o);
  }

  async function handleAction(action) {
    setMenuOpen(false);
    try {
      switch (action) {
        case 'open': setSelectedTask(task.id); break;
        case 'to_claude': await moveTask(task.id, 'claude'); break;
        case 'to_done': await moveTask(task.id, 'done'); break;
        case 'to_your_turn': await moveTask(task.id, 'your_turn'); break;
        case 'to_not_started': await moveTask(task.id, 'not_started'); break;
        case 'stop': await stopTask(task.id); break;
        case 'archive': await archiveTask(task.id); break;
        case 'delete':
          if (confirm('Permanently delete this task?')) await deleteTask(task.id);
          break;
      }
    } catch (err) {
      alert(err.message);
    }
  }

  // Build menu items based on column
  const menuItems = [
    { action: 'open', icon: 'open_in_new', label: 'Open' },
  ];

  if (task.column === 'not_started') {
    menuItems.push({ action: 'to_claude', icon: 'smart_toy', label: 'Send to Claude' });
    menuItems.push({ action: 'to_done', icon: 'check_circle', label: 'Move to Done' });
  } else if (task.column === 'claude') {
    menuItems.push({ action: 'stop', icon: 'stop_circle', label: 'Stop', danger: true });
  } else if (task.column === 'your_turn') {
    menuItems.push({ action: 'to_claude', icon: 'smart_toy', label: 'Send to Claude' });
    menuItems.push({ action: 'to_done', icon: 'check_circle', label: 'Move to Done' });
  } else if (task.column === 'done') {
    menuItems.push({ action: 'to_not_started', icon: 'replay', label: 'Reopen' });
  }

  menuItems.push({ divider: true });
  menuItems.push({ action: 'archive', icon: 'inventory_2', label: 'Archive' });
  menuItems.push({ action: 'delete', icon: 'delete', label: 'Delete', danger: true });

  return (
    <div
      style={{
        ...styles.card,
        ...(isSelected || isMultiSelected ? styles.cardSelected : {}),
        ...(isDone ? styles.cardDone : {}),
        opacity: isDragging ? 0.5 : 1,
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Left accent bar */}
      <div style={{
        ...styles.accent,
        ...(isRunning ? { opacity: 1, background: 'var(--purple)' } :
            isSelected || isMultiSelected ? { opacity: 1, background: color } : {}),
      }} />

      {/* Status tag row */}
      {(isRunning || isQueued || task.needs_input === 1) && (
        <div style={styles.tagRow}>
          {isRunning && (
            <span style={styles.runningTag}>
              <span style={styles.runningDot} />
              Running
            </span>
          )}
          {isQueued && <span style={styles.queuedTag}>Queued</span>}
          {task.needs_input === 1 && (
            <span style={styles.inputTag}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>priority_high</span>
              Needs Input
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button style={styles.dotsBtn} onClick={handleDotsClick}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>more_horiz</span>
          </button>
        </div>
      )}

      {isDone && (
        <div style={styles.tagRow}>
          <span style={styles.doneTag}>Done</span>
          <div style={{ flex: 1 }} />
          <button style={styles.dotsBtn} onClick={handleDotsClick}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>more_horiz</span>
          </button>
        </div>
      )}

      {/* For cards without a tag row, show dots on hover */}
      {!isRunning && !isQueued && task.needs_input !== 1 && !isDone && (
        <button style={styles.dotsBtnFloat} onClick={handleDotsClick}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>more_horiz</span>
        </button>
      )}

      <span style={{
        ...styles.title,
        ...(isDone ? styles.titleDone : {}),
      }}>{task.title}</span>

      {task.description && (
        <p style={{
          ...styles.desc,
          ...(isDone ? { color: 'var(--text-muted)' } : {}),
        }}>{task.description.slice(0, 100)}{task.description.length > 100 ? '...' : ''}</p>
      )}

      <div style={styles.footer}>
        <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--text-muted)' }}>schedule</span>
        <span style={styles.timeTag}>{task.updated_at ? formatRelativeTime(task.updated_at) : ''}</span>
      </div>

      {/* Context menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            ...styles.menu,
            position: 'fixed',
            left: menuPos.x,
            top: menuPos.y,
          }}
        >
          {menuItems.map((item, i) =>
            item.divider ? (
              <div key={i} style={styles.menuDivider} />
            ) : (
              <button
                key={item.action}
                style={{
                  ...styles.menuItem,
                  ...(item.danger ? styles.menuItemDanger : {}),
                }}
                onClick={() => handleAction(item.action)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(ts) {
  try {
    const now = Date.now();
    const then = new Date(ts + 'Z').getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(ts + 'Z').toLocaleDateString();
  } catch {
    return '';
  }
}

const styles = {
  card: {
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 16px',
    paddingLeft: 20,
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    position: 'relative',
    overflow: 'visible',
  },
  cardSelected: {
    boxShadow: 'var(--shadow-md)',
  },
  cardDone: {
    opacity: 0.75,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: '0 3px 3px 0',
    opacity: 0,
    transition: 'opacity 0.15s',
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  runningTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--purple-bg)',
    color: 'var(--purple)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  runningDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'var(--purple)',
    animation: 'gentle-pulse 2.5s ease-in-out infinite',
  },
  queuedTag: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  inputTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--orange-bg)',
    color: 'var(--orange)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  doneTag: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--bg-highest)',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  title: {
    fontFamily: 'var(--font-headline)',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    display: 'block',
    marginBottom: 4,
  },
  titleDone: {
    color: 'var(--text-secondary)',
    textDecoration: 'line-through',
    textDecorationColor: 'var(--text-muted)',
  },
  desc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    lineHeight: 1.5,
    marginBottom: 10,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  timeTag: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  dotsBtn: {
    width: 22,
    height: 22,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s, background 0.15s',
    flexShrink: 0,
  },
  dotsBtnFloat: {
    position: 'absolute',
    top: 10,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'opacity 0.15s',
  },
  menu: {
    zIndex: 300,
    minWidth: 180,
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-dropdown)',
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 10px',
    border: 'none',
    background: 'none',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  menuItemDanger: {
    color: 'var(--red)',
  },
  menuDivider: {
    height: 1,
    background: 'var(--border)',
    margin: '3px 6px',
  },
};
