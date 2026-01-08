import { useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// 5 Minutes Idle Threshold
const IDLE_THRESHOLD = 10 * 1000; 
// 2 Minutes Heartbeat (Ping database to say "I'm still here")
const HEARTBEAT_INTERVAL = 2 * 60 * 1000;

export function useActivityMonitor(user) {
  const timeoutRef = useRef(null);
  const heartbeatRef = useRef(null);
  const isIdle = useRef(false);

  // Helper to update status in DB
  const setStatus = async (status) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.id), {
        onlineStatus: status,
        lastSeen: serverTimestamp()
      });
    } catch (e) {
      console.error("Error updating status:", e);
    }
  };

  useEffect(() => {
    if (!user) return;

    // 1. Initial "Online" set
    setStatus('Online');

    // 2. Event Handler: Called whenever user does something
    const handleActivity = () => {
      // If they were idle, mark them online again
      if (isIdle.current) {
        isIdle.current = false;
        setStatus('Online');
      }

      // Reset the "Idle Timer"
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        isIdle.current = true;
        setStatus('Idle');
      }, IDLE_THRESHOLD);
    };

    // 3. Listen to events
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, handleActivity));

    // 4. Heartbeat Loop (Updates 'lastSeen' so we know they haven't crashed)
    heartbeatRef.current = setInterval(() => {
        if (!isIdle.current) setStatus('Online'); // Only update if active
    }, HEARTBEAT_INTERVAL);

    // 5. Cleanup when user logs out or closes tab
    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
      clearTimeout(timeoutRef.current);
      clearInterval(heartbeatRef.current);
    };
  }, [user]);
}