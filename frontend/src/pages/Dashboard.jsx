import { useEffect, useState } from 'react';
import { api } from '../api';

const fmt = n => '₪' + Number(n).toLocaleString('he-IL');
const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;

function Card({ title, value, sub, color = 'blue' }) {
  const colors = { blue: 'bg-blue-50 border-blue-200', green: 'bg-green-50 border-green-200', orange: 'bg-orange-50 border-orange-200', red: 'bg-red-50 border-red-200' };
  const textColors = { blue: 'text-blue-700', green: 'text-green-700', orange: 'text-orange-700', red: 'text-red-700' };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-gray-500 text-sm mb-1">{title}</p>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value}</p>
      {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.dashboard().then(setData).catch(e => setErr(e.message));
  }, []);

  if (err) return <div className="text-red-500">{err}</div>;
  if (!data) return <div className="text-gray-400">טוען...</div>;

  const budgetPct = pct(data.budget.paid, data.budget.total);
  const collectionPct = pct(data.payments.paid, data.payments.due);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">📊 סיכום פרויקט – הוברמן 6</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card title="שולם מהתקציב" value={fmt(data.budget.paid)} sub={`${budgetPct}% מתוך ${fmt(data.budget.total)}`} color="blue" />
        <Card title="יתרת תקציב" value={fmt(data.budget.total - data.budget.paid)} sub="נותר לשלם" color="orange" />
        <Card title="גבייה שהתקבלה" value={fmt(data.payments.paid)} sub={`${collectionPct}% מהדיירים`} color="green" />
        <Card title="פניות פתוחות" value={data.openComplaints} sub="ממתינות לטיפול" color={data.openComplaints > 0 ? 'red' : 'green'} />
      </div>

      {/* Budget progress bar */}
      <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-gray-700">התקדמות תקציב כוללת</span>
          <span className="text-blue-700 font-semibold">{budgetPct}%</span>
        </div>
        <div className="bg-gray-200 rounded-full h-4">
          <div className="bg-blue-600 h-4 rounded-full transition-all" style={{ width: budgetPct + '%' }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>שולם: {fmt(data.budget.paid)}</span>
          <span>יעד סיום: {data.targetDate}</span>
          <span>סה"כ: {fmt(data.budget.total)}</span>
        </div>
      </div>

      {/* Collection progress bar */}
      <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-gray-700">גבייה מדיירים</span>
          <span className="text-green-700 font-semibold">{collectionPct}%</span>
        </div>
        <div className="bg-gray-200 rounded-full h-4">
          <div className="bg-green-500 h-4 rounded-full transition-all" style={{ width: collectionPct + '%' }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>שולם: {fmt(data.payments.paid)}</span>
          <span>קבלנים פעילים: {data.activeContractors}</span>
          <span>סה"כ לגביה: {fmt(data.payments.due)}</span>
        </div>
      </div>

      {/* Last update */}
      {data.lastUpdate && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-2">📅 עדכון אחרון – {data.lastUpdate.visit_date}</h3>
          <p className="text-gray-600 text-sm mb-2">{data.lastUpdate.summary}</p>
          {data.lastUpdate.blockers && (
            <p className="text-orange-600 text-sm bg-orange-50 rounded px-3 py-1 mb-2">⚠️ חסמים: {data.lastUpdate.blockers}</p>
          )}
          {data.lastUpdate.next_steps && (
            <p className="text-blue-600 text-sm">➡️ צעדים הבאים: {data.lastUpdate.next_steps}</p>
          )}
          <p className="text-gray-400 text-xs mt-2">מאת: {data.lastUpdate.author}</p>
        </div>
      )}
    </div>
  );
}
