import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'; // Added updateDoc, serverTimestamp

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

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('teampulse_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('teampulse_user');
    }
  }, [currentUser]);

  async function login(username, password) {
    setLoading(true);
    // Emergency Fallback
    if (username === 'admin' && password === 'admin123') {
      setCurrentUser({ fullname: 'Master Admin', username: 'admin', role: 'ADMIN', id: 'master' });
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
      
      // Update status to Online immediately on login
      await updateDoc(doc(db, 'users', docSnap.id), {
        onlineStatus: 'Online',
        lastSeen: serverTimestamp()
      });

      setCurrentUser(userData);
      setLoading(false);
      return true;
    } catch (error) {
      console.error("Login error:", error);
      alert("Login failed. Check console.");
      setLoading(false);
      return false;
    }
  }

  // UPDATED LOGOUT FUNCTION
  async function logout() {
    if (currentUser && currentUser.id && currentUser.id !== 'master') {
      try {
        // Mark as Offline in DB
        await updateDoc(doc(db, 'users', currentUser.id), {
          onlineStatus: 'Offline',
          lastSeen: serverTimestamp()
        });
      } catch (e) {
        console.error("Error setting offline status:", e);
      }
    }
    setCurrentUser(null);
  }

  const value = {
    currentUser,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}