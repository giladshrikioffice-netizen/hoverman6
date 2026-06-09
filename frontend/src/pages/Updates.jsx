import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const EMPTY = { visit_date:'', summary:'', blockers:'', next_steps:'' };

export default function Updates() {
  const { user } = useAuth();
  const canEdit = ['superadmin','admin','committee'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');

  useEffect(() => { api.updates.list().then(setRows).catch(e=>setErr(e.message)); }, []);

  const save = async () => {
    try {
      if(editing==='new') { const r = await api.updates.create(form); setRows(p=>[r,...p]); }
      else { const r = await api.updates.update(editing,form); setRows(p=>p.map(x=>x.id===editing?r:x)); }
      setEditing(null);
    } catch(e) { setErr(e.message); }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">📋 יומן פיקוח</h2>
        {canEdit && <button onClick={()=>{setForm({...EMPTY,visit_date:new Date().toISOString().slice(0,10)});setEditing('new');}} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">+ עדכון חדש</button>}
      </div>
      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="space-y-4">
        {rows.map(r=>(
          <div key={r.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-white">ביקור {r.visit_date}</h3>
                <p className="text-xs text-slate-500">מאת: {r.author}</p>
              </div>
              {canEdit && <button onClick={()=>{setForm(r);setEditing(r.id);}} className="text-blue-400 text-xs">✏️</button>}
            </div>
            {r.summary && <p className="text-slate-300 text-sm mb-2">{r.summary}</p>}
            {r.blockers && <div className="bg-orange-900/20 border border-orange-700/40 rounded-lg px-3 py-1.5 text-sm text-orange-400 mb-2">⚠️ {r.blockers}</div>}
            {r.next_steps && <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg px-3 py-1.5 text-sm text-blue-400">➡️ {r.next_steps}</div>}
          </div>
        ))}
        {rows.length===0 && <p className="text-slate-500 text-center py-8">אין עדכונים</p>}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">{editing==='new'?'עדכון חדש':'עריכה'}</h3>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">תאריך ביקור</label>
              <input type="date" value={form.visit_date||''} onChange={e=>setForm(p=>({...p,visit_date:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {[['summary','סיכום'],['blockers','חסמים/בעיות'],['next_steps','צעדים הבאים']].map(([k,l])=>(
              <div key={k} className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">{l}</label>
                <textarea rows={2} value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
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
