import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Contractors from './pages/Contractors';
import Budget from './pages/Budget';
import Payments from './pages/Payments';
import Decisions from './pages/Decisions';
import Updates from './pages/Updates';
import Complaints from './pages/Complaints';
import './index.css';

const PAGES = { dashboard: Dashboard, contractors: Contractors, budget: Budget, payments: Payments, decisions: Decisions, updates: Updates, complaints: Complaints };

function AppInner() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('dashboard');

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">טוען...</div>;
  if (!user) return <Login />;

  const Page = PAGES[page] || Dashboard;
  return (
    <Layout page={page} setPage={setPage}>
      <Page />
    </Layout>
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}
