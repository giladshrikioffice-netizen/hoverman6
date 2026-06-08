import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const EMPTY = { visit_date: '', summary: '', blockers: '', next_steps: '' };

export default function Updates() {
  const { user } = useAuth();
  const canEdit = ['admin', 'committee'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');

  useEffect(() => { api.updates.list().then(setRows).catch(e => setErr(e.message)); }, []);

  const save = async () => {
    try {
      if (editing === 'new') { const r = await api.updates.create(form); setRows(prev => [r, ...prev]); }
      else { const r = await api.updates.update(editing, form); setRows(prev => prev.map(x => x.id === editing ? r : x)); }
      setEditing(null);
    } catch (e) { setErr(e.message); }
  };

  const del = async id => {
    if (!confirm('למחוק?')) return;
    await api.updates.del(id).catch(e => setErr(e.message));
    setRows(prev => prev.filter(x => x.id !== id));
  };

  const Field = ({ label, k, multiline }) => (
    <div className="mb-3">
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      {multiline
        ? <textarea rows={3} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-400" />
        : <input type={k === 'visit_date' ? 'date' : 'text'} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-400" />
      }
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">📅 עדכונים שבועיים</h2>
        {canEdit && <button onClick={() => { setForm({ ...EMPTY, visit_date: new Date().toISOString().slice(0, 10) }); setEditing('new'); }}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800">+ עדכון חדש</button>}
      </div>

      {err && <div className="bg-red-50 text-red-700 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="space-y-4">
        {rows.map(r => (
          <div key={r.id} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-gray-800">ביקור {r.visit_date}</h3>
                <p className="text-xs text-gray-400">מאת: {r.author}</p>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button onClick={() => { setForm(r); setEditing(r.id); }} className="text-blue-600 hover:underline text-xs">עריכה</button>
                  {user?.role === 'admin' && <button onClick={() => del(r.id)} className="text-red-500 hover:underline text-xs">מחיקה</button>}
                </div>
              )}
            </div>
            {r.summary && <p className="text-gray-700 text-sm mb-2">{r.summary}</p>}
            {r.blockers && <div className="bg-orange-50 rounded-lg px-3 py-2 text-sm text-orange-700 mb-2">⚠️ חסמים: {r.blockers}</div>}
            {r.next_steps && <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-700">➡️ הבא: {r.next_steps}</div>}
          </div>
        ))}
        {rows.length === 0 && <p className="text-gray-400 text-center py-8">אין עדכונים עדיין</p>}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-4">{editing === 'new' ? 'עדכון חדש' : 'עריכת עדכון'}</h3>
            <Field label="תאריך ביקור" k="visit_date" />
            <Field label="סיכום" k="summary" multiline />
            <Field label="חסמים / בעיות" k="blockers" multiline />
            <Field label="צעדים הבאים" k="next_steps" multiline />
            <div className="flex gap-2 justify-end mt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border text-gray-600 text-sm">ביטול</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm">שמירה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
