import { useState } from 'react';
import { useAuth } from '../AuthContext';

const NAV_ALL = [
  { key: 'dashboard', label: 'דשבורד', icon: '📊' },
  { key: 'contractors', label: 'קבלנים', icon: '👷' },
  { key: 'budget', label: 'תקציב', icon: '💰' },
  { key: 'payments', label: 'גבייה', icon: '💳' },
  { key: 'decisions', label: 'החלטות', icon: '📋' },
  { key: 'updates', label: 'עדכונים', icon: '📅' },
  { key: 'maintenance', label: 'תחזוקה', icon: '🔧' },
  { key: 'professionals', label: 'אנשי מקצוע', icon: '⭐' },
  { key: 'complaints', label: 'פניות', icon: '📩' },
  { key: 'tutorials', label: 'מדריכים', icon: '🎓' },
];

const NAV_SUPERADMIN = [
  { key: 'admin', label: 'ניהול מערכת', icon: '🏢' },
  ...NAV_ALL,
];

const ROLE_LABEL = { superadmin: 'מנהל מערכת', admin: 'מנהל', committee: 'ועד בית', resident: 'דייר' };

export default function Layout({ page, setPage, children }) {
  const { user, building, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const nav = user?.role === 'superadmin' ? NAV_SUPERADMIN : NAV_ALL;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      {/* Top bar */}
      <header className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button className="md:hidden text-xl" onClick={() => setOpen(!open)}>☰</button>
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white font-black text-sm px-2 py-1 rounded">GS</div>
            <div>
              <span className="font-bold text-white text-sm">GS.pro</span>
              {building && <span className="text-slate-400 text-xs mr-2">| {building.name || 'בניין'}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-slate-300">{user?.full_name}</span>
          <span className="bg-blue-600/30 text-blue-300 border border-blue-600/50 px-2 py-0.5 rounded text-xs">{ROLE_LABEL[user?.role]}</span>
          <button onClick={logout} className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-slate-200 text-xs transition-colors">יציאה</button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className={`${open ? 'block' : 'hidden'} md:block w-52 bg-slate-900 border-l border-slate-700 flex-shrink-0`}>
          <ul className="py-3">
            {nav.map(n => (
              <li key={n.key}>
                <button
                  onClick={() => { setPage(n.key); setOpen(false); }}
                  className={`w-full text-right px-4 py-2.5 text-sm transition-colors flex items-center gap-2 justify-end
                    ${page === n.key
                      ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                  <span>{n.label}</span>
                  <span className="text-base">{n.icon}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main */}
        <main className="flex-1 p-4 md:p-6 overflow-auto bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}
