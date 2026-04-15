import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../store.js';
import { fetchOutput, moveTask, stopTask, updateTask, logActivity, archiveTask, unarchiveTask, deleteTask, fetchCommands } from '../api.js';
import { useAutoResize } from '../hooks/useAutoResize.js';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import ActivityLog from './ActivityLog.jsx';
import NeedsInputBanner from './NeedsInputBanner.jsx';
import SlashCommandOverlay from './SlashCommandOverlay.jsx';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(code, { language: lang }).value; } catch {}
    }
    try { return hljs.highlightAuto(code).value; } catch {}
    return code;
  },
});

const COLUMN_LABELS = {
  not_started: 'Not Started',
  claude: 'Claude',
  your_turn: 'Your Turn',
  done: 'Done',
};

const COLUMN_TAG_STYLES = {
  not_started: { background: 'var(--bg-elevated)', color: 'var(--text-secondary)' },
  claude: { background: 'var(--purple-bg)', color: 'var(--purple)' },
  your_turn: { background: 'var(--orange-bg)', color: 'var(--orange)' },
  done: { background: 'var(--tertiary-container)', color: 'var(--tertiary)' },
};

const NEXT_COLUMN = {
  not_started: 'claude',
  claude: null,
  your_turn: 'done',
  done: null,
};

