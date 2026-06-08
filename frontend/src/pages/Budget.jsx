import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const fmt = n => '₪' + Number(n || 0).toLocaleString('he-IL');
const EMPTY = { category: '', planned_amount: '', paid_amount: '' };

export default function Budget() {
  const { user } = useAuth();
  const canEdit = ['admin', 'committee'].includes(user?.role);
  const [data, setData] = useState({ items: [], totals: {} });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');

  const load = () => api.budget.get().then(setData).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing === 'new') await api.budget.create(form);
      else await api.budget.update(editing, form);
      setEditing(null);
      load();
    } catch (e) { setErr(e.message); }
  };

  const del = async id => {
    if (!confirm('למחוק?')) return;
    await api.budget.del(id).catch(e => setErr(e.message));
    load();
  };

  const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">💰 תקציב פרויקט</h2>
        {canEdit && <button onClick={() => { setForm(EMPTY); setEditing('new'); }} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800">+ סעיף חדש</button>}
      </div>

      {err && <div className="bg-red-50 text-red-700 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'תקציב פרויקט', val: fmt(data.totals.project_total), color: 'bg-gray-100' },
          { label: 'מתוכנן', val: fmt(data.totals.planned), color: 'bg-blue-50' },
          { label: 'שולם', val: fmt(data.totals.paid), color: 'bg-green-50' },
          { label: 'יתרה', val: fmt(data.totals.balance), color: 'bg-orange-50' },
        ].map(c => (
          <div key={c.label} className={`rounded-xl p-3 ${c.color}`}>
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-lg font-bold text-gray-800">{c.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['סעיף', 'מתוכנן', 'שולם', 'יתרה', 'התקדמות', ...(canEdit ? ['פעולות'] : [])].map(h => (
                <th key={h} className="px-4 py-3 text-right font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.category}</td>
                <td className="px-4 py-3">{fmt(r.planned_amount)}</td>
                <td className="px-4 py-3 text-green-700">{fmt(r.paid_amount)}</td>
                <td className={`px-4 py-3 font-medium ${r.balance < 0 ? 'text-red-600' : 'text-orange-600'}`}>{fmt(r.balance)}</td>
                <td className="px-4 py-3 min-w-24">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: Math.min(pct(r.paid_amount, r.planned_amount), 100) + '%' }} />
                    </div>
                    <span className="text-xs text-gray-500 w-8">{pct(r.paid_amount, r.planned_amount)}%</span>
                  </div>
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <button onClick={() => { setForm(r); setEditing(r.id); }} className="text-blue-600 hover:underline ml-3 text-xs">עריכה</button>
                    {user?.role === 'admin' && <button onClick={() => del(r.id)} className="text-red-500 hover:underline text-xs">מחיקה</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold border-t-2">
            <tr>
              <td className="px-4 py-3">סה"כ</td>
              <td className="px-4 py-3">{fmt(data.totals.planned)}</td>
              <td className="px-4 py-3 text-green-700">{fmt(data.totals.paid)}</td>
              <td className="px-4 py-3 text-orange-600">{fmt(data.totals.balance)}</td>
              <td colSpan={canEdit ? 2 : 1} className="px-4 py-3 text-gray-400 text-xs">
                {pct(data.totals.paid, data.totals.project_total)}% מתקציב הפרויקט הכולל
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editing === 'new' ? 'סעיף תקציב חדש' : 'עריכת סעיף'}</h3>
            {[['category', 'קטגוריה'], ['planned_amount', 'סכום מתוכנן (₪)'], ['paid_amount', 'שולם עד כה (₪)']].map(([k, l]) => (
              <div key={k} className="mb-3">
                <label className="block text-sm text-gray-600 mb-1">{l}</label>
                <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            ))}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border text-gray-600 text-sm">ביטול</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm">שמירה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
