import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const fmt = n => '₪' + Number(n||0).toLocaleString('he-IL');
const EMPTY = { category:'', planned_amount:'', paid_amount:'', track:'project' };
const pct = (a,b) => b ? Math.min(Math.round(a/b*100),100) : 0;
const TRACKS = [['all','הכל'],['project','📐 ניהול פרויקט'],['maintenance','🔧 ניהול תחזוקה']];
const TRACK_LABEL = { project:'📐 פרויקט', maintenance:'🔧 תחזוקה' };

export default function Budget() {
  const { user } = useAuth();
  const canEdit = ['superadmin','admin','committee'].includes(user?.role);
  const [data, setData] = useState({ items:[], totals:{} });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');
  const [track, setTrack] = useState('all');

  const load = () => api.budget.get().then(setData).catch(e=>setErr(e.message));
  useEffect(() => { load(); }, []);

  const items = data.items.filter(r => track==='all' || (r.track||'project')===track);
  const totals = items.reduce((a,r)=>({
    planned:a.planned+(r.planned_amount||0), paid:a.paid+(r.paid_amount||0),
  }),{planned:0,paid:0});
  totals.balance = totals.planned - totals.paid;
  totals.project_total = data.totals.project_total;

  const save = async () => {
    try {
      if(editing==='new') await api.budget.create(form); else await api.budget.update(editing,form);
      setEditing(null); load();
    } catch(e) { setErr(e.message); }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">💰 תקציב פרויקט</h2>
        {canEdit && <button onClick={()=>{setForm(EMPTY);setEditing('new');}} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">+ סעיף חדש</button>}
      </div>
      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="flex gap-2 mb-4 flex-wrap">
        {TRACKS.map(([k,l])=>(
          <button key={k} onClick={()=>setTrack(k)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${track===k?'bg-blue-600 text-white border-blue-500':'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[['תקציב',fmt(totals.project_total)],['מתוכנן',fmt(totals.planned)],['שולם',fmt(totals.paid)],['יתרה',fmt(totals.balance)]].map(([l,v])=>(
          <div key={l} className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400">{l}</p>
            <p className="font-bold text-white text-sm mt-0.5">{v}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700">
            <tr>{['סעיף','מסלול','מתוכנן','שולם','יתרה','%',...(canEdit?['פעולות']:[])].map(h=>(
              <th key={h} className="px-4 py-3 text-right text-xs font-medium text-slate-400">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {items.map(r=>(
              <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="px-4 py-2.5 font-medium text-white">{r.category}</td>
                <td className="px-4 py-2.5 text-xs text-slate-400">{TRACK_LABEL[r.track||'project']}</td>
                <td className="px-4 py-2.5 text-slate-300">{fmt(r.planned_amount)}</td>
                <td className="px-4 py-2.5 text-green-400">{fmt(r.paid_amount)}</td>
                <td className={`px-4 py-2.5 font-medium ${r.balance<0?'text-red-400':'text-orange-400'}`}>{fmt(r.balance)}</td>
                <td className="px-4 py-2.5 min-w-20">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{width:pct(r.paid_amount,r.planned_amount)+'%'}} />
                    </div>
                    <span className="text-xs text-slate-500">{pct(r.paid_amount,r.planned_amount)}%</span>
                  </div>
                </td>
                {canEdit && <td className="px-4 py-2.5 flex gap-2">
                  <button onClick={()=>{setForm(r);setEditing(r.id);}} className="text-blue-400 text-xs">✏️</button>
                  <button onClick={async()=>{ if(!confirm('למחוק?')) return; await api.budget.del(r.id); load(); }} className="text-red-400 text-xs">🗑️</button>
                </td>}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-600">
            <tr>
              <td className="px-4 py-2.5 font-semibold text-white">סה״כ {track!=='all'?TRACK_LABEL[track]:''}</td>
              <td />
              <td className="px-4 py-2.5 font-semibold text-slate-300">{fmt(totals.planned)}</td>
              <td className="px-4 py-2.5 font-semibold text-green-400">{fmt(totals.paid)}</td>
              <td className="px-4 py-2.5 font-semibold text-orange-400">{fmt(totals.balance)}</td>
              <td className="px-4 py-2.5 text-xs text-slate-500">{pct(totals.paid,totals.planned)}%</td>
              {canEdit && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">{editing==='new'?'סעיף חדש':'עריכה'}</h3>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">מסלול תקציב</label>
              <select value={form.track||'project'} onChange={e=>setForm(p=>({...p,track:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="project">📐 ניהול פרויקט</option>
                <option value="maintenance">🔧 ניהול תחזוקה</option>
              </select>
            </div>
            {[['category','קטגוריה'],['planned_amount','מתוכנן (₪)'],['paid_amount','שולם (₪)']].map(([k,l])=>(
              <div key={k} className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">{l}</label>
                <input value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setEditing(null)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">ביטול</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">שמירה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
