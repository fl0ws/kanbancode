import React, { useEffect, useState } from 'react';
import { useStore } from '../store.js';
import { fetchOutput, moveTask, stopTask, updateTask, logActivity, archiveTask, deleteTask } from '../api.js';
import LiveOutput from './LiveOutput.jsx';
import ActivityLog from './ActivityLog.jsx';
import NeedsInputBanner from './NeedsInputBanner.jsx';
import QuestionPanel from './QuestionPanel.jsx';

const COLUMN_LABELS = {
  not_started: 'Not Started',
  claude: 'Claude',
  your_turn: 'Your Turn',
  done: 'Done',
};

const COLUMN_COLORS = {
  not_started: '#9E9E9E',
  claude: '#7C4DFF',
  your_turn: '#FF9800',
  done: '#4CAF50',
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
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    fetchOutput(taskId).then(data => {
      if (data.output) setOutput(taskId, data.output);
    }).catch(() => {});
  }, [taskId]);

  if (!task) return null;

  const isRunning = poolStatus.running?.includes(taskId);
  const color = COLUMN_COLORS[task.column];

  function startEdit() {
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditing(true);
  }

  async function saveEdit() {
    await updateTask(taskId, { title: editTitle, description: editDesc });
    setEditing(false);
  }

  async function handleMove(column) {
    try {
      await moveTask(taskId, column);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleStop() {
    await stopTask(taskId);
  }

  async function handleReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    await logActivity(taskId, 'user', reply.trim());
    setReply('');
    await moveTask(taskId, 'claude');
  }

  async function handleArchive() {
    await archiveTask(taskId);
    setSelectedTask(null);
  }

  async function handleDelete() {
    if (!confirm('Permanently delete this task?')) return;
    await deleteTask(taskId);
    setSelectedTask(null);
  }

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <div style={styles.colIndicator}>
          <span style={{ ...styles.dot, background: color }} />
          <span style={styles.colLabel}>{COLUMN_LABELS[task.column]}</span>
        </div>
        <button style={styles.closeBtn} onClick={() => setSelectedTask(null)}>x</button>
      </div>

      <div style={styles.scrollArea}>
        {editing ? (
          <div style={styles.editForm}>
            <input style={styles.editInput} value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            <textarea style={styles.editTextarea} value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
            <div style={styles.editActions}>
              <button style={styles.smallBtn} onClick={() => setEditing(false)}>Cancel</button>
              <button style={{ ...styles.smallBtn, ...styles.btnGreen }} onClick={saveEdit}>Save</button>
            </div>
          </div>
        ) : (
          <div style={styles.taskInfo} onClick={startEdit}>
            <h3 style={styles.taskTitle}>{task.title}</h3>
            {task.description && <p style={styles.taskDesc}>{task.description}</p>}
          </div>
        )}

        {task.working_dir && (
          <div style={styles.meta}>
            <span style={styles.metaLabel}>Dir:</span>
            <span style={styles.metaValue}>{task.working_dir}</span>
          </div>
        )}
        {task.branch && (
          <div style={styles.meta}>
            <span style={styles.metaLabel}>Branch:</span>
            <span style={styles.metaValue}>{task.branch}</span>
          </div>
        )}

        {task.needs_input === 1 && !pendingQuestions && <NeedsInputBanner task={task} onStop={handleStop} />}

        {(isRunning || liveOutput) && (
          <LiveOutput output={liveOutput} isRunning={isRunning} />
        )}

        {pendingQuestions && (
          <QuestionPanel taskId={taskId} questions={pendingQuestions} />
        )}

        <ActivityLog activities={task.activity_log || []} />
      </div>

      {task.column === 'your_turn' && (
        <form onSubmit={handleReply} style={styles.replyForm}>
          <div style={styles.replyRow}>
            <textarea
              style={styles.replyInput}
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (reply.trim()) handleReply(e);
                }
              }}
              placeholder="Reply to Claude..."
              rows={1}
            />
            <button type="submit" style={styles.sendBtn} disabled={!reply.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </form>
      )}

      <div style={styles.quickActions}>
        {NEXT_COLUMN[task.column] && (
          <button style={styles.actionBtn} onClick={() => handleMove(NEXT_COLUMN[task.column])}>
            Move to {COLUMN_LABELS[NEXT_COLUMN[task.column]]}
          </button>
        )}
        {task.column === 'claude' && (
          <button style={{ ...styles.actionBtn, ...styles.stopBtn }} onClick={handleStop}>Stop</button>
        )}
        <button style={styles.actionBtn} onClick={handleArchive}>Archive</button>
        <button style={{ ...styles.actionBtn, ...styles.deleteBtn }} onClick={handleDelete}>Delete</button>
      </div>
    </div>
  );
}

const styles = {
  panel: {
    width: 460,
    flexShrink: 0,
    borderLeft: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
  },
  colIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  colLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 16,
    cursor: 'pointer',
    padding: '4px 8px',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  taskInfo: {
    cursor: 'pointer',
    marginBottom: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 4,
  },
  taskDesc: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    lineHeight: 1.5,
  },
  meta: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    marginBottom: 4,
    display: 'flex',
    gap: 6,
  },
  metaLabel: {
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  metaValue: {
    wordBreak: 'break-all',
  },
  editForm: {
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  editInput: {
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 14,
    fontWeight: 600,
  },
  editTextarea: {
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 13,
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  editActions: {
    display: 'flex',
    gap: 6,
    justifyContent: 'flex-end',
  },
  replyForm: {
    padding: '10px 16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-surface)',
  },
  replyRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    background: 'var(--bg-input)',
    borderRadius: 20,
    padding: '4px 4px 4px 14px',
    border: '1px solid var(--border)',
  },
  replyInput: {
    flex: 1,
    padding: '8px 0',
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 13,
    resize: 'none',
    fontFamily: 'inherit',
    outline: 'none',
    lineHeight: 1.4,
    maxHeight: 100,
    overflowY: 'auto',
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    background: 'var(--green)',
    color: 'var(--text-on-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  quickActions: {
    display: 'flex',
    gap: 6,
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    flexWrap: 'wrap',
  },
  actionBtn: {
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
  },
  stopBtn: {
    borderColor: 'var(--red)',
    color: 'var(--red)',
  },
  deleteBtn: {
    borderColor: 'var(--red-alpha)',
    color: 'var(--red)',
    marginLeft: 'auto',
  },
  smallBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
  },
  btnGreen: {
    background: 'var(--green)',
    borderColor: 'var(--green-dark)',
    color: 'var(--text-on-accent)',
  },
};
