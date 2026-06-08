import { useState } from 'react';
import { useAuth } from '../AuthContext';

const NAV = [
  { key: 'dashboard', label: '🏠 דשבורד' },
  { key: 'contractors', label: '👷 קבלנים' },
  { key: 'budget', label: '💰 תקציב' },
  { key: 'payments', label: '💳 גבייה' },
  { key: 'decisions', label: '📋 החלטות' },
  { key: 'updates', label: '📅 עדכונים' },
  { key: 'complaints', label: '📩 פניות' },
];

export default function Layout({ page, setPage, children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const roleLabel = { admin: 'מנהל פרויקט', committee: 'ועד בית', resident: 'דייר' }[user?.role] || '';

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Top bar */}
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <button className="md:hidden text-xl" onClick={() => setOpen(!open)}>☰</button>
          <span className="font-bold text-lg">🏗️ הוברמן 6</span>
          <span className="hidden sm:inline text-blue-200 text-sm">פתח תקווה</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline">{user?.full_name}</span>
          <span className="bg-blue-600 px-2 py-0.5 rounded text-xs">{roleLabel}</span>
          <button onClick={logout} className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded">יציאה</button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className={`${open ? 'block' : 'hidden'} md:block w-48 bg-white shadow-md flex-shrink-0`}>
          <ul className="py-2">
            {NAV.map(n => (
              <li key={n.key}>
                <button
                  onClick={() => { setPage(n.key); setOpen(false); }}
                  className={`w-full text-right px-4 py-3 text-sm hover:bg-blue-50 transition-colors ${page === n.key ? 'bg-blue-100 text-blue-800 font-semibold border-r-4 border-blue-600' : 'text-gray-700'}`}
                >
                  {n.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