export default function TaskDetail({ taskId }) {
  const task = useStore(s => s.tasks[taskId]);
  const liveOutput = useStore(s => s.liveOutput[taskId] || '');
  const pendingQuestions = useStore(s => s.pendingQuestions[taskId] || null);
  const setSelectedTask = useStore(s => s.setSelectedTask);
  const setOutput = useStore(s => s.setOutput);
  const poolStatus = useStore(s => s.poolStatus);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [commands, setCommands] = useState([]);
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [showEditSlash, setShowEditSlash] = useState(false);
  const [editSlashFilter, setEditSlashFilter] = useState('');
  const replyRef = useRef(null);
  const editDescRef = useRef(null);
  const { handleInput: handleReplyResize, resetHeight } = useAutoResize(5);
  const { handleInput: handleEditDescResize } = useAutoResize(25);

  useEffect(() => {
    fetchCommands().then(setCommands).catch(() => {});
  }, []);

  useEffect(() => {
    fetchOutput(taskId).then(data => {
      if (data.output) setOutput(taskId, data.output);
    }).catch(() => {});
  }, [taskId]);

  function handleClose() {
    if (closing || sending) return;
    setClosing(true);
    setTimeout(() => setSelectedTask(null), 200);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); handleClose(); }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [closing, sending]);

  if (!task) return null;

  const isRunning = poolStatus.running?.includes(taskId);
  const isArchived = task.archived === 1;
  const tagStyle = COLUMN_TAG_STYLES[task.column] || COLUMN_TAG_STYLES.not_started;

  function startEdit() {
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditing(true);
  }

  // Auto-size edit textarea when entering edit mode (so existing long
  // descriptions expand on first render instead of showing a tiny scroll box)
  useEffect(() => {
    if (editing && editDescRef.current) {
      const el = editDescRef.current;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 500) + 'px';
    }
  }, [editing]);

  async function saveEdit() {
    await updateTask(taskId, { title: editTitle, description: editDesc });
    setEditing(false);
  }

  async function handleMove(column) {
    try {
      await moveTask(taskId, column);
      if (column === 'done') handleClose();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleStop() {
    await stopTask(taskId);
  }

  function handleReplyChange(e) {
    const val = e.target.value;
    setReply(val);
    handleReplyResize(e);

    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const lastLineStart = textBefore.lastIndexOf('\n') + 1;
    const currentLine = textBefore.slice(lastLineStart);

    if (currentLine.startsWith('/')) {
      setShowSlash(true);
      setSlashFilter(currentLine.slice(1));
    } else {
      setShowSlash(false);
    }
  }

  function handleSelectCommand(cmd) {
    const cursorPos = replyRef.current?.selectionStart || reply.length;
    const textBefore = reply.slice(0, cursorPos);
    const textAfter = reply.slice(cursorPos);
    const lastLineStart = textBefore.lastIndexOf('\n') + 1;
    const before = reply.slice(0, lastLineStart);
    setReply(before + cmd.template + textAfter);
    setShowSlash(false);
    setTimeout(() => {
      if (replyRef.current) {
        replyRef.current.style.height = 'auto';
        replyRef.current.style.height = Math.min(replyRef.current.scrollHeight, 100) + 'px';
        replyRef.current.focus();
      }
    }, 0);
  }

  function handleEditDescChange(e) {
    const val = e.target.value;
    setEditDesc(val);
    handleEditDescResize(e);

    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const lastLineStart = textBefore.lastIndexOf('\n') + 1;
    const currentLine = textBefore.slice(lastLineStart);

    if (currentLine.startsWith('/')) {
      setShowEditSlash(true);
      setEditSlashFilter(currentLine.slice(1));
    } else {
      setShowEditSlash(false);
    }
  }

  function handleEditSelectCommand(cmd) {
    const cursorPos = editDescRef.current?.selectionStart || editDesc.length;
    const textBefore = editDesc.slice(0, cursorPos);
    const textAfter = editDesc.slice(cursorPos);
    const lastLineStart = textBefore.lastIndexOf('\n') + 1;
    const before = editDesc.slice(0, lastLineStart);
    setEditDesc(before + cmd.template + textAfter);
    setShowEditSlash(false);
    setTimeout(() => editDescRef.current?.focus(), 0);
  }

  async function handleReply(e, closeAfter = false) {
    e.preventDefault();
    if (!reply.trim()) return;
    setShowSlash(false);
    await logActivity(taskId, 'user', reply.trim());
    setReply('');
    resetHeight(replyRef.current);
    await moveTask(taskId, 'claude');
    if (closeAfter) {
      setSending(true);
      setTimeout(() => {
        setSending(false);
        setSelectedTask(null);
      }, 400);
    }
  }

  async function handleArchive() {
    await archiveTask(taskId);
    setSelectedTask(null);
  }

  async function handleRestore() {
    await unarchiveTask(taskId);
    setSelectedTask(null);
  }

  async function handleDelete() {
    if (!confirm('Permanently delete this task?')) return;
    await deleteTask(taskId);
    setSelectedTask(null);
  }

  return (
    <div style={{ ...styles.overlay, ...(sending ? styles.overlayFading : {}), ...(closing ? styles.overlayClosing : {}) }} onClick={() => !sending && handleClose()}>
    <div style={{ ...styles.panel, ...(sending ? styles.panelSending : {}), ...(closing ? styles.panelClosing : {}) }} onClick={e => e.stopPropagation()}>
      {/* Panel Header */}
      <div style={styles.panelHeader}>
        <div style={styles.headerLeft}>
          <button style={styles.closeBtn} onClick={handleClose} title="Close">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
          <span style={{ ...styles.statusTag, ...(isArchived ? { background: 'var(--bg-elevated)', color: 'var(--text-muted)' } : tagStyle) }}>
            {isRunning && <span style={styles.statusDot} />}
            {isArchived ? 'Archived' : COLUMN_LABELS[task.column]}
          </span>
        </div>
        <div style={styles.headerRight}>
          {isArchived ? (
            <button style={styles.headerAction} onClick={handleRestore}>
              <span style={{ color: 'var(--green)' }}>Restore</span>
            </button>
          ) : (
            <>
              {task.column === 'claude' && (
                <button style={styles.headerAction} onClick={handleStop}>
                  <span style={{ color: 'var(--red)' }}>Stop</span>
                </button>
              )}
              <button style={styles.headerAction} onClick={handleArchive}>Archive</button>
            </>
          )}
        </div>
      </div>

      <div style={styles.body}>
        {/* Left: task info + actions */}
        <div style={styles.leftCol}>
          <div style={styles.leftScroll}>
            {editing ? (
              <div style={styles.editForm}>
                <input style={styles.editInput} value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                <div style={{ position: 'relative' }}>
                  <textarea
                    ref={editDescRef}
                    style={styles.editTextarea}
                    value={editDesc}
                    onChange={handleEditDescChange}
                    onKeyDown={e => { if (e.key === 'Escape' && showEditSlash) e.stopPropagation(); }}
                    rows={5}
                    placeholder='Description... Type "/" for commands'
                  />
                  {showEditSlash && (
                    <SlashCommandOverlay
                      commands={commands}
                      filter={editSlashFilter}
                      onSelect={handleEditSelectCommand}
                      onClose={() => setShowEditSlash(false)}
                      anchorRef={editDescRef}
                    />
                  )}
                </div>
                <div style={styles.editActions}>
                  <button style={styles.smallBtn} onClick={() => setEditing(false)}>Cancel</button>
                  <button style={{ ...styles.smallBtn, ...styles.btnGreen }} onClick={saveEdit}>Save</button>
                </div>
              </div>
            ) : (
              <div style={styles.taskInfo} onClick={isArchived ? undefined : startEdit}>
                <h2 style={styles.taskTitle}>{task.title}</h2>
                {task.description && (
                  <div
                    className="qq-markdown"
                    style={styles.taskDesc}
                    dangerouslySetInnerHTML={{ __html: marked.parse(task.description) }}
                  />
                )}
              </div>
            )}

            {/* Metadata */}
            {(task.working_dir || task.branch || task.conversation_id) && (
              <div style={styles.metaBox}>
                {task.working_dir && (
                  <>
                    <span style={styles.metaLabel}>Directory</span>
                    <span style={styles.metaValue}>{task.working_dir}</span>
                  </>
                )}
                {task.branch && (
                  <>
                    <span style={styles.metaLabel}>Branch</span>
                    <span style={styles.metaValue}>{task.branch}</span>
                  </>
                )}
                {task.conversation_id && (
                  <>
                    <span style={styles.metaLabel}>Session</span>
                    <span style={styles.metaValue}>{task.conversation_id.slice(0, 8)}...</span>
                  </>
                )}
              </div>
            )}

            {task.needs_input === 1 && !pendingQuestions && <NeedsInputBanner task={task} onStop={handleStop} />}
          </div>

          {!isArchived && (
            <div style={styles.quickActions}>
              {NEXT_COLUMN[task.column] && (
                <button style={{ ...styles.actionBtn, ...styles.moveBtn }} onClick={() => handleMove(NEXT_COLUMN[task.column])}>
                  Move to {COLUMN_LABELS[NEXT_COLUMN[task.column]]}
                </button>
              )}
              <button style={{ ...styles.actionBtn, ...styles.deleteBtn }} onClick={handleDelete}>Delete</button>
            </div>
          )}
        </div>

        {/* Right: chat/thoughts/log + reply */}
        <div style={styles.rightCol}>
          <ActivityLog
            activities={task.activity_log || []}
            liveOutput={liveOutput}
            isRunning={isRunning}
            pendingQuestions={pendingQuestions}
            taskId={taskId}
          />

          {task.column === 'your_turn' && (
            <form onSubmit={handleReply} style={styles.replyForm}>
              <div style={styles.replyWrapper}>
                {showSlash && (
                  <SlashCommandOverlay
                    commands={commands}
                    filter={slashFilter}
                    onSelect={handleSelectCommand}
                    onClose={() => setShowSlash(false)}
                    anchorRef={replyRef}
                  />
                )}
                <div style={styles.replyRow}>
                  <textarea
                    ref={replyRef}
                    style={styles.replyInput}
                    value={reply}
                    onChange={handleReplyChange}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && !showSlash) {
                        e.preventDefault();
                        if (reply.trim()) handleReply(e, e.ctrlKey || e.metaKey);
                      }
                    }}
                    placeholder='Reply to Claude... Type "/" for commands'
                    rows={1}
                  />
                  <button type="submit" style={styles.sendBtn} disabled={!reply.trim()}>
                    Send
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
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
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    transition: 'background 0.3s ease',
    animation: 'detail-overlay-in 0.2s ease',
  },
  overlayFading: {
    background: 'rgba(0,0,0,0)',
  },
  overlayClosing: {
    animation: 'detail-overlay-out 0.2s ease forwards',
  },
  panel: {
    width: 1400,
    maxWidth: '96vw',
    height: '85vh',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-lg)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease',
    animation: 'detail-panel-in 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
  },
  panelClosing: {
    animation: 'detail-panel-out 0.2s cubic-bezier(0.4, 0, 1, 1) forwards',
  },
  panelSending: {
    transform: 'scale(0.08) translateX(-300%)',
    opacity: 0,
    borderRadius: 40,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
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
    transition: 'background 0.15s',
  },
  statusTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 'var(--fs-sm)',
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'currentColor',
    animation: 'gentle-pulse 2.5s ease-in-out infinite',
  },
  headerAction: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    fontSize: 'var(--fs-small)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  body: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  leftCol: {
    width: 300,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  leftScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 20px',
  },
  rightCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
    padding: '8px 20px 14px',
    gap: 8,
  },
  taskInfo: {
    cursor: 'pointer',
    marginBottom: 16,
  },
  taskTitle: {
    fontFamily: 'var(--font-headline)',
    fontSize: 'var(--fs-xl)',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    marginBottom: 6,
    lineHeight: 1.3,
  },
  taskDesc: {
    fontSize: 'var(--fs-body)',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
  },
  metaBox: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '6px 14px',
    fontSize: 'var(--fs-small)',
    padding: '12px 14px',
    background: 'var(--bg-sidebar)',
    borderRadius: 'var(--radius-lg)',
    marginBottom: 14,
  },
  metaLabel: {
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  metaValue: {
    color: 'var(--text-primary)',
    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
    fontSize: 'var(--fs-caption)',
    wordBreak: 'break-all',
  },
  editForm: {
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  editInput: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 'var(--fs-base)',
    fontWeight: 600,
    fontFamily: 'var(--font-headline)',
    outline: 'none',
  },
  editTextarea: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 'var(--fs-body)',
    resize: 'none',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    minHeight: 80,
    maxHeight: 500,
    overflowY: 'auto',
    lineHeight: 1.5,
  },
  editActions: {
    display: 'flex',
    gap: 6,
    justifyContent: 'flex-end',
  },
  replyForm: {
    flexShrink: 0,
  },
  replyWrapper: {
    position: 'relative',
  },
  replyRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    background: 'var(--bg-sidebar)',
    borderRadius: 'var(--radius-lg)',
    padding: '4px 4px 4px 14px',
  },
  replyInput: {
    flex: 1,
    padding: '8px 0',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 'var(--fs-body)',
    resize: 'none',
    fontFamily: 'inherit',
    outline: 'none',
    lineHeight: '20px',
    maxHeight: 100,
    overflowY: 'auto',
  },
  sendBtn: {
    padding: '8px 14px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
    color: 'var(--text-on-accent)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'var(--font-headline)',
    transition: 'opacity 0.15s',
  },
  quickActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '12px 20px',
    flexShrink: 0,
  },
  actionBtn: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 'var(--fs-small)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  moveBtn: {
    background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
    color: 'var(--text-on-accent)',
  },
  deleteBtn: {
    color: 'var(--red)',
  },
  smallBtn: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 'var(--fs-small)',
    cursor: 'pointer',
  },
  btnGreen: {
    background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
    color: 'var(--text-on-accent)',
  },
};
