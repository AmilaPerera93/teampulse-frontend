import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore'; 
import { useDate } from '../contexts/DateContext';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Coffee, ZapOff, AlertCircle, Play, CheckCircle } from 'lucide-react';
import Timer from './Timer';

// Helper for formatting time
const formatMinutes = (ms) => {
    if (!ms) return "0m";
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
};

export default function AdminDashboard() {
  const { globalDate } = useDate();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ idle: {}, break: {}, power: {}, activeCut: {} });
  const [loading, setLoading] = useState(true);
  const [expandedUsers, setExpandedUsers] = useState({});
  const [, setTick] = useState(0);

  // Force re-render every minute to update "Live" durations
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setLoading(true);
    
    // 1. LISTEN TO USERS (The Source of Truth)
    const qUsers = query(collection(db, 'users'), where('role', '==', 'MEMBER'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
        const userList = snap.docs.map(d => ({
            id: d.id, ...d.data(), onlineStatus: d.data().onlineStatus || 'Offline' 
        }));
        
        // Sort: Power Cut > Break > Online > Idle > Offline
        userList.sort((a, b) => {
            const statusOrder = { 'Power Cut': -1, 'Break': 0, 'Online': 1, 'Idle': 2, 'Offline': 3 };
            return (statusOrder[a.onlineStatus] ?? 3) - (statusOrder[b.onlineStatus] ?? 3);
        });
        setUsers(userList);
        
        // CRITICAL FIX: Stop loading as soon as we have users (or empty list)
        setLoading(false);
    });

    // 2. LISTEN TO TASKS (Work Load)
    const qTasks = query(collection(db, 'tasks'), where('date', '==', globalDate));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. LISTEN TO LOGS (Idle, Breaks, Power)
    // We update the 'stats' state incrementally as data comes in
    const qIdle = query(collection(db, 'idle_logs'), where('date', '==', globalDate));
    const unsubIdle = onSnapshot(qIdle, (s) => {
        const data = {}; 
        s.docs.forEach(d => { const id = d.data().userId; data[id] = (data[id]||0) + d.data().durationMs; });
        setStats(prev => ({ ...prev, idle: data }));
    });

    const qBreaks = query(collection(db, 'breaks'), where('date', '==', globalDate));
    const unsubBreak = onSnapshot(qBreaks, (s) => {
        const data = {}; 
        s.docs.forEach(d => { const id = d.data().userId; data[id] = (data[id]||0) + d.data().durationMs; });
        setStats(prev => ({ ...prev, break: data }));
    });

    const qPower = query(collection(db, 'power_logs'), where('date', '==', globalDate));
    const unsubPower = onSnapshot(qPower, (s) => {
        const data = {}; 
        s.docs.forEach(d => { const id = d.data().userId; data[id] = (data[id]||0) + d.data().durationMs; });
        setStats(prev => ({ ...prev, power: data }));
    });

    // 4. LISTEN TO ACTIVE INTERRUPTIONS (Live Power Cuts)
    const qActiveInt = query(collection(db, 'interruptions'), where('active', '==', true));
    const unsubActive = onSnapshot(qActiveInt, (s) => {
        const data = {}; 
        s.docs.forEach(d => { 
            // We need to match by user ID. 
            // If your interruption doc has 'userId', use it. If only 'user' (name), we might need to map it.
            // Assuming we saved 'userId' in the latest MemberDashboard update.
            const id = d.data().userId; 
            if(id) data[id] = d.data().startTime; 
        });
        setStats(prev => ({ ...prev, activeCut: data }));
    });

    return () => { 
        unsubUsers(); unsubTasks(); unsubIdle(); unsubBreak(); unsubPower(); unsubActive();
    };
  }, [globalDate]);

  const toggleExpand = (e, userName) => {
    e.stopPropagation();
    setExpandedUsers(prev => ({ ...prev, [userName]: !prev[userName] }));
  };

  if (loading) return <div className="text-center p-20 text-slate-400 animate-pulse">Loading Dashboard...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in pb-20">
      {users.length === 0 && (
        <div className="col-span-full text-center text-slate-400 p-10 bg-white rounded-xl border border-dashed border-slate-300">
            No team members found. Invite users to get started.
        </div>
      )}

      {users.map(user => {
        const userName = user.fullname;
        const uId = user.id;

        // --- 1. CALCULATE STATUS ---
        let displayStatus = user.onlineStatus;
        const lastSeenDate = user.lastSeen?.toDate();
        let statusText = displayStatus;

        // Crash Detection (3 mins)
        if ((displayStatus === 'Online' || displayStatus === 'Idle') && lastSeenDate) {
            if ((Date.now() - lastSeenDate.getTime()) > 3 * 60 * 1000) {
                displayStatus = 'Offline';
                statusText = 'Offline (Timeout)';
            }
        }

        // Active Power Cut Override (Highest Priority)
        const activeCutStart = stats.activeCut?.[uId];
        if (activeCutStart) {
            displayStatus = 'Power Cut';
            statusText = 'Power Outage Active';
        }

        // --- 2. CALCULATE TOTALS ---
        const totalIdle = stats.idle?.[uId] || 0;
        const totalBreak = stats.break?.[uId] || 0;
        const totalPower = stats.power?.[uId] || 0;
        
        // Add current session durations for "Live" accuracy
        let currentSessionMs = 0;
        if (displayStatus === 'Break' && user.lastBreakStart) {
            currentSessionMs = Date.now() - user.lastBreakStart;
            statusText = `On Break (${formatMinutes(currentSessionMs)})`;
        }
        if (activeCutStart) {
            currentSessionMs = Date.now() - activeCutStart;
            statusText = `No Power (${formatMinutes(currentSessionMs)})`;
        }

        // Grand Totals (Historic + Current Session)
        const grandTotalBreak = totalBreak + (displayStatus === 'Break' ? currentSessionMs : 0);
        const grandTotalPower = totalPower + (activeCutStart ? currentSessionMs : 0);

        // --- 3. TASKS ---
        const userTasks = tasks.filter(t => t.assignedTo === userName);
        userTasks.sort((a,b) => (a.isRunning === b.isRunning ? 0 : a.isRunning ? -1 : 1));
        
        // --- 4. EFFICIENCY SCORE ---
        // Worked Time = Completed Tasks Duration + Current Task Duration
        const workedMs = userTasks.reduce((acc, t) => acc + (t.elapsedMs || 0) + (t.isRunning ? (Date.now() - t.lastStartTime) : 0), 0);
        
        // Net Available = 8 Hours - (Power Cuts + Breaks)
        const netAvailable = (8 * 3600000) - grandTotalPower - grandTotalBreak;
        
        // Score = Worked / Net Available
        const efficiency = netAvailable > 0 ? Math.min(100, Math.round((workedMs / netAvailable) * 100)) : 0;

        const isExpanded = expandedUsers[userName];
        const visibleTasks = isExpanded ? userTasks : userTasks.slice(0, 3);
        const hiddenCount = userTasks.length - 3;

        return (
          <div 
            key={user.id} 
            onClick={() => navigate(`/member/${userName}`)} 
            className={`card card-hover h-fit cursor-pointer group relative transition-all duration-200 hover:shadow-md border-t-4 
                ${displayStatus === 'Power Cut' ? 'border-t-red-500 bg-red-50/10' : 'border-t-transparent hover:border-t-primary bg-white'}`}
          >
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                <ExternalLink size={16} />
            </div>

            {/* HEADER SECTION */}
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 text-lg">
                            {userName.charAt(0)}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm transition-colors duration-500 ${
                            displayStatus === 'Online' ? 'bg-emerald-500' :
                            displayStatus === 'Idle' ? 'bg-amber-400' :
                            displayStatus === 'Break' ? 'bg-blue-500' :
                            displayStatus === 'Power Cut' ? 'bg-red-600 animate-pulse' :
                            'bg-slate-300'
                        }`} title={displayStatus}></div>
                    </div>

                    <div>
                        <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                            {userName}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] uppercase font-bold tracking-wider transition-colors duration-300 ${
                                displayStatus === 'Online' ? 'text-emerald-600' :
                                displayStatus === 'Idle' ? 'text-amber-500' :
                                displayStatus === 'Break' ? 'text-blue-600' :
                                displayStatus === 'Power Cut' ? 'text-red-600' :
                                'text-slate-400'
                            }`}>
                                {statusText}
                            </span>
                            {/* Warning Icon for Power Cuts */}
                            {displayStatus === 'Power Cut' && <ZapOff size={12} className="text-red-600 animate-pulse"/>}
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <div className={`text-xl font-mono font-bold ${efficiency >= 80 ? 'text-emerald-600' : efficiency >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {efficiency}%
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Efficiency</div>
                </div>
            </div>

            {/* STATS GRID */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="p-2 bg-amber-50 rounded border border-amber-100">
                    <div className="text-[10px] text-amber-700 font-bold uppercase mb-1 flex justify-center gap-1"><AlertCircle size={10}/> Idle</div>
                    <div className="font-mono text-sm font-bold text-amber-900">{formatMinutes(totalIdle)}</div>
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-100">
                    <div className="text-[10px] text-blue-700 font-bold uppercase mb-1 flex justify-center gap-1"><Coffee size={10}/> Break</div>
                    <div className="font-mono text-sm font-bold text-blue-900">{formatMinutes(grandTotalBreak)}</div>
                </div>
                <div className="p-2 bg-red-50 rounded border border-red-100">
                    <div className="text-[10px] text-red-700 font-bold uppercase mb-1 flex justify-center gap-1"><ZapOff size={10}/> Cuts</div>
                    <div className="font-mono text-sm font-bold text-red-900">{formatMinutes(grandTotalPower)}</div>
                </div>
            </div>

            {/* TASKS LIST */}
            <div className="space-y-2">
                {visibleTasks.length === 0 && (
                    <div className="text-center italic text-slate-400 text-xs py-3 bg-slate-50 rounded border border-dashed border-slate-200">
                        No tasks active for {globalDate === new Date().toISOString().split('T')[0] ? 'Today' : globalDate}
                    </div>
                )}

                {visibleTasks.map(task => {
                    const isRun = task.isRunning;
                    return (
                        <div key={task.id} className={`flex justify-between items-center text-xs p-2 rounded border transition-all ${
                            isRun ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}>
                            <div className="truncate pr-2 flex items-center gap-2">
                                {isRun && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>}
                                <span className={`font-medium ${task.status==='Done'?'line-through text-slate-400':'text-slate-700'}`}>
                                    {task.description}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={`font-mono font-bold ${isRun ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    <Timer startTime={task.lastStartTime} elapsed={task.elapsedMs} isRunning={isRun} />
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {hiddenCount > 0 && (
                <button 
                    onClick={(e) => toggleExpand(e, userName)}
                    className="w-full text-center text-[10px] text-slate-400 font-bold mt-2 hover:text-indigo-600 transition-colors uppercase tracking-wide"
                >
                    {isExpanded ? 'Show Less' : `+ ${hiddenCount} more tasks`}
                </button>
            )}
          </div>
        );
      })}
    </div>
  );
}