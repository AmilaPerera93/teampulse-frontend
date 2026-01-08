import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { useDate } from '../contexts/DateContext';
import { formatMs } from '../utils/helpers';
import { ArrowLeft, Clock, ZapOff, CheckCircle, PlayCircle, DollarSign, Briefcase } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function MemberDetail() {
  const { username } = useParams();
  const { globalDate } = useDate();
  const navigate = useNavigate();
  
  const [tasks, setTasks] = useState([]);
  const [interruptions, setInterruptions] = useState([]);
  const [activeInterruption, setActiveInterruption] = useState(null);
  const [stats, setStats] = useState({ worked: 0, estimated: 0, downtime: 0, netAvailable: 0 });

  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch Tasks
      const qTasks = query(collection(db, 'tasks'), where('assignedTo', '==', username), where('date', '==', globalDate));
      
      // 2. Fetch Interruptions
      const qInt = query(collection(db, 'interruptions'), where('user', '==', username), where('date', '==', globalDate));

      const [snapTasks, snapInt] = await Promise.all([getDocs(qTasks), getDocs(qInt)]);

      const taskData = snapTasks.docs.map(d => d.data());
      const intData = snapInt.docs.map(d => ({...d.data(), id: d.id}));

      setTasks(taskData);
      setInterruptions(intData);

      // Find if currently in power cut
      const active = intData.find(i => i.active === true);
      setActiveInterruption(active || null);

      // --- ADVANCED CALCULATIONS ---
      const totalWorkedMs = taskData.reduce((acc, t) => acc + (t.elapsedMs || 0) + (t.isRunning ? (Date.now() - t.lastStartTime) : 0), 0);
      const totalEstHours = taskData.reduce((acc, t) => acc + (t.estHours || 0), 0);
      
      const totalDowntimeMs = intData.reduce((acc, i) => acc + (i.durationMs || (i.active ? (Date.now() - i.startTime) : 0)), 0);

      // Standard Day = 8 Hours (28800000 ms)
      // Net Available = 8 Hours - Downtime
      const standardDay = 8 * 60 * 60 * 1000;
      const netAvailable = Math.max(0, standardDay - totalDowntimeMs);

      setStats({
        worked: totalWorkedMs,
        estimated: totalEstHours * 3600000,
        downtime: totalDowntimeMs,
        netAvailable: netAvailable
      });
    };
    fetchData();
  }, [username, globalDate]);

  // --- ACTIONS ---

  const reportPowerCut = async () => {
    if(!confirm(`Mark ${username} as having a power cut?`)) return;
    await addDoc(collection(db, 'interruptions'), {
        user: username, type: 'Admin Reported Outage', startTime: Date.now(), active: true, date: globalDate
    });
    window.location.reload();
  };

  const resumeMember = async () => {
    if(!activeInterruption) return;
    if(!confirm(`Resume work for ${username}? (End Power Cut)`)) return;
    
    const duration = Date.now() - activeInterruption.startTime;
    await updateDoc(doc(db, 'interruptions', activeInterruption.id), {
        active: false, endTime: Date.now(), durationMs: duration
    });
    window.location.reload();
  };

  // Fair Score: (Worked / NetAvailable) * 100
  const efficiencyScore = stats.netAvailable > 0 ? Math.round((stats.worked / stats.netAvailable) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="btn btn-ghost"><ArrowLeft size={18} /> Back</button>
            <h1 className="text-2xl font-bold">{username}</h1>
            {activeInterruption && (
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2">
                    <ZapOff size={12} /> POWER CUT ACTIVE
                </span>
            )}
        </div>
        <div className="flex gap-2">
            {activeInterruption ? (
                <button onClick={resumeMember} className="btn bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200">
                    <PlayCircle size={18} /> Resume Member
                </button>
            ) : (
                <button onClick={reportPowerCut} className="btn btn-outline text-amber-600 hover:bg-amber-50">
                    <ZapOff size={18} /> Report Outage
                </button>
            )}
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card border-l-4 border-l-primary">
            <div className="text-text-sec text-xs font-bold uppercase">Actual Worked</div>
            <div className="text-2xl font-mono font-bold text-primary mt-1">{formatMs(stats.worked)}</div>
        </div>
        <div className="card border-l-4 border-l-red-400">
            <div className="text-text-sec text-xs font-bold uppercase">Lost Time (Cuts)</div>
            <div className="text-2xl font-mono font-bold text-red-500 mt-1">{formatMs(stats.downtime)}</div>
        </div>
        <div className="card border-l-4 border-l-slate-300">
            <div className="text-text-sec text-xs font-bold uppercase">Net Available</div>
            <div className="text-sm text-slate-400">8h - Cuts</div>
            <div className="text-xl font-mono font-bold text-slate-600">{formatMs(stats.netAvailable)}</div>
        </div>
        <div className="card border-l-4 border-l-emerald-500">
            <div className="text-text-sec text-xs font-bold uppercase">Fair Efficiency</div>
            <div className="text-2xl font-mono font-bold text-emerald-600 mt-1">{efficiencyScore}%</div>
            <div className="text-xs text-slate-400">Based on available time</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LOGS */}
          <div className="lg:col-span-2 card">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Clock size={18}/> Activity Log</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {interruptions.map(i => (
                      <div key={i.id} className={`p-3 border rounded-lg flex justify-between items-center ${i.active ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-transparent'}`}>
                          <div className="flex items-center gap-2 text-red-700 font-semibold">
                              <ZapOff size={14} /> {i.type}
                          </div>
                          <div className="text-sm font-mono">
                                {new Date(i.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - 
                                {i.active ? ' NOW' : new Date(i.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                          </div>
                      </div>
                  ))}
                  {tasks.map(t => (
                      <div key={t.id} className="p-3 border border-border rounded-lg flex justify-between items-center">
                          <div>
                              <div className="font-semibold text-sm">{t.description}</div>
                              <div className="text-xs text-text-sec">{t.project}</div>
                          </div>
                          <div className="font-mono text-sm font-bold">{formatMs(t.elapsedMs)}</div>
                      </div>
                  ))}
              </div>
          </div>

          {/* VISUALS */}
          <div className="card">
              <h3 className="font-bold mb-4">Day Split</h3>
              <div className="h-64 flex justify-center items-center">
                  <Doughnut data={{
                      labels: ['Worked', 'Power Cuts', 'Unaccounted'],
                      datasets: [{
                          data: [stats.worked, stats.downtime, Math.max(0, stats.netAvailable - stats.worked)],
                          backgroundColor: ['#4f46e5', '#ef4444', '#f1f5f9'],
                          borderWidth: 0
                      }]
                  }} />
              </div>
          </div>
      </div>
    </div>
  );
}