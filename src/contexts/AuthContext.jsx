import React, { createContext, useState, useContext, useEffect } from 'react';
import { loginUser } from '../services/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  // 1. Initialize User from LocalStorage (Persist login on refresh)
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('teampulse_user');
    const savedToken = localStorage.getItem('teampulse_token');
    const savedExpiry = localStorage.getItem('teampulse_expiry');
    
    // Check if session is still valid
    if (savedUser && savedToken && savedExpiry) {
      const expiryTime = parseInt(savedExpiry);
      if (Date.now() < expiryTime) {
        return JSON.parse(savedUser);
      } else {
        // Session expired, clear localStorage
        localStorage.removeItem('teampulse_user');
        localStorage.removeItem('teampulse_token');
        localStorage.removeItem('teampulse_expiry');
        return null;
      }
    }
    return null;
  });
  
  const [loading, setLoading] = useState(false);

  // 2. The Login Function (Now talks to Azure)
  async function login(username, password) {
    setLoading(true);

    // --- Legacy Master Admin Support ---
    if (username === 'admin' && password === 'admin123') {
      const masterData = { fullname: 'Master Admin', username: 'admin', role: 'ADMIN', id: 'master' };
      completeLogin(masterData, null, null);
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

        // Calculate expiry time from response
        const expiryTime = Date.now() + (response.expiresIn * 1000); // Convert seconds to milliseconds
        completeLogin(user, response.token, expiryTime);
        return true;
      } else {
        alert(response.message || "Invalid Username or Password");
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
  function completeLogin(userData, token, expiryTime) {
    setCurrentUser(userData);
    localStorage.setItem('teampulse_user', JSON.stringify(userData));
    if (token && expiryTime) {
      localStorage.setItem('teampulse_token', token);
      localStorage.setItem('teampulse_expiry', expiryTime.toString());
    }
    setLoading(false);
  }

  // 3. The Logout Function
  function logout() {
    localStorage.removeItem('teampulse_user');
    localStorage.removeItem('teampulse_token');
    localStorage.removeItem('teampulse_expiry');
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