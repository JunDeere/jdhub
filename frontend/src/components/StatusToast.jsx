import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

const DISPLAY_MS = 3000;

export default function StatusToast({ error, success, onDismiss }) {
  const timerRef = useRef(null);
  const dismissRef = useRef(onDismiss);
  const message = error || success;

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  const stopTimer = useCallback(() => clearTimeout(timerRef.current), []);
  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setTimeout(() => dismissRef.current?.(), DISPLAY_MS);
  }, [stopTimer]);

  useEffect(() => {
    if (!message) return undefined;
    startTimer();
    return stopTimer;
  }, [message, startTimer, stopTimer]);

  if (!message) return null;

  return (
    <div
      aria-live={error ? 'assertive' : 'polite'}
      className={`status-toast ${error ? 'is-error' : 'is-success'}`}
      onMouseEnter={stopTimer}
      onMouseLeave={startTimer}
      role="status"
    >
      {error ? <TriangleAlert size={17} /> : <CircleCheck size={17} />}
      <span>{message}</span>
      <button aria-label="Dismiss notification" onClick={onDismiss} type="button"><X size={15} /></button>
    </div>
  );
}
