import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const STATUS_COLOR = {
  'תקין': 'bg-green-500/20 text-green-400 border-green-500/30',
  'נדרש טיפול': 'bg-red-500/20 text-red-400 border-red-500/30',
  'בטיפול': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};
const EMPTY = { name: '', frequency_days: 365, last_check: '', status: 'תקין', notes: '' };

const DEFAULT_ITEMS = [
  { name: 'מעלית', frequency_days: 180 },
  { name: 'גנרטור חירום', frequency_days: 365 },
  { name: 'משאבות מים/ביוב', frequency_days: 180 },
  { name: 'מערכת כיבוי אש ומטפים', frequency_days: 365 },
  { name: 'ביטוח מבנה משותף', frequency_days: 365 },
  { name: 'מאגר/מערכת מים', frequency_days: 365 },
  { name: 'לוחות חשמל משותפים', frequency_days: 365 },
  { name: 'דלתות/שערים ואינטרקום', frequency_days: 365 },
  { name: 'גינון', frequency_days: 30 },
  { name: 'ניקיון', frequency_days: 30 },
];

export default function Maintenance() {
  const { user } = useAuth();
  const canEdit = ['superadmin', 'admin', 'committee'].includes(user?.role);
  const [items, setItems] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');

  const load = () => {
    api.maintenance.list().then(setItems).catch(e => setErr(e.message));
    api.professionals.list().then(setProfessionals).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const isAlert = item => item.alert;

  const save = async () => {
    try {
      if (editing === 'new') { const r = await api.maintenance.create(form); setItems(p => [...p, r]); }
      else { const r = await api.maintenance.update(editing, form); setItems(p => p.map(x => x.id === editing ? r : x)); }
      setEditing(null);
    } catch(e) { setErr(e.message); }
  };

  const del = async id => {
    if (!confirm('למחוק?')) return;
    await api.maintenance.del(id).catch(e => setErr(e.message));
    setItems(p => p.filter(x => x.id !== id));
  };

  const markDone = async item => {
    const today = new Date().toISOString().slice(0, 10);
    const updated = await api.maintenance.update(item.id, { ...item, last_check: today, status: 'תקין' }).catch(e => { setErr(e.message); return null; });
    if (updated) setItems(p => p.map(x => x.id === item.id ? updated : x));
  };

  const alerts = items.filter(isAlert);

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">🔧 קבלני תחזוקה שוטפת</h2>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => { setForm(EMPTY); setEditing('new'); }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">
              + פריט חדש
            </button>
          </div>
        )}
      </div>

      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-600/40 rounded-xl p-4 mb-4">
          <h3 className="text-yellow-400 font-semibold text-sm mb-2">⚠️ {alerts.length} פריטים דורשים תשומת לב בקרוב</h3>
          <div className="flex flex-wrap gap-2">
            {alerts.map(a => (
              <span key={a.id} className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 px-2 py-0.5 rounded text-xs">
                {a.name} — {a.next_check}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700">
            <tr>
              {['פריט', 'תדירות', 'בדיקה אחרונה', 'בדיקה הבאה', 'סטטוס', 'איש מקצוע', ...(canEdit ? ['פעולות'] : [])].map(h => (
                <th key={h} className="px-3 py-3 text-right text-xs font-medium text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className={`border-b border-slate-800 hover:bg-slate-800/50 ${isAlert(item) ? 'bg-yellow-900/10' : ''}`}>
                <td className="px-3 py-2.5 font-medium text-white">
                  {isAlert(item) && <span className="text-yellow-400 ml-1">⚠️</span>}
                  {item.name}
                </td>
                <td className="px-3 py-2.5 text-slate-400 text-xs">{item.frequency_days >= 365 ? 'שנתי' : item.frequency_days >= 180 ? 'חצי-שנתי' : item.frequency_days >= 30 ? 'חודשי' : `${item.frequency_days} ימים`}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs">{item.last_check || '—'}</td>
                <td className="px-3 py-2.5 text-xs">{item.next_check || '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[item.status] || 'bg-slate-700 text-slate-300'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-400 text-xs">{item.professional_name || '—'}</td>
                {canEdit && (
                  <td className="px-3 py-2.5">
                    <div className="flex gap-2">
                      <button onClick={() => markDone(item)} className="text-green-400 hover:text-green-300 text-xs">✓ בוצע</button>
                      <button onClick={() => { setForm(item); setEditing(item.id); }} className="text-blue-400 hover:text-blue-300 text-xs">✏️</button>
                      <button onClick={() => del(item.id)} className="text-red-400 hover:text-red-300 text-xs">🗑️</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">{editing === 'new' ? 'פריט תחזוקה חדש' : 'עריכה'}</h3>
            {[['name','שם הפריט','text'],['last_check','בדיקה אחרונה','date'],['notes','הערות','text']].map(([k,l,t]) => (
              <div key={k} className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">{l}</label>
                <input type={t} value={form[k]||''} onChange={e => setForm(p=>({...p,[k]:e.target.value}))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">תדירות (ימים)</label>
              <select value={form.frequency_days} onChange={e => setForm(p=>({...p,frequency_days:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value={30}>חודשי (30 יום)</option>
                <option value={90}>רבעוני (90 יום)</option>
                <option value={180}>חצי-שנתי (180 יום)</option>
                <option value={365}>שנתי (365 יום)</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">סטטוס</label>
              <select value={form.status} onChange={e => setForm(p=>({...p,status:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['תקין','נדרש טיפול','בטיפול'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">איש מקצוע</label>
              <select value={form.professional_id||''} onChange={e => setForm(p=>({...p,professional_id:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— ללא —</option>
                {professionals.map(p => <option key={p.id} value={p.id}>{p.name} ({p.trade})</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">ביטול</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">שמירה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
