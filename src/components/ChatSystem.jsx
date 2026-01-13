import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, setDoc, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Send, Search, User, ShieldAlert, MessageCircle, Lock } from 'lucide-react';

// Helper: Generate a consistent Chat ID for two users
const getChatId = (user1, user2) => {
    return [user1, user2].sort().join("_");
};

export default function ChatSystem() {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const scrollRef = useRef();
    
    // Super Admin State
    const [isSuperAdminMode, setSuperAdminMode] = useState(false);
    const [allActiveChats, setAllActiveChats] = useState([]);

    // 1. FETCH USERS (Sidebar)
    useEffect(() => {
        if (!currentUser) return;
        
        const q = query(collection(db, 'users'));
        const unsub = onSnapshot(q, (snap) => {
            let userList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Remove self from list
            userList = userList.filter(u => u.fullname !== currentUser.fullname);
            setUsers(userList);
        });
        return () => unsub();
        
        // --- QUOTA FIX: Removed 'currentUser' ---
        // We only restart this listener if the user ID changes (Log out/in)
    }, [currentUser.id]); 

    // 2. LISTEN TO MESSAGES (When a user is selected)
    useEffect(() => {
        if (!selectedUser && !isSuperAdminMode) return;
        if (!currentUser) return;

        let chatId;
        if (isSuperAdminMode) {
            if (!selectedUser) return;
            chatId = selectedUser.id; 
        } else {
            chatId = getChatId(currentUser.id, selectedUser.id);
        }

        const q = query(
            collection(db, 'chats', chatId, 'messages'), 
            orderBy('timestamp', 'asc')
        );

        const unsub = onSnapshot(q, (snap) => {
            setMessages(snap.docs.map(doc => doc.data()));
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        });

        return () => unsub();
        
        // --- QUOTA FIX: Changed 'currentUser' to 'currentUser.id' ---
        // This prevents re-reading all messages every time your heartbeat updates
    }, [selectedUser, currentUser.id, isSuperAdminMode]);

    // 3. LISTEN TO ALL CHATS (Super Admin Only)
    useEffect(() => {
        if (!isSuperAdminMode) return;

        const q = query(collection(db, 'chats'), orderBy('lastMessageTime', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setAllActiveChats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [isSuperAdminMode]);

    // SEND MESSAGE FUNCTION
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedUser) return;

        if (isSuperAdminMode) {
            alert("Monitoring mode is read-only.");
            return;
        }

        const chatId = getChatId(currentUser.id, selectedUser.id);
        const chatRef = doc(db, 'chats', chatId);

        // 1. Add Message
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
            text: newMessage,
            senderId: currentUser.id,
            senderName: currentUser.fullname,
            timestamp: serverTimestamp()
        });

        // 2. Update Parent Chat (For Sidebar preview)
        await setDoc(chatRef, {
            participants: [currentUser.id, selectedUser.id],
            participantNames: [currentUser.fullname, selectedUser.fullname],
            lastMessage: newMessage,
            lastMessageTime: serverTimestamp()
        }, { merge: true });

        setNewMessage("");
    };

    const filteredUsers = users.filter(u => u.fullname.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex h-[calc(100vh-100px)] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
            {/* SIDEBAR */}
            <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-white">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            {isSuperAdminMode ? <ShieldAlert className="text-red-600"/> : <MessageCircle className="text-indigo-600"/>}
                            {isSuperAdminMode ? "Surveillance" : "Team Chat"}
                        </h2>
                        {currentUser.role === 'SUPER_ADMIN' && (
                            <button 
                                onClick={() => { setSuperAdminMode(!isSuperAdminMode); setSelectedUser(null); setMessages([]); }}
                                className={`text-[10px] px-2 py-1 rounded border font-bold uppercase transition-colors ${isSuperAdminMode ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                                {isSuperAdminMode ? "Exit Monitor" : "Monitor"}
                            </button>
                        )}
                    </div>
                    {!isSuperAdminMode && (
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                            <input 
                                type="text" placeholder="Search colleagues..." 
                                className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 ring-indigo-500 outline-none transition-all"
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {isSuperAdminMode ? (
                        allActiveChats.map(chat => (
                            <div key={chat.id} onClick={() => setSelectedUser(chat)} className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-red-50 transition-colors ${selectedUser?.id === chat.id ? 'bg-red-50 border-l-4 border-l-red-500' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <div className="font-bold text-sm text-slate-700 truncate w-40">{chat.participantNames?.join(" & ")}</div>
                                    <span className="text-[10px] text-slate-400">{chat.lastMessageTime?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                </div>
                                <div className="text-xs text-slate-500 truncate mt-1 italic">"{chat.lastMessage}"</div>
                            </div>
                        ))
                    ) : (
                        filteredUsers.map(user => (
                            <div key={user.id} onClick={() => setSelectedUser(user)} className={`p-4 flex items-center gap-3 cursor-pointer transition-all hover:bg-white ${selectedUser?.id === user.id ? 'bg-white shadow-sm border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}>
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">{user.fullname.charAt(0)}</div>
                                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${user.onlineStatus === 'Online' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-slate-700">{user.fullname}</div>
                                    <div className="text-xs text-slate-400">{user.role}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* CHAT WINDOW */}
            <div className="flex-1 flex flex-col bg-[#f8fafc] relative">
                {selectedUser ? (
                    <>
                        <div className={`h-16 border-b border-slate-200 flex items-center px-6 justify-between ${isSuperAdminMode ? 'bg-red-50' : 'bg-white'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                    {isSuperAdminMode ? <Lock size={16} /> : <User size={16} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{isSuperAdminMode ? `Monitoring: ${selectedUser.participantNames?.join(" & ")}` : selectedUser.fullname}</h3>
                                    {isSuperAdminMode && <span className="text-xs text-red-500 font-bold tracking-wide uppercase">Read Only Mode</span>}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg, index) => {
                                const isMe = msg.senderId === currentUser.id;
                                const bubbleStyle = isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm";
                                return (
                                    <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${bubbleStyle}`}>
                                            {isSuperAdminMode && !isMe && <div className="text-[10px] font-bold opacity-50 mb-1">{msg.senderName}</div>}
                                            {msg.text}
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    </div>
                                );
                            })}
                            <div ref={scrollRef}></div>
                        </div>

                        {!isSuperAdminMode && (
                            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-200 flex gap-2">
                                <input type="text" className="flex-1 bg-slate-100 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Type a message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)}/>
                                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full transition-colors shadow-lg shadow-indigo-200"><Send size={18} /></button>
                            </form>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                        <MessageCircle size={64} className="mb-4 opacity-50" />
                        <p className="font-medium text-lg">Select a colleague to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    );
}