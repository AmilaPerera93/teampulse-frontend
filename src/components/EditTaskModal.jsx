import React, { useState, useEffect } from 'react';
import { fetchProjects, saveTask } from '../services/api';
import { X, Save, FolderOpen } from 'lucide-react';

export default function EditTaskModal({ isOpen, onClose, task }) {
  const [formData, setFormData] = useState({ description: '', project: '', estHours: 0 });
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await fetchProjects();
        setProjects(data);
      } catch (e) { console.error(e); }
    };
    if (isOpen) loadProjects();
  }, [isOpen]);

  useEffect(() => {
    if (task) {
      setFormData({
        description: task.description || '',
        project: task.project || '',
        estHours: task.estHours || 0
      });
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Merge original task with form updates to keep IDs and metadata
      await saveTask({ ...task, ...formData, estHours: parseFloat(formData.estHours) });
      onClose();
    } catch (error) {
      alert("Update failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 font-bold">
          <span>Edit Task</span>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input className="input-field w-full p-3 border rounded-lg" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Task Description" required />
          
          <div className="relative">
            <select className="input-field w-full p-3 border rounded-lg appearance-none" value={formData.project} onChange={e => setFormData({...formData, project: e.target.value})} required>
              <option value="">Select Project</option>
              {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <FolderOpen size={16} className="absolute right-3 top-4 text-slate-400" />
          </div>

          <input type="number" step="0.5" className="input-field w-full p-3 border rounded-lg" value={formData.estHours} onChange={e => setFormData({...formData, estHours: e.target.value})} placeholder="Estimated Hours" required />
          
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}