import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Trash2, UserPlus, Shield, User } from 'lucide-react';

export default function UsersManager() {
  const [users, setUsers] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({ fullname: '', username: '', password: '', role: 'MEMBER' });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.fullname || !formData.username || !formData.password) return;
    
    await addDoc(collection(db, 'users'), formData);
    setIsFormOpen(false);
    setFormData({ fullname: '', username: '', password: '', role: 'MEMBER' });
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this user? They will no longer be able to log in.")) {
      await deleteDoc(doc(db, 'users', id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-text-main">Team Members</h2>
        <button onClick={() => setIsFormOpen(!isFormOpen)} className="btn btn-primary">
            <UserPlus size={18} /> New User
        </button>
      </div>

      {/* CREATE USER FORM */}
      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-border mb-8 animate-in fade-in slide-in-from-top-4">
            <h3 className="font-bold mb-4">Add New Account</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input className="input-field mb-0" placeholder="Full Name" value={formData.fullname} onChange={e => setFormData({...formData, fullname: e.target.value})} />
                <input className="input-field mb-0" placeholder="Username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                <input className="input-field mb-0" placeholder="Password" type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                <select className="input-field mb-0" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                </select>
                <div className="md:col-span-2 flex gap-2 mt-2">
                    <button type="submit" className="btn btn-primary">Create Account</button>
                    <button type="button" onClick={() => setIsFormOpen(false)} className="btn btn-ghost">Cancel</button>
                </div>
            </form>
        </div>
      )}

      {/* USERS TABLE */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-50 border-b border-border text-xs uppercase text-text-sec">
                    <th className="p-4 font-bold">Name</th>
                    <th className="p-4 font-bold">Username</th>
                    <th className="p-4 font-bold">Password</th>
                    <th className="p-4 font-bold">Role</th>
                    <th className="p-4 font-bold text-right">Action</th>
                </tr>
            </thead>
            <tbody>
                {users.map(u => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                        <td className="p-4 font-semibold text-text-main">{u.fullname}</td>
                        <td className="p-4 text-text-sec">{u.username}</td>
                        <td className="p-4 font-mono text-xs text-slate-400">•••••••</td>
                        <td className="p-4">
                            <span className={`badge flex items-center gap-1 w-fit ${u.role === 'ADMIN' ? 'status-admin' : 'status-todo'}`}>
                                {u.role === 'ADMIN' ? <Shield size={12}/> : <User size={12}/>} {u.role}
                            </span>
                        </td>
                        <td className="p-4 text-right">
                            <button onClick={() => handleDelete(u.id)} className="btn-icon bg-red-50 text-danger hover:bg-red-100 ml-auto">
                                <Trash2 size={16} />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}