import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { DateProvider } from './contexts/DateContext'; 
import { TimerProvider } from './contexts/TimerContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <DateProvider>
        <TimerProvider> {/* WRAP HERE */}
          <App />
        </TimerProvider>
      </DateProvider>
    </AuthProvider>
  </React.StrictMode>,
);