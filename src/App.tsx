import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { LogSymptoms } from './pages/LogSymptoms';
import { Calendar } from './pages/Calendar';
import { SecretChats } from './pages/SecretChats';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="log" element={<LogSymptoms />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="chats" element={<SecretChats />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
