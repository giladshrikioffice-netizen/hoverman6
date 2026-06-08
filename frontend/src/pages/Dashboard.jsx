import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const fmt = n => '₪' + Number(n||0).toLocaleString('he-IL');
const pct = (a, b) => b ? Math.min(Math.round((a / b) * 100), 100) : 0;

function StatCard({ label, value, sub, color }) {
  const colors = {
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    green: 'border-green-500/30 bg-green-500/10 text-green-400',
    orange: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    red: 'border-red-500/30 bg-red-500/10 text-red-400',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
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
  const { building } = useAuth();
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
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">{data.building?.name || 'דשבורד'}</h2>
        <p className="text-slate-400 text-sm">{data.building?.address}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="שולם מהתקציב" value={fmt(data.budget.paid)} sub={`${budgetPct}% מתוך ${fmt(data.budget.total)}`} color="blue" />
        <StatCard label="יתרת תקציב" value={fmt(data.budget.total - data.budget.paid)} sub="נותר לשלם" color="orange" />
        <StatCard label="גבייה שהתקבלה" value={fmt(data.payments.paid)} sub={`${collectionPct}% מהדיירים`} color="green" />
        <StatCard label="התראות תחזוקה" value={data.maintenanceAlerts} sub="תוך 14 יום" color={data.maintenanceAlerts > 0 ? 'yellow' : 'green'} />
      </div>

      {/* Budget progress */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">התקדמות תקציב</span>
          <span className="text-blue-400 font-semibold">{budgetPct}%</span>
        </div>
        <ProgressBar value={budgetPct} color="bg-blue-500" />
        <div className="flex justify-between text-xs text-slate-500 mt-1.5">
          <span>שולם: {fmt(data.budget.paid)}</span>
          <span>יעד: {data.building?.target_date || '—'}</span>
          <span>סה״כ: {fmt(data.budget.total)}</span>
        </div>
      </div>

      {/* Collection progress */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">גבייה מדיירים</span>
          <span className="text-green-400 font-semibold">{collectionPct}%</span>
        </div>
        <ProgressBar value={collectionPct} color="bg-green-500" />
        <div className="flex justify-between text-xs text-slate-500 mt-1.5">
          <span>שולם: {fmt(data.payments.paid)}</span>
          <span>קבלנים פעילים: {data.activeContractors}</span>
          <span>פניות פתוחות: {data.openComplaints}</span>
        </div>
      </div>

      {/* Last update */}
      {data.lastUpdate && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">📅 עדכון אחרון — {data.lastUpdate.visit_date}</h3>
          {data.lastUpdate.summary && <p className="text-slate-400 text-sm mb-2">{data.lastUpdate.summary}</p>}
          {data.lastUpdate.blockers && (
            <div className="bg-orange-900/20 border border-orange-700/40 rounded-lg px-3 py-1.5 text-sm text-orange-400 mb-2">
              ⚠️ {data.lastUpdate.blockers}
            </div>
          )}
          {data.lastUpdate.next_steps && (
            <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg px-3 py-1.5 text-sm text-blue-400">
              ➡️ {data.lastUpdate.next_steps}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
