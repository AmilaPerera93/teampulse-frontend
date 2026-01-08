import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore'; // Removed getDocs, added onSnapshot
import { useDate } from '../contexts/DateContext';
import { useNavigate } from 'react-router-dom';
import { Trash2, ExternalLink } from 'lucide-react';
import Timer from './Timer';

export default function AdminDashboard() {
  const { globalDate } = useDate();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [expandedUsers, setExpandedUsers] = useState({});

  useEffect(() => {
    // 1. Listen to Users (REAL-TIME STATUS UPDATES)
    const qUsers = query(collection(db, 'users'), where('role', '==', 'MEMBER'));
    
    const unsubUsers = onSnapshot(qUsers, (snap) => {
        const userList = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            // Default to offline if not set
            onlineStatus: d.data().onlineStatus || 'Offline' 
        }));
        
        // Optional: Sort so Online/Idle users are at the top
        userList.sort((a, b) => {
            const statusOrder = { 'Online': 1, 'Idle': 2, 'Offline': 3 };
            const aVal = statusOrder[a.onlineStatus] || 3;
            const bVal = statusOrder[b.onlineStatus] || 3;
            return aVal - bVal;
        });

        setUsers(userList);
    });

    // 2. Listen to Tasks for the selected GLOBAL DATE
    const qTasks = query(collection(db, 'tasks'), where('date', '==', globalDate));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
    });

    return () => { unsubUsers(); unsubTasks(); };
  }, [globalDate]);

  const handleDelete = async (e, id) => {
    e.stopPropagation(); 
    if(confirm("Permanently delete this task?")) {
        await deleteDoc(doc(db, 'tasks', id));
    }
  };

  const toggleExpand = (e, userName) => {
    e.stopPropagation();
    setExpandedUsers(prev => ({ ...prev, [userName]: !prev[userName] }));
  };

  if (loading) return <div className="text-center p-10 text-text-sec">Loading Overview...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
      {users.length === 0 && (
        <div className="col-span-full text-center text-text-sec p-10">
            No members found. Go to "Users" to add team members.
        </div>
      )}

      {users.map(user => {
        const userName = user.fullname;
        
        // --- STATUS LOGIC ---
        let displayStatus = user.onlineStatus;
        const lastSeenDate = user.lastSeen?.toDate();
        
        // Safety Check: If "Online" but no ping in > 3 mins, force Offline
        if (displayStatus === 'Online' && lastSeenDate) {
            const diff = (Date.now() - lastSeenDate.getTime()) / 1000 / 60; // diff in minutes
            if (diff > 3) displayStatus = 'Offline';
        }

        // Filter tasks for this user
        const userTasks = tasks.filter(t => t.assignedTo === userName);
        
        // Sort: Running first
        userTasks.sort((a,b) => (a.isRunning === b.isRunning ? 0 : a.isRunning ? -1 : 1));
        
        // Calc Total Load
        const totalLoad = userTasks.reduce((acc, t) => acc + (t.estHours || 0), 0);
        
        // Pagination Logic
        const isExpanded = expandedUsers[userName];
        const visibleTasks = isExpanded ? userTasks : userTasks.slice(0, 4);
        const hiddenCount = userTasks.length - 4;

        return (
          <div 
            key={user.id} 
            onClick={() => navigate(`/member/${userName}`)} 
            className="card card-hover h-fit cursor-pointer group relative transition-all duration-200"
          >
            {/* Hover Hint */}
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                <ExternalLink size={16} />
            </div>

            <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                    {/* AVATAR + STATUS DOT */}
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                            {userName.charAt(0)}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                            displayStatus === 'Online' ? 'bg-emerald-500' :
                            displayStatus === 'Idle' ? 'bg-amber-400' :
                            'bg-slate-300'
                        }`} title={displayStatus}></div>
                    </div>

                    <div>
                        <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                            {userName}
                        </h3>
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${
                             displayStatus === 'Online' ? 'text-emerald-600' :
                             displayStatus === 'Idle' ? 'text-amber-500' :
                             'text-slate-400'
                        }`}>
                            {displayStatus}
                        </span>
                    </div>
                </div>

                <span className="text-xs font-bold text-text-sec bg-slate-100 px-2 py-1 rounded">
                    {totalLoad}h Load
                </span>
            </div>

            <div className="space-y-3">
                {visibleTasks.length === 0 && (
                    <div className="text-center italic text-text-sec text-sm py-4">No tasks assigned</div>
                )}

                {visibleTasks.map(task => {
                    const isRun = task.isRunning;
                    return (
                        <div key={task.id} className={`flex justify-between items-center text-sm p-2 rounded-lg border 
                            ${isRun ? 'bg-emerald-50 border-emerald-200' : 'bg-transparent border-transparent border-b-slate-100'}`}>
                            
                            <div className="overflow-hidden">
                                <div className={`font-semibold truncate ${task.status === 'Done' ? 'line-through text-slate-400' : 'text-text-main'}`}>
                                    {isRun && <span className="inline-block w-2 h-2 bg-success rounded-full mr-2 animate-pulse"></span>}
                                    {task.description}
                                </div>
                                <div className="text-xs text-text-sec">{task.project}</div>
                            </div>

                            <div className="flex items-center gap-3 pl-2">
                                <div className={`font-mono font-bold ${isRun ? 'text-success' : 'text-slate-400'}`}>
                                    <Timer 
                                        startTime={task.lastStartTime} 
                                        elapsed={task.elapsedMs} 
                                        isRunning={isRun} 
                                    />
                                </div>
                                <button 
                                    onClick={(e) => handleDelete(e, task.id)}
                                    className="text-slate-300 hover:text-danger transition-colors p-1 rounded hover:bg-red-50"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {hiddenCount > 0 && (
                <button 
                    onClick={(e) => toggleExpand(e, userName)}
                    className="w-full text-center text-sm text-primary font-semibold mt-4 pt-2 border-t border-border hover:underline"
                >
                    {isExpanded ? 'Show Less' : `Show ${hiddenCount} More...`}
                </button>
            )}
          </div>
        );
      })}
    </div>
  );
}