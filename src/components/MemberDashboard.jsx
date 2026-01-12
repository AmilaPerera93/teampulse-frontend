import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useDate } from '../contexts/DateContext'; 
import { formatMs } from '../utils/helpers';
import Timer from './Timer';
import { Play, Pause, CheckCircle, ZapOff, Calendar } from 'lucide-react';

export default function MemberDashboard() {
  const { currentUser } = useAuth();
  const { globalDate } = useDate(); 
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentInterruption, setCurrentInterruption] = useState(null);

  useEffect(() => {
    if (!currentUser) return;

    // 1. LISTEN TO TASKS
    const qTasks = query(
        collection(db, 'tasks'), 
        where('assignedTo', '==', currentUser.fullname)
        // Optimization: You could add limit(50) here if history gets too big later
    );

    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // FILTER LOGIC:
      const relevantTasks = allTasks.filter(t => t.date === globalDate || t.isRunning === true);
      
      relevantTasks.sort((a, b) => {
        if (a.isRunning && !b.isRunning) return -1;
        if (!a.isRunning && b.isRunning) return 1;
        return 0;
      });
      setTasks(relevantTasks);
      setLoading(false);
    });

    // 2. LISTEN TO INTERRUPTIONS
    const qInt = query(
        collection(db, 'interruptions'), 
        where('user', '==', currentUser.fullname),
        where('active', '==', true),
        limit(1)
    );
    const unsubInt = onSnapshot(qInt, (snap) => {
        if (!snap.empty) {
            setCurrentInterruption({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
            setCurrentInterruption(null);
        }
    });

    return () => { unsubTasks(); unsubInt(); };
    
    // --- CRITICAL FIX BELOW: ---
    // Changed [currentUser] to [currentUser.id, currentUser.fullname]
    // This prevents re-fetching when the "Heartbeat" updates lastSeen.
  }, [currentUser.id, currentUser.fullname, globalDate]); 

  // --- ACTIONS ---

  const toggleTimer = async (task) => {
    if (currentInterruption) {
        alert("POWER CUT ACTIVE: You cannot start tasks until you report that power is back.");
        return;
    }

    const taskRef = doc(db, 'tasks', task.id);
    if (task.isRunning) {
        // PAUSE
        const sessionDuration = Date.now() - task.lastStartTime;
        await updateDoc(taskRef, { isRunning: false, elapsedMs: (task.elapsedMs || 0) + sessionDuration, lastStartTime: null });
    } else {
        // START (Auto-pause others)
        const running = tasks.find(t => t.isRunning);
        if(running) {
             const rRef = doc(db, 'tasks', running.id);
             const rDur = Date.now() - running.lastStartTime;
             await updateDoc(rRef, { isRunning: false, elapsedMs: (running.elapsedMs||0) + rDur, lastStartTime: null });
        }
        await updateDoc(taskRef, { isRunning: true, lastStartTime: Date.now(), status: 'In Progress' });
    }
  };

  const markDone = async (task) => {
    if(!confirm("Mark this task as completed?")) return;
    
    const taskRef = doc(db, 'tasks', task.id);
    let finalElapsed = task.elapsedMs || 0;
    
    // If it was running, add the final chunk of time
    if (task.isRunning) finalElapsed += (Date.now() - task.lastStartTime);
    
    await updateDoc(taskRef, { 
        status: 'Done', 
        isRunning: false, 
        elapsedMs: finalElapsed, 
        lastStartTime: null 
    });
  };

  const togglePowerCut = async () => {
    if (currentInterruption) {
        // STOP POWER CUT
        const intRef = doc(db, 'interruptions', currentInterruption.id);
        const duration = Date.now() - currentInterruption.startTime;
        
        await updateDoc(intRef, { active: false, endTime: Date.now(), durationMs: duration });
        
        await addDoc(collection(db, 'power_logs'), {
            userId: currentUser.id,
            userName: currentUser.fullname,
            startTime: currentInterruption.startTime,
            endTime: Date.now(),
            durationMs: duration,
            date: globalDate
        });

    } else {
        // START POWER CUT
        const running = tasks.find(t => t.isRunning);
        if(running) {
             const rRef = doc(db, 'tasks', running.id);
             const rDur = Date.now() - running.lastStartTime;
             await updateDoc(rRef, { isRunning: false, elapsedMs: (running.elapsedMs||0) + rDur, lastStartTime: null });
        }

        await addDoc(collection(db, 'interruptions'), {
            userId: currentUser.id, 
            user: currentUser.fullname,
            type: 'Power Cut',
            startTime: Date.now(),
            active: true,
            date: globalDate 
        });
    }
  };

  if (loading) return <div className="text-center p-20 text-slate-400 animate-pulse">Loading Your Dashboard...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      
      {/* HEADER & ALERTS */}
      {currentInterruption ? (
        <div className="bg-red-600 text-white p-6 rounded-2xl shadow-xl flex justify-between items-center animate-pulse border-4 border-red-500">
            <div className="flex items-center gap-5">
                <div className="p-3 bg-white/20 rounded-full"><ZapOff size={32} /></div>
                <div>
                    <h2 className="text-2xl font-bold">POWER CUT ACTIVE</h2>
                    <p className="opacity-90 font-medium">Tracking paused since {new Date(currentInterruption.startTime).toLocaleTimeString()}</p>
                </div>
            </div>
            <button onClick={togglePowerCut} className="bg-white text-red-700 px-8 py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-lg">
                I Have Power Now
            </button>
        </div>
      ) : (
         <div className="flex justify-end">
            <button onClick={togglePowerCut} className="btn bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 shadow-sm">
                <ZapOff size={18} className="mr-2" /> Report Power Outage
            </button>
         </div>
      )}

      {/* TASKS GROUPED BY PROJECT */}
      {tasks.length > 0 ? (
          Object.entries(tasks.reduce((acc, t) => { (acc[t.project] = acc[t.project] || []).push(t); return acc; }, {}))
           .map(([project, pTasks]) => (
            <div key={project} className="animate-in slide-in-from-bottom-2">
                <h3 className="text-lg font-bold text-slate-700 mb-3 ml-1">{project}</h3>
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {pTasks.map(task => (
                        <div key={task.id} className={`grid grid-cols-[1fr_auto_auto] gap-4 p-5 border-b border-slate-100 last:border-0 transition-colors ${task.isRunning ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}>
                            
                            {/* Task Info */}
                            <div className="flex flex-col justify-center">
                                <div className={`font-semibold text-base ${task.status === 'Done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                    {task.description}
                                </div>
                                <div className="text-xs text-slate-400 font-medium mt-1">
                                    Est: {task.estHours}h
                                </div>
                            </div>

                            {/* Timer Display */}
                            <div className="flex items-center">
                                <Timer startTime={task.lastStartTime} elapsed={task.elapsedMs} isRunning={task.isRunning} />
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-2">
                                {task.status !== 'Done' && (
                                    <>
                                    <button 
                                        onClick={() => toggleTimer(task)} 
                                        disabled={!!currentInterruption} 
                                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm ${task.isRunning 
                                            ? 'bg-amber-400 text-white hover:bg-amber-500 hover:scale-105' 
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105'
                                        } disabled:opacity-50 disabled:grayscale`}
                                        title={task.isRunning ? "Pause Task" : "Start Task"}
                                    >
                                        {task.isRunning ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor" className="ml-0.5"/>}
                                    </button>
                                    
                                    <button 
                                        onClick={() => markDone(task)} 
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border-2 border-slate-100 text-slate-400 hover:text-emerald-500 hover:border-emerald-200 hover:bg-emerald-50 transition-all"
                                        title="Mark as Completed"
                                    >
                                        <CheckCircle size={20}/>
                                    </button>
                                    </>
                                )}
                                {task.status === 'Done' && (
                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1">
                                        <CheckCircle size={12} /> Done
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          ))
      ) : (
        /* EMPTY STATE - NO TASKS */
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
              <Calendar size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-600">No tasks assigned for {globalDate}</h3>
          <p className="text-slate-400 max-w-xs mx-auto mt-2">Enjoy your free time, or check with your manager if this seems wrong.</p>
        </div>
      )}
    </div>
  );
}