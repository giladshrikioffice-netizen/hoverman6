import { useState } from 'react';
import { useAuth } from '../AuthContext';

// Nav ordered by strategic priority: supervision → maintenance → collection → community
const NAV_ALL = [
  { key: 'dashboard',     label: 'סקירת הבניין',  icon: '🏗️' },
  // Supervision (shown only for supervision buildings)
  { key: 'updates',       label: 'יומן פיקוח',    icon: '📋', supervisionOnly: true },
  { key: 'monthly',       label: 'דוח חודשי',      icon: '🗓️', supervisionOnly: true, staffOnly: true },
  { key: 'documents',     label: 'תיק בניין',      icon: '📁', supervisionOnly: true },
  { key: 'contractors',   label: 'קבלנים',         icon: '👷', supervisionOnly: true },
  { key: 'budget',        label: 'תקציב פרויקט',   icon: '💰', supervisionOnly: true },
  { key: 'decisions',     label: 'החלטות',          icon: '✅', module: 'decisions' },
  // Maintenance (all buildings)
  { key: 'maintenance',   label: 'תחזוקה שוטפת',   icon: '🔧', module: 'maintenance' },
  { key: 'professionals', label: 'ספק שירות',       icon: '⭐', module: 'professionals' },
  // Residents / collection
  { key: 'payments',      label: 'גבייה',           icon: '💳', module: 'payments' },
  { key: 'complaints',    label: 'פניות דיירים',    icon: '📩', module: 'complaints' },
  { key: 'tutorials',     label: 'מדריכים',         icon: '🎓', module: 'tutorials' },
  { key: 'feedback',      label: 'פידבק ושיפורים',  icon: '💬' },
  { key: 'settings',      label: 'הגדרות חשבון',    icon: '⚙️' },
];

const NAV_COMMITTEE_EXTRA = [
  { key: 'permissions', label: 'הרשאות דיירים', icon: '🔐' },
];

const NAV_SUPERADMIN = [
  { key: 'admin', label: 'ניהול מערכת', icon: '🏢' },
  { key: 'users', label: 'ניהול משתמשים', icon: '👥' },
  ...NAV_ALL,
];

const ROLE_LABEL = { superadmin: 'מנהל מערכת', admin: 'מנהל', committee: 'ועד בית', resident: 'דייר' };

export default function Layout({ page, setPage, children }) {
  const { user, building, logout, hasAccess, isSupervision } = useAuth();
  const [open, setOpen] = useState(false);
  const buildingType = isSupervision ? 'פיקוח הנדסי' : 'תחזוקה שוטפת';
  const buildingTypeColor = isSupervision
    ? 'bg-blue-600/20 border-blue-600/40 text-blue-400'
    : 'bg-emerald-600/20 border-emerald-600/40 text-emerald-400';

  let baseNav = user?.role === 'superadmin' ? NAV_SUPERADMIN : NAV_ALL;

  // Filter by supervision flag and permissions
  const nav = [
    ...baseNav.filter(n => {
      if (n.supervisionOnly && !isSupervision) return false;
      if (n.staffOnly && user?.role === 'resident') return false;
      if (n.module && !hasAccess(n.module)) return false;
      return true;
    }),
    ...(user?.role === 'committee' ? NAV_COMMITTEE_EXTRA : []),
  ];

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
              {building && <span className="text-slate-400 text-xs mr-2">| {building.name}</span>}
            </div>
            {building && (
              <span className={`hidden sm:inline border text-xs px-2 py-0.5 rounded-full ${buildingTypeColor}`}>
                {buildingType}
              </span>
            )}
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
        <main className="flex-1 p-4 md:p-6 overflow-auto bg-slate-950 flex flex-col">
          <div className="flex-1">{children}</div>
          <footer className="mt-8 pt-4 border-t border-slate-800 text-xs text-slate-600 flex justify-between items-center">
            <span>GS.pro · גלעד שריקי פרויקטים</span>
            <button onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'privacy' }))}
              className="hover:text-slate-400 transition-colors">מדיניות פרטיות</button>
          </footer>
        </main>
      </div>
    </div>
  );
}
