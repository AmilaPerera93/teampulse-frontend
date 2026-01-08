import React, { useState, useEffect } from 'react';
import { formatMs } from '../utils/helpers';

export default function Timer({ startTime, elapsed, isRunning }) {
  const [time, setTime] = useState(elapsed || 0);

  useEffect(() => {
    // If not running, just show the static elapsed time
    if (!isRunning) {
      setTime(elapsed);
      return;
    }

    // If running, calculate difference in real-time
    const interval = setInterval(() => {
      const now = Date.now();
      const currentSession = now - startTime;
      setTime(elapsed + currentSession);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, elapsed, isRunning]);

  return (
    <div className={`font-mono text-xl font-bold tracking-tight ${isRunning ? 'text-success drop-shadow-sm' : 'text-text-main'}`}>
      {formatMs(time)}
    </div>
  );
}