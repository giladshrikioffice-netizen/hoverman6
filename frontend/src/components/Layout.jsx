import { useState } from 'react';
import { useAuth } from '../AuthContext';

// Modules grouped by area. Each group is gated by the building's areas and the
// user's assigned areas (see AuthContext.canSeeArea). When a building is "both",
// the 🔵 and 🟢 groups appear side by side, giving clear visual separation.
const GROUPS = [
  { area: 'supervision', label: 'פיקוח הנדסי', dot: '🔵', color: 'text-blue-400', items: [
    { key: 'updates',     label: 'יומן פיקוח',     icon: '📋', staffClientOnly: true },
    { key: 'reports',     label: 'דוחות חודשיים',   icon: '📑' },
    { key: 'documents',   label: 'תיק בניין',       icon: '📁' },
    { key: 'contractors', label: 'קבלנים',          icon: '👷' },
    { key: 'budget',      label: 'תקציב פרויקט',    icon: '💰' },
    { key: 'bgchecks',    label: 'בדיקת רקע לקבלן',  icon: '🔎', staffOnly: true },
  ]},
  { area: 'maintenance', label: 'תחזוקה שוטפת', dot: '🟢', color: 'text-emerald-400', items: [
    { key: 'maintenance',   label: 'קבלני תחזוקה שוטפת', icon: '🔧', module: 'maintenance' },
    { key: 'professionals', label: 'ספקי שירות',          icon: '⭐', module: 'professionals' },
  ]},
  { area: 'shared', label: 'משותף', dot: '🟡', color: 'text-amber-400', items: [
    { key: 'decisions',  label: 'החלטות',        icon: '✅', module: 'decisions' },
    { key: 'payments',   label: 'גבייה',          icon: '💳', module: 'payments' },
    { key: 'complaints', label: 'פניות דיירים',   icon: '📩', module: 'complaints' },
  ]},
];

const ROLE_LABEL = { superadmin: 'מנהל מערכת', admin: 'מנהל', committee: 'ועד בית', resident: 'דייר' };

export default function Layout({ page, setPage, children }) {
  const { user, building, logout, hasAccess, canSeeArea, isCombined, buildingHasSupervision, buildingHasMaintenance } = useAuth();
  const [open, setOpen] = useState(false);
  const isStaff = ['superadmin','admin'].includes(user?.role);

  const buildingTypeChip = isCombined
    ? { text: '🔵🟢 פיקוח + תחזוקה', cls: 'bg-purple-600/20 border-purple-600/40 text-purple-300' }
    : buildingHasMaintenance
      ? { text: '🟢 תחזוקה שוטפת', cls: 'bg-emerald-600/20 border-emerald-600/40 text-emerald-400' }
      : { text: '🔵 פיקוח הנדסי', cls: 'bg-blue-600/20 border-blue-600/40 text-blue-400' };

  // Should an item be shown for this user/building?
  const itemVisible = (n, area) => {
    if (n.staffOnly && !isStaff) return false;
    if (n.staffClientOnly && user?.role === 'resident') return false;
    if (n.module && !hasAccess(n.module)) return false;
    // shared items: show if the user can see at least one area
    if (area === 'shared') return canSeeArea('supervision') || canSeeArea('maintenance');
    return canSeeArea(area);
  };

  const go = key => { setPage(key); setOpen(false); };

  const linkCls = key => `w-full text-right px-4 py-2 text-sm transition-colors flex items-center gap-2 justify-end ${
    page === key ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-500' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <header className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button className="md:hidden text-xl" onClick={() => setOpen(!open)}>☰</button>
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white font-black text-sm px-2 py-1 rounded">GS</div>
            <div>
              <span className="font-bold text-white text-sm">GS.pro</span>
              {building && <span className="text-slate-400 text-xs mr-2">| {building.name}</span>}
            </div>
            {building && <span className={`hidden sm:inline border text-xs px-2 py-0.5 rounded-full ${buildingTypeChip.cls}`}>{buildingTypeChip.text}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-slate-300">{user?.full_name}</span>
          <span className="bg-blue-600/30 text-blue-300 border border-blue-600/50 px-2 py-0.5 rounded text-xs">{ROLE_LABEL[user?.role]}</span>
          <button onClick={logout} className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-slate-200 text-xs transition-colors">יציאה</button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className={`${open ? 'block' : 'hidden'} md:block w-56 bg-slate-900 border-l border-slate-700 flex-shrink-0`}>
          <ul className="py-3 space-y-0.5">
            {/* Always: dashboard */}
            <li><button onClick={() => go('dashboard')} className={linkCls('dashboard')}><span>סקירת הבניין</span><span className="text-base">🏗️</span></button></li>

            {/* Superadmin: system management */}
            {user?.role === 'superadmin' && (
              <>
                <li><button onClick={() => go('admin')} className={linkCls('admin')}><span>ניהול מערכת</span><span className="text-base">🏢</span></button></li>
                <li><button onClick={() => go('users')} className={linkCls('users')}><span>ניהול משתמשים</span><span className="text-base">👥</span></button></li>
                <li><button onClick={() => go('onboarding')} className={linkCls('onboarding')}><span>טפסי קליטה</span><span className="text-base">📨</span></button></li>
              </>
            )}

            {/* Area groups */}
            {GROUPS.map(g => {
              const visible = g.items.filter(n => itemVisible(n, g.area));
              if (!visible.length) return null;
              return (
                <li key={g.area} className="pt-3">
                  <div className={`px-4 pb-1 text-[11px] font-bold ${g.color} flex items-center gap-1 justify-end`}>
                    <span>{g.label}</span><span>{g.dot}</span>
                  </div>
                  {visible.map(n => (
                    <button key={n.key} onClick={() => go(n.key)} className={linkCls(n.key)}>
                      <span>{n.label}</span><span className="text-base">{n.icon}</span>
                    </button>
                  ))}
                </li>
              );
            })}

            {/* General */}
            <li className="pt-3 border-t border-slate-800 mt-2">
              <button onClick={() => go('settings')} className={linkCls('settings')}><span>הגדרות חשבון</span><span className="text-base">⚙️</span></button>
              <button onClick={() => go('feedback')} className={linkCls('feedback')}><span>פידבק ושיפורים</span><span className="text-base">💬</span></button>
            </li>
          </ul>
        </nav>

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
