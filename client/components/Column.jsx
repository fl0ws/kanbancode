import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useStore } from '../store.js';
import SortableCard from './SortableCard.jsx';

export default function Column({ columnId, label, color, onAddTask }) {
  const taskIds = useStore(s => s.columns[columnId]);
  const tasks = useStore(s => s.tasks);

  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div style={{
      ...styles.column,
      ...(isOver ? { borderColor: color + '66' } : {}),
    }}>
      <div style={styles.header}>
        <span style={{ ...styles.dot, background: color }} />
        <span style={styles.label}>{label}</span>
        <span style={styles.count}>{taskIds.length}</span>
        {onAddTask && (
          <button style={styles.addBtn} onClick={onAddTask} title="New task">+</button>
        )}
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={styles.list}>
          {taskIds.map(id => {
            const task = tasks[id];
            if (!task) return null;
            return <SortableCard key={id} task={task} color={color} />;
          })}
        </div>
      </SortableContext>
    </div>
  );
}

const styles = {
  column: {
    flex: '1 1 0',
    minWidth: 260,
    maxWidth: 340,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-surface)',
    borderRadius: 12,
    borderWidth: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
    overflow: 'hidden',
    transition: 'border-color 0.2s',
    boxShadow: 'var(--shadow-sm)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  count: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    marginLeft: 'auto',
    background: 'var(--border)',
    padding: '2px 8px',
    borderRadius: 10,
  },
  addBtn: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: 'none',
    background: 'var(--green)',
    color: 'var(--text-on-accent)',
    fontSize: 16,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minHeight: 60,
  },
};
