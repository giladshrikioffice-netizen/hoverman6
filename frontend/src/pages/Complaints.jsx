import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const STATUS_COLOR = { 'פתוח':'bg-red-500/20 text-red-400 border-red-500/30', 'בטיפול':'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', 'טופל':'bg-green-500/20 text-green-400 border-green-500/30' };

export default function Complaints() {
  const { user } = useAuth();
  const canManage = ['superadmin','admin','committee'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [newForm, setNewForm] = useState({ subject:'', body:'' });
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { api.complaints.list().then(setRows).catch(e=>setErr(e.message)); }, []);

  const submit = async () => {
    try { const r = await api.complaints.create(newForm); setRows(p=>[r,...p]); setNewForm({subject:'',body:''}); setShowNew(false); }
    catch(e) { setErr(e.message); }
  };

  const updateStatus = async (id, status) => {
    const r = await api.complaints.update(id,{status}).catch(e=>{ setErr(e.message); return null; });
    if(r) setRows(p=>p.map(x=>x.id===id?r:x));
  };

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">📩 פניות ותלונות</h2>
        <button onClick={()=>setShowNew(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">+ פנייה חדשה</button>
      </div>
      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="space-y-3">
        {rows.map(r=>(
          <div key={r.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-semibold text-white">{r.subject}</p>
                <p className="text-xs text-slate-500 mt-0.5">דירה {r.unit_number} | {new Date(r.created_at).toLocaleDateString('he-IL')}</p>
                {r.body && <p className="text-sm text-slate-400 mt-2">{r.body}</p>}
              </div>
              <div className="flex items-center gap-2 mr-3">
                <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[r.status]||''}`}>{r.status}</span>
                {canManage && (
                  <select value={r.status} onChange={e=>updateStatus(r.id,e.target.value)}
                    className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white focus:outline-none">
                    {['פתוח','בטיפול','טופל'].map(s=><option key={s}>{s}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>
        ))}
        {rows.length===0 && <p className="text-slate-500 text-sm text-center py-8">אין פניות</p>}
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">פנייה חדשה</h3>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">נושא</label>
              <input value={newForm.subject} onChange={e=>setNewForm(p=>({...p,subject:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">פרטים</label>
              <textarea rows={3} value={newForm.body} onChange={e=>setNewForm(p=>({...p,body:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setShowNew(false)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">ביטול</button>
              <button onClick={submit} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">שלח</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
