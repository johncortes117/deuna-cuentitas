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

  return (
    <span
      className={`text-[13px] font-mono font-semibold ${
        isDanger
          ? 'mitimiti-timer-danger'
          : isWarning
            ? 'text-amber-500'
            : 'text-gray-400'
      }`}
    >
      ⏱ {formatTimer(seconds)}
    </span>
  );
}
