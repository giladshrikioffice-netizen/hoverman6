import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import DemoBadge, { demoTint } from '../components/DemoBadge';

const EMPTY = { date:'', topic:'', approved_by:'', status:'ממתין' };
const STATUS_COLOR = { 'מאושר':'bg-green-500/20 text-green-400 border-green-500/30', 'ממתין':'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', 'נדחה':'bg-red-500/20 text-red-400 border-red-500/30' };

export default function Decisions() {
  const { user } = useAuth();
  const canEdit = ['superadmin','admin','committee'].includes(user?.role);
  const canDelete = ['superadmin','admin'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');

  useEffect(() => { api.decisions.list().then(setRows).catch(e=>setErr(e.message)); }, []);

  const [uploading, setUploading] = useState(false);

  const del = async id => {
    if (!confirm('למחוק החלטה זו?')) return;
    try { await api.decisions.del(id); setRows(p=>p.filter(x=>x.id!==id)); }
    catch(e) { setErr(e.message); }
  };

  const handleFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 8*1024*1024) { setErr('הקובץ גדול מ-8MB'); return; }
    const reader = new FileReader();
    reader.onload = async ev => {
      setUploading(true); setErr('');
      try {
        const r = await api.upload(ev.target.result, f.name);
        setForm(p=>({...p, doc_url:r.url, doc_name:f.name}));
      } catch(e) { setErr(e.message); }
      setUploading(false);
    };
    reader.readAsDataURL(f);
  };

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
          <div key={r.id} className={`bg-slate-900 border border-slate-700 rounded-xl p-4 border-r-2 border-r-blue-500 ${demoTint(r.is_demo)}`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-semibold text-white flex items-center gap-2">{r.topic} <DemoBadge show={r.is_demo} /></p>
                <p className="text-xs text-slate-500 mt-1">{r.date} | אישר: {r.approved_by||'—'}</p>
                {r.doc_url && <a href={r.doc_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs mt-1 inline-block">📎 {r.doc_name||'מסמך מצורף'}</a>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[r.status]||''}`}>{r.status}</span>
                {canEdit && <button onClick={()=>{setForm(r);setEditing(r.id);}} className="text-blue-400 text-xs">✏️</button>}
                {canDelete && <button onClick={()=>del(r.id)} className="text-red-400 text-xs">🗑️</button>}
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
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">📎 מסמך אסמכתא (אופציונלי — חשבונית/קבלה, עד 8MB)</label>
              <input type="file" onChange={handleFile}
                className="w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-200 file:px-3 file:py-1.5" />
              {uploading && <p className="text-amber-400 text-xs mt-1">מעלה...</p>}
              {form.doc_name && !uploading && <p className="text-emerald-400 text-xs mt-1">✅ {form.doc_name}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setEditing(null)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">ביטול</button>
              <button onClick={save} disabled={uploading} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm">שמירה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
