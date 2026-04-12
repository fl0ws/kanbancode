import React, { useEffect } from 'react';
import { useModalClose } from '../hooks/useModalClose.js';

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Esc'], desc: 'Close panel / clear selection' },
      { keys: ['?'], desc: 'Toggle this shortcut guide' },
    ],
  },
  {
    title: 'Tasks',
    shortcuts: [
      { keys: ['N'], desc: 'Create new task' },
      { keys: ['Ctrl', 'Space'], desc: 'Quick question' },
      { keys: ['Ctrl', 'Click'], desc: 'Multi-select cards' },
      { keys: ['Delete'], desc: 'Delete selected cards' },
    ],
  },
  {
    title: 'Board',
    shortcuts: [
      { keys: ['Drag'], desc: 'Move card between columns' },
      { keys: ['Ctrl', 'Drag'], desc: 'Move all selected cards' },
      { keys: ['Right-click'], desc: 'Card context menu' },
    ],
  },
  {
    title: 'Chat',
    shortcuts: [
      { keys: ['Enter'], desc: 'Send reply' },
      { keys: ['Shift', 'Enter'], desc: 'New line in reply' },
      { keys: ['Ctrl', 'Enter'], desc: 'Send and close panel' },
      { keys: ['/'], desc: 'Slash commands in reply' },
    ],
  },
];

export default function KeyboardShortcutsModal({ onClose }) {
  const { closing, handleClose, overlayStyle, modalStyle } = useModalClose(onClose);
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        handleClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleClose]);

  return (
    <div style={{ ...styles.overlay, ...overlayStyle }} onClick={handleClose}>
      <div style={{ ...styles.modal, ...modalStyle }} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Keyboard Shortcuts</h2>
          <button style={styles.closeBtn} onClick={handleClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div style={styles.body}>
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title} style={styles.group}>
              <h3 style={styles.groupTitle}>{group.title}</h3>
              <div style={styles.shortcuts}>
                {group.shortcuts.map(s => (
                  <div key={s.desc} style={styles.row}>
                    <div style={styles.keys}>
                      {s.keys.map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span style={styles.plus}>+</span>}
                          <kbd style={styles.kbd}>{key}</kbd>
                        </span>
                      ))}
                    </div>
                    <span style={styles.desc}>{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--overlay)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-lg)',
    width: 480,
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 22px 14px',
  },
  title: {
    fontFamily: 'var(--font-headline)',
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: '0 22px 22px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  group: {},
  groupTitle: {
    fontFamily: 'var(--font-headline)',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
  },
  shortcuts: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-sidebar)',
  },
  keys: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 8px',
    minWidth: 24,
    height: 24,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-surface)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px var(--border)',
    fontFamily: 'var(--font-body)',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  plus: {
    fontSize: 10,
    color: 'var(--text-muted)',
    margin: '0 2px',
  },
  desc: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
};
