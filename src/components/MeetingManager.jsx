import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { Calendar, Clock, Video, Plus, Trash2, Users, ArrowLeft, ExternalLink } from 'lucide-react';

export default function MeetingManager() {
  const { currentUser } = useAuth();
  
  // State
  const [meetings, setMeetings] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState(null); // If set, shows video room
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [formData, setFormData] = useState({ title: '', date: '', time: '', duration: 30 });

  // 1. Fetch Meetings
  useEffect(() => {
    const q = query(collection(db, 'meetings'), orderBy('scheduledAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter out old meetings (optional, kept for history here)
      setMeetings(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. Schedule Meeting
  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.time) return;

    const scheduledAt = new Date(`${formData.date}T${formData.time}`).toISOString();
    // Generate a unique, secure room name
    const roomName = `TeamPulse-${Math.random().toString(36).substring(7)}-${Date.now()}`;

    await addDoc(collection(db, 'meetings'), {
      title: formData.title,
      scheduledAt: scheduledAt,
      duration: formData.duration,
      createdBy: currentUser.fullname,
      createdById: currentUser.id,
      roomName: roomName,
      createdAt: new Date().toISOString()
    });

    setIsModalOpen(false);
    setFormData({ title: '', date: '', time: '', duration: 30 });
  };

  // 3. Delete Meeting
  const handleDelete = async (id) => {
    if(confirm("Cancel this meeting?")) {
      await deleteDoc(doc(db, 'meetings', id));
    }
  };

  // --- VIEW: ACTIVE MEETING ROOM ---
  if (activeMeeting) {
    return (
      <div className="h-full flex flex-col animate-in fade-in">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setActiveMeeting(null)} className="btn btn-ghost gap-2">
            <ArrowLeft size={18}/> Leave Meeting
          </button>
          <div className="text-right">
            <h2 className="font-bold text-lg">{activeMeeting.title}</h2>
            <p className="text-xs text-slate-400">Hosted by {activeMeeting.createdBy}</p>
          </div>
        </div>
        
        <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
          <JitsiMeeting
            domain="meet.jit.si"
            roomName={activeMeeting.roomName}
            configOverwrite={{
              startWithAudioMuted: true,
              disableThirdPartyRequests: true,
              prejoinPageEnabled: false,
            }}
            interfaceConfigOverwrite={{
              TOOLBAR_BUTTONS: [
                'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
                'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
                'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
                'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone', 'security'
              ],
            }}
            userInfo={{
              displayName: currentUser.fullname
            }}
            onApiReady={(externalApi) => {
              // You can attach listeners here if needed
            }}
            getIFrameRef={(iframeRef) => { iframeRef.style.height = '100%'; }}
          />
        </div>
      </div>
    );
  }

  // --- VIEW: MEETING LIST ---
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Virtual Meetings</h2>
          <p className="text-slate-500">Schedule and join team syncs.</p>
        </div>
        {currentUser.role === 'ADMIN' && (
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary shadow-lg shadow-indigo-200">
            <Plus size={18} className="mr-2" /> Schedule Meeting
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && <div className="col-span-full text-center p-20 text-slate-400">Loading schedule...</div>}
        
        {!loading && meetings.length === 0 && (
          <div className="col-span-full text-center p-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
             <Video size={48} className="mx-auto text-slate-300 mb-4"/>
             <h3 className="text-slate-500 font-medium">No upcoming meetings.</h3>
          </div>
        )}

        {meetings.map(meeting => {
          const date = new Date(meeting.scheduledAt);
          const isToday = new Date().toDateString() === date.toDateString();
          
          return (
            <div key={meeting.id} className={`bg-white rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-all ${isToday ? 'border-indigo-200 ring-4 ring-indigo-50' : 'border-slate-200'}`}>
               {/* TOP STRIP */}
               <div className={`h-2 w-full ${isToday ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>
               
               <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <h3 className="font-bold text-lg text-slate-800 leading-tight mb-1">{meeting.title}</h3>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                           <Users size={12}/> {meeting.createdBy}
                        </div>
                     </div>
                     {(currentUser.role === 'ADMIN' || currentUser.id === meeting.createdById) && (
                        <button onClick={() => handleDelete(meeting.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                           <Trash2 size={16}/>
                        </button>
                     )}
                  </div>

                  <div className="space-y-3 mb-6">
                     <div className="flex items-center gap-3 text-sm text-slate-600">
                        <Calendar size={16} className="text-indigo-500"/>
                        <span className="font-medium">{date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                     </div>
                     <div className="flex items-center gap-3 text-sm text-slate-600">
                        <Clock size={16} className="text-indigo-500"/>
                        <span className="font-medium">
                           {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                           <span className="text-slate-400 ml-1">({meeting.duration} min)</span>
                        </span>
                     </div>
                  </div>

                  <button 
                    onClick={() => setActiveMeeting(meeting)}
                    className={`btn w-full justify-center gap-2 ${isToday ? 'btn-primary' : 'btn-outline'}`}
                  >
                    <Video size={18}/> {isToday ? 'Join Now' : 'Join Room'}
                  </button>
               </div>
            </div>
          );
        })}
      </div>

      {/* SCHEDULE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold mb-6">Schedule New Meeting</h3>
                <form onSubmit={handleSchedule} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                        <input className="input-field" placeholder="e.g. Daily Standup" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                           <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required/>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Time</label>
                           <input type="time" className="input-field" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} required/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Duration (Minutes)</label>
                        <select className="input-field" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})}>
                            <option value="15">15 Minutes</option>
                            <option value="30">30 Minutes</option>
                            <option value="45">45 Minutes</option>
                            <option value="60">1 Hour</option>
                            <option value="90">1.5 Hours</option>
                        </select>
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost">Cancel</button>
                        <button type="submit" className="btn btn-primary px-6">Schedule</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}