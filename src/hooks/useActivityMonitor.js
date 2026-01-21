import { useEffect, useRef } from 'react';
import { sendHeartbeat, saveLog } from '../services/api';

const IDLE_THRESHOLD = 2 * 1000;  
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; 

export function useActivityMonitor(user) {
  const timeoutRef = useRef(null);
  const heartbeatRef = useRef(null);
  const isIdle = useRef(false);
  const idleStartTime = useRef(null);
  const userRef = useRef(user); // Keep user updated without re-running effect

  // Update ref whenever user changes
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const setStatus = (status) => {
    if (!user || !user.id || user.onlineStatus === 'Break') return;
    sendHeartbeat(user.id, status).catch(console.error);
  };

  const logIdleTime = async () => {
    if (!idleStartTime.current || !userRef.current?.id) return;
    const duration = Date.now() - idleStartTime.current;
    
    // Only log if idle time is more than 6 seconds
    if (duration > 6000) {
      try {
        await saveLog('idle', {
          userId: userRef.current.id,
          userName: userRef.current.fullname,
          startTime: idleStartTime.current,
          endTime: Date.now(),
          durationMs: duration,
          date: new Date().toISOString().split('T')[0],
          type: 'Auto-Idle'
        });
        console.log(`Logged idle time: ${duration}ms`);
      } catch (e) {
        console.error('Failed to log idle time:', e);
      }
    }
    idleStartTime.current = null;
  };

  useEffect(() => {
    if (!user || user.onlineStatus === 'Break') {
      clearTimeout(timeoutRef.current);
      clearInterval(heartbeatRef.current);
      return;
    }

    // Set initial status to Online
    if (user.onlineStatus !== 'Online' && user.onlineStatus !== 'Idle') {
      setStatus('Online');
    }

    const handleActivity = () => {
      if (userRef.current?.onlineStatus === 'Break') return;

      if (isIdle.current) {
        isIdle.current = false;
        logIdleTime(); // Will log async, status changes immediately
        setStatus('Online');
        console.log('Activity detected - Returning to Online');
      }

      // Reset the idle timer
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        isIdle.current = true;
        idleStartTime.current = Date.now();
        setStatus('Idle');
        console.log('Idle timeout triggered');
      }, IDLE_THRESHOLD);
    };

    // Add event listeners
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, handleActivity));

    // Send initial heartbeat
    setStatus('Online');

    // Send periodic heartbeats to keep session alive
    heartbeatRef.current = setInterval(() => {
      if (!isIdle.current && userRef.current?.onlineStatus !== 'Break') {
        setStatus('Online');
        console.log('Heartbeat sent');
      }
    }, HEARTBEAT_INTERVAL);

    // Cleanup
    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
      clearTimeout(timeoutRef.current);
      clearInterval(heartbeatRef.current);
      
      // Log any pending idle time on unmount
      if (isIdle.current && idleStartTime.current) {
        logIdleTime();
      }
    };
  }, [user?.id, user?.onlineStatus]); // Watch both user.id and onlineStatus
}