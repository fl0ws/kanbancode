import React, { useState, useRef, useEffect } from 'react';

export default function ActivityLog({ activities }) {
  const [tab, setTab] = useState('chat');
  const scrollRef = useRef(null);

  const chatMessages = activities.filter(a => a.author !== 'system');
  const systemEvents = activities.filter(a => a.author === 'system');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities, tab]);

  if (!activities.length) return null;

  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'chat' ? styles.tabActive : {}) }}
          onClick={() => setTab('chat')}
        >
          Chat{chatMessages.length > 0 ? ` (${chatMessages.length})` : ''}
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'log' ? styles.tabActive : {}) }}
          onClick={() => setTab('log')}
        >
          Log{systemEvents.length > 0 ? ` (${systemEvents.length})` : ''}
        </button>
      </div>

      <div ref={scrollRef} style={styles.scrollArea}>
        {tab === 'chat' && (
          chatMessages.length === 0
            ? <p style={styles.empty}>No messages yet</p>
            : chatMessages.map(entry => (
                <ChatBubble key={entry.id} entry={entry} />
              ))
        )}
        {tab === 'log' && (
          systemEvents.length === 0
            ? <p style={styles.empty}>No events</p>
            : systemEvents.map(entry => (
                <LogEntry key={entry.id} entry={entry} />
              ))
        )}
      </div>
    </div>
  );
}

function ChatBubble({ entry }) {
  const isUser = entry.author === 'user';

  return (
    <div style={{
      ...styles.bubbleRow,
      justifyContent: isUser ? 'flex-end' : 'flex-start',
    }}>
      {!isUser && <div style={styles.avatar}>🤖</div>}
      <div style={{
        ...styles.bubble,
        ...(isUser ? styles.userBubble : styles.claudeBubble),
      }}>
        <p style={styles.messageText}>{entry.message}</p>
        <span style={{
          ...styles.timestamp,
          textAlign: isUser ? 'right' : 'left',
        }}>{formatTime(entry.timestamp)}</span>
      </div>
      {isUser && <div style={{ ...styles.avatar, ...styles.userAvatar }}>🧑</div>}
    </div>
  );
}

function LogEntry({ entry }) {
  return (
    <div style={styles.logEntry}>
      <span style={styles.logDot} />
      <span style={styles.logMessage}>{entry.message}</span>
      <span style={styles.logTime}>{formatTime(entry.timestamp)}</span>
    </div>
  );
}

function formatTime(ts) {
  try {
    const d = new Date(ts + 'Z');
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

const styles = {
  container: {
    marginTop: 16,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 10,
    border: '1px solid #E0E0E0',
    overflow: 'hidden',
    background: '#FAFAFA',
    flex: 1,
    minHeight: 0,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #E0E0E0',
    background: '#F5F5F5',
  },
  tab: {
    flex: 1,
    padding: '8px 0',
    fontSize: 12,
    fontWeight: 500,
    color: '#9E9E9E',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: '#212121',
    borderBottomColor: '#1976D2',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    minHeight: 0,
  },
  empty: {
    color: '#9E9E9E',
    fontSize: 12,
    textAlign: 'center',
    padding: 16,
  },

  // Chat bubbles
  bubbleRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: '#E8F5E9',
    color: '#4CAF50',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    flexShrink: 0,
  },
  userAvatar: {
    background: '#E3F2FD',
    color: '#1976D2',
  },
  bubble: {
    maxWidth: '78%',
    padding: '8px 12px',
    borderRadius: 16,
    lineHeight: 1.4,
  },
  claudeBubble: {
    background: '#4CAF50',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    background: '#1976D2',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 13,
    color: '#FFFFFF',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
  },
  timestamp: {
    display: 'block',
    fontSize: 10,
    color: '#ffffffbb',
    marginTop: 4,
  },

  // Log entries
  logEntry: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
  },
  logDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#BDBDBD',
    flexShrink: 0,
  },
  logMessage: {
    fontSize: 12,
    color: '#757575',
    flex: 1,
  },
  logTime: {
    fontSize: 11,
    color: '#9E9E9E',
    flexShrink: 0,
  },
};
