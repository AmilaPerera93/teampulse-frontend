import React, { useState, useEffect } from 'react';
import { fetchUsers, fetchProjects, saveTask } from '../services/api';
import { useDate } from '../contexts/DateContext';
import { X } from 'lucide-react';

export default function AssignTaskModal({ isOpen, onClose }) {
  const { globalDate } = useDate();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  
  const [assignedTo, setAssignedTo] = useState('');
  const [project, setProject] = useState('General');
  const [description, setDescription] = useState('');
  const [estHours, setEstHours] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchData = async () => {
      try {
        const [uData, pData] = await Promise.all([fetchUsers(), fetchProjects()]);
        setUsers(uData);
        setProjects(pData.length > 0 ? pData : [{ name: 'General' }, { name: 'Internal' }]);
      } catch (err) { console.error("Modal fetch error", err); }
    };
    fetchData();
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignedTo || !description) return;
    setLoading(true);

    try {
      await saveTask({
        assignedTo,
        project,
        description,
        estHours: parseFloat(estHours) || 0,
        date: globalDate,
        status: 'Todo',
        elapsedMs: 0,
        isRunning: false,
        lastStartTime: null,
        comments: []
      });
      onClose();
      setDescription('');
      setEstHours('');
    } catch (err) {
      alert("Error assigning task via Azure");
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24} /></button>
        <h2 className="text-xl font-bold mb-6">Assign New Task (Azure)</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1 uppercase">Assignee</label>
                    <select className="w-full p-2 border rounded-lg" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} required>
                        <option value="" disabled>Select Member</option>
                        {users.map(u => <option key={u.id} value={u.fullname}>{u.fullname}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1 uppercase">Project</label>
                    <select className="w-full p-2 border rounded-lg" value={project} onChange={e => setProject(e.target.value)}>
                        {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                </div>
            </div>
            <div>
                <label className="text-xs font-bold text-slate-500 block mb-1 uppercase">Description</label>
                <input type="text" className="w-full p-2 border rounded-lg" placeholder="Task description..." value={description} onChange={e => setDescription(e.target.value)} required />
            </div>
            <div>
                <label className="text-xs font-bold text-slate-500 block mb-1 uppercase">Est. Hours</label>
                <input type="number" className="w-full p-2 border rounded-lg" placeholder="4" value={estHours} onChange={e => setEstHours(e.target.value)} />
            </div>
            <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold" disabled={loading}>{loading ? 'Assigning...' : 'Assign Task'}</button>
                <button type="button" onClick={onClose} className="flex-1 border border-slate-200 py-3 rounded-xl font-bold">Cancel</button>
            </div>
        </form>
      </div>
    </div>
  );
}