import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDate } from '../contexts/DateContext'; 
import { fetchTasks, saveTask, saveLog, fetchLogs, deleteTask } from '../services/api'; 
import Timer from './Timer';
import { Play, Pause, CheckCircle, ZapOff, Trash2 } from 'lucide-react';

export default function MemberDashboard() {
  const { currentUser } = useAuth();
  const { globalDate } = useDate(); 
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentInterruption, setCurrentInterruption] = useState(null);

  const loadMemberData = async () => {
    if (!currentUser) return;
    try {
      // 1. Fetch Tasks
      const taskData = await fetchTasks(currentUser.fullname, globalDate);
      const relevantTasks = taskData.sort((a, b) => (a.isRunning === b.isRunning ? 0 : a.isRunning ? -1 : 1));
      setTasks(relevantTasks);
      
      // 2. Fetch Active Interruption (To persist across refresh)
      const logs = await fetchLogs('interruptions', globalDate, currentUser.id);
      const active = logs.find(l => l.active === true);
      if (active) setCurrentInterruption(active);

      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  useEffect(() => {
    loadMemberData();
    const interval = setInterval(loadMemberData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [currentUser.id, globalDate]);

  // --- ACTIONS ---

  const toggleTimer = async (task) => {
    if (currentInterruption) {
        alert("POWER CUT ACTIVE: You cannot start tasks until you report that power is back.");
        return;
    }

    const isPausing = task.isRunning;
    const updatedTask = { ...task };

    if (isPausing) {
        const sessionDuration = Date.now() - task.lastStartTime;
        updatedTask.isRunning = false;
        updatedTask.elapsedMs = (task.elapsedMs || 0) + sessionDuration;
        updatedTask.lastStartTime = null;
    } else {
        // Stop any other running task locally before starting this one
        setTasks(prev => prev.map(t => t.isRunning ? { ...t, isRunning: false, lastStartTime: null } : t));
        updatedTask.isRunning = true;
        updatedTask.lastStartTime = Date.now();
        updatedTask.status = 'In Progress';
    }

    try {
        await saveTask(updatedTask);
        loadMemberData(); 
    } catch (e) { alert("Failed to update task"); }
  };

  const markDone = async (task) => {
    if(!confirm("Mark this task as completed?")) return;
    
    const updatedTask = { ...task, status: 'Done', isRunning: false };
    if (task.isRunning) {
        updatedTask.elapsedMs = (task.elapsedMs || 0) + (Date.now() - task.lastStartTime);
        updatedTask.lastStartTime = null;
    }

    try {
        await saveTask(updatedTask);
        loadMemberData();
    } catch (e) { alert("Failed to complete task"); }
  };

  const handleDeleteTask = async (task) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    
    // Optimistic UI Update
    setTasks(prev => prev.filter(t => t.id !== task.id));

    try {
        // Send task.assignedTo as the partition key
        await deleteTask(task.id, task.assignedTo || currentUser.fullname);
    } catch (error) {
        console.error("Delete failed", error);
        alert("Could not delete task.");
        loadMemberData(); 
    }
  };

  const togglePowerCut = async () => {
    const isEnding = !!currentInterruption;
    
    try {
        if (isEnding) {
            const duration = Date.now() - currentInterruption.startTime;
            // End the active interruption
            await saveLog('power', {
                ...currentInterruption,
                active: false,
                endTime: Date.now(),
                durationMs: duration,
                date: globalDate
            });
            setCurrentInterruption(null);
        } else {
            // Start a new interruption
            const running = tasks.find(t => t.isRunning);
            if(running) await toggleTimer(running);

            const newInt = {
                userId: currentUser.id, 
                user: currentUser.fullname,
                startTime: Date.now(),
                active: true,
                date: globalDate,
                type: 'Power Cut'
            };
            await saveLog('interruption', newInt);
            setCurrentInterruption(newInt);
        }
        loadMemberData();
    } catch (e) { alert("Power log failed"); }
  };

  if (loading) return <div className="text-center p-20 text-slate-400 animate-pulse">Loading Your Dashboard...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      
      {/* POWER CUT UI */}
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
            <button onClick={togglePowerCut} className="btn bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 shadow-sm px-4 py-2 rounded-lg font-bold flex items-center">
                <ZapOff size={18} className="mr-2" /> Report Power Outage
            </button>
         </div>
      )}

      {/* TASK LIST */}
      {tasks.length > 0 ? (
          Object.entries(tasks.reduce((acc, t) => { (acc[t.project] = acc[t.project] || []).push(t); return acc; }, {}))
           .map(([project, pTasks]) => (
            <div key={project} className="animate-in slide-in-from-bottom-2">
                <h3 className="text-lg font-bold text-slate-700 mb-3 ml-1 uppercase tracking-wider text-xs">{project}</h3>
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {pTasks.map(task => (
                        <div key={task.id} className={`grid grid-cols-[1fr_auto_auto] gap-4 p-5 border-b border-slate-100 last:border-0 transition-colors ${task.isRunning ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}>
                            <div className="flex flex-col justify-center">
                                <div className={`font-semibold text-base ${task.status === 'Done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                    {task.description}
                                </div>
                                <div className="text-xs text-slate-400 font-medium mt-1">Est: {task.estHours}h</div>
                            </div>
                            <div className="flex items-center">
                                <Timer startTime={task.lastStartTime} elapsed={task.elapsedMs} isRunning={task.isRunning} />
                            </div>
                            <div className="flex items-center gap-2">
                                {task.status !== 'Done' ? (
                                    <>
                                        <button onClick={() => toggleTimer(task)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm ${task.isRunning ? 'bg-amber-400 text-white' : 'bg-indigo-600 text-white'}`}>
                                            {task.isRunning ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor" className="ml-0.5"/>}
                                        </button>
                                        <button onClick={() => markDone(task)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border-2 border-slate-100 text-slate-400 hover:text-emerald-500 hover:border-emerald-200 transition-all">
                                            <CheckCircle size={20}/>
                                        </button>
                                        <button onClick={() => handleDeleteTask(task)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border-2 border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all">
                                            <Trash2 size={18}/>
                                        </button>
                                    </>
                                ) : (
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
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 italic text-slate-400">
             No tasks assigned for {globalDate}
        </div>
      )}
    </div>
  );
}