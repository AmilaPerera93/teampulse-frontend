import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, ZapOff, Coffee, ChevronDown, CheckCircle, Activity, BarChart3, AlertCircle } from 'lucide-react';

// --- HELPER: Format Milliseconds to HH:MM:SS ---
const formatMs = (ms) => {
  if (!ms) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- HELPER: Format Date Nicely ---
const formatDate = (dateStr) => {
    if(!dateStr) return "Unknown Date";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

export default function HistoryLog() {
  const { currentUser } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    // 1. SAFE DATE CALCULATION (Last 7 Days)
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const dateLimit = d.toISOString().split('T')[0]; // YYYY-MM-DD

    // 2. QUERIES
    // Note: If you still see "Index Needed" in console, click the link!
    const qTasks = query(
        collection(db, 'tasks'), 
        where('assignedTo', '==', currentUser.fullname),
        where('date', '>=', dateLimit)
    );

    const qBreaks = query(
        collection(db, 'breaks'), 
        where('userId', '==', currentUser.id),
        where('date', '>=', dateLimit)
    );

    const qPower = query(
        collection(db, 'power_logs'), 
        where('userId', '==', currentUser.id),
        where('date', '>=', dateLimit)
    );

    // 3. DATA PROCESSING
    let tasksData = [];
    let breaksData = [];
    let powerData = [];

    const processData = () => {
        const grouped = {};

        // Helper to ensure day object exists
        const initDate = (date) => {
            if (!grouped[date]) {
                grouped[date] = { 
                    date, 
                    worked: 0, 
                    breaks: 0, 
                    power: 0, 
                    taskList: [], 
                    breakList: [], 
                    powerList: [] 
                };
            }
        };

        // --- TASKS ---
        tasksData.forEach(t => {
            if (!t.date) return;
            initDate(t.date);
            grouped[t.date].worked += (t.elapsedMs || 0);
            grouped[t.date].taskList.push(t);
        });

        // --- BREAKS ---
        breaksData.forEach(b => {
            if (!b.date) return;
            initDate(b.date);
            grouped[b.date].breaks += (b.durationMs || 0);
            grouped[b.date].breakList.push(b);
        });

        // --- POWER CUTS ---
        powerData.forEach(p => {
            if (!p.date) return;
            initDate(p.date);
            grouped[p.date].power += (p.durationMs || 0);
            grouped[p.date].powerList.push(p);
        });

        // SORT: Newest First
        const sorted = Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
        setHistory(sorted);
        setLoading(false);
    };

    // 4. LISTENERS
    const unsubTasks = onSnapshot(qTasks, (snap) => {
        tasksData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        processData();
    });
    const unsubBreaks = onSnapshot(qBreaks, (snap) => {
        breaksData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        processData();
    });
    const unsubPower = onSnapshot(qPower, (snap) => {
        powerData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        processData();
    });

    return () => { unsubTasks(); unsubBreaks(); unsubPower(); };
  }, [currentUser]);

  if (loading) return <div className="p-20 text-center text-slate-400 animate-pulse">Loading History...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-100 pb-6">
        <div>
           <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Work History</h2>
           <p className="text-slate-500 mt-1">Your activity report for the last 7 days.</p>
        </div>
        <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 mt-4 md:mt-0">
            <Calendar size={16}/> Last 7 Days
        </div>
      </div>

      {/* EMPTY STATE */}
      {!loading && history.length === 0 && (
          <div className="text-center p-16 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="text-slate-300" size={32}/>
              </div>
              <h3 className="text-slate-800 font-bold text-lg">No Activity Found</h3>
              <p className="text-slate-500 text-sm mt-1">No tasks or logs recorded in the past week.</p>
          </div>
      )}

      {/* DAILY CARDS */}
      <div className="space-y-4">
          {history.map((day) => {
              const isExpanded = expandedDate === day.date;
              // Calculate "Efficiency" based on 8 hours work day
              const efficiency = Math.min(100, Math.round((day.worked / (8 * 60 * 60 * 1000)) * 100));

              return (
                  <div key={day.date} className={`bg-white rounded-2xl transition-all duration-300 overflow-hidden ${isExpanded ? 'shadow-lg ring-1 ring-indigo-100' : 'shadow-sm border border-slate-200 hover:shadow-md'}`}>
                      
                      {/* --- CARD HEADER (CLICKABLE) --- */}
                      <div 
                        onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                        className="p-6 cursor-pointer flex flex-col lg:flex-row gap-6 lg:items-center justify-between group"
                      >
                          {/* DATE & TASK COUNT */}
                          <div className="flex items-center gap-5">
                              <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center border transition-colors shrink-0 ${isExpanded ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-100 group-hover:bg-white group-hover:border-indigo-200'}`}>
                                  <span className="text-[10px] font-black uppercase tracking-wider opacity-80">{new Date(day.date).toLocaleString('default', { month: 'short' })}</span>
                                  <span className="text-3xl font-black leading-none">{new Date(day.date).getDate()}</span>
                              </div>
                              <div>
                                  <h3 className="font-bold text-xl text-slate-800">{formatDate(day.date)}</h3>
                                  <div className="flex items-center gap-3 text-sm font-medium text-slate-500 mt-1">
                                      <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-indigo-500"/> {day.taskList.length} Tasks</span>
                                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                      <span className={`${efficiency > 80 ? 'text-emerald-600' : 'text-slate-500'}`}>{efficiency}% Goal</span>
                                  </div>
                              </div>
                          </div>

                          {/* METRICS ROW */}
                          <div className="flex items-center gap-3 flex-wrap lg:justify-end flex-1">
                              <MetricPill icon={Clock} label="Worked" value={formatMs(day.worked)} color="bg-emerald-50 text-emerald-700 border-emerald-100" />
                              <MetricPill icon={Coffee} label="Breaks" value={formatMs(day.breaks)} color="bg-blue-50 text-blue-700 border-blue-100" />
                              <MetricPill icon={ZapOff} label="Power" value={formatMs(day.power)} color="bg-red-50 text-red-700 border-red-100" />
                              
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ml-2 ${isExpanded ? 'bg-slate-100 rotate-180 text-slate-600' : 'text-slate-300 group-hover:text-slate-500'}`}>
                                  <ChevronDown size={20}/>
                              </div>
                          </div>
                      </div>

                      {/* --- EXPANDED DETAILS --- */}
                      {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50/50 p-6 lg:p-8 animate-in slide-in-from-top-2 fade-in">
                              
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                  {/* LEFT: TASKS */}
                                  <div>
                                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                          <Activity size={14}/> Logged Tasks
                                      </h4>
                                      <div className="space-y-3">
                                          {day.taskList.map((t, i) => (
                                              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:border-indigo-200 transition-colors">
                                                  <div>
                                                      <div className="font-bold text-slate-700 text-sm">{t.description}</div>
                                                      <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wide bg-slate-100 px-1.5 py-0.5 rounded w-fit">{t.project}</div>
                                                  </div>
                                                  <div className="font-mono font-bold text-indigo-600 text-sm bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                                      {formatMs(t.elapsedMs)}
                                                  </div>
                                              </div>
                                          ))}
                                          {day.taskList.length === 0 && (
                                              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl">
                                                  <p className="text-sm text-slate-400 italic">No tasks were logged on this day.</p>
                                              </div>
                                          )}
                                      </div>
                                  </div>

                                  {/* RIGHT: BREAKS & OUTAGES */}
                                  <div className="space-y-6">
                                      {/* Breaks */}
                                      <div>
                                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                              <Coffee size={14}/> Breaks Taken
                                          </h4>
                                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                              {day.breakList.length > 0 ? day.breakList.map((b, i) => (
                                                  <div key={i} className="flex justify-between items-center p-3 border-b border-slate-50 last:border-0 text-sm px-5">
                                                      <span className="text-slate-500 font-medium">{new Date(b.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                      <span className="font-mono font-bold text-slate-700">{formatMs(b.durationMs)}</span>
                                                  </div>
                                              )) : (
                                                  <div className="p-4 text-xs text-slate-400 italic text-center">No breaks recorded.</div>
                                              )}
                                          </div>
                                      </div>

                                      {/* Power Cuts */}
                                      <div>
                                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                              <ZapOff size={14}/> Power Outages
                                          </h4>
                                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                              {day.powerList.length > 0 ? day.powerList.map((p, i) => (
                                                  <div key={i} className="flex justify-between items-center p-3 border-b border-slate-50 last:border-0 text-sm px-5">
                                                      <span className="text-slate-500 font-medium">{new Date(p.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                      <span className="font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">{formatMs(p.durationMs)}</span>
                                                  </div>
                                              )) : (
                                                  <div className="p-4 text-xs text-slate-400 italic text-center">No outages reported.</div>
                                              )}
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              );
          })}
      </div>
    </div>
  );
}

// Clean UI Component for Metrics
function MetricPill({ icon: Icon, label, value, color }) {
    return (
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border min-w-[130px] ${color}`}>
            <Icon size={18} />
            <div className="flex flex-col">
                <span className="text-[9px] uppercase font-black opacity-60 leading-none mb-1">{label}</span>
                <span className="font-mono font-bold text-sm leading-none">{value}</span>
            </div>
        </div>
    );
}