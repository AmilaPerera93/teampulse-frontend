import React, { createContext, useState, useContext, useEffect } from 'react';
import { loginUser } from '../services/api'; // Import the Azure Bridge

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  // 1. Initialize User from LocalStorage (Persist login on refresh)
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('teampulse_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [loading, setLoading] = useState(false);

  // 2. The Login Function (Now talks to Azure)
  async function login(username, password) {
    setLoading(true);

    // --- Legacy Master Admin Support ---
    if (username === 'admin' && password === 'admin123') {
      const masterData = { fullname: 'Master Admin', username: 'admin', role: 'ADMIN', id: 'master' };
      completeLogin(masterData);
      return true;
    }

    try {
      // Call the Azure API
      const response = await loginUser(username, password);

      if (response.success) {
        const user = response.user;

        // Role Check: Only Admins allowed on Web
        if (user.role !== 'ADMIN') {
             alert("ACCESS DENIED: Team Members must use the Desktop App.");
             setLoading(false);
             return false;
        }

        completeLogin(user);
        return true;
      } else {
        alert("Invalid Username or Password"); // Response from API was { success: false }
        setLoading(false);
        return false;
      }

    } catch (error) {
      console.error("Login Error:", error);
      alert("System Error: Could not connect to Azure Backend.");
      setLoading(false);
      return false;
    }
  }

  // Helper to save state
  function completeLogin(userData) {
    setCurrentUser(userData);
    localStorage.setItem('teampulse_user', JSON.stringify(userData));
    setLoading(false);
  }

  // 3. The Logout Function
  function logout() {
    // We simply clear the local session. 
    // The Desktop App handles the complex "Stop Tasks" logic.
    localStorage.removeItem('teampulse_user');
    setCurrentUser(null);
  }

  const value = {
    currentUser,
    login,
    logout,
    loading,
    isAuthenticated: !!currentUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}