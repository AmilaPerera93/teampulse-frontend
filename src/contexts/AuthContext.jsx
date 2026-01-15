import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'; 

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('teampulse_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(false);

  // --- REAL-TIME SYNC & SECURITY GUARD ---
  useEffect(() => {
    if (!currentUser || !currentUser.id || currentUser.id === 'master') return;

    // Listen to the user's record in real-time
    const unsub = onSnapshot(doc(db, 'users', currentUser.id), (docSnap) => {
        if (docSnap.exists()) {
            const freshData = { id: docSnap.id, ...docSnap.data() };
            
            // 🚨 SECURITY GUARD 🚨
            // If a MEMBER (not Admin) is logged in but has NO sessionToken in the DB,
            // it means the Desktop App is NOT connected.
            if (freshData.role !== 'ADMIN' && !freshData.sessionToken) {
                 // Only trigger if we currently think we have a session, to prevent loops
                 if (currentUser.role !== 'ADMIN') { 
                     console.warn("Security Alert: No Desktop Session detected. Force logging out.");
                     logout(); // <--- KICK THEM OUT
                     return;
                 }
            }

            // Normal Sync: Update local state if DB changes
            if (JSON.stringify(freshData) !== JSON.stringify(currentUser)) {
                setCurrentUser(freshData);
                localStorage.setItem('teampulse_user', JSON.stringify(freshData));
            }
        } else {
            // If the user document was deleted, log them out
            logout();
        }
    });
    return () => unsub();
  }, [currentUser?.id]);

  async function login(username, password) {
    setLoading(true);
    
    // Master Admin
    if (username === 'admin' && password === 'admin123') {
      const masterData = { fullname: 'Master Admin', username: 'admin', role: 'ADMIN', id: 'master' };
      setCurrentUser(masterData);
      localStorage.setItem('teampulse_user', JSON.stringify(masterData));
      setLoading(false);
      return true;
    }

    try {
      const q = query(
        collection(db, 'users'),
        where('username', '==', username),
        where('password', '==', password)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("Invalid Username or Password");
        setLoading(false);
        return false;
      }

      const docSnap = querySnapshot.docs[0];
      const userData = { id: docSnap.id, ...docSnap.data() };
      
      // 🚨 LOGIN BLOCK 🚨
      // Strictly prevent Members from using the Web Form
      if (userData.role !== 'ADMIN') {
         alert("ACCESS DENIED: Team Members must use the Desktop App.");
         setLoading(false);
         return false;
      }

      // Mark Admin Online
      await updateDoc(doc(db, 'users', docSnap.id), {
        onlineStatus: 'Online',
        lastSeen: serverTimestamp()
      });

      setCurrentUser(userData);
      localStorage.setItem('teampulse_user', JSON.stringify(userData));
      setLoading(false);
      return true;
    } catch (error) {
      console.error("Login error:", error);
      setLoading(false);
      return false;
    }
  }

  // --- TOKEN LOGIN (For Desktop App) ---
  async function loginWithToken(token) {
    setLoading(true);
    try {
        const q = query(collection(db, 'users'), where('sessionToken', '==', token));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            setLoading(false);
            return false;
        }

        const docSnap = snapshot.docs[0];
        const userData = { id: docSnap.id, ...docSnap.data() };
        
        setCurrentUser(userData);
        localStorage.setItem('teampulse_user', JSON.stringify(userData));
        setLoading(false);
        return true;
    } catch (e) {
        setLoading(false);
        return false;
    }
  }

  // --- LOGOUT ---
  async function logout() {
    // Only try to update DB if we have a valid user
    if (currentUser && currentUser.id && currentUser.id !== 'master') {
      try {
        // 1. Pause Tasks
        const qRunning = query(
            collection(db, 'tasks'), 
            where('assignedTo', '==', currentUser.fullname), 
            where('isRunning', '==', true)
        );
        const runningSnap = await getDocs(qRunning);
        
        const updates = runningSnap.docs.map(tDoc => {
             const tData = tDoc.data();
             const elapsed = tData.elapsedMs || 0;
             const session = tData.lastStartTime ? (Date.now() - tData.lastStartTime) : 0;
             
             return updateDoc(doc(db, 'tasks', tDoc.id), {
                 isRunning: false,
                 lastStartTime: null,
                 elapsedMs: elapsed + session
             });
        });
        await Promise.all(updates);

        // 2. Clear Session in DB
        await updateDoc(doc(db, 'users', currentUser.id), {
          onlineStatus: 'Offline',
          lastSeen: serverTimestamp(),
          sessionToken: null 
        });

      } catch (e) { console.error("Logout Cleanup Error:", e); }
    }
    
    // 3. Nuke Local State
    localStorage.removeItem('teampulse_user');
    setCurrentUser(null);
  }

  const value = {
    currentUser,
    login,
    loginWithToken,
    logout,
    loading,
    resetUserPassword: async (uid, newPass) => {
        await updateDoc(doc(db, 'users', uid), { password: newPass });
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}