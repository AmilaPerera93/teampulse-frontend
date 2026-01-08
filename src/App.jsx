import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import MemberDashboard from './components/MemberDashboard';
import AdminDashboard from './components/AdminDashboard';
import UsersManager from './components/UsersManager';       // <--- Import
import ProjectsManager from './components/ProjectsManager'; // <--- Import
import MemberDetail from './components/MemberDetail';
import ClientManager from './components/ClientManager';
import InvoiceManager from './components/InvoiceManager';
import ResourcePlanner from './components/ResourcePlanner';

function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Login />;
  return children;
}

export default function App() {
  const { currentUser } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={
            currentUser?.role === 'ADMIN' ? <AdminDashboard /> : <MemberDashboard />
          } /> 
          
          {/* NOW THESE ROUTES WORK: */}
          <Route path="users" element={<UsersManager />} />
          <Route path="projects" element={<ProjectsManager />} />
          <Route path="history" element={<div>History Page</div>} />
          <Route path="member/:username" element={<MemberDetail />} />
          <Route path="crm" element={<ClientManager />} />
          <Route path="finance" element={<InvoiceManager />} />   
          <Route path="resources" element={<ResourcePlanner />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}