import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store.js';
import { askQuestion, replyQuestion, stopQuestion, resetQuestion, listQuestions, loadQuestion, getQuestion, deleteQuestion, qqStatus } from '../api.js';
import { marked } from 'marked';
import { useAutoResize } from '../hooks/useAutoResize.js';

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

export default function QuickQuestion({ onClose }) {
  const activeProjectId = useStore(s => s.activeProjectId);
  const projects = useStore(s => s.projects);
  const activeProject = projects.find(p => p.id === activeProjectId);

  const [history, setHistory] = useState([]);
  const [activeQId, setActiveQId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const { handleInput: handleInputResize, resetHeight } = useAutoResize(5);
  const idlePhraseRef = useRef(0);
  const idleTimerRef = useRef(null);

  // Load history and check for active process on mount
  useEffect(() => {
    if (activeProjectId) {
      listQuestions(activeProjectId).then(setHistory).catch(() => {});

      // Check if a question is still being processed
      qqStatus().then(status => {
        if (status.active && status.questionId) {
          setIsProcessing(true);
          setActiveQId(status.questionId);
          // Load the question's existing messages
          getQuestion(status.questionId).then(q => {
            if (q?.messages) {
              setMessages(q.messages.map(m => ({ role: m.role, text: m.text })));
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [activeProjectId]);

  // Rotate idle phrases while processing
  useEffect(() => {
    if (isProcessing) {
      idlePhraseRef.current = 0;
      setStatus(IDLE_PHRASES[0]);
      idleTimerRef.current = setInterval(() => {
        idlePhraseRef.current = (idlePhraseRef.current + 1) % IDLE_PHRASES.length;
        setStatus(prev => IDLE_PHRASES.includes(prev) ? IDLE_PHRASES[idlePhraseRef.current] : prev);
      }, 3000);
      return () => clearInterval(idleTimerRef.current);
    } else {
      if (idleTimerRef.current) clearInterval(idleTimerRef.current);
      setStatus('');
    }
  }, [isProcessing]);

  // WebSocket events
  useEffect(() => {
    function handleWs(evt) {
      try {
        const data = JSON.parse(evt.data);
        if (data.event === 'qq:status') {
          setStatus(data.status);
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
          if (data.questionId) setActiveQId(data.questionId);
          if (data.result) {
            setMessages(prev => [...prev, { role: 'assistant', text: data.result }]);
          }
          // Refresh history
          if (activeProjectId) listQuestions(activeProjectId).then(setHistory).catch(() => {});
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
  }, [activeProjectId]);

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
    resetHeight(inputRef.current);
    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setIsProcessing(true);

    try {
      if (activeQId) {
        await replyQuestion(question);
      } else {
        const result = await askQuestion(question, activeProjectId);
        if (result.questionId) setActiveQId(result.questionId);
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
    setActiveQId(null);
    setIsProcessing(false);
    inputRef.current?.focus();
  }

  async function handleLoadQuestion(id) {
    if (isProcessing) return;
    try {
      await resetQuestion();
      const result = await loadQuestion(id);
      if (result.question) {
        setActiveQId(id);
        setMessages((result.question.messages || []).map(m => ({
          role: m.role,
          text: m.text,
        })));
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', text: err.message }]);
    }
  }

  async function handleDeleteQuestion(e, id) {
    e.stopPropagation();
    await deleteQuestion(id);
    setHistory(prev => prev.filter(q => q.id !== id));
    if (activeQId === id) {
      setActiveQId(null);
      setMessages([]);
      await resetQuestion();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <div style={styles.overlay} onKeyDown={handleKeyDown}>
      <div style={styles.modal}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <span style={styles.sidebarTitle}>History</span>
            <button style={styles.newBtn} onClick={handleNewConversation} title="New question">+</button>
          </div>
          <div style={styles.sidebarList}>
            {history.length === 0 && (
              <div style={styles.sidebarEmpty}>No questions yet</div>
            )}
            {history.map(q => (
              <div
                key={q.id}
                style={{
                  ...styles.sidebarItem,
                  ...(q.id === activeQId ? styles.sidebarItemActive : {}),
                }}
                onClick={() => handleLoadQuestion(q.id)}
              >
                <span style={styles.sidebarItemTitle}>{q.title}</span>
                <button
                  style={styles.sidebarDeleteBtn}
                  onClick={(e) => handleDeleteQuestion(e, q.id)}
                  title="Delete"
                >x</button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div style={styles.main}>
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <span style={styles.headerIcon}>?</span>
              <span style={styles.headerTitle}>Quick Question</span>
              {activeProject && (
                <span style={styles.headerProject}>{activeProject.name}</span>
              )}
            </div>
            <button style={styles.closeBtn} onClick={onClose} title="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
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
              <textarea
                ref={inputRef}
                style={styles.input}
                value={input}
                onChange={e => { setInput(e.target.value); handleInputResize(e); }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !isProcessing) handleSubmit(e);
                  }
                }}
                placeholder={activeQId ? 'Ask a follow-up...' : 'Ask a question about the codebase...'}
                autoFocus
                disabled={isProcessing}
                rows={1}
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
    display: 'flex',
    background: 'var(--bg-surface)',
    borderRadius: 16,
    width: 800,
    maxWidth: '92vw',
    height: 520,
    maxHeight: '80vh',
    boxShadow: 'var(--shadow-lg, 0 16px 48px rgba(0,0,0,0.2))',
    overflow: 'hidden',
  },

  // Sidebar
  sidebar: {
    width: 200,
    flexShrink: 0,
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-elevated)',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  sidebarTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  newBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  sidebarList: {
    flex: 1,
    overflowY: 'auto',
  },
  sidebarEmpty: {
    padding: 16,
    fontSize: 12,
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  sidebarItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border)',
    transition: 'background 0.1s',
  },
  sidebarItemActive: {
    background: 'var(--blue-bg)',
  },
  sidebarItemTitle: {
    flex: 1,
    fontSize: 12,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sidebarDeleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 11,
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: 3,
    flexShrink: 0,
    opacity: 0.5,
  },

  // Main chat area
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
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
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s',
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
    boxShadow: '0 2px 6px rgba(0,0,0,0.16), 0 1px 3px rgba(0,0,0,0.12)',
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
    boxShadow: '0 2px 6px rgba(0,0,0,0.16), 0 1px 3px rgba(0,0,0,0.12)',
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
    flexShrink: 0,
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
    resize: 'none',
    lineHeight: '20px',
    maxHeight: 100,
    overflowY: 'auto',
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
