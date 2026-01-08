import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useDate } from '../contexts/DateContext';

export default function ResourcePlanner() {
  const { globalDate } = useDate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // 1. Get All Members
      const uSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'MEMBER')));
      const memberList = uSnap.docs.map(d => d.data());

      // 2. Get All Tasks for this Date
      const tSnap = await getDocs(query(collection(db, 'tasks'), where('date', '==', globalDate)));
      const tasks = tSnap.docs.map(d => d.data());

      // 3. Map Data
      const report = memberList.map(u => {
        const userTasks = tasks.filter(t => t.assignedTo === u.fullname);
        const totalEst = userTasks.reduce((acc, t) => acc + (t.estHours || 0), 0);
        const capacity = 8; // Standard 8 hours
        const utilization = Math.round((totalEst / capacity) * 100);
        
        return { ...u, totalEst, utilization, tasks: userTasks };
      });

      setUsers(report);
      setLoading(false);
    };
    fetchData();
  }, [globalDate]);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Resource Allocation ({globalDate})</h2>
      <div className="space-y-4">
        {users.map(u => (
            <div key={u.username} className="card p-5">
                <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-lg">{u.fullname}</div>
                    <div className={`font-bold px-3 py-1 rounded text-sm ${
                        u.utilization > 100 ? 'bg-red-100 text-red-700' : 
                        u.utilization > 80 ? 'bg-amber-100 text-amber-700' : 
                        'bg-emerald-100 text-emerald-700'
                    }`}>
                        {u.utilization}% Capacity
                    </div>
                </div>
                
                {/* Visual Bar */}
                <div className="w-full bg-slate-100 rounded-full h-4 mb-4 overflow-hidden">
                    <div 
                        className={`h-full ${u.utilization > 100 ? 'bg-red-500' : 'bg-primary'}`} 
                        style={{ width: `${Math.min(u.utilization, 100)}%` }}
                    ></div>
                </div>

                <div className="flex justify-between text-sm text-slate-500">
                    <span>Assigned: {u.totalEst}h</span>
                    <span>Capacity: 8h</span>
                </div>

                {/* Mini Task List */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {u.tasks.map((t, i) => (
                        <div key={i} className="text-xs bg-slate-50 p-2 rounded border border-slate-100 truncate">
                            {t.description} ({t.estHours}h)
                        </div>
                    ))}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}