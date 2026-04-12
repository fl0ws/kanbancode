import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useStore } from '../store.js';
import { createTask } from '../api.js';
import SortableCard from './SortableCard.jsx';

export default function Column({ columnId, label, color, onAddTask }) {
  const taskIds = useStore(s => s.columns[columnId]);
  const tasks = useStore(s => s.tasks);
  const activeProjectId = useStore(s => s.activeProjectId);
  const [fileDragOver, setFileDragOver] = useState(false);

  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  const isNotStarted = columnId === 'not_started';
  const isDone = columnId === 'done';

  function handleDragOver(e) {
    if (!isNotStarted) return;
    const hasFiles = e.dataTransfer?.types?.includes('Files');
    if (hasFiles) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setFileDragOver(true);
    }
  }

  function handleDragLeave() {
    setFileDragOver(false);
  }

  async function handleDrop(e) {
    setFileDragOver(false);
    if (!isNotStarted) return;
    const files = [...(e.dataTransfer?.files || [])].filter(f => f.name.endsWith('.md'));
    if (files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();

    for (const file of files) {
      const content = await file.text();
      const title = file.name.replace(/\.md$/i, '').replace(/[-_]/g, ' ');
      await createTask({ title, description: content, project_id: activeProjectId });
    }
  }

  // Column count badge color based on column type
  const countStyle = columnId === 'claude'
    ? { background: 'var(--purple-bg)', color: 'var(--purple)' }
    : columnId === 'your_turn'
    ? { background: 'var(--orange-bg)', color: 'var(--orange)' }
    : columnId === 'done'
    ? { background: 'var(--tertiary-container)', color: 'var(--tertiary)' }
    : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)' };

  return (
    <div
      style={{
        ...styles.column,
        ...(isOver ? { background: 'var(--bg-elevated)' } : {}),
        ...(fileDragOver ? { outline: '2px dashed var(--green)', outlineOffset: -2 } : {}),
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div style={styles.header}>
        <span style={{
          ...styles.label,
          color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)',
        }}>{label}</span>
        <span style={{ ...styles.count, ...countStyle }}>{taskIds.length}</span>
        <div style={{ flex: 1 }} />
        {onAddTask && (
          <button style={styles.addBtn} onClick={onAddTask} title="New task">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
          </button>
        )}
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={styles.list}>
          {fileDragOver && (
            <div style={styles.dropHint}>Drop .md files to create tasks</div>
          )}
          {taskIds.map(id => {
            const task = tasks[id];
            if (!task) return null;
            return <SortableCard key={id} task={task} color={color} />;
          })}
          {onAddTask && (
            <button style={styles.addCardBtn} onClick={onAddTask}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
              Add New Task
            </button>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

const styles = {
  column: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 120,
    transition: 'background 0.2s',
    borderRadius: 'var(--radius-xl)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px 8px',
  },
  label: {
    fontFamily: 'var(--font-headline)',
    fontSize: 'var(--fs-caption)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  count: {
    fontSize: 'var(--fs-sm)',
    fontWeight: 700,
    padding: '1px 7px',
    borderRadius: 10,
  },
  addBtn: {
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
    transition: 'color 0.15s',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 2px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 60,
  },
  addCardBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    padding: '14px 8px',
    border: '2px dashed var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'none',
    color: 'var(--text-muted)',
    fontSize: 'var(--fs-small)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
  },
  dropHint: {
    padding: '14px 8px',
    textAlign: 'center',
    fontSize: 'var(--fs-small)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-lg)',
    border: '2px dashed var(--border)',
    background: 'var(--bg-input)',
  },
};
