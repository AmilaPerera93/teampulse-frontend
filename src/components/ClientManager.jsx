import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Plus, ArrowRight, X } from 'lucide-react';

const STAGES = ['New', 'Contacted', 'Proposal', 'Negotiation', 'Closed'];

export default function ClientManager() {
  const [clients, setClients] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', value: '', stage: 'New' });

  useEffect(() => onSnapshot(collection(db, 'clients'), s => setClients(s.docs.map(d => ({id:d.id, ...d.data()})))), []);

  const saveClient = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'clients'), form);
    setForm({ name: '', company: '', value: '', stage: 'New' });
    setIsFormOpen(false);
  };

  const moveStage = async (client, direction) => {
    const currentIndex = STAGES.indexOf(client.stage);
    if (currentIndex === -1) return;
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < STAGES.length) {
        await updateDoc(doc(db, 'clients', client.id), { stage: STAGES[newIndex] });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 px-1">
        <h2 className="text-2xl font-bold">Pipeline</h2>
        <button onClick={() => setIsFormOpen(true)} className="btn btn-primary"><Plus size={16}/> New Lead</button>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <form onSubmit={saveClient} className="bg-white p-6 rounded-xl w-96 space-y-4">
                <h3 className="font-bold">Add New Deal</h3>
                <input className="input-field mb-0" placeholder="Contact Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required/>
                <input className="input-field mb-0" placeholder="Company" value={form.company} onChange={e=>setForm({...form, company:e.target.value})} />
                <input className="input-field mb-0" type="number" placeholder="Est. Value ($)" value={form.value} onChange={e=>setForm({...form, value:e.target.value})} />
                <div className="flex gap-2">
                    <button className="btn btn-primary flex-1">Add</button>
                    <button type="button" onClick={() => setIsFormOpen(false)} className="btn btn-outline">Cancel</button>
                </div>
            </form>
        </div>
      )}

      {/* KANBAN BOARD */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full min-w-[1000px] pb-4">
            {STAGES.map(stage => (
                <div key={stage} className="flex-1 flex flex-col bg-slate-100 rounded-xl min-w-[250px]">
                    <div className="p-3 font-bold text-sm text-slate-500 uppercase tracking-wider flex justify-between">
                        {stage}
                        <span className="bg-slate-200 px-2 rounded-full text-xs flex items-center">
                            {clients.filter(c => c.stage === stage).length}
                        </span>
                    </div>
                    <div className="p-2 flex-1 overflow-y-auto space-y-2">
                        {clients.filter(c => c.stage === stage).map(c => (
                            <div key={c.id} className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-all group">
                                <div className="font-bold text-text-main">{c.name}</div>
                                <div className="text-xs text-text-sec">{c.company}</div>
                                <div className="mt-2 font-mono font-bold text-emerald-600">${c.value || '0'}</div>
                                
                                {/* Hover Controls */}
                                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between opacity-50 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => deleteDoc(doc(db, 'clients', c.id))} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                                    <div className="flex gap-1">
                                        {stage !== 'New' && <button onClick={() => moveStage(c, -1)} className="text-slate-400 hover:text-primary text-xs font-bold">Prev</button>}
                                        {stage !== 'Closed' && <button onClick={() => moveStage(c, 1)} className="text-primary hover:text-primary-dark text-xs font-bold flex items-center">Next <ArrowRight size={10}/></button>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}