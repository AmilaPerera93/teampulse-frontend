import { useEffect, useRef } from 'react';
import { sendHeartbeat, saveLog } from '../services/api';

const IDLE_THRESHOLD = 2 * 1000; 
const HEARTBEAT_INTERVAL = 2 * 60 * 1000;

export function useActivityMonitor(user) {
  const timeoutRef = useRef(null);
  const heartbeatRef = useRef(null);
  const isIdle = useRef(false);
  const idleStartTime = useRef(null);

  const setStatus = (status) => {
    if (!user || !user.id || user.onlineStatus === 'Break') return; 
    sendHeartbeat(user.id, status).catch(console.error);
  };

  const logIdleTime = async () => {
    if (!idleStartTime.current || !user.id) return;
    const duration = Date.now() - idleStartTime.current;
    if (duration > 1000) { 
        try {
            await saveLog('idle', {
                userId: user.id,
                userName: user.fullname,
                startTime: idleStartTime.current,
                endTime: Date.now(),
                durationMs: duration,
                date: new Date().toISOString().split('T')[0],
                type: 'Auto-Idle'
            });
        } catch(e) { console.error(e); }
    }
    idleStartTime.current = null;
  };

  useEffect(() => {
    if (!user || user.onlineStatus === 'Break') {
        clearTimeout(timeoutRef.current);
        clearInterval(heartbeatRef.current);
        return; 
    }

    if(user.onlineStatus !== 'Online' && user.onlineStatus !== 'Idle') setStatus('Online');

    const handleActivity = () => {
      if (user.onlineStatus === 'Break') return;

      if (isIdle.current) {
        isIdle.current = false;
        logIdleTime(); 
        setStatus('Online');
      }

      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        isIdle.current = true;
        idleStartTime.current = Date.now();
        setStatus('Idle');
      }, IDLE_THRESHOLD);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, handleActivity));

    heartbeatRef.current = setInterval(() => {
        if (!isIdle.current && user.onlineStatus !== 'Break') setStatus('Online');
    }, HEARTBEAT_INTERVAL);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
      clearTimeout(timeoutRef.current);
      clearInterval(heartbeatRef.current);
    };
  }, [user?.onlineStatus]); 
}