import React, { useEffect, useState } from 'react';
import { fetchTrainings, assignTraining, fetchUsers } from '../services/api'; // Azure API
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Play, CheckCircle, Plus, ExternalLink, Clock } from 'lucide-react';

export default function Academy() {
  const { currentUser } = useAuth();
  const [trainings, setTrainings] = useState([]);
  const [users, setUsers] = useState([]); // For Admin dropdown
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', link: '', assignedTo: '', type: 'Video' });

  const loadData = async () => {
    setLoading(true);
    try {
        // Admin sees all, User sees theirs
        const assignedTo = currentUser.role === 'ADMIN' ? null : currentUser.fullname;
        const data = await fetchTrainings(assignedTo);
        setTrainings(data);

        if (currentUser.role === 'ADMIN') {
            const uData = await fetchUsers();
            setUsers(uData.filter(u => u.role === 'MEMBER'));
        }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [currentUser]);

  const handleAssign = async (e) => {
      e.preventDefault();
      if (!formData.title || !formData.assignedTo) return;
      
      try {
          await assignTraining({
              ...formData,
              assignedAt: new Date().toISOString(),
              status: 'Pending'
          });
          setIsModalOpen(false);
          setFormData({ title: '', link: '', assignedTo: '', type: 'Video' });
          loadData();
      } catch (e) { alert("Failed to assign training"); }
  };

  const markComplete = async (id) => {
      // In a real app, you'd have an updateTraining endpoint. 
      // For now, we can reuse the "saveTraining" style or assume you added a PATCH endpoint.
      // Assuming you added the PUT logic to 'manageTrainings.js' as I shared earlier:
      if (!confirm("Mark this training as completed?")) return;
      
      try {
          // We use the fetch API directly if api.js helper is missing for updates
          await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:7071/api'}/manageTrainings`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, assignedTo: currentUser.fullname, status: 'Completed' })
          });
          loadData();
      } catch(e) { alert("Update failed"); }
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-slate-400">Loading Academy...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in pb-20">
      
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Training Academy</h2>
            <p className="text-slate-500">Upskill and track progress.</p>
        </div>
        {currentUser.role === 'ADMIN' && (
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                <Plus size={18} /> Assign Training
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trainings.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                <div className={`h-2 bg-gradient-to-r ${t.status === 'Completed' ? 'from-emerald-400 to-emerald-600' : 'from-indigo-400 to-purple-600'}`}></div>
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-2 rounded-lg ${t.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {t.status === 'Completed' ? <CheckCircle size={24}/> : <BookOpen size={24}/>}
                        </div>
                        {t.status === 'Pending' && currentUser.fullname === t.assignedTo && (
                            <button onClick={() => markComplete(t.id)} className="text-xs font-bold text-slate-400 hover:text-emerald-600 border border-slate-200 px-2 py-1 rounded hover:bg-emerald-50 transition-colors">
                                Mark Done
                            </button>
                        )}
                    </div>
                    
                    <h3 className="font-bold text-lg text-slate-800 mb-1">{t.title}</h3>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">{t.type}</div>

                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
                        <Clock size={14}/> 
                        <span>Assigned: {new Date(t.assignedAt).toLocaleDateString()}</span>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Assigned To</span>
                            <span className="text-sm font-bold text-slate-700">{t.assignedTo}</span>
                        </div>
                        {t.link && (
                            <a href={t.link} target="_blank" rel="noreferrer" className="btn btn-sm bg-slate-900 text-white hover:bg-slate-800 text-xs">
                                Open <ExternalLink size={12} className="ml-1"/>
                            </a>
                        )}
                    </div>
                </div>
            </div>
        ))}
      </div>

      {trainings.length === 0 && (
          <div className="text-center p-20 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
              No trainings assigned yet.
          </div>
      )}

      {/* ASSIGN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
                <h3 className="text-lg font-bold mb-4 text-slate-800">Assign New Training</h3>
                <form onSubmit={handleAssign} className="space-y-4">
                    <input className="input-field" placeholder="Training Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                    <input className="input-field" placeholder="Link (URL)" value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} required />
                    
                    <select className="input-field" value={formData.assignedTo} onChange={e => setFormData({...formData, assignedTo: e.target.value})} required>
                        <option value="" disabled>Select Member</option>
                        {users.map(u => <option key={u.id} value={u.fullname}>{u.fullname}</option>)}
                    </select>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost">Cancel</button>
                        <button type="submit" className="btn btn-primary">Assign</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}