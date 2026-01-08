import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const TimerContext = createContext();

export function useTimer() {
  return useContext(TimerContext);
}

export function TimerProvider({ children }) {
  const { currentUser } = useAuth();
  const [activeTask, setActiveTask] = useState(null);
  const [activeInterruption, setActiveInterruption] = useState(null);

  useEffect(() => {
    if (!currentUser) return;

    // 1. Listen for MY active task
    const qTask = query(
      collection(db, 'tasks'), 
      where('assignedTo', '==', currentUser.fullname),
      where('isRunning', '==', true)
    );
    
    const unsubTask = onSnapshot(qTask, (snap) => {
      if (!snap.empty) {
        setActiveTask({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setActiveTask(null);
      }
    });

    // 2. Listen for Power Cuts
    const qInt = query(
        collection(db, 'interruptions'),
        where('user', '==', currentUser.fullname),
        where('active', '==', true)
    );
    const unsubInt = onSnapshot(qInt, (snap) => {
        if(!snap.empty) setActiveInterruption({ id: snap.docs[0].id, ...snap.docs[0].data() });
        else setActiveInterruption(null);
    });

    return () => { unsubTask(); unsubInt(); };
  }, [currentUser]);

  const startTask = async (task) => {
    if (activeInterruption) return alert("Cannot start work during a Power Cut!");
    
    // Stop current if exists
    if (activeTask) {
       const dur = Date.now() - activeTask.lastStartTime;
       await updateDoc(doc(db, 'tasks', activeTask.id), { isRunning: false, elapsedMs: (activeTask.elapsedMs||0) + dur, lastStartTime: null });
    }

    // Start new
    await updateDoc(doc(db, 'tasks', task.id), { isRunning: true, lastStartTime: Date.now(), status: 'In Progress' });
  };

  const stopTask = async () => {
    if (!activeTask) return;
    const dur = Date.now() - activeTask.lastStartTime;
    await updateDoc(doc(db, 'tasks', activeTask.id), { isRunning: false, elapsedMs: (activeTask.elapsedMs||0) + dur, lastStartTime: null });
  };

  return (
    <TimerContext.Provider value={{ activeTask, activeInterruption, startTask, stopTask }}>
      {children}
    </TimerContext.Provider>
  );
}