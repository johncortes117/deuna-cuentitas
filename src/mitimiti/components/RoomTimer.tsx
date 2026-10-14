// ─── RoomTimer: Countdown de expiración ─────────────────────
import { useState, useEffect } from 'react';
import { getSecondsRemaining, formatTimer } from '../utils';

interface RoomTimerProps {
  expiresAt: string;
  onExpired?: () => void;
}

export default function RoomTimer({ expiresAt, onExpired }: RoomTimerProps) {
  const [seconds, setSeconds] = useState(() => getSecondsRemaining(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getSecondsRemaining(expiresAt);
      setSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const isDanger = seconds < 60;
  const isWarning = seconds < 300 && !isDanger;

  // "⏱ 13:05" solo no decía qué pasaba al llegar a cero; "Cierra en" sí.
  return (
    <span
      className={`text-[12px] font-semibold tabular-nums ${
        isDanger
          ? 'mitimiti-timer-danger'
          : isWarning
            ? 'text-amber-600'
            : 'text-gray-500'
      }`}
    >
      Cierra en {formatTimer(seconds)}
    </span>
  );
}
