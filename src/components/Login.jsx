import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Zap } from 'lucide-react'; // Using modern icons

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    await login(username, password);
  };

  return (
    <div className="fixed inset-0 bg-bg-body z-50 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col items-center">
        <div className="text-5xl mb-4 text-primary animate-pulse-fast">
            <Zap size={64} fill="currentColor" />
        </div>
        <h1 className="text-3xl font-extrabold text-text-main mb-2">TeamPulse</h1>
        <p className="text-text-sec mb-8">Sign in to your workspace</p>
        
        <form onSubmit={handleSubmit} className="w-full text-left">
          <label className="text-xs font-extrabold text-text-sec mb-2 block tracking-wider">USERNAME</label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="e.g. admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          
          <label className="text-xs font-extrabold text-text-sec mb-2 block tracking-wider">PASSWORD</label>
          <input 
            type="password" 
            className="input-field" 
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button 
            type="submit" 
            className="btn btn-primary w-full justify-center mt-4 h-12 text-base"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}