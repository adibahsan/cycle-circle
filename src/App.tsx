import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { LogSymptoms } from './pages/LogSymptoms';
import { Calendar } from './pages/Calendar';
import { SecretChats } from './pages/SecretChats';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';

// ─── Auth guard ───────────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUserId } = useAppContext();
  const location = useLocation();
  if (!currentUserId) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
};

// ─── Public-only route (redirects authenticated users away) ──────────────────
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUserId } = useAppContext();
  if (currentUserId) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// ─── Inner router (needs AppContext already mounted) ──────────────────────────
const AppRoutes: React.FC = () => (
  <Routes>
    {/* Public routes */}
    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/onboarding" element={<PublicRoute><Onboarding /></PublicRoute>} />

    {/* Protected routes inside Layout shell */}
    <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
      <Route index element={<Home />} />
      <Route path="log" element={<LogSymptoms />} />
      <Route path="calendar" element={<Calendar />} />
      <Route path="chats" element={<SecretChats />} />
      <Route path="settings" element={<Settings />} />
    </Route>

    {/* Catch-all */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
