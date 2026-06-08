import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const fmt = n => '₪' + Number(n).toLocaleString('he-IL');

const EMPTY = { name: '', trade: '', phone: '', contract_amount: '', status: 'פעיל' };

export default function Contractors() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');

  useEffect(() => { api.contractors.list().then(setRows).catch(e => setErr(e.message)); }, []);

  const openNew = () => { setForm(EMPTY); setEditing('new'); };
  const openEdit = r => { setForm({ ...r }); setEditing(r.id); };

  const save = async () => {
    try {
      if (editing === 'new') {
        const r = await api.contractors.create(form);
        setRows(prev => [...prev, r]);
      } else {
        const r = await api.contractors.update(editing, form);
        setRows(prev => prev.map(x => x.id === editing ? r : x));
      }
      setEditing(null);
    } catch (e) { setErr(e.message); }
  };

  const del = async id => {
    if (!confirm('למחוק קבלן זה?')) return;
    await api.contractors.del(id).catch(e => setErr(e.message));
    setRows(prev => prev.filter(x => x.id !== id));
  };

  const statusColor = s => ({ 'פעיל': 'bg-green-100 text-green-800', 'הושלם': 'bg-blue-100 text-blue-800', 'מושהה': 'bg-yellow-100 text-yellow-800' }[s] || 'bg-gray-100 text-gray-800');

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">👷 קבלנים וספקים</h2>
        {isAdmin && <button onClick={openNew} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800">+ הוסף קבלן</button>}
      </div>

      {err && <div className="bg-red-50 text-red-700 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['שם', 'תחום', 'טלפון', 'סכום חוזה', 'סטטוס', ...(isAdmin ? ['פעולות'] : [])].map(h => (
                <th key={h} className="px-4 py-3 text-right font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-gray-600">{r.trade}</td>
                <td className="px-4 py-3 text-gray-600 ltr">{r.phone}</td>
                <td className="px-4 py-3 text-blue-700 font-medium">{fmt(r.contract_amount)}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(r.status)}`}>{r.status}</span></td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline ml-3 text-xs">עריכה</button>
                    <button onClick={() => del(r.id)} className="text-red-500 hover:underline text-xs">מחיקה</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editing === 'new' ? 'קבלן חדש' : 'עריכת קבלן'}</h3>
            {[['name', 'שם'], ['trade', 'תחום'], ['phone', 'טלפון'], ['contract_amount', 'סכום חוזה']].map(([k, l]) => (
              <div key={k} className="mb-3">
                <label className="block text-sm text-gray-600 mb-1">{l}</label>
                <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            ))}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">סטטוס</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-400">
                {['פעיל', 'הושלם', 'מושהה'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border text-gray-600 text-sm">ביטול</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm hover:bg-blue-800">שמירה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
