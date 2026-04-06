import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store.js';
import { askQuestion, replyQuestion, stopQuestion, resetQuestion } from '../api.js';
import { marked } from 'marked';

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

export default function QuickQuestion({ onClose }) {
  const activeProjectId = useStore(s => s.activeProjectId);
  const projects = useStore(s => s.projects);
  const activeProject = projects.find(p => p.id === activeProjectId);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const idlePhraseRef = useRef(0);
  const idleTimerRef = useRef(null);

  // Rotate idle phrases while processing
  useEffect(() => {
    if (isProcessing) {
      idlePhraseRef.current = 0;
      setStatus(IDLE_PHRASES[0]);
      idleTimerRef.current = setInterval(() => {
        idlePhraseRef.current = (idlePhraseRef.current + 1) % IDLE_PHRASES.length;
        setStatus(prev => {
          // Only rotate if it's an idle phrase (not a real status from server)
          if (IDLE_PHRASES.includes(prev)) {
            return IDLE_PHRASES[idlePhraseRef.current];
          }
          return prev;
        });
      }, 3000);
      return () => clearInterval(idleTimerRef.current);
    } else {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      setStatus('');
    }
  }, [isProcessing]);

  // Listen for WebSocket events
  useEffect(() => {
    function handleWs(evt) {
      try {
        const data = JSON.parse(evt.data);
        if (data.event === 'qq:status') {
          setStatus(data.status);
          // Reset idle rotation timer so the real status shows for a bit
          if (idleTimerRef.current) {
            clearInterval(idleTimerRef.current);
            idleTimerRef.current = setInterval(() => {
              idlePhraseRef.current = (idlePhraseRef.current + 1) % IDLE_PHRASES.length;
              setStatus(IDLE_PHRASES[idlePhraseRef.current]);
            }, 3000);
          }
        }
        if (data.event === 'qq:finished') {
          setIsProcessing(false);
          setHasConversation(true);
          if (data.result) {
            setMessages(prev => [...prev, { role: 'assistant', text: data.result }]);
          }
          setTimeout(() => inputRef.current?.focus(), 50);
        }
        if (data.event === 'qq:error') {
          setIsProcessing(false);
          setMessages(prev => [...prev, { role: 'error', text: data.error }]);
        }
      } catch {}
    }

    window.addEventListener('qq-ws-message', handleWs);
    return () => window.removeEventListener('qq-ws-message', handleWs);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setIsProcessing(true);

    try {
      if (hasConversation) {
        await replyQuestion(question);
      } else {
        await askQuestion(question, activeProjectId);
      }
    } catch (err) {
      setIsProcessing(false);
      setMessages(prev => [...prev, { role: 'error', text: err.message }]);
    }
  }

  async function handleStop() {
    await stopQuestion();
    setIsProcessing(false);
  }

  async function handleNewConversation() {
    await resetQuestion();
    setMessages([]);
    setHasConversation(false);
    setIsProcessing(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <div style={styles.overlay} onKeyDown={handleKeyDown}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.headerIcon}>?</span>
            <span style={styles.headerTitle}>Quick Question</span>
            {activeProject && (
              <span style={styles.headerProject}>{activeProject.name}</span>
            )}
          </div>
          <div style={styles.headerRight}>
            {hasConversation && (
              <button style={styles.newBtn} onClick={handleNewConversation}>New</button>
            )}
            <button style={styles.closeBtn} onClick={onClose}>x</button>
          </div>
        </div>

        <div ref={scrollRef} style={styles.chatArea}>
          {messages.length === 0 && !isProcessing && (
            <div style={styles.placeholder}>
              Ask anything about the codebase.
              <br />Claude will search and read files to answer.
              <br /><br />
              <span style={styles.shortcut}>Ctrl+Space</span> to toggle
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              ...styles.messageRow,
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {msg.role === 'assistant' && <div style={styles.assistantAvatar}>🤖</div>}
              {msg.role === 'error' && <div style={styles.errorAvatar}>!</div>}
              {msg.role === 'assistant' ? (
                <div
                  style={{ ...styles.bubble, ...styles.assistantBubble }}
                  className="qq-markdown"
                  dangerouslySetInnerHTML={{ __html: marked.parse(msg.text || '') }}
                />
              ) : (
                <div style={{
                  ...styles.bubble,
                  ...(msg.role === 'user' ? styles.userBubble : {}),
                  ...(msg.role === 'error' ? styles.errorBubble : {}),
                }}>
                  {msg.text}
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div style={styles.statusRow}>
              <div style={styles.statusBubble}>
                <span style={styles.spinner} />
                <span style={styles.statusText}>{status}</span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={styles.inputArea}>
          <div style={styles.inputRow}>
            <input
              ref={inputRef}
              style={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={hasConversation ? 'Ask a follow-up...' : 'Ask a question about the codebase...'}
              autoFocus
              disabled={isProcessing}
            />
            {isProcessing ? (
              <button type="button" style={styles.stopBtn} onClick={handleStop}>Stop</button>
            ) : (
              <button type="submit" style={styles.sendBtn} disabled={!input.trim()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: 'var(--bg-surface)',
    borderRadius: 16,
    width: 600,
    maxWidth: '90vw',
    height: 500,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-lg, 0 16px 48px rgba(0,0,0,0.2))',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'var(--blue)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  headerProject: {
    fontSize: 11,
    color: 'var(--text-muted)',
    background: 'var(--bg-input)',
    padding: '2px 8px',
    borderRadius: 4,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  newBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 16,
    cursor: 'pointer',
    padding: '4px 8px',
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  placeholder: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: 13,
    lineHeight: 1.6,
    padding: '40px 20px',
  },
  shortcut: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    fontSize: 12,
    fontFamily: 'monospace',
    color: 'var(--text-secondary)',
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--blue-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
  },
  errorAvatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--red-alpha, #f8514922)',
    color: 'var(--red)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '80%',
    padding: '8px 12px',
    borderRadius: 14,
    fontSize: 13,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: 'var(--text-primary)',
  },
  userBubble: {
    background: 'var(--blue)',
    color: '#fff',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    background: 'var(--bg-input)',
    borderBottomLeftRadius: 4,
    whiteSpace: 'normal',
  },
  errorBubble: {
    background: 'var(--red-alpha, #f8514922)',
    color: 'var(--red)',
    borderBottomLeftRadius: 4,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  statusBubble: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    background: 'var(--bg-input)',
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: '2px solid var(--border)',
    borderTopColor: 'var(--blue)',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
  statusText: {
    fontSize: 13,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  inputArea: {
    padding: '10px 16px',
    borderTop: '1px solid var(--border)',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--bg-input)',
    borderRadius: 20,
    padding: '4px 4px 4px 14px',
    border: '1px solid var(--border)',
  },
  input: {
    flex: 1,
    padding: '8px 0',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    background: 'var(--blue)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  stopBtn: {
    padding: '6px 12px',
    borderRadius: 16,
    border: '1px solid var(--red)',
    background: 'var(--bg-elevated)',
    color: 'var(--red)',
    fontSize: 12,
    cursor: 'pointer',
    flexShrink: 0,
  },
};
