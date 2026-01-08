import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDate } from '../contexts/DateContext'; 
import { useTimer } from '../contexts/TimerContext'; 
import { useActivityMonitor } from '../hooks/useActivityMonitor'; 
import AssignTaskModal from './AssignTaskModal';   
import Timer from './Timer';
import { db } from '../firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'; 
import { 
  Zap, LayoutGrid, Users, FolderOpen, 
  CheckCircle, History, LogOut, Calendar, Plus,
  Briefcase, DollarSign, BarChart3, Pause, Play, ZapOff, Coffee, Lock
} from 'lucide-react';

// --- HELPER: Format Milliseconds to HH:MM:SS ---
const formatDuration = (ms) => {
  if (!ms) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// --- SUB-COMPONENT: GLOBAL TIMER WIDGET ---
function GlobalTimerWidget() {
  const { activeTask, activeInterruption, stopTask } = useTimer();

  if (activeInterruption) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white p-3 z-50 flex justify-center items-center gap-4 animate-pulse shadow-lg">
        <ZapOff size={20} />
        <span className="font-bold tracking-wide">POWER CUT ACTIVE - WORK PAUSED</span>
      </div>
    );
  }

  if (!activeTask) return null;

  return (
    <div className="fixed bottom-6 right-8 bg-slate-900 text-white shadow-2xl rounded-full px-6 py-3 z-50 flex items-center gap-6 border border-slate-700 animate-in slide-in-from-bottom-10">
      <div className="flex flex-col">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Current Task</span>
        <span className="font-bold text-sm max-w-[200px] truncate">{activeTask.description}</span>
      </div>
      <div className="font-mono text-xl font-bold text-emerald-400 min-w-[80px] text-center">
        <Timer startTime={activeTask.lastStartTime} elapsed={activeTask.elapsedMs} isRunning={true} />
      </div>
      <button 
        onClick={stopTask} 
        className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-all hover:scale-105"
        title="Stop Timer"
      >
        <Pause size={18} fill="currentColor" />
      </button>
    </div>
  );
}

