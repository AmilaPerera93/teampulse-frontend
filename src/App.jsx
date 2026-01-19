import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Contexts
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DateProvider } from './contexts/DateContext';
import { TimerProvider } from './contexts/TimerContext';

// Components
import Login from './components/Login';
import Layout from './components/Layout';
import MemberDashboard from './components/MemberDashboard';
import AdminDashboard from './components/AdminDashboard'; // You need this file
import UsersManager from './components/UsersManager'; // You need this file
import ProjectsManager from './components/ProjectsManager';
import MemberDetail from './components/MemberDetail';
import ClientManager from './components/ClientManager'; // You need this file
import InvoiceManager from './components/InvoiceManager'; // You need this file
import ResourcePlanner from './components/ResourcePlanner'; // You need this file
import LeaveManager from './components/LeaveManager';
import HistoryLog from './components/HistoryLog';
import GameZone from './components/GameZone'; // You need this file
import MorningMeeting from './components/MorningMeeting';
import TrainingManager from './components/TrainingManager'; // This uses the Academy code I gave you

// --- PROTECTED ROUTE WRAPPER ---
function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  
  if (loading) return <div className="p-20 text-center">Loading App...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  
  return children;
}

// --- MAIN ROUTING LOGIC ---
function AppRoutes() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        {/* DASHBOARD SWITCHER */}
        <Route index element={
          currentUser?.role === 'ADMIN' ? <AdminDashboard /> : <MemberDashboard />
        } /> 
        
        {/* FEATURE ROUTES */}
        <Route path="users" element={<UsersManager />} />
        <Route path="projects" element={<ProjectsManager />} />
        <Route path="member/:username" element={<MemberDetail />} />
        <Route path="crm" element={<ClientManager />} />
        <Route path="finance" element={<InvoiceManager />} />   
        <Route path="resources" element={<ResourcePlanner />} />
        <Route path="leaves" element={<LeaveManager />} />
        <Route path="history" element={<HistoryLog />} />
        <Route path="game" element={<GameZone />} />
        <Route path="meeting" element={<MorningMeeting />} /> 
        <Route path="training" element={<TrainingManager />} />

      </Route>
    </Routes>
  );
}

// --- ROOT APP COMPONENT (PROVIDERS) ---
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DateProvider>
          <TimerProvider>
             <AppRoutes />
          </TimerProvider>
        </DateProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}