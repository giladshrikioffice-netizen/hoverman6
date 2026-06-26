import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import AdminPanel from './pages/AdminPanel';
import Dashboard from './pages/Dashboard';
import Contractors from './pages/Contractors';
import Budget from './pages/Budget';
import Payments from './pages/Payments';
import Decisions from './pages/Decisions';
import Updates from './pages/Updates';
import Complaints from './pages/Complaints';
import Maintenance from './pages/Maintenance';
import Professionals from './pages/Professionals';
import Tutorials from './pages/Tutorials';
import Onboarding from './pages/Onboarding';
import PermissionsManager from './pages/PermissionsManager';
import Feedback from './pages/Feedback';
import UsersManager from './pages/UsersManager';
import Settings from './pages/Settings';
import Privacy from './pages/Privacy';
import Documents from './pages/Documents';
import MonthlyReport from './pages/MonthlyReport';
import BackgroundChecks from './pages/BackgroundChecks';
import ReportsModule from './pages/ReportsModule';
import OnboardingPublic from './pages/OnboardingPublic';
import OnboardingAdmin from './pages/OnboardingAdmin';
import Search from './pages/Search';
import { api } from './api';
import './index.css';

const PAGES = {
  dashboard: Dashboard, contractors: Contractors, budget: Budget,
  payments: Payments, decisions: Decisions, updates: Updates,
  complaints: Complaints, maintenance: Maintenance,
  professionals: Professionals, tutorials: Tutorials,
  admin: AdminPanel, permissions: PermissionsManager, feedback: Feedback,
  users: UsersManager,
  settings: Settings,
  privacy: Privacy,
  documents: Documents,
  monthly: MonthlyReport,
  bgchecks: BackgroundChecks,
  reports: ReportsModule,
  onboarding: OnboardingAdmin,
  search: Search,
};

function AppInner() {
  const { user, building, setBuilding, selectBuilding, loading } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Allow footer privacy link to navigate
  useEffect(() => {
    const handler = e => setPage(e.detail);
    window.addEventListener('navigate', handler);
    return () => window.removeEventListener('navigate', handler);
  }, []);

  // Load building info when user logs in
  useEffect(() => {
    if (user && !building) {
      if (user.role === 'superadmin') {
        api.buildings.list().then(bs => {
          if (bs.length > 0) { selectBuilding(bs[0]); }
          else setPage('admin');
        }).catch(() => {});
      } else if (user.building_id) {
        api.buildings.list().then(bs => {
          const b = bs.find(x => x.id === user.building_id);
          if (b) setBuilding(b);
        }).catch(() => {});
      }
    }
  }, [user]);

  // Show onboarding on first login
  useEffect(() => {
    if (user && !localStorage.getItem('onboarding_done')) {
      setShowOnboarding(true);
    }
  }, [user]);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-400 text-sm">טוען...</div>
    </div>
  );

  if (!user) return <Login />;

  if (showOnboarding) return <Onboarding onDone={() => setShowOnboarding(false)} />;

  const Page = PAGES[page] || Dashboard;

  return (
    <Layout page={page} setPage={setPage}>
      {page === 'admin'
        ? <AdminPanel onSelectBuilding={b => { selectBuilding(b); setPage('dashboard'); }} />
        : <Page />
      }
    </Layout>
  );
}

export default function App() {
  // Public onboarding form link (?form=TOKEN) — rendered without login or AuthProvider.
  const formToken = new URLSearchParams(window.location.search).get('form');
  if (formToken) return <OnboardingPublic token={formToken} />;
  return <AuthProvider><AppInner /></AuthProvider>;
}
