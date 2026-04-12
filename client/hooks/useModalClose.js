import { useState, useCallback } from 'react';

const DURATION = 180; // ms — matches CSS animation

export function useModalClose(onClose) {
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onClose(), DURATION);
  }, [closing, onClose]);

  const overlayStyle = closing
    ? { animation: `modal-overlay-out ${DURATION}ms ease forwards` }
    : { animation: `modal-overlay-in ${DURATION}ms ease` };

  const modalStyle = closing
    ? { animation: `modal-out ${DURATION}ms cubic-bezier(0.4, 0, 1, 1) forwards` }
    : { animation: `modal-in 200ms cubic-bezier(0.2, 0.9, 0.3, 1)` };

  return { closing, handleClose, overlayStyle, modalStyle };
}