// --- MAIN LAYOUT COMPONENT ---
export default function Layout() {
  const { currentUser, logout, changePassword } = useAuth(); 
  const { globalDate, setGlobalDate } = useDate(); 
  const { stopTask, activeTask } = useTimer(); // Import stopTask to pause work
  const [isModalOpen, setIsModalOpen] = useState(false); 
  
  // Break Timer State
  const [breakElapsed, setBreakElapsed] = useState(0);

  const navigate = useNavigate();

  // --- ACTIVATE MONITORING ---
  useActivityMonitor(currentUser);

  // --- LIVE BREAK TIMER ---
  useEffect(() => {
    let interval;
    if (currentUser?.onlineStatus === 'Break' && currentUser?.lastBreakStart) {
        // Update timer every second
        interval = setInterval(() => {
            setBreakElapsed(Date.now() - currentUser.lastBreakStart);
        }, 1000);
    } else {
        setBreakElapsed(0);
    }
    return () => clearInterval(interval);
  }, [currentUser?.onlineStatus, currentUser?.lastBreakStart]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // --- HANDLE PASSWORD CHANGE (Self) ---
  const handlePasswordChange = () => {
      const newPass = prompt("Enter your new password:");
      if (newPass) {
          changePassword(newPass);
      }
  };

  // --- BREAK HANDLER ---
  const toggleBreak = async () => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.id);

    if (currentUser.onlineStatus === 'Break') {
        // 1. ENDING BREAK
        // Calculate total duration
        const duration = Date.now() - (currentUser.lastBreakStart || Date.now());
        
        // Log the completed break to 'breaks' collection for Performance Stats
        if (duration > 1000) {
            try {
                await addDoc(collection(db, 'breaks'), {
                    userId: currentUser.id,
                    userName: currentUser.fullname,
                    startTime: currentUser.lastBreakStart,
                    endTime: Date.now(),
                    durationMs: duration,
                    date: new Date().toISOString().split('T')[0]
                });
            } catch(e) { console.error(e); }
        }

        // Reset Status
        await updateDoc(userRef, { 
            onlineStatus: 'Online', 
            lastSeen: serverTimestamp(),
            lastBreakStart: null // Clear timer
        });

    } else {
        // 2. STARTING BREAK
        
        // A) STOP Active Task first!
        if (activeTask) {
            await stopTask(); 
        }

        // B) Update Status & Start Timer
        await updateDoc(userRef, { 
            onlineStatus: 'Break', 
            lastSeen: serverTimestamp(),
            lastBreakStart: Date.now() // Save start time for timer
        });
    }
  };

  const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink 
      to={to} 
      className={({ isActive }) => 
        `flex items-center gap-3 px-5 py-3 mx-4 rounded-lg font-semibold transition-colors duration-200 cursor-pointer ${
          isActive 
            ? 'bg-primary-light text-primary' 
            : 'text-text-sec hover:bg-slate-100 hover:text-text-main'
        }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );

  return (
    <div className="flex w-full h-screen bg-bg-body overflow-hidden">
      {/* SIDEBAR */}
      <div className="w-[280px] bg-bg-surface border-r border-border flex flex-col z-20 shadow-sm">
        <div className="p-6 border-b border-border">
          <div className="font-extrabold text-xl text-primary flex items-center gap-2">
            <Zap size={24} fill="currentColor" /> TeamPulse
          </div>
          <div className="text-sm font-semibold text-text-sec mt-2 pl-8">
            {currentUser?.fullname}
          </div>
        </div>

        <div className="flex-1 py-6 overflow-y-auto no-scrollbar">
          {currentUser?.role === 'ADMIN' ? (
            <>
              <div className="px-6 text-xs font-extrabold text-text-sec mb-3 tracking-wider">MANAGEMENT</div>
              <NavItem to="/" icon={LayoutGrid} label="Dashboard" />
              <NavItem to="/users" icon={Users} label="Team" />
              <NavItem to="/projects" icon={FolderOpen} label="Projects" />
              <NavItem to="/resources" icon={BarChart3} label="Resource Plan" />

              <div className="px-6 text-xs font-extrabold text-text-sec mt-6 mb-3 tracking-wider">BUSINESS</div>
              <NavItem to="/crm" icon={Briefcase} label="CRM & Leads" />
              <NavItem to="/finance" icon={DollarSign} label="Invoicing" />
            </>
          ) : (
            <>
              <div className="px-6 text-xs font-extrabold text-text-sec mb-3 tracking-wider">YOUR WORK</div>
              <NavItem to="/" icon={CheckCircle} label="Today's Tasks" />
              <NavItem to="/history" icon={History} label="History Log" />
            </>
          )}
        </div>

        {/* BOTTOM ACTIONS */}
        <div className="p-6 border-t border-border space-y-3">
          
          {/* 1. CHANGE PASSWORD (Visible to everyone) */}
          <button 
            onClick={handlePasswordChange}
            className="btn btn-ghost w-full text-text-sec hover:bg-slate-100 justify-start pl-4"
          >
            <Lock size={18} /> Change Pass
          </button>

          {/* 2. TAKE BREAK (Visible ONLY to Members, HIDDEN for Admins) */}
          {currentUser?.role !== 'ADMIN' && (
              <button 
                onClick={toggleBreak}
                className={`btn w-full justify-center gap-2 font-bold transition-all relative overflow-hidden ${
                   currentUser?.onlineStatus === 'Break' 
                   ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
                   : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {currentUser?.onlineStatus === 'Break' ? (
                    <div className="flex flex-col items-center leading-none py-1">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-1">
                            <Play size={12} /> Resume
                        </div>
                        <div className="font-mono text-lg font-black">
                            {formatDuration(breakElapsed)}
                        </div>
                    </div>
                ) : (
                    <><Coffee size={18} /> Take a Break</>
                )}
              </button>
          )}

          {/* 3. LOGOUT */}
          <button onClick={handleLogout} className="btn btn-ghost w-full text-danger hover:text-danger hover:bg-danger-bg justify-start pl-4">
            <LogOut size={18} /> Log Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* HEADER */}
        <div className="h-16 bg-bg-surface border-b border-border px-8 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <h2 className="text-xl font-bold text-text-main">Workspace</h2>
          
          <div className="flex items-center gap-4">
            {/* Global Date Picker */}
            <div className="bg-bg-body px-3 py-1.5 rounded-lg border border-border flex items-center gap-2 hover:border-primary transition-colors focus-within:ring-2 ring-primary-light">
              <Calendar size={16} className="text-text-sec" />
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-sm font-semibold text-text-main cursor-pointer"
                value={globalDate}
                onChange={(e) => setGlobalDate(e.target.value)}
              />
            </div>

            {/* Admin Only: Assign Button */}
            {currentUser?.role === 'ADMIN' && (
                <button onClick={() => setIsModalOpen(true)} className="btn btn-primary shadow-md shadow-indigo-200">
                    <Plus size={18} /> Assign Task
                </button>
            )}
          </div>
        </div>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <Outlet />
        </div>
        
        {/* GLOBAL FLOATING WIDGET */}
        <GlobalTimerWidget />
      </div>

      {/* MODAL */}
      <AssignTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}