import { useCallback } from 'react';

export function useAutoResize(maxLines = 5) {
  const lineHeight = 20; // approx line height at 13px font
  const maxHeight = lineHeight * maxLines;

  const handleInput = useCallback((e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, [maxHeight]);

  const resetHeight = useCallback((el) => {
    if (el) {
      el.style.height = 'auto';
    }
  }, []);

  return { handleInput, resetHeight, maxHeight };
}
