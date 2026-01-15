import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  getDocs 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { 
  BookOpen, Play, CheckCircle, Plus, User, 
  ExternalLink, Pencil, Trash2, X, Save 
} from 'lucide-react';

export default function TrainingManager() {
  const { currentUser } = useAuth();
  const [trainings, setTrainings] = useState([]);
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // Null = Assigning, ID = Editing
  const [loading, setLoading] = useState(true);

  // Form States
  const [formData, setFormData] = useState({ title: '', platform: '', assignedTo: '', description: '' });
  const [reportUrl, setReportUrl] = useState('');
  const [completingId, setCompletingId] = useState(null);

  useEffect(() => {
    if (!currentUser?.id) return;

    // 1. Setup Listener for Trainings
    const q = currentUser.role === 'ADMIN' 
      ? collection(db, 'trainings') 
      : query(collection(db, 'trainings'), where('assignedTo', '==', currentUser.fullname));
    
    const unsub = onSnapshot(q, (snap) => {
      setTrainings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // 2. Fetch User List for Admin (One-time fetch)
    if(currentUser.role === 'ADMIN') {
        getDocs(query(collection(db, 'users'), where('role', '==', 'MEMBER'))).then(snap => {
            setUsers(snap.docs.map(d => d.data().fullname));
        });
    }

    return () => unsub();
  }, [currentUser?.id]);

  // CREATE OR UPDATE
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        if (editingId) {
            await updateDoc(doc(db, 'trainings', editingId), { ...formData });
        } else {
            await addDoc(collection(db, 'trainings'), {
                ...formData,
                status: 'Assigned',
                createdAt: serverTimestamp(),
                reportUrl: null
            });
        }
        closeModal();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this training? This cannot be undone.")) return;
    try {
        await deleteDoc(doc(db, 'trainings', id));
    } catch (err) { console.error(err); }
  };

  const openEdit = (training) => {
    setEditingId(training.id);
    setFormData({ 
        title: training.title, 
        platform: training.platform, 
        assignedTo: training.assignedTo, 
        description: training.description 
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ title: '', platform: '', assignedTo: '', description: '' });
  };

  const startTraining = async (training) => {
    await updateDoc(doc(db, 'trainings', training.id), { status: 'Started' });
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
        reportUrl, status: 'Completed', completedAt: serverTimestamp() 
    });
    setCompletingId(null);
    setReportUrl('');
  };

  if (loading) return <div className="p-20 text-center text-slate-400 animate-pulse">Syncing Academy...</div>;

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in fade-in">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Academy</h2>
          <p className="text-slate-500 font-medium">Professional certifications & training path.</p>
        </div>
        {currentUser.role === 'ADMIN' && (
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary shadow-xl shadow-indigo-100 px-6">
            <Plus size={20} className="mr-2"/> Assign Course
          </button>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2rem] w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-800">{editingId ? 'Edit Training' : 'Assign Training'}</h3>
                <button type="button" onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Course Title</label>
                <input className="input-field" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Platform</label>
                <input className="input-field" value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Assign To</label>
                <select className="input-field" value={formData.assignedTo} onChange={e => setFormData({...formData, assignedTo: e.target.value})} required>
                  <option value="">Select Member...</option>
                  {users.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Notes</label>
                <textarea className="input-field h-24 pt-3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button type="button" onClick={closeModal} className="btn btn-ghost flex-1">Cancel</button>
              <button type="submit" className="btn btn-primary flex-1 shadow-lg shadow-indigo-100">
                {editingId ? <><Save size={18} className="mr-2"/> Update</> : 'Assign Now'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* COMPLETION MODAL */}
      {completingId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-bold mb-2 text-slate-800">Finalize Training</h3>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">Paste the link to your report (Google Drive/Doc/Notion) to mark this as finished.</p>
            <div className="flex flex-col gap-4">
               <input className="input-field" placeholder="https://..." value={reportUrl} onChange={e => setReportUrl(e.target.value)} autoFocus />
               <div className="flex gap-3">
                 <button onClick={() => setCompletingId(null)} className="btn btn-ghost flex-1">Cancel</button>
                 <button onClick={completeTraining} className="btn btn-primary flex-1">Submit & Close</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* LISTING */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {trainings.map(t => (
          <div key={t.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 flex flex-col group hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-50/50 transition-all duration-500 relative">
            
            {/* ADMIN ACTIONS */}
            {currentUser.role === 'ADMIN' && (
                <div className="absolute top-6 right-6 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button onClick={() => openEdit(t)} className="p-2 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"><Pencil size={16}/></button>
                    <button onClick={() => handleDelete(t.id)} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-colors"><Trash2 size={16}/></button>
                </div>
            )}

            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
                <BookOpen size={28} />
              </div>
              <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border mt-2 ${
                t.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                t.status === 'Started' ? 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse' : 'bg-slate-50 text-slate-500 border-slate-100'
              }`}>
                {t.status}
              </span>
            </div>

            <h3 className="text-2xl font-bold text-slate-800 leading-tight mb-1 pr-10">{t.title}</h3>
            <p className="text-indigo-600 font-bold text-xs uppercase tracking-[0.2em] mb-4">{t.platform}</p>
            
            <div className="flex-1 p-4 bg-slate-50 rounded-2xl text-xs text-slate-500 italic border border-slate-100 leading-relaxed">
                "{t.description || 'No special instructions provided.'}"
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">{t.assignedTo.charAt(0)}</div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.assignedTo}</span>
              </div>

              {t.status === 'Assigned' && currentUser.fullname === t.assignedTo && (
                <button onClick={() => startTraining(t)} className="btn btn-primary w-full justify-center py-4 rounded-2xl">
                  <Play size={18} fill="currentColor" className="mr-2"/> Start Certification
                </button>
              )}

              {t.status === 'Started' && currentUser.fullname === t.assignedTo && (
                <button onClick={() => setCompletingId(t.id)} className="btn bg-emerald-600 text-white hover:bg-emerald-700 w-full justify-center py-4 rounded-2xl shadow-lg shadow-emerald-100">
                  <CheckCircle size={18} className="mr-2"/> Mark as Finished
                </button>
              )}

              {t.status === 'Completed' && t.reportUrl && (
                <a href={t.reportUrl} target="_blank" rel="noreferrer" className="btn bg-slate-900 text-white w-full justify-center py-4 rounded-2xl hover:bg-black transition-colors">
                  <ExternalLink size={18} className="mr-2"/> View Report Link
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}