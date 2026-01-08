import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Trash2, UserPlus, Shield, User, Lock, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext'; // Import context to use reset function

export default function UsersManager() {
  const [users, setUsers] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { resetUserPassword } = useAuth(); // Hook
  
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

  // --- NEW RESET FUNCTION ---
  const handleResetPassword = async (userId, userName) => {
      const newPass = prompt(`Enter new password for ${userName}:`);
      if (newPass) {
          await resetUserPassword(userId, newPass);
      }
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-2xl font-bold text-text-main">Team Members</h2>
            <p className="text-sm text-text-sec">Manage accounts, roles, and security.</p>
        </div>
        <button onClick={() => setIsFormOpen(!isFormOpen)} className="btn btn-primary shadow-md shadow-indigo-200">
            <UserPlus size={18} className="mr-2" /> New User
        </button>
      </div>

      {/* CREATE USER FORM */}
      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-border mb-8 animate-in slide-in-from-top-4">
            <h3 className="font-bold mb-4 text-slate-700">Add New Account</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input className="input-field mb-0" placeholder="Full Name" value={formData.fullname} onChange={e => setFormData({...formData, fullname: e.target.value})} />
                <input className="input-field mb-0" placeholder="Username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                <input className="input-field mb-0" placeholder="Password" type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                <select className="input-field mb-0" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                </select>
                <div className="md:col-span-2 flex gap-3 mt-4 justify-end">
                    <button type="button" onClick={() => setIsFormOpen(false)} className="btn btn-ghost">Cancel</button>
                    <button type="submit" className="btn btn-primary px-6">Create Account</button>
                </div>
            </form>
        </div>
      )}

      {/* USERS TABLE */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm flex-1">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-50 border-b border-border text-xs uppercase text-slate-500">
                    <th className="p-4 font-bold">Name</th>
                    <th className="p-4 font-bold">Username</th>
                    <th className="p-4 font-bold">Role</th>
                    <th className="p-4 font-bold">Security</th>
                    <th className="p-4 font-bold text-right">Action</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-bold text-text-main flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                {u.fullname.charAt(0)}
                            </div>
                            {u.fullname}
                        </td>
                        <td className="p-4 text-text-sec font-mono text-sm">@{u.username}</td>
                        <td className="p-4">
                            <span className={`badge flex items-center gap-1 w-fit ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {u.role === 'ADMIN' ? <Shield size={12}/> : <User size={12}/>} {u.role}
                            </span>
                        </td>
                        <td className="p-4">
                            <button 
                                onClick={() => handleResetPassword(u.id, u.fullname)} 
                                className="btn-xs bg-slate-100 border border-slate-200 text-slate-600 hover:text-primary hover:border-primary flex items-center gap-2 px-3 py-1.5 rounded font-bold text-xs transition-all"
                            >
                                <KeyRound size={12}/> Reset Pass
                            </button>
                        </td>
                        <td className="p-4 text-right">
                            <button onClick={() => handleDelete(u.id)} className="btn-icon bg-white text-slate-300 hover:text-red-500 hover:bg-red-50 ml-auto">
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