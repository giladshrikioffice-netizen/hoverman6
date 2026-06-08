import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const fmt = n => '₪' + Number(n||0).toLocaleString('he-IL');
const STATUS_COLOR = { 'שולם במלואו':'bg-green-500/20 text-green-400 border-green-500/30', 'שולם חלקית':'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', 'לא שולם':'bg-red-500/20 text-red-400 border-red-500/30' };

export default function Payments() {
  const { user } = useAuth();
  const canEdit = ['superadmin','admin','committee'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { api.payments.list().then(setRows).catch(e=>setErr(e.message)); }, []);

  const save = async () => {
    try { const r = await api.payments.update(editing,form); setRows(p=>p.map(x=>x.id===editing?r:x)); setEditing(null); }
    catch(e) { setErr(e.message); }
  };

  const filtered = rows.filter(r => !search || String(r.unit_number).includes(search) || (r.owner_name||'').includes(search));
  const totals = rows.reduce((a,r)=>({ due:a.due+r.amount_due, paid:a.paid+r.amount_paid }),{due:0,paid:0});

  if (user?.role === 'resident') return (
    <div className="max-w-sm">
      <h2 className="text-xl font-bold text-white mb-4">💳 מצב התשלום שלי</h2>
      {rows.map(r=>(
        <div key={r.id} className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div><p className="text-xs text-slate-400">לתשלום</p><p className="text-lg font-bold text-white">{fmt(r.amount_due)}</p></div>
            <div><p className="text-xs text-slate-400">שולם</p><p className="text-lg font-bold text-green-400">{fmt(r.amount_paid)}</p></div>
            <div><p className="text-xs text-slate-400">יתרה</p><p className="text-lg font-bold text-red-400">{fmt(r.balance)}</p></div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm border ${STATUS_COLOR[r.status]||''}`}>{r.status}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-5xl">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-white">💳 גבייה מדיירים</h2>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="חיפוש דירה/שם..."
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none w-44" />
      </div>
      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[['סה״כ לגביה',fmt(totals.due),'blue'],['שולם',fmt(totals.paid),'green'],['יתרת חוב',fmt(totals.due-totals.paid),'red']].map(([l,v,c])=>(
          <div key={l} className={`bg-slate-900 border rounded-xl p-3 text-center border-${c}-500/30`}>
            <p className="text-xs text-slate-400">{l}</p>
            <p className={`font-bold text-${c}-400`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700">
            <tr>{['דירה','בעלים','לתשלום','שולם','יתרה','סטטוס',...(canEdit?['פעולות']:[])].map(h=>(
              <th key={h} className="px-3 py-3 text-right text-xs font-medium text-slate-400">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {filtered.map(r=>(
              <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="px-3 py-2 font-medium text-white">{r.unit_number}</td>
                <td className="px-3 py-2 text-slate-400 text-xs">{r.owner_name||'—'}</td>
                <td className="px-3 py-2 text-slate-300">{fmt(r.amount_due)}</td>
                <td className="px-3 py-2 text-green-400">{fmt(r.amount_paid)}</td>
                <td className={`px-3 py-2 font-medium ${r.balance>0?'text-red-400':'text-green-400'}`}>{fmt(r.balance)}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[r.status]||''}`}>{r.status}</span></td>
                {canEdit && <td className="px-3 py-2">
                  <button onClick={()=>{ setForm({amount_due:r.amount_due,amount_paid:r.amount_paid,due_date:r.due_date||'',note:r.note||''}); setEditing(r.id); }} className="text-blue-400 hover:text-blue-300 text-xs">✏️</button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">עריכת תשלום</h3>
            {[['amount_due','לתשלום (₪)'],['amount_paid','שולם (₪)'],['note','הערה']].map(([k,l])=>(
              <div key={k} className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">{l}</label>
                <input value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">תאריך לתשלום</label>
              <input type="date" value={form.due_date||''} onChange={e=>setForm(p=>({...p,due_date:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
