import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchUsers, fetchTasks, fetchLogs, saveLog } from '../services/api'; // Azure API
import { useDate } from '../contexts/DateContext';
import { ArrowLeft, ZapOff, PlayCircle, Coffee, AlertCircle, CheckCircle } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

// Helper for formatting durations
const formatDuration = (ms) => {
    if (!ms) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default function MemberDetail() {
  const { username } = useParams();
  const { globalDate } = useDate();
  const navigate = useNavigate();
  
  const [tasks, setTasks] = useState([]);
  const [powerLogs, setPowerLogs] = useState([]);
  const [breakLogs, setBreakLogs] = useState([]);
  const [idleLogs, setIdleLogs] = useState([]);
  const [activeInt, setActiveInt] = useState(null);
  const [stats, setStats] = useState({ worked: 0, idle: 0, breaks: 0, downtime: 0, netAvailable: 0 });
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
          // 1. Get User ID from Name (Azure doesn't filter users by name server-side yet)
          const allUsers = await fetchUsers();
          const user = allUsers.find(u => u.fullname === username);
          
          if (!user) {
              setLoading(false);
              return;
          }
          setCurrentUserId(user.id);

          // 2. Fetch All Logs in Parallel
          const [tData, iData, bData, pData, intData] = await Promise.all([
              fetchTasks(username, globalDate),
              fetchLogs('idle_logs', globalDate, user.id),
              fetchLogs('breaks', globalDate, user.id),
              fetchLogs('power_logs', globalDate, user.id),
              fetchLogs('interruptions', globalDate, user.id) // Get interruptions to check active one
          ]);

          // 3. Process & Sort Data
          const idlData = iData
            .filter(d => d.startTime)
            .sort((a,b) => a.startTime - b.startTime); // Ascending for calculations

          setTasks(tData);
          setIdleLogs([...idlData].reverse()); // Reverse for UI
          setBreakLogs(bData.sort((a,b) => b.startTime - a.startTime));
          setPowerLogs(pData.sort((a,b) => b.startTime - a.startTime));
          
          // Check for active interruption
          const active = intData.find(i => i.active === true);
          setActiveInt(active || null);

          // --- CALCULATIONS ---
          const wMs = tData.reduce((acc, t) => acc + (t.elapsedMs || 0) + (t.isRunning ? (Date.now() - t.lastStartTime) : 0), 0);
          const brkMs = bData.reduce((acc, i) => acc + (Number(i.durationMs) || 0), 0);
          const pwrMs = pData.reduce((acc, i) => acc + (Number(i.durationMs) || 0), 0);

          // --- STRICT IDLE LOGIC ---
          let calculatedIdleMs = 0;
          let patternBuffer = [];

          idlData.forEach((log, index) => {
              const duration = Number(log.durationMs) || 0;
              const TEN_MINS = 10 * 60 * 1000;
              const SPECIFIC_50S = 50 * 1000;
              const SPECIFIC_110S = 110 * 1000;

              // SCENARIO 1: Record is 10 minutes or longer
              if (duration >= TEN_MINS) {
                  calculatedIdleMs += duration;
                  if (patternBuffer.length >= 3) {
                      calculatedIdleMs += patternBuffer.reduce((a, b) => a + b, 0);
                  }
                  patternBuffer = [];
              } 
              // SCENARIO 2: Specific pattern detection
              else if (duration === SPECIFIC_50S || duration === SPECIFIC_110S) {
                  patternBuffer.push(duration);
              } 
              // Reset buffer
              else {
                  if (patternBuffer.length >= 3) {
                      calculatedIdleMs += patternBuffer.reduce((a, b) => a + b, 0);
                  }
                  patternBuffer = [];
              }

              // Final check
              if (index === idlData.length - 1 && patternBuffer.length >= 3) {
                  calculatedIdleMs += patternBuffer.reduce((a, b) => a + b, 0);
              }
          });

          const standardDay = 8 * 60 * 60 * 1000;
          const netAvailable = Math.max(0, standardDay - pwrMs - brkMs);

          setStats({ 
              worked: wMs, 
              idle: calculatedIdleMs, 
              breaks: brkMs, 
              downtime: pwrMs, 
              netAvailable 
          });

      } catch (error) {
          console.error("Member Detail Error:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, [username, globalDate]);

  // Actions
  const reportPowerCut = async () => {
    if(!confirm(`Start a Power Outage for ${username}?`)) return;
    try {
        await saveLog('interruption', { 
            user: username, 
            userId: currentUserId, 
            active: true, 
            startTime: Date.now(), 
            date: globalDate, 
            type: 'Power Cut' 
        });
        window.location.reload();
    } catch (e) { alert("Failed to report outage"); }
  };

  const resumeMember = async () => {
    if(!activeInt) return;
    if(!confirm(`Resume work for ${username}?`)) return;
    
    try {
        const duration = Date.now() - activeInt.startTime;
        // 1. Create permanent log
        await saveLog('power', {
            userId: activeInt.userId, 
            userName: username, 
            startTime: activeInt.startTime, 
            endTime: Date.now(), 
            durationMs: duration, 
            date: globalDate
        });
        // 2. Note: In Azure, we don't 'update' the interruption active status usually
        // unless you built an 'updateInterruption' endpoint. 
        // For now, reloading re-fetches logs, but to fully clear it from UI immediately:
        // You might need a deleteInterruption or updateLog endpoint if you want to be precise.
        // Assuming saveLog handles the logic or we rely on the new power log to calculate stats.
        
        // IMPORTANT: If your system relies on `active: false` in DB, you need an update API.
        // But for this display, a reload works if the backend processes it.
        window.location.reload();
    } catch (e) { alert("Failed to resume"); }
  };

  const score = stats.netAvailable > 0 ? Math.round((stats.worked / stats.netAvailable) * 100) : 0;

  if (loading) return <div className="p-20 text-center animate-pulse text-slate-400">Loading Report...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="btn btn-ghost p-2"><ArrowLeft size={18} /></button>
            <div>
                <h1 className="text-2xl font-bold text-slate-800">{username}</h1>
                <p className="text-xs text-slate-400 font-mono">{globalDate}</p>
            </div>
            {activeInt && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">POWER CUT ACTIVE</span>}
        </div>
        <div>
            {activeInt ? (
                <button onClick={resumeMember} className="btn bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200 shadow-lg"><PlayCircle size={18} className="mr-2"/> Resume Member</button>
            ) : (
                <button onClick={reportPowerCut} className="btn btn-outline text-red-500 border-red-200 hover:bg-red-50"><ZapOff size={18} className="mr-2"/> Report Outage</button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard label="Worked" value={formatDuration(stats.worked)} color="border-l-indigo-500 text-indigo-600" />
        <MetricCard label="Filtered Idle" value={formatDuration(stats.idle)} color="border-l-amber-500 text-amber-600" />
        <MetricCard label="Breaks" value={formatDuration(stats.breaks)} color="border-l-blue-500 text-blue-600" />
        <MetricCard label="Outages" value={formatDuration(stats.downtime)} color="border-l-red-500 text-red-600" />
        <MetricCard label="Efficiency" value={`${score}%`} color="border-l-emerald-500 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            
            {/* IDLE LOGS */}
            <Section title="Raw Idle Log" icon={<AlertCircle size={16} className="text-amber-600"/>} css="bg-amber-50/50 border-amber-100">
                 {idleLogs.length === 0 ? <span className="italic text-slate-400 text-xs">No records found.</span> : idleLogs.map((log, i) => (
                    <div key={i} className="flex justify-between p-2 bg-white rounded border border-amber-100 mb-2 text-sm">
                        <span className="text-slate-500 font-mono">
                            {log.startTime ? new Date(log.startTime).toLocaleTimeString() : 'Unknown'} - 
                            {log.endTime ? new Date(log.endTime).toLocaleTimeString() : '...'}
                        </span>
                        <span className="font-bold text-amber-700">{formatDuration(log.durationMs)}</span>
                    </div>
                ))}
            </Section>

            {/* POWER & BREAKS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Section title="Power Outages" icon={<ZapOff size={16} className="text-red-600"/>} css="bg-red-50/50 border-red-100">
                    {powerLogs.map((log, i) => (
                        <div key={i} className="flex justify-between p-2 bg-white rounded border border-red-100 mb-2 text-sm">
                            <span className="text-slate-500 font-mono">{new Date(log.startTime).toLocaleTimeString()} - {new Date(log.endTime).toLocaleTimeString()}</span>
                            <span className="font-bold text-red-700">{formatDuration(log.durationMs)}</span>
                        </div>
                    ))}
                </Section>
                <Section title="Breaks" icon={<Coffee size={16} className="text-blue-600"/>} css="bg-blue-50/50 border-blue-100">
                    {breakLogs.map((log, i) => (
                        <div key={i} className="flex justify-between p-2 bg-white rounded border border-blue-100 mb-2 text-sm">
                            <span className="text-slate-500 font-mono">{new Date(log.startTime).toLocaleTimeString()} - {new Date(log.endTime).toLocaleTimeString()}</span>
                            <span className="font-bold text-blue-700">{formatDuration(log.durationMs)}</span>
                        </div>
                    ))}
                </Section>
            </div>
            
            <div className="card">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-700"><CheckCircle size={18}/> Productive Tasks</h3>
                {tasks.map((t, i) => {
                    const isDone = t.status === 'Done';
                    return (
                        <div key={i} className={`flex justify-between p-3 border-b last:border-0 hover:bg-slate-50 transition-colors ${isDone ? 'opacity-70 bg-slate-50' : ''}`}>
                            <div>
                                <div className={`font-medium ${isDone ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                    {t.description}
                                </div>
                                <div className="text-[10px] text-slate-400 uppercase font-bold">{t.project}</div>
                            </div>
                            <span className={`font-mono font-bold ${isDone ? 'text-slate-400' : 'text-indigo-600'}`}>
                                {formatDuration(t.elapsedMs)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>

        <div className="card h-fit sticky top-6 flex flex-col items-center">
            <h3 className="font-bold mb-6 text-slate-700">Time Split</h3>
            <Doughnut data={{
                labels: ['Work', 'Filtered Idle', 'Break', 'Power'],
                datasets: [{
                    data: [stats.worked, stats.idle, stats.breaks, stats.downtime],
                    backgroundColor: ['#6366f1', '#f59e0b', '#3b82f6', '#ef4444'],
                    borderWidth: 0
                }]
            }} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children, css }) {
    return (
        <div className={`p-4 rounded-xl border ${css}`}>
            <h3 className="font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">{icon} {title}</h3>
            <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">{children}</div>
        </div>
    );
}

function MetricCard({ label, value, color }) {
    return (
        <div className={`bg-white p-4 rounded-xl border-l-4 shadow-sm ${color}`}>
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
    );
}