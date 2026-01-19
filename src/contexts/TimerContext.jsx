import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useDate } from './DateContext'; // Need date for fetching today's tasks
import { fetchTasks, saveTask, saveLog } from '../services/api';

const TimerContext = createContext();

export function useTimer() {
  return useContext(TimerContext);
}

export function TimerProvider({ children }) {
  const { currentUser } = useAuth();
  const { globalDate } = useDate();
  const [activeTask, setActiveTask] = useState(null);
  const [activeInterruption, setActiveInterruption] = useState(null);

  // --- 1. POLL FOR ACTIVE TASK ---
  // Replaces onSnapshot. Checks server every 10 seconds.
  useEffect(() => {
    if (!currentUser) return;

    const syncState = async () => {
      try {
        // Fetch tasks to find the running one
        const tasks = await fetchTasks(currentUser.fullname, globalDate);
        const running = tasks.find(t => t.isRunning);
        
        // Only update if state is different (prevents re-renders)
        setActiveTask(prev => (prev?.id === running?.id && prev?.isRunning === running?.isRunning) ? prev : (running || null));

        // Note: For Interruptions, we assume local state is primary for now. 
        // If you need multi-device interruption sync, we would need a fetchInterruptions API.
      } catch (error) {
        console.error("Timer Sync Error:", error);
      }
    };

    syncState();
    const interval = setInterval(syncState, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [currentUser?.fullname, globalDate]);

  // --- ACTIONS ---

  const startTask = async (task) => {
    if (activeInterruption) return alert("Cannot start work during a Power Cut!");
    
    // Optimistic Update (Update UI immediately)
    const prevTask = activeTask;
    setActiveTask({ ...task, isRunning: true, lastStartTime: Date.now() });

    try {
        // 1. Stop previous task if exists
        if (prevTask) {
            const dur = Date.now() - prevTask.lastStartTime;
            await saveTask({ ...prevTask, isRunning: false, elapsedMs: (prevTask.elapsedMs||0) + dur, lastStartTime: null });
        }
        // 2. Start new task
        await saveTask({ ...task, isRunning: true, lastStartTime: Date.now(), status: 'In Progress' });
    } catch (e) {
        console.error("Start failed", e);
        setActiveTask(prevTask); // Revert on error
        alert("Failed to start task. Check connection.");
    }
  };

  const stopTask = async () => {
    if (!activeTask) return;

    const taskToStop = activeTask;
    setActiveTask(null); // Optimistic clear

    try {
        const dur = Date.now() - taskToStop.lastStartTime;
        await saveTask({ 
            ...taskToStop, 
            isRunning: false, 
            elapsedMs: (taskToStop.elapsedMs||0) + dur, 
            lastStartTime: null 
        });
    } catch (e) {
        console.error("Stop failed", e);
        setActiveTask(taskToStop); // Revert
    }
  };

  // --- POWER CUT HANDLER ---
  const togglePowerCut = async () => {
      if(!currentUser) return;

      if (activeInterruption) {
          // STOP POWER CUT
          const endTime = Date.now();
          const startTime = activeInterruption.startTime;
          const duration = endTime - startTime;

          setActiveInterruption(null); // Optimistic UI

          try {
             if(duration > 1000) {
                // Save to power_logs
                await saveLog('power', {
                    userId: currentUser.id,
                    userName: currentUser.fullname,
                    startTime: startTime,
                    endTime: endTime,
                    durationMs: duration,
                    date: new Date().toISOString().split('T')[0]
                });
             }
             // We don't need to "delete" the interruption from DB like Firestore
             // because in Azure we just create a new log entry for the record.
             // If you store "Active Interruptions" in a separate container, you would delete it here.
             // For now, we assume saveLog handles the logic.
          } catch (e) { console.error(e); }

      } else {
          // START POWER CUT
          const newInt = {
              userId: currentUser.id,
              user: currentUser.fullname,
              active: true,
              startTime: Date.now(),
              type: 'Power Cut'
          };
          
          setActiveInterruption(newInt); // Optimistic UI

          if(activeTask) await stopTask();

          try {
              await saveLog('interruption', newInt);
          } catch(e) {
              console.error(e);
              setActiveInterruption(null); // Revert
          }
      }
  };

  return (
    <TimerContext.Provider value={{ activeTask, activeInterruption, startTask, stopTask, togglePowerCut }}>
      {children}
    </TimerContext.Provider>
  );
}