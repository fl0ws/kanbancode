import { useCallback, useRef, useState } from 'react';
import { useStore } from '../store.js';
import { moveTask, reorderTasks, fetchTasks } from '../api.js';

export function useDragAndDrop() {
  const [activeId, setActiveId] = useState(null);
  const store = useStore;
  const dragOrigin = useRef(null); // track where the drag started

  const findColumn = useCallback((taskId) => {
    const columns = store.getState().columns;
    for (const [col, ids] of Object.entries(columns)) {
      if (ids.includes(taskId)) return col;
    }
    return null;
  }, []);

  function onDragStart(event) {
    setActiveId(event.active.id);
    dragOrigin.current = findColumn(event.active.id);
  }

  function onDragOver(event) {
    const { active, over } = event;
    if (!over) return;

    const activeCol = findColumn(active.id);
    let overCol = findColumn(over.id);
    if (!overCol) {
      if (['not_started', 'claude', 'your_turn', 'done'].includes(over.id)) {
        overCol = over.id;
      } else {
        return;
      }
    }

    if (activeCol === overCol) return;

    const state = store.getState();
    const targetIds = [...state.columns[overCol]];
    const overIndex = over.id === overCol ? targetIds.length : targetIds.indexOf(over.id);
    const insertAt = overIndex === -1 ? targetIds.length : overIndex;

    state.optimisticMove(active.id, activeCol, overCol, insertAt);
  }

  function onDragEnd(event) {
    const { active, over } = event;
    const originCol = dragOrigin.current;
    setActiveId(null);
    dragOrigin.current = null;

    if (!over) {
      // Dropped outside — rollback if column changed
      if (originCol) {
        fetchTasks().then(tasks => store.getState().setTasks(tasks));
      }
      return;
    }

    const currentCol = findColumn(active.id);
    if (!currentCol) return;

    const state = store.getState();
    const colIds = [...state.columns[currentCol]];
    const overIndex = over.id === currentCol
      ? colIds.length - 1
      : colIds.indexOf(over.id);
    const activeIndex = colIds.indexOf(active.id);

    // Within-column reorder
    if (originCol === currentCol && activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      const newIds = [...colIds];
      newIds.splice(activeIndex, 1);
      newIds.splice(overIndex, 0, active.id);
      state.reorderColumn(currentCol, newIds);

      reorderTasks(currentCol, newIds).catch(() => {
        fetchTasks().then(tasks => store.getState().setTasks(tasks));
      });
    }

    // Cross-column move — compare against where the drag started
    if (originCol && originCol !== currentCol) {
      moveTask(active.id, currentCol).catch(() => {
        fetchTasks().then(tasks => store.getState().setTasks(tasks));
      });
    }
  }

  return { activeId, onDragStart, onDragOver, onDragEnd };
}
