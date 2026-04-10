import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store.js';

const TYPE_CONFIG = {
  completed: { icon: 'check_circle', color: 'var(--green)', label: 'Completed' },
  needs_input: { icon: 'priority_high', color: 'var(--orange)', label: 'Needs Input' },
  done: { icon: 'task_alt', color: 'var(--tertiary)', label: 'Done' },
  error: { icon: 'error', color: 'var(--red)', label: 'Error' },
};

export default function NotificationBell() {
  const notifications = useStore(s => s.notifications);
  const markAllNotificationsRead = useStore(s => s.markAllNotificationsRead);
  const markNotificationRead = useStore(s => s.markNotificationRead);
  const clearNotifications = useStore(s => s.clearNotifications);
  const setSelectedTask = useStore(s => s.setSelectedTask);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function handleToggle() {
    setOpen(o => !o);
    if (!open && unreadCount > 0) {
      markAllNotificationsRead();
    }
  }

  function handleClick(n) {
    markNotificationRead(n.id);
    if (n.taskId) {
      setSelectedTask(n.taskId);
      setOpen(false);
    }
  }

  function formatTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <div ref={ref} style={styles.container}>
      <button style={styles.bellBtn} onClick={handleToggle} title="Notifications">
        <span className="material-symbols-outlined" style={{
          fontSize: 20,
          fontVariationSettings: unreadCount > 0 ? "'FILL' 1" : "'FILL' 0",
        }}>notifications</span>
        {unreadCount > 0 && (
          <span style={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <span style={styles.dropdownTitle}>Notifications</span>
            {notifications.length > 0 && (
              <button style={styles.clearBtn} onClick={clearNotifications}>Clear all</button>
            )}
          </div>

          <div style={styles.list}>
            {notifications.length === 0 ? (
              <div style={styles.empty}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--text-muted)', marginBottom: 6 }}>notifications_off</span>
                <span>No notifications yet</span>
              </div>
            ) : (
              notifications.map(n => {
                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.completed;
                return (
                  <button
                    key={n.id}
                    style={{
                      ...styles.item,
                      ...(!n.read ? styles.itemUnread : {}),
                    }}
                    onClick={() => handleClick(n)}
                  >
                    <span className="material-symbols-outlined" style={{
                      fontSize: 18,
                      color: config.color,
                      fontVariationSettings: "'FILL' 1",
                      flexShrink: 0,
                    }}>{config.icon}</span>
                    <div style={styles.itemContent}>
                      <span style={styles.itemTitle}>{n.title}</span>
                      <span style={styles.itemMessage}>{n.message}</span>
                    </div>
                    <span style={styles.itemTime}>{formatTime(n.timestamp)}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    transition: 'background 0.15s',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    background: 'var(--red)',
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
    lineHeight: 1,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: 340,
    maxHeight: 420,
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  dropdownHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 10px',
  },
  dropdownTitle: {
    fontFamily: 'var(--font-headline)',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  clearBtn: {
    border: 'none',
    background: 'none',
    color: 'var(--text-muted)',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    transition: 'color 0.15s',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 8px 8px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    color: 'var(--text-muted)',
    fontSize: 12,
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    padding: '10px 10px',
    border: 'none',
    background: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  itemUnread: {
    background: 'var(--bg-sidebar)',
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemMessage: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  itemTime: {
    fontSize: 10,
    color: 'var(--text-muted)',
    flexShrink: 0,
    marginTop: 2,
  },
};
