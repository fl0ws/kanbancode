import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import QuestionPanel from './QuestionPanel.jsx';

marked.setOptions({ breaks: false, gfm: true });

const IDLE_PHRASES = [
  'Pondering...',
  'Rummaging through code...',
  'Connecting the dots...',
  'Following the breadcrumbs...',
  'Digging deeper...',
  'Almost there...',
  'Reading between the lines...',
  'Untangling the logic...',
];

export default function ActivityLog({ activities, liveOutput, isRunning, pendingQuestions, taskId }) {
  const [tab, setTab] = useState('chat');
  const scrollRef = useRef(null);
  const [ponderStatus, setPonderStatus] = useState('');
  const idlePhraseRef = useRef(0);
  const idleTimerRef = useRef(null);

  const chatMessages = activities.filter(a => a.author !== 'system');
  const systemEvents = activities.filter(a => a.author === 'system');
  const hasThoughts = !!(liveOutput || isRunning);

  // Rotate idle phrases while running
  useEffect(() => {
    if (isRunning) {
      idlePhraseRef.current = 0;
      setPonderStatus(IDLE_PHRASES[0]);
      idleTimerRef.current = setInterval(() => {
        idlePhraseRef.current = (idlePhraseRef.current + 1) % IDLE_PHRASES.length;
        setPonderStatus(IDLE_PHRASES[idlePhraseRef.current]);
      }, 3000);
      return () => clearInterval(idleTimerRef.current);
    } else {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      setPonderStatus('');
    }
  }, [isRunning]);


  // Auto-switch to chat when questions arrive
  useEffect(() => {
    if (pendingQuestions) setTab('chat');
  }, [pendingQuestions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities, tab, liveOutput, pendingQuestions]);

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
          style={{ ...styles.tab, ...(tab === 'thoughts' ? styles.tabActive : {}) }}
          onClick={() => setTab('thoughts')}
        >
          Thoughts
          {isRunning && <span style={styles.tabPulse} />}
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
          <>
            {chatMessages.length === 0 && !pendingQuestions && (
              <p style={styles.empty}>No messages yet</p>
            )}
            {chatMessages.map(entry => (
              <ChatBubble key={entry.id} entry={entry} />
            ))}
            {isRunning && !pendingQuestions && (
              <div style={styles.bubbleRow}>
                <div style={styles.avatar}><span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>smart_toy</span></div>
                <div style={styles.ponderBubble}>
                  <span style={styles.spinner} />
                  <span style={styles.ponderText}>{ponderStatus}</span>
                </div>
              </div>
            )}
            {pendingQuestions && (
              <div style={styles.bubbleRow}>
                <div style={styles.avatar}><span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>smart_toy</span></div>
                <div style={styles.questionBubble}>
                  <QuestionPanel taskId={taskId} questions={pendingQuestions} />
                </div>
              </div>
            )}
          </>
        )}
        {tab === 'thoughts' && (
          <pre style={styles.thoughtsText}>
            {liveOutput || (isRunning ? 'Waiting for output...' : 'No activity yet')}
          </pre>
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
      {!isUser && <div style={styles.avatar}><span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>smart_toy</span></div>}
      <div style={{
        ...styles.bubble,
        ...(isUser ? styles.userBubble : styles.claudeBubble),
      }}>
        {isUser ? (
          <p style={styles.messageText}>{entry.message}</p>
        ) : (
          <div
            className="qq-markdown"
            style={styles.messageText}
            dangerouslySetInnerHTML={{ __html: marked.parse(entry.message || '') }}
          />
        )}
        <span style={{
          ...styles.timestamp,
          textAlign: isUser ? 'right' : 'left',
        }}>{formatTime(entry.timestamp)}</span>
      </div>
      {isUser && <div style={{ ...styles.avatar, ...styles.userAvatar }}><span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>person</span></div>}
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
    marginTop: 0,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    background: 'var(--bg-elevated)',
    flex: 1,
    minHeight: 0,
  },
  tabs: {
    display: 'flex',
    background: 'var(--bg-sidebar)',
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: '8px 0',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'var(--font-headline)',
    color: 'var(--text-muted)',
    background: 'none',
    borderWidth: 0,
    borderStyle: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    outline: 'none',
    cursor: 'pointer',
    transition: 'color 0.15s, border-bottom-color 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabActive: {
    color: 'var(--green)',
    borderBottomColor: 'var(--green)',
  },
  tabPulse: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--green)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    minHeight: 0,
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: 12,
    textAlign: 'center',
    padding: 16,
  },

  // Thoughts
  thoughtsText: {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--text-muted)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    fontStyle: 'italic',
    background: 'var(--purple-bg)',
    padding: 12,
    borderRadius: 'var(--radius-md)',
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
    background: 'var(--purple-bg)',
    color: 'var(--purple)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    flexShrink: 0,
  },
  userAvatar: {
    background: 'var(--green-bg)',
    color: 'var(--green)',
  },
  bubble: {
    maxWidth: '80%',
    padding: '8px 12px',
    borderRadius: 'var(--radius-lg)',
    fontSize: 13,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)',
  },
  claudeBubble: {
    background: 'var(--bg-sidebar)',
    color: 'var(--text-primary)',
    borderBottomLeftRadius: 4,
  },
  questionBubble: {
    maxWidth: '85%',
  },
  ponderBubble: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderRadius: 'var(--radius-lg)',
    borderBottomLeftRadius: 4,
    background: 'var(--purple-bg)',
    boxShadow: 'var(--shadow-sm)',
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'rgba(0,0,0,0.08)',
    borderTopColor: 'var(--purple)',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
  ponderText: {
    fontSize: 13,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  userBubble: {
    background: 'linear-gradient(135deg, #466369, #3a575d)',
    color: '#fff',
    borderBottomRightRadius: 4,
  },
  messageText: {
    margin: 0,
  },
  timestamp: {
    display: 'block',
    fontSize: 10,
    color: 'var(--text-muted)',
    marginTop: 4,
  },

  // Author labels
  authorLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  claudeAuthorLabel: {
    color: 'var(--purple)',
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
    background: 'var(--log-dot)',
    flexShrink: 0,
  },
  logMessage: {
    fontSize: 12,
    color: 'var(--text-muted)',
    flex: 1,
  },
  logTime: {
    fontSize: 11,
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
};
