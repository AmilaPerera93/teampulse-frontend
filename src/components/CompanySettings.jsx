import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Save, Upload } from 'lucide-react';

export default function CompanySettings({ onClose }) {
  const [profile, setProfile] = useState({
    name: '', email: '', address: '', phone: '', website: '', logoUrl: ''
  });

  useEffect(() => {
    getDoc(doc(db, 'settings', 'companyProfile')).then(s => {
        if(s.exists()) setProfile(s.data());
    });
  }, []);

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfile(p => ({ ...p, logoUrl: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    await setDoc(doc(db, 'settings', 'companyProfile'), profile);
    alert("Branding Saved!");
    onClose();
  };

  return (
    <div className="bg-white p-8 rounded-xl border border-border shadow-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 border-b pb-4">Company Branding</h2>
      <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2 flex items-center gap-6">
            <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50 overflow-hidden relative">
                {profile.logoUrl ? <img src={profile.logoUrl} className="object-contain w-full h-full" /> : <span className="text-xs text-slate-400">No Logo</span>}
            </div>
            <div>
                <label className="btn btn-outline cursor-pointer">
                    <Upload size={16} className="mr-2"/> Upload Logo
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                </label>
                <p className="text-xs text-slate-400 mt-2">Recommended: Square PNG</p>
            </div>
        </div>
        <div className="col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Company Name</label>
            <input className="input-field mb-0" value={profile.name} onChange={e=>setProfile({...profile, name:e.target.value})} placeholder="ThunderJaw AI" required />
        </div>
        <input className="input-field mb-0" value={profile.email} onChange={e=>setProfile({...profile, email:e.target.value})} placeholder="Email Address" />
        <input className="input-field mb-0" value={profile.phone} onChange={e=>setProfile({...profile, phone:e.target.value})} placeholder="Phone Number" />
        <input className="input-field mb-0 md:col-span-2" value={profile.address} onChange={e=>setProfile({...profile, address:e.target.value})} placeholder="Full Address" />
        <input className="input-field mb-0 md:col-span-2" value={profile.website} onChange={e=>setProfile({...profile, website:e.target.value})} placeholder="Website URL" />
        
        <div className="col-span-2 pt-4">
            <button className="btn btn-primary w-full justify-center"><Save size={16} className="mr-2"/> Save Profile</button>
        </div>
      </form>
    </div>
  );
}