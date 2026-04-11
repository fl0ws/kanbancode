import React from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  DragOverlay,
} from '@dnd-kit/core';
import { useStore } from '../store.js';
import { useDragAndDrop } from '../hooks/useDragAndDrop.js';
import Column from './Column.jsx';
import TaskCard from './TaskCard.jsx';

const COLUMNS = [
  { id: 'not_started', label: 'To Do', color: 'var(--text-secondary)' },
  { id: 'claude', label: 'Claude', color: 'var(--purple)' },
  { id: 'your_turn', label: 'Your Turn', color: 'var(--orange)' },
  { id: 'done', label: 'Done', color: 'var(--tertiary)' },
];

function customCollisionDetection(args) {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return closestCenter(args);
}

export default function Board({ onAddTask }) {
  const { activeId, onDragStart, onDragOver, onDragEnd } = useDragAndDrop();
  const tasks = useStore(s => s.tasks);
  const selectedCardIds = useStore(s => s.selectedCardIds);
  const activeTask = activeId ? tasks[activeId] : null;

  // Count how many cards are being dragged
  const dragCount = activeId && selectedCardIds.size > 0 && selectedCardIds.has(activeId)
    ? selectedCardIds.size
    : 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div style={styles.board}>
        {COLUMNS.map(col => (
          <Column key={col.id} columnId={col.id} label={col.label} color={col.color} onAddTask={col.id === 'not_started' ? onAddTask : undefined} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div style={{ position: 'relative' }}>
            <TaskCard
              task={activeTask}
              color={COLUMNS.find(c => c.id === activeTask.column)?.color || 'var(--text-muted)'}
              isDragging
            />
            {dragCount > 1 && (
              <div style={styles.dragBadge}>{dragCount}</div>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const styles = {
  board: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 20,
    padding: '0 28px 16px',
    height: '100%',
    overflowX: 'auto',
    alignContent: 'start',
  },
  dragBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    background: 'var(--green)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
    boxShadow: 'var(--shadow-md)',
  },
};
