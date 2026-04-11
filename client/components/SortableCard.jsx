import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '../store.js';
import TaskCard from './TaskCard.jsx';

export default function SortableCard({ task, color }) {
  const selectedCardIds = useStore(s => s.selectedCardIds);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    active,
  } = useSortable({ id: task.id });

  // When another card from the same multi-selection is being dragged, dim this card
  const isMultiDragPeer = active && active.id !== task.id
    && selectedCardIds.size > 1
    && selectedCardIds.has(task.id)
    && selectedCardIds.has(active.id);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : isMultiDragPeer ? 0.35 : 1,
    outline: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} color={color} />
    </div>
  );
}
