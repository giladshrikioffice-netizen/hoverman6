import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

function AlertsButton() {
  const [status, setStatus] = useState('idle'); // idle | sending | done | err
  const [msg, setMsg] = useState('');
  const send = async () => {
    setStatus('sending'); setMsg('');
    try {
      const r = await api.alerts.send();
      setMsg(`✅ נשלחו ${r.sent} הודעות`);
      setStatus('done');
    } catch(e) { setMsg('❌ ' + e.message); setStatus('err'); }
    setTimeout(() => setStatus('idle'), 4000);
  };
  return (
    <div className="flex items-center gap-2">
      <button onClick={send} disabled={status === 'sending'}
        className="bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/40 text-amber-400 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
        {status === 'sending' ? '⏳ שולח...' : '📧 שלח התראות'}
      </button>
      {msg && <span className="text-xs text-slate-400">{msg}</span>}
    </div>
  );
}

const fmt = n => '₪' + Number(n||0).toLocaleString('he-IL');
const pct = (a, b) => b ? Math.min(Math.round((a / b) * 100), 100) : 0;

function StatCard({ label, value, sub, color }) {
  const colors = {
    blue:   'border-blue-500/30 bg-blue-500/10 text-blue-400',
    green:  'border-green-500/30 bg-green-500/10 text-green-400',
    orange: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    red:    'border-red-500/30 bg-red-500/10 text-red-400',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
    slate:  'border-slate-600/50 bg-slate-800/50 text-slate-300',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, color = 'bg-blue-500' }) {
  return (
    <div className="bg-slate-700 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: value + '%' }} />
    </div>
  );
}

export default function Dashboard() {
  const { building, isSupervision, isMaintenance, user } = useAuth();
  const openMonthly = () => window.dispatchEvent(new CustomEvent('navigate', { detail: 'monthly' }));
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.dashboard().then(setData).catch(e => setErr(e.message));
  }, [building]);

  if (err) return <div className="text-red-400 text-sm">{err}</div>;
  if (!data) return <div className="text-slate-500 text-sm">טוען...</div>;

  const budgetPct = pct(data.budget.paid, data.budget.total);
  const collectionPct = pct(data.payments.paid, data.payments.due);

  return (
    <div className="max-w-4xl" dir="rtl">

      {/* Building header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">{data.building?.name || 'דשבורד'}</h2>
          <p className="text-slate-400 text-sm mt-0.5">{data.building?.address}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {data.building?.target_date && isSupervision && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm">
              <p className="text-slate-500 text-xs">יעד סיום</p>
              <p className="text-white font-semibold">{data.building.target_date}</p>
            </div>
          )}
          {user?.role === 'superadmin' && <AlertsButton />}
        </div>
      </div>

      {/* === SUPERVISION SECTION === */}
      {isSupervision && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">🔵 פיקוח הנדסי</span>
            <div className="flex-1 h-px bg-blue-800/40" />
            <button onClick={openMonthly}
              className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/40 text-blue-400 text-xs px-3 py-1 rounded-lg transition-colors whitespace-nowrap">
              🗓️ דוח חודשי
            </button>
          </div>

          {/* Supervision stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard label="תקציב פרויקט" value={fmt(data.budget.total)} sub="סה״כ מאושר" color="blue" />
            <StatCard label="שולם לקבלנים" value={fmt(data.budget.paid)} sub={`${budgetPct}% מהתקציב`} color="blue" />
            <StatCard label="יתרה לביצוע" value={fmt(data.budget.total - data.budget.paid)} sub="נותר לשלם" color="orange" />
            <StatCard label="קבלנים פעילים" value={data.activeContractors} sub="חוזים פעילים" color="slate" />
          </div>

          {/* Budget progress */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">התקדמות תקציב פרויקט</span>
              <span className="text-blue-400 font-semibold">{budgetPct}%</span>
            </div>
            <ProgressBar value={budgetPct} color="bg-blue-500" />
            <div className="flex justify-between text-xs text-slate-500 mt-1.5">
              <span>שולם: {fmt(data.budget.paid)}</span>
              <span>סה״כ: {fmt(data.budget.total)}</span>
            </div>
          </div>

          {/* Last supervision update */}
          {data.lastUpdate && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                📋 עדכון פיקוח אחרון — {data.lastUpdate.visit_date}
              </h3>
              {data.lastUpdate.summary && (
                <p className="text-slate-300 text-sm mb-3">{data.lastUpdate.summary}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.lastUpdate.blockers && (
                  <div className="bg-orange-900/20 border border-orange-700/40 rounded-lg px-3 py-2 text-sm text-orange-400">
                    ⚠️ <span className="font-semibold">חסמים:</span> {data.lastUpdate.blockers}
                  </div>
                )}
                {data.lastUpdate.next_steps && (
                  <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg px-3 py-2 text-sm text-blue-400">
                    ➡️ <span className="font-semibold">הצעדים הבאים:</span> {data.lastUpdate.next_steps}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* === MAINTENANCE SECTION === */}
      {isMaintenance && (<>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">🟢 תחזוקה שוטפת</span>
        <div className="flex-1 h-px bg-emerald-800/40" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className={`rounded-xl border p-4 ${
          data.maintenanceAlerts > 0
            ? 'border-yellow-500/40 bg-yellow-500/10'
            : 'border-green-500/30 bg-green-500/10'
        }`}>
          <p className="text-slate-400 text-xs mb-1">התראות תחזוקה</p>
          <p className={`text-2xl font-bold ${data.maintenanceAlerts > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
            {data.maintenanceAlerts}
          </p>
          <p className="text-slate-500 text-xs mt-1">
            {data.maintenanceAlerts > 0 ? 'פריטים דורשים טיפול תוך 14 יום' : 'הכל תקין — אין התראות'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-600/50 bg-slate-800/50 p-4">
          <p className="text-slate-400 text-xs mb-1">פניות פתוחות</p>
          <p className="text-2xl font-bold text-slate-300">{data.openComplaints}</p>
          <p className="text-slate-500 text-xs mt-1">פניות דיירים הממתינות לטיפול</p>
        </div>
      </div>
      </>)}

      {/* === COLLECTION SECTION (secondary) === */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">גבייה</span>
        <div className="flex-1 h-px bg-slate-700" />
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">גבייה מדיירים</span>
          <span className="text-green-400 font-semibold">{collectionPct}%</span>
        </div>
        <ProgressBar value={collectionPct} color="bg-green-500" />
        <div className="flex justify-between text-xs text-slate-500 mt-1.5">
          <span>שולם: {fmt(data.payments.paid)}</span>
          <span>לגבייה: {fmt(data.payments.due - data.payments.paid)}</span>
          <span>סה״כ: {fmt(data.payments.due)}</span>
        </div>
      </div>

    </div>
  );
}
