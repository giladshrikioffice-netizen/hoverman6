import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import DemoBadge, { demoTint } from '../components/DemoBadge';

const EMPTY = { name: '', address: '', num_units: '', num_floors: '', budget: '', target_date: '', type: 'supervision' };
const fmt = n => '₪' + Number(n||0).toLocaleString('he-IL');
const TYPE_LABEL = {
  supervision: { text: '🔵 פיקוח הנדסי', cls: 'bg-blue-600/20 text-blue-400 border-blue-600/40' },
  maintenance: { text: '🟢 תחזוקה שוטפת', cls: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/40' },
  both:        { text: '🔵🟢 פיקוח + תחזוקה', cls: 'bg-purple-600/20 text-purple-400 border-purple-600/40' },
};

export default function AdminPanel({ onSelectBuilding }) {
  const { selectBuilding } = useAuth();
  const [buildings, setBuildings] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');

  useEffect(() => { api.buildings.list().then(setBuildings).catch(e => setErr(e.message)); }, []);

  const save = async () => {
    try {
      if (editing === 'new') { const b = await api.buildings.create(form); setBuildings(p => [...p, b]); }
      else { const b = await api.buildings.update(editing, form); setBuildings(p => p.map(x => x.id === editing ? b : x)); }
      setEditing(null);
    } catch (e) { setErr(e.message); }
  };

  const del = async id => {
    if (!confirm('למחוק בניין זה?')) return;
    await api.buildings.del(id).catch(e => setErr(e.message));
    setBuildings(p => p.filter(x => x.id !== id));
  };

  const enter = b => { selectBuilding(b); onSelectBuilding(b); };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">🏢 ניהול בניינים</h2>
        <button onClick={() => { setForm(EMPTY); setEditing('new'); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
          + בניין חדש
        </button>
      </div>

      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-4 text-sm">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buildings.map(b => (
          <div key={b.id} className={`bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-blue-500/50 transition-colors ${demoTint(b.is_demo)}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">{b.name} <DemoBadge show={b.is_demo} /></h3>
                <p className="text-slate-400 text-xs mt-0.5">{b.address}</p>
                <span className={`inline-block mt-1.5 border text-[11px] px-2 py-0.5 rounded-full ${(TYPE_LABEL[b.type]||TYPE_LABEL.supervision).cls}`}>
                  {(TYPE_LABEL[b.type]||TYPE_LABEL.supervision).text}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setForm(b); setEditing(b.id); }} className="text-blue-400 hover:text-blue-300 text-xs">✏️</button>
                <button onClick={() => del(b.id)} className="text-red-400 hover:text-red-300 text-xs">🗑️</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-4">
              <span>🏠 {b.num_units} דירות</span>
              <span>🏗️ {b.num_floors} קומות</span>
              <span>💰 {fmt(b.budget)}</span>
              <span>🎯 {b.target_date || '—'}</span>
            </div>
            <button onClick={() => enter(b)}
              className="w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-600/40 rounded-lg py-1.5 text-sm transition-colors">
              כניסה לבניין →
            </button>
          </div>
        ))}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">{editing === 'new' ? 'בניין חדש' : 'עריכת בניין'}</h3>
            <div className="mb-3">
              <label className="block text-sm text-slate-400 mb-1">סיווג הבניין</label>
              <select value={form.type||'supervision'} onChange={e=>setForm(p=>({...p,type:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="supervision">🔵 פיקוח הנדסי בלבד</option>
                <option value="maintenance">🟢 תחזוקה שוטפת בלבד</option>
                <option value="both">🔵🟢 פיקוח + תחזוקה (שניהם)</option>
              </select>
            </div>
            {[['name','שם הבניין'],['address','כתובת'],['num_units','מספר דירות'],['num_floors','מספר קומות'],['budget','תקציב (₪)'],['target_date','יעד סיום']].map(([k,l]) => (
              <div key={k} className="mb-3">
                <label className="block text-sm text-slate-400 mb-1">{l}</label>
                <input type={k === 'target_date' ? 'date' : 'text'} value={form[k]} onChange={e => setForm(p=>({...p,[k]:e.target.value}))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">ביטול</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500">שמירה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
