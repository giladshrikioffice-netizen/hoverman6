import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const fmt = n => '₪' + Number(n||0).toLocaleString('he-IL');
const EMPTY = { name: '', trade: '', phone: '', contract_amount: '', status: 'פעיל' };
const STATUS_COLOR = { 'פעיל': 'bg-green-500/20 text-green-400 border-green-500/30', 'הושלם': 'bg-blue-500/20 text-blue-400 border-blue-500/30', 'מושהה': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };

export default function Contractors() {
  const { user } = useAuth();
  const canEdit = ['superadmin','admin','committee'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');

  useEffect(() => { api.contractors.list().then(setRows).catch(e => setErr(e.message)); }, []);

  const save = async () => {
    try {
      if (editing === 'new') { const r = await api.contractors.create(form); setRows(p=>[...p,r]); }
      else { const r = await api.contractors.update(editing,form); setRows(p=>p.map(x=>x.id===editing?r:x)); }
      setEditing(null);
    } catch(e) { setErr(e.message); }
  };

  const del = async id => {
    if(!confirm('למחוק?')) return;
    await api.contractors.del(id).catch(e=>setErr(e.message));
    setRows(p=>p.filter(x=>x.id!==id));
  };

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">👷 קבלנים וספקים</h2>
        {canEdit && <button onClick={() => { setForm(EMPTY); setEditing('new'); }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">+ הוסף קבלן</button>}
      </div>
      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700">
            <tr>{['שם','תחום','טלפון','סכום חוזה','סטטוס',...(canEdit?['פעולות']:[])].map(h=>(
              <th key={h} className="px-4 py-3 text-right text-xs font-medium text-slate-400">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="px-4 py-2.5 font-medium text-white">{r.name}</td>
                <td className="px-4 py-2.5 text-slate-400">{r.trade}</td>
                <td className="px-4 py-2.5 text-slate-400 text-xs">{r.phone}</td>
                <td className="px-4 py-2.5 text-blue-400 font-medium">{fmt(r.contract_amount)}</td>
                <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[r.status]||'bg-slate-700 text-slate-300'}`}>{r.status}</span></td>
                {canEdit && <td className="px-4 py-2.5 flex gap-2">
                  <button onClick={()=>{setForm(r);setEditing(r.id);}} className="text-blue-400 hover:text-blue-300 text-xs">✏️</button>
                  <button onClick={()=>del(r.id)} className="text-red-400 hover:text-red-300 text-xs">🗑️</button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">{editing==='new'?'קבלן חדש':'עריכה'}</h3>
            {[['name','שם'],['trade','תחום'],['phone','טלפון'],['contract_amount','סכום חוזה']].map(([k,l])=>(
              <div key={k} className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">{l}</label>
                <input value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">סטטוס</label>
              <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['פעיל','הושלם','מושהה'].map(s=><option key={s}>{s}</option>)}
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
