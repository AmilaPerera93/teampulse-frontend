import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Play, CheckCircle, Link, FileText, Plus, User, ExternalLink } from 'lucide-react';

export default function TrainingManager() {
  const { currentUser } = useAuth();
  const [trainings, setTrainings] = useState([]);
  const [users, setUsers] = useState([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form States
  const [newTraining, setNewTraining] = useState({ title: '', platform: '', assignedTo: '', description: '' });
  const [reportUrl, setReportUrl] = useState('');
  const [completingId, setCompletingId] = useState(null); // Track which training is being finished

  useEffect(() => {
    if (!currentUser) return;

    // 1. Listen for Trainings (Quota Safe)
    const q = currentUser.role === 'ADMIN' 
      ? collection(db, 'trainings') 
      : query(collection(db, 'trainings'), where('assignedTo', '==', currentUser.fullname));
    
    const unsub = onSnapshot(q, (snap) => {
      setTrainings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // 2. Get Users for Assignment (Admin only - One-time fetch)
    if(currentUser.role === 'ADMIN') {
        getDocs(collection(db, 'users')).then(snap => {
            setUsers(snap.docs.map(d => d.data().fullname));
        });
    }

    return () => unsub();
  }, [currentUser?.id]);

  const handleAssign = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'trainings'), {
      ...newTraining,
      status: 'Assigned',
      createdAt: serverTimestamp(),
      reportUrl: null
    });
    setIsAssigning(false);
    setNewTraining({ title: '', platform: '', assignedTo: '', description: '' });
  };

  const startTraining = async (training) => {
    // Update Training Status
    await updateDoc(doc(db, 'trainings', training.id), { status: 'Started' });

    // CREATE A RUNNING TASK (Triggers the Dashboard Timer)
    await addDoc(collection(db, 'tasks'), {
      description: `🎓 TRAINING: ${training.title}`,
      project: 'Academy',
      assignedTo: currentUser.fullname,
      date: new Date().toISOString().split('T')[0],
      status: 'In Progress',
      isRunning: true,
      lastStartTime: Date.now(),
      elapsedMs: 0
    });
  };

  const completeTraining = async () => {
    if (!reportUrl.trim()) return alert("Please provide the link to your report.");
    
    await updateDoc(doc(db, 'trainings', completingId), { 
        reportUrl: reportUrl, 
        status: 'Completed',
        completedAt: serverTimestamp() 
    });
    
    setCompletingId(null);
    setReportUrl('');
    alert("Training successfully marked as Completed!");
  };

  if (loading) return <div className="p-20 text-center text-slate-400 animate-pulse">Accessing Academy...</div>;

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Academy</h2>
          <p className="text-slate-500 mt-1">Professional development and certifications.</p>
        </div>
        {currentUser.role === 'ADMIN' && (
          <button onClick={() => setIsAssigning(true)} className="btn btn-primary shadow-lg shadow-indigo-100">
            <Plus size={18} className="mr-2"/> Assign Course
          </button>
        )}
      </div>

      {/* ADMIN: ASSIGN MODAL */}
      {isAssigning && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAssign} className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-6 text-slate-800">Assign Certification</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Course Title</label>
                <input className="input-field" placeholder="e.g. Local SEO Course" value={newTraining.title} onChange={e => setNewTraining({...newTraining, title: e.target.value})} required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Platform</label>
                <input className="input-field" placeholder="e.g. Semrush Academy" value={newTraining.platform} onChange={e => setNewTraining({...newTraining, platform: e.target.value})} required />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Team Member</label>
                <select className="input-field" value={newTraining.assignedTo} onChange={e => setNewTraining({...newTraining, assignedTo: e.target.value})} required>
                  <option value="">Select Member...</option>
                  {users.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Instructions</label>
                <textarea className="input-field h-20" placeholder="Focus on modules 3 & 4..." value={newTraining.description} onChange={e => setNewTraining({...newTraining, description: e.target.value})}></textarea>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button type="button" onClick={() => setIsAssigning(false)} className="btn btn-ghost flex-1">Cancel</button>
              <button type="submit" className="btn btn-primary flex-1">Assign Now</button>
            </div>
          </form>
        </div>
      )}

      {/* MEMBER: COMPLETE MODAL */}
      {completingId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-2 text-slate-800">Submit Completion</h3>
            <p className="text-sm text-slate-500 mb-6">Paste the link to your report or certificate (Google Drive/Doc).</p>
            <div className="flex flex-col gap-4">
               <input className="input-field" placeholder="https://docs.google.com/..." value={reportUrl} onChange={e => setReportUrl(e.target.value)} autoFocus />
               <div className="flex gap-3">
                 <button onClick={() => setCompletingId(null)} className="btn btn-ghost flex-1">Cancel</button>
                 <button onClick={completeTraining} className="btn btn-primary flex-1">Finalize Training</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* TRAINING CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trainings.map(t => (
          <div key={t.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-7 flex flex-col group hover:border-indigo-400 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
            
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-slate-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                <BookOpen size={24} />
              </div>
              <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border ${
                t.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                t.status === 'Started' ? 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse' : 'bg-slate-50 text-slate-500 border-slate-100'
              }`}>
                {t.status}
              </span>
            </div>

            <h3 className="text-xl font-bold text-slate-800 leading-snug mb-1">{t.title}</h3>
            <p className="text-indigo-600 font-bold text-xs uppercase tracking-widest">{t.platform}</p>
            
            <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-500 italic border border-slate-100">
                "{t.description || 'No special instructions.'}"
            </div>

            <div className="mt-auto pt-6 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <User size={12} className="text-indigo-400"/> {t.assignedTo}
              </div>

              {t.status === 'Assigned' && currentUser.fullname === t.assignedTo && (
                <button onClick={() => startTraining(t)} className="btn btn-primary w-full justify-center py-3">
                  <Play size={16} fill="currentColor" className="mr-2"/> Start This Course
                </button>
              )}

              {t.status === 'Started' && currentUser.fullname === t.assignedTo && (
                <button onClick={() => setCompletingId(t.id)} className="btn bg-emerald-600 text-white hover:bg-emerald-700 w-full justify-center py-3 shadow-lg shadow-emerald-100">
                  <CheckCircle size={16} className="mr-2"/> Complete & Link Report
                </button>
              )}

              {t.status === 'Completed' && t.reportUrl && (
                <a href={t.reportUrl} target="_blank" rel="noreferrer" className="btn bg-slate-800 text-white w-full justify-center py-3 hover:bg-slate-900 transition-colors">
                  <ExternalLink size={16} className="mr-2"/> View Report / Link
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}