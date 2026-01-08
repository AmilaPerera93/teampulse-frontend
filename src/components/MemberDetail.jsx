import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { useDate } from '../contexts/DateContext';
import { formatMs } from '../utils/helpers';
import { ArrowLeft, Clock, ZapOff, PlayCircle, Coffee, AlertCircle, CheckCircle } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const userQ = query(collection(db, 'users'), where('fullname', '==', username));
      const userSnap = await getDocs(userQ);
      if (userSnap.empty) { setLoading(false); return; }
      const userId = userSnap.docs[0].id;

      // 1. Fetch Tasks
      const qTasks = query(collection(db, 'tasks'), where('assignedTo', '==', username), where('date', '==', globalDate));
      // 2. Fetch Idle Logs
      const qIdle = query(collection(db, 'idle_logs'), where('userId', '==', userId), where('date', '==', globalDate));
      // 3. Fetch Breaks
      const qBreaks = query(collection(db, 'breaks'), where('userId', '==', userId), where('date', '==', globalDate));
      // 4. Fetch Active Interruption
      const qActive = query(collection(db, 'interruptions'), where('user', '==', username), where('active', '==', true));
      // 5. Fetch Power Logs (Finished outages)
      const qPower = query(collection(db, 'power_logs'), where('userId', '==', userId), where('date', '==', globalDate));

      const [sTasks, sIdle, sBreaks, sActive, sPower] = await Promise.all([
        getDocs(qTasks), getDocs(qIdle), getDocs(qBreaks), getDocs(qActive), getDocs(qPower)
      ]);

      const tData = sTasks.docs.map(d => d.data());
      const idlData = sIdle.docs.map(d => d.data()).sort((a,b) => b.startTime - a.startTime);
      const brkData = sBreaks.docs.map(d => d.data()).sort((a,b) => b.startTime - a.startTime);
      const pwrLogs = sPower.docs.map(d => d.data()).sort((a,b) => b.startTime - a.startTime);

      setTasks(tData);
      setIdleLogs(idlData);
      setBreakLogs(brkData);
      setPowerLogs(pwrLogs);
      setActiveInt(!sActive.empty ? {id: sActive.docs[0].id, ...sActive.docs[0].data()} : null);

      const wMs = tData.reduce((acc, t) => acc + (t.elapsedMs || 0), 0);
      const idlMs = idlData.reduce((acc, i) => acc + i.durationMs, 0);
      const brkMs = brkData.reduce((acc, i) => acc + i.durationMs, 0);
      const pwrMs = pwrLogs.reduce((acc, i) => acc + i.durationMs, 0);

      const standardDay = 8 * 60 * 60 * 1000;
      setStats({ worked: wMs, idle: idlMs, breaks: brkMs, downtime: pwrMs, netAvailable: standardDay - brkMs - pwrMs });
      setLoading(false);
    };
    fetchData();
  }, [username, globalDate]);

  const reportPowerCut = async () => {
    if(!confirm(`Start a Power Outage for ${username}?`)) return;
    const userSnap = await getDocs(query(collection(db, 'users'), where('fullname', '==', username)));
    await addDoc(collection(db, 'interruptions'), { 
        user: username, userId: userSnap.docs[0].id, active: true, startTime: Date.now(), date: globalDate, type: 'Power Cut' 
    });
    window.location.reload();
  };

  const resumeMember = async () => {
    if(!activeInt) return;
    if(!confirm(`Resume work for ${username}?`)) return;
    const duration = Date.now() - activeInt.startTime;
    await addDoc(collection(db, 'power_logs'), {
        userId: activeInt.userId, userName: username, startTime: activeInt.startTime, endTime: Date.now(), durationMs: duration, date: globalDate
    });
    await deleteDoc(doc(db, 'interruptions', activeInt.id));
    window.location.reload();
  };

  const score = stats.netAvailable > 0 ? Math.round((stats.worked / stats.netAvailable) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="btn btn-ghost"><ArrowLeft size={18} /> Back</button>
            <h1 className="text-2xl font-bold">{username}</h1>
            {activeInt && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">POWER CUT ACTIVE</span>}
        </div>
        <div>
            {activeInt ? (
                <button onClick={resumeMember} className="btn bg-emerald-500 text-white hover:bg-emerald-600"><PlayCircle size={18} className="mr-2"/> Resume Member</button>
            ) : (
                <button onClick={reportPowerCut} className="btn btn-outline text-red-500 border-red-200"><ZapOff size={18} className="mr-2"/> Report Outage</button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard label="Worked" value={formatMs(stats.worked)} color="border-l-primary" />
        <MetricCard label="Idle Time" value={formatMs(stats.idle)} color="border-l-amber-500" />
        <MetricCard label="Breaks" value={formatMs(stats.breaks)} color="border-l-blue-500" />
        <MetricCard label="Outages" value={formatMs(stats.downtime)} color="border-l-red-500" />
        <MetricCard label="Efficiency" value={`${score}%`} color="border-l-emerald-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <Section title="Idle Log" icon={<AlertCircle size={18} className="text-amber-500"/>} data={idleLogs} color="amber" />
            <Section title="Power Outages" icon={<ZapOff size={18} className="text-red-500"/>} data={powerLogs} color="red" />
            <Section title="Breaks" icon={<Coffee size={18} className="text-blue-500"/>} data={breakLogs} color="blue" />
            
            <div className="card">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-700"><CheckCircle size={18}/> Productive Tasks</h3>
                {tasks.map((t, i) => (
                    <div key={i} className="flex justify-between p-3 border-b last:border-0">
                        <span>{t.description}</span>
                        <span className="font-mono font-bold text-primary">{formatMs(t.elapsedMs)}</span>
                    </div>
                ))}
            </div>
        </div>

        <div className="card h-fit sticky top-6 flex flex-col items-center">
            <h3 className="font-bold mb-6">Time Split</h3>
            <Doughnut data={{
                labels: ['Work', 'Idle', 'Break', 'Power'],
                datasets: [{
                    data: [stats.worked, stats.idle, stats.breaks, stats.downtime],
                    backgroundColor: ['#4f46e5', '#f59e0b', '#3b82f6', '#ef4444'],
                    borderWidth: 0
                }]
            }} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, data, color }) {
    const colors = { amber: "bg-amber-50 border-amber-100 text-amber-800", red: "bg-red-50 border-red-100 text-red-800", blue: "bg-blue-50 border-blue-100 text-blue-800" };
    return (
        <div className={`card ${colors[color]} border shadow-none`}>
            <h3 className="font-bold mb-3 flex items-center gap-2">{icon} {title}</h3>
            {data.length === 0 ? <p className="text-xs opacity-60 italic">No records found.</p> : data.map((d, i) => (
                <div key={i} className="flex justify-between bg-white/80 p-2 rounded mb-1 text-sm">
                    <span className="opacity-70">{new Date(d.startTime).toLocaleTimeString()} - {new Date(d.endTime).toLocaleTimeString()}</span>
                    <span className="font-bold">{formatMs(d.durationMs)}</span>
                </div>
            ))}
        </div>
    );
}

function MetricCard({ label, value, color }) {
    return (
        <div className={`bg-white p-4 rounded-xl border-l-4 ${color} shadow-sm`}>
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{label}</p>
            <p className="text-xl font-bold text-slate-800">{value}</p>
        </div>
    );
}