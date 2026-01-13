import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { Trash2, Plus, Folder, Loader2 } from 'lucide-react';

export default function ProjectsManager() {
  const [projects, setProjects] = useState([]);
  const [newProject, setNewProject] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // 1. Fetch Projects
  useEffect(() => {
    // We remove orderBy('name') temporarily to ensure no "Missing Index" error blocks us
    const q = query(collection(db, 'projects'));
    
    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Firestore Listen Error:", error);
    });
    
    return () => unsub();
  }, []);

  // 2. Add Project
  const handleAdd = async (e) => {
    e.preventDefault();
    const projectName = newProject.trim();
    
    if (!projectName) return;
    if (isAdding) return;

    setIsAdding(true);
    console.log("Attempting to add project to database...");

    try {
      // We use addDoc to create a new project document
      await addDoc(collection(db, 'projects'), { 
        name: projectName,
        createdAt: serverTimestamp() // Better for sorting later
      });
      
      console.log("Success: Project added!");
      setNewProject('');
    } catch (error) {
      console.error("Detailed Error:", error);
      // This alert will tell us if it's a Permission or Quota issue
      alert(`Failed to add project: ${error.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  // 3. Delete Project
  const handleDelete = async (id) => {
    if (window.confirm("Remove this project from the list?")) {
      try {
        await deleteDoc(doc(db, 'projects', id));
      } catch (error) {
        alert("Delete failed: " + error.message);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Manage Projects</h2>

      {/* ADD PROJECT FORM */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
        <form onSubmit={handleAdd} className="flex gap-3">
          <input 
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-50" 
            placeholder="New Project Name (e.g. Website Redesign)" 
            value={newProject}
            onChange={e => setNewProject(e.target.value)}
            disabled={isAdding}
          />
          <button 
            type="submit" 
            disabled={isAdding || !newProject.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {isAdding ? "Adding..." : "Add"}
          </button>
        </form>
      </div>

      {/* PROJECTS LIST */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {projects.length === 0 && (
          <div className="p-10 text-center text-slate-400 italic">
            No projects found. Add one above to get started.
          </div>
        )}
        
        {projects.map(p => (
          <div key={p.id} className="flex items-center justify-between p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-4 font-semibold text-slate-700">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Folder size={20} />
              </div>
              {p.name}
            </div>
            <button 
              onClick={() => handleDelete(p.id)} 
              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Delete Project"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}