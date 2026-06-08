import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const fmt = n => '₪' + Number(n || 0).toLocaleString('he-IL');

const statusColor = s => ({
  'שולם במלואו': 'bg-green-100 text-green-800',
  'שולם חלקית': 'bg-yellow-100 text-yellow-800',
  'לא שולם': 'bg-red-100 text-red-800',
}[s] || 'bg-gray-100');

export default function Payments() {
  const { user } = useAuth();
  const canEdit = ['admin', 'committee'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { api.payments.list().then(setRows).catch(e => setErr(e.message)); }, []);

  const save = async () => {
    try {
      const r = await api.payments.update(editing, form);
      setRows(prev => prev.map(x => x.id === editing ? r : x));
      setEditing(null);
    } catch (e) { setErr(e.message); }
  };

  const filtered = rows.filter(r => !search || String(r.unit_number).includes(search) || (r.owner_name || '').includes(search));

  const totals = rows.reduce((a, r) => ({ due: a.due + r.amount_due, paid: a.paid + r.amount_paid }), { due: 0, paid: 0 });

  if (user?.role === 'resident') {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">💳 מצב תשלומים – דירתי</h2>
        {rows.length === 0 ? <p className="text-gray-400">אין נתוני תשלום לדירתך.</p> : (
          rows.map(r => (
            <div key={r.id} className="bg-white rounded-xl p-5 shadow-sm">
              <p className="text-gray-500 text-sm mb-3">דירה {r.unit_number}{r.owner_name ? ` – ${r.owner_name}` : ''}</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xs text-gray-400">לתשלום</p><p className="text-lg font-bold text-gray-800">{fmt(r.amount_due)}</p></div>
                <div><p className="text-xs text-gray-400">שולם</p><p className="text-lg font-bold text-green-700">{fmt(r.amount_paid)}</p></div>
                <div><p className="text-xs text-gray-400">יתרת חוב</p><p className="text-lg font-bold text-red-600">{fmt(r.balance)}</p></div>
              </div>
              <div className="mt-3 text-center">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor(r.status)}`}>{r.status}</span>
              </div>
              {r.note && <p className="mt-3 text-sm text-gray-500">הערה: {r.note}</p>}
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-gray-800">💳 גבייה מדיירים</h2>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי דירה / שם..."
          className="border rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400 w-48" />
      </div>

      {err && <div className="bg-red-50 text-red-700 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">סה"כ לגביה</p><p className="font-bold text-blue-700">{fmt(totals.due)}</p></div>
        <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">שולם</p><p className="font-bold text-green-700">{fmt(totals.paid)}</p></div>
        <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">יתרת חוב</p><p className="font-bold text-red-600">{fmt(totals.due - totals.paid)}</p></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['דירה', 'בעלים', 'לתשלום', 'שולם', 'יתרה', 'סטטוס', ...(canEdit ? ['פעולות'] : [])].map(h => (
                <th key={h} className="px-3 py-3 text-right font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.unit_number}</td>
                <td className="px-3 py-2 text-gray-600">{r.owner_name || '—'}</td>
                <td className="px-3 py-2">{fmt(r.amount_due)}</td>
                <td className="px-3 py-2 text-green-700">{fmt(r.amount_paid)}</td>
                <td className={`px-3 py-2 font-medium ${r.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(r.balance)}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(r.status)}`}>{r.status}</span></td>
                {canEdit && (
                  <td className="px-3 py-2">
                    <button onClick={() => { setForm({ amount_due: r.amount_due, amount_paid: r.amount_paid, due_date: r.due_date || '', note: r.note || '' }); setEditing(r.id); }}
                      className="text-blue-600 hover:underline text-xs">עריכה</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold mb-4">עריכת תשלום</h3>
            {[['amount_due', 'לתשלום (₪)'], ['amount_paid', 'שולם (₪)'], ['due_date', 'תאריך לתשלום'], ['note', 'הערה']].map(([k, l]) => (
              <div key={k} className="mb-3">
                <label className="block text-sm text-gray-600 mb-1">{l}</label>
                <input type={k === 'due_date' ? 'date' : 'text'} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
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
