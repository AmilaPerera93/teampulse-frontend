import React, { useEffect, useState } from 'react';
import { fetchProjects, saveProject, deleteProject } from '../services/api'; // Azure
import { Trash2, Plus, Folder } from 'lucide-react';

export default function ProjectsManager() {
  const [projects, setProjects] = useState([]);
  const [newProject, setNewProject] = useState('');

  const loadProjects = async () => {
    try {
        const data = await fetchProjects(); // Uses manageProjects GET
        setProjects(data);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { loadProjects(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newProject.trim()) return;
    await saveProject({ name: newProject }); // Uses manageProjects POST
    setNewProject('');
    loadProjects();
  };

  const handleDelete = async (id) => {
    if (confirm("Remove this project from the list?")) {
      await deleteProject(id); // Uses manageProjects DELETE
      loadProjects();
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Manage Projects</h2>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
        <form onSubmit={handleAdd} className="flex gap-3">
            <input
                className="input-field mb-0 flex-1"
                placeholder="New Project Name"
                value={newProject}
                onChange={e => setNewProject(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
                <Plus size={18} /> Add
            </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {projects.length === 0 && <div className="p-6 text-center text-slate-400">No projects found.</div>}
        
        {projects.map(p => (
            <div key={p.id} className="flex items-center justify-between p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <div className="flex items-center gap-3 font-semibold text-slate-700">
                    <div className="w-8 h-8 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Folder size={16} />
                    </div>
                    {p.name}
                </div>
                <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                </button>
            </div>
        ))}
      </div>
    </div>
  );
}