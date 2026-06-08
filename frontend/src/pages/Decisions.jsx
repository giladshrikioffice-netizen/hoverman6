import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const EMPTY = { date:'', topic:'', approved_by:'', status:'ממתין' };
const STATUS_COLOR = { 'מאושר':'bg-green-500/20 text-green-400 border-green-500/30', 'ממתין':'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', 'נדחה':'bg-red-500/20 text-red-400 border-red-500/30' };

export default function Decisions() {
  const { user } = useAuth();
  const canEdit = ['superadmin','admin','committee'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');

  useEffect(() => { api.decisions.list().then(setRows).catch(e=>setErr(e.message)); }, []);

  const save = async () => {
    try {
      if(editing==='new') { const r = await api.decisions.create(form); setRows(p=>[r,...p]); }
      else { const r = await api.decisions.update(editing,form); setRows(p=>p.map(x=>x.id===editing?r:x)); }
      setEditing(null);
    } catch(e) { setErr(e.message); }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">📋 יומן החלטות</h2>
        {canEdit && <button onClick={()=>{setForm({...EMPTY,date:new Date().toISOString().slice(0,10)});setEditing('new');}} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">+ החלטה חדשה</button>}
      </div>
      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="space-y-3">
        {rows.map(r=>(
          <div key={r.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4 border-r-2 border-r-blue-500">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-semibold text-white">{r.topic}</p>
                <p className="text-xs text-slate-500 mt-1">{r.date} | אישר: {r.approved_by||'—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[r.status]||''}`}>{r.status}</span>
                {canEdit && <button onClick={()=>{setForm(r);setEditing(r.id);}} className="text-blue-400 text-xs">✏️</button>}
              </div>
            </div>
          </div>
        ))}
        {rows.length===0 && <p className="text-slate-500 text-center py-8">אין החלטות</p>}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">{editing==='new'?'החלטה חדשה':'עריכה'}</h3>
            {[['date','תאריך','date'],['topic','נושא','text'],['approved_by','אושר ע"י','text']].map(([k,l,t])=>(
              <div key={k} className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">{l}</label>
                <input type={t} value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">סטטוס</label>
              <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['ממתין','מאושר','נדחה'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
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
