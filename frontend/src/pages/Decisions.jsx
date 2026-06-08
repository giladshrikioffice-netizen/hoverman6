import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const EMPTY = { date: '', topic: '', approved_by: '', status: 'ממתין' };
const statusColor = s => ({ 'מאושר': 'bg-green-100 text-green-800', 'ממתין': 'bg-yellow-100 text-yellow-800', 'נדחה': 'bg-red-100 text-red-800' }[s] || 'bg-gray-100');

export default function Decisions() {
  const { user } = useAuth();
  const canEdit = ['admin', 'committee'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');

  useEffect(() => { api.decisions.list().then(setRows).catch(e => setErr(e.message)); }, []);

  const save = async () => {
    try {
      if (editing === 'new') { const r = await api.decisions.create(form); setRows(prev => [r, ...prev]); }
      else { const r = await api.decisions.update(editing, form); setRows(prev => prev.map(x => x.id === editing ? r : x)); }
      setEditing(null);
    } catch (e) { setErr(e.message); }
  };

  const del = async id => {
    if (!confirm('למחוק?')) return;
    await api.decisions.del(id).catch(e => setErr(e.message));
    setRows(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">📋 יומן החלטות</h2>
        {canEdit && <button onClick={() => { setForm({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setEditing('new'); }} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800">+ החלטה חדשה</button>}
      </div>

      {err && <div className="bg-red-50 text-red-700 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm border-r-4 border-blue-500">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{r.topic}</p>
                <p className="text-sm text-gray-500 mt-1">תאריך: {r.date} | אישר: {r.approved_by || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(r.status)}`}>{r.status}</span>
                {canEdit && <button onClick={() => { setForm(r); setEditing(r.id); }} className="text-blue-600 hover:underline text-xs">עריכה</button>}
                {user?.role === 'admin' && <button onClick={() => del(r.id)} className="text-red-500 hover:underline text-xs">מחיקה</button>}
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-gray-400 text-center py-8">אין החלטות רשומות</p>}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editing === 'new' ? 'החלטה חדשה' : 'עריכת החלטה'}</h3>
            {[['date', 'תאריך', 'date'], ['topic', 'נושא', 'text'], ['approved_by', 'אושר ע"י', 'text']].map(([k, l, t]) => (
              <div key={k} className="mb-3">
                <label className="block text-sm text-gray-600 mb-1">{l}</label>
                <input type={t} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            ))}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">סטטוס</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
                {['ממתין', 'מאושר', 'נדחה'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
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
