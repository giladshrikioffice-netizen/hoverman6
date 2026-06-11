import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const fmt = n => '₪' + Number(n||0).toLocaleString('he-IL');
const monthKey = d => (d || '').slice(0, 7); // YYYY-MM
const nowMonth = new Date().toISOString().slice(0, 7);
const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const monthLabel = m => { const [y, mo] = m.split('-'); return `${MONTH_NAMES[+mo-1]} ${y}`; };

export default function MonthlyReport() {
  const { user, building } = useAuth();
  const [month, setMonth] = useState(nowMonth);
  const [data, setData] = useState({ updates: [], payments: [], budget: { items: [], totals: {} }, maintenance: [] });
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([
      api.updates.list().catch(() => []),
      api.payments.list().catch(() => []),
      api.budget.get().catch(() => ({ items: [], totals: {} })),
      api.maintenance.list().catch(() => []),
    ]).then(([updates, payments, budget, maintenance]) =>
      setData({ updates, payments, budget, maintenance })
    ).catch(e => setErr(e.message));
  }, []);

  const monthUpdates = data.updates.filter(u => monthKey(u.visit_date) === month);
  const monthMaint = data.maintenance.filter(m => monthKey(m.next_check) === month);
  const pay = data.payments.reduce((a, p) => ({
    due: a.due + (p.amount_due || 0),
    paid: a.paid + (p.amount_paid || 0),
  }), { due: 0, paid: 0 });
  const debtors = data.payments.filter(p => (p.amount_due || 0) - (p.amount_paid || 0) > 0);

  return (
    <div className="max-w-3xl print:max-w-full" dir="rtl">
      <style>{`@media print { .no-print { display:none !important; } body { background:#fff; } }`}</style>

      <div className="flex justify-between items-center mb-4 flex-wrap gap-2 no-print">
        <h2 className="text-xl font-bold text-white">🗓️ דוח חודשי מרוכז</h2>
        <div className="flex gap-2 items-center">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none" />
          <button onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm">🖨️ הדפס / PDF</button>
        </div>
      </div>

      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 print:bg-white print:text-black space-y-5">
        {/* Header */}
        <div className="text-center border-b border-slate-700 pb-3">
          <h1 className="text-lg font-bold text-white print:text-black">דוח חודשי — {building?.name || ''}</h1>
          <p className="text-slate-400 text-sm print:text-gray-600">{monthLabel(month)}</p>
          <p className="text-slate-600 text-xs mt-1 print:text-gray-500">GS.pro · גלעד שריקי פרויקטים</p>
        </div>

        {/* Collection */}
        <section>
          <h3 className="font-semibold text-blue-400 print:text-blue-700 mb-2">💳 מצב גבייה</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Box label="סה״כ לגבייה" val={fmt(pay.due)} />
            <Box label="נגבה" val={fmt(pay.paid)} cls="text-green-400" />
            <Box label="יתרת חוב" val={fmt(pay.due - pay.paid)} cls="text-red-400" />
          </div>
          {debtors.length > 0 && (
            <p className="text-slate-400 text-xs mt-2 print:text-gray-600">{debtors.length} דירות עם יתרת חוב</p>
          )}
        </section>

        {/* Budget */}
        <section>
          <h3 className="font-semibold text-blue-400 print:text-blue-700 mb-2">💰 תקציב פרויקט</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Box label="מתוכנן" val={fmt(data.budget.totals.planned)} />
            <Box label="שולם" val={fmt(data.budget.totals.paid)} cls="text-green-400" />
            <Box label="יתרה" val={fmt(data.budget.totals.balance)} cls="text-orange-400" />
          </div>
        </section>

        {/* Pikuach updates this month */}
        <section>
          <h3 className="font-semibold text-blue-400 print:text-blue-700 mb-2">📋 דיווחי פיקוח בחודש זה ({monthUpdates.length})</h3>
          {monthUpdates.length === 0 && <p className="text-slate-500 text-sm print:text-gray-500">אין דיווחים בחודש זה.</p>}
          <div className="space-y-2">
            {monthUpdates.map(u => (
              <div key={u.id} className="bg-slate-800 print:bg-gray-100 rounded-lg p-3 text-sm">
                <p className="text-slate-400 print:text-gray-600 text-xs">{u.visit_date} · {u.author || ''}</p>
                {u.summary && <p className="text-slate-200 print:text-black mt-1">{u.summary}</p>}
                {u.blockers && <p className="text-amber-400 print:text-amber-700 text-xs mt-1">⚠️ חסמים: {u.blockers}</p>}
                {u.next_steps && <p className="text-slate-400 print:text-gray-600 text-xs mt-1">➡️ {u.next_steps}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Maintenance due this month */}
        <section>
          <h3 className="font-semibold text-blue-400 print:text-blue-700 mb-2">🔧 תחזוקה למועד בחודש זה ({monthMaint.length})</h3>
          {monthMaint.length === 0 && <p className="text-slate-500 text-sm print:text-gray-500">אין פריטי תחזוקה למועד בחודש זה.</p>}
          {monthMaint.map(m => (
            <p key={m.id} className="text-slate-300 print:text-black text-sm">• {m.name} — {m.next_check} ({m.status})</p>
          ))}
        </section>
      </div>
    </div>
  );
}

function Box({ label, val, cls }) {
  return (
    <div className="bg-slate-800 print:bg-gray-100 rounded-lg p-2">
      <p className="text-xs text-slate-400 print:text-gray-600">{label}</p>
      <p className={`font-bold text-sm mt-0.5 ${cls || 'text-white print:text-black'}`}>{val}</p>
    </div>
  );
}
