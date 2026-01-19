import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Zap, Shield } from 'lucide-react';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  const handleAdminLogin = async (e) => {
      e.preventDefault();
      const success = await login(adminUser, adminPass);  
      if (success) navigate('/');  
  };

  return (
    <div className="fixed inset-0 bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-2xl w-full max-w-md shadow-2xl text-center">
        <Zap size={64} className="text-indigo-600 mx-auto mb-6" fill="currentColor" />
        <h1 className="text-3xl font-black text-slate-800 mb-8">TeamPulse Azure</h1>

        {!showAdminLogin ? (
            <div className="space-y-6">
                <div className="p-4 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold">
                    Desktop Agent required for Members.
                </div>
                <button onClick={() => setShowAdminLogin(true)} className="flex items-center justify-center gap-2 text-slate-400 hover:text-indigo-600 w-full">
                    <Shield size={16}/> Admin Dashboard Login
                </button>
            </div>
        ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
                <input className="w-full p-3 border rounded-xl" placeholder="Username" value={adminUser} onChange={e => setAdminUser(e.target.value)} />
                <input className="w-full p-3 border rounded-xl" type="password" placeholder="Password" value={adminPass} onChange={e => setAdminPass(e.target.value)} />
                <button className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-100">
                    {loading ? 'Verifying...' : 'Login to Azure'}
                </button>
                <button onClick={() => setShowAdminLogin(false)} className="w-full text-slate-400 text-sm">Back</button>
            </form>
        )}
      </div>
    </div>
  );
}