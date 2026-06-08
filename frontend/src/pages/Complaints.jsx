import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const statusColor = s => ({ 'פתוח': 'bg-red-100 text-red-800', 'בטיפול': 'bg-yellow-100 text-yellow-800', 'טופל': 'bg-green-100 text-green-800' }[s] || 'bg-gray-100');
const STATUSES = ['פתוח', 'בטיפול', 'טופל'];

export default function Complaints() {
  const { user } = useAuth();
  const isResident = user?.role === 'resident';
  const canManage = ['admin', 'committee'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [newForm, setNewForm] = useState({ subject: '', body: '' });
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { api.complaints.list().then(setRows).catch(e => setErr(e.message)); }, []);

  const submit = async () => {
    try {
      const r = await api.complaints.create(newForm);
      setRows(prev => [r, ...prev]);
      setNewForm({ subject: '', body: '' });
      setShowNew(false);
    } catch (e) { setErr(e.message); }
  };

  const updateStatus = async (id, status) => {
    try {
      const r = await api.complaints.update(id, { status });
      setRows(prev => prev.map(x => x.id === id ? r : x));
    } catch (e) { setErr(e.message); }
  };

  const del = async id => {
    if (!confirm('למחוק?')) return;
    await api.complaints.del(id).catch(e => setErr(e.message));
    setRows(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">📩 פניות ותלונות</h2>
        <button onClick={() => setShowNew(true)} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800">+ פנייה חדשה</button>
      </div>

      {err && <div className="bg-red-50 text-red-700 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{r.subject}</p>
                <p className="text-xs text-gray-400 mt-0.5">דירה {r.unit_number} | {new Date(r.created_at).toLocaleDateString('he-IL')}</p>
                {r.body && <p className="text-sm text-gray-600 mt-2">{r.body}</p>}
              </div>
              <div className="flex items-center gap-2 mr-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(r.status)}`}>{r.status}</span>
                {canManage && (
                  <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                    className="text-xs border rounded px-2 py-1 focus:outline-none">
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                )}
                {user?.role === 'admin' && <button onClick={() => del(r.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>}
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-gray-400 text-center py-8">אין פניות</p>}
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">פנייה חדשה</h3>
            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">נושא</label>
              <input value={newForm.subject} onChange={e => setNewForm(p => ({ ...p, subject: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">פרטים</label>
              <textarea rows={4} value={newForm.body} onChange={e => setNewForm(p => ({ ...p, body: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg border text-gray-600 text-sm">ביטול</button>
              <button onClick={submit} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm">שלח פנייה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
