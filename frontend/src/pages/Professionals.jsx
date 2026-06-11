import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import DemoBadge, { demoTint } from '../components/DemoBadge';

const EMPTY = { name: '', trade: '', phone: '', email: '', rating: 5, review: '', last_cost: '', last_service_date: '', service_years: '' };

function Stars({ rating, onChange }) {
  return (
    <div className="flex gap-1 flex-row-reverse">
      {[5,4,3,2,1].map(n => (
        <button key={n} type="button" onClick={() => onChange && onChange(n)}
          className={`text-xl ${n <= rating ? 'text-yellow-400' : 'text-slate-600'} ${onChange ? 'hover:text-yellow-300' : ''}`}>
          ★
        </button>
      ))}
    </div>
  );
}

export default function Professionals() {
  const { user } = useAuth();
  const canEdit = ['superadmin', 'admin', 'committee'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { api.professionals.list().then(setRows).catch(e => setErr(e.message)); }, []);

  const save = async () => {
    try {
      if (editing === 'new') { const r = await api.professionals.create(form); setRows(p => [...p, r]); }
      else { const r = await api.professionals.update(editing, form); setRows(p => p.map(x => x.id === editing ? r : x)); }
      setEditing(null);
    } catch(e) { setErr(e.message); }
  };

  const del = async id => {
    if (!confirm('למחוק?')) return;
    await api.professionals.del(id).catch(e => setErr(e.message));
    setRows(p => p.filter(x => x.id !== id));
  };

  const filtered = rows.filter(r => !search || r.name.includes(search) || (r.trade||'').includes(search));

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-white">⭐ אנשי מקצוע</h2>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש..."
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36" />
          {canEdit && (
            <button onClick={() => { setForm(EMPTY); setEditing('new'); }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm">
              + הוסף
            </button>
          )}
        </div>
      </div>

      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(r => (
          <div key={r.id} className={`bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors ${demoTint(r.is_demo)}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">{r.name} <DemoBadge show={r.is_demo} /></h3>
                <p className="text-slate-400 text-xs">{r.trade}</p>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button onClick={() => { setForm(r); setEditing(r.id); }} className="text-blue-400 hover:text-blue-300 text-xs">✏️</button>
                  <button onClick={() => del(r.id)} className="text-red-400 hover:text-red-300 text-xs">🗑️</button>
                </div>
              )}
            </div>
            <Stars rating={r.rating} />
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              {r.phone && (
                <div className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                  <a href={`tel:${r.phone}`} className="text-blue-400 hover:text-blue-300 font-medium">📞 {r.phone}</a>
                  <div className="flex gap-2">
                    <a href={`tel:${r.phone}`} className="bg-blue-700 hover:bg-blue-600 text-white px-2 py-0.5 rounded text-xs transition-colors">התקשר</a>
                    <a href={`https://wa.me/972${r.phone.replace(/[^0-9]/g,'').replace(/^0/,'')}`} target="_blank" rel="noreferrer"
                      className="bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-0.5 rounded text-xs transition-colors">WhatsApp</a>
                  </div>
                </div>
              )}
              {r.email && (
                <div className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                  <span className="text-slate-400">✉️ {r.email}</span>
                  <a href={`mailto:${r.email}?subject=פנייה מ-GS.pro&body=שלום ${r.name},%0A%0A`}
                    className="bg-slate-600 hover:bg-slate-500 text-white px-2 py-0.5 rounded text-xs transition-colors">שלח מייל</a>
                </div>
              )}
              {r.last_cost && <p>💰 טיפול אחרון: ₪{Number(r.last_cost).toLocaleString()}</p>}
              {r.last_service_date && <p>📅 {r.last_service_date}</p>}
              {r.service_years && <p>🗓️ נותן שירות: {r.service_years}</p>}
              {r.review && <p className="text-slate-300 mt-1 bg-slate-800 rounded px-2 py-1">"{r.review}"</p>}
              {r.added_by && <p className="text-slate-600 text-[11px] mt-1">נוסף ע"י: {r.added_by}</p>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-slate-500 text-sm col-span-2 text-center py-8">אין אנשי מקצוע רשומים</p>}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">{editing === 'new' ? 'איש מקצוע חדש' : 'עריכה'}</h3>
            {[['name','שם'],['trade','תחום'],['phone','📞 טלפון'],['email','✉️ אימייל','email'],['service_years','🗓️ כמה שנים נותן שירות (למשל "3 שנים")'],['last_cost','עלות טיפול אחרון (₪)'],['last_service_date','תאריך טיפול אחרון','date']].map(([k,l,t]) => (
              <div key={k} className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">{l}</label>
                <input type={t||'text'} value={form[k]||''} onChange={e => setForm(p=>({...p,[k]:e.target.value}))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">דירוג</label>
              <Stars rating={parseInt(form.rating)||0} onChange={n => setForm(p=>({...p,rating:n}))} />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">חוות דעת</label>
              <textarea rows={2} value={form.review||''} onChange={e => setForm(p=>({...p,review:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
