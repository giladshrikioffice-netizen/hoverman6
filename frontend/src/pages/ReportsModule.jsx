import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

// Req #3: monthly inspection reports. Committee composes + attaches docs and
// publishes; residents see a report only after it is published.
const nowMonth = new Date().toISOString().slice(0, 7);
const EMPTY = { month: nowMonth, title: '', summary: '', docs: [] };

export default function ReportsModule() {
  const { user } = useAuth();
  const isStaff = ['superadmin', 'admin', 'committee'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = () => api.monthlyReports.list().then(setRows).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setEditing('new'); setErr(''); };
  const openEdit = r => { setForm({ ...r, docs: r.docs || [] }); setEditing(r.id); setErr(''); };

  const save = async (publish) => {
    try {
      const payload = { ...form, status: publish ? 'published' : (form.status || 'draft') };
      if (editing === 'new') await api.monthlyReports.create(payload);
      else await api.monthlyReports.update(editing, payload);
      setEditing(null); load();
    } catch (e) { setErr(e.message); }
  };

  const setPublished = async (r, published) => {
    try { await api.monthlyReports.update(r.id, { ...r, status: published ? 'published' : 'draft' }); load(); }
    catch (e) { setErr(e.message); }
  };

  const del = async id => {
    if (!confirm('למחוק דוח זה?')) return;
    try { await api.monthlyReports.del(id); setRows(p => p.filter(x => x.id !== id)); }
    catch (e) { setErr(e.message); }
  };

  const handleFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setErr('הקובץ גדול מ-8MB'); return; }
    const reader = new FileReader();
    reader.onload = async ev => {
      setUploading(true); setErr('');
      try { const r = await api.upload(ev.target.result, f.name); setForm(p => ({ ...p, docs: [...(p.docs || []), { url: r.url, name: f.name }] })); }
      catch (e) { setErr(e.message); }
      setUploading(false);
    };
    reader.readAsDataURL(f);
  };

  const removeDoc = i => setForm(p => ({ ...p, docs: p.docs.filter((_, idx) => idx !== i) }));

  return (
    <div className="max-w-3xl" dir="rtl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">📑 דוחות פיקוח חודשיים</h2>
        {isStaff && <button onClick={openNew} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">+ דוח חדש</button>}
      </div>

      {!isStaff && <p className="text-slate-400 text-sm mb-3">כאן מתפרסמים דוחות הפיקוח החודשיים שאישר ועד הבית.</p>}
      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <p className="font-semibold text-white flex items-center gap-2">
                  {r.title || `דוח ${r.month}`}
                  {isStaff && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${r.status === 'published' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border-amber-500/40'}`}>
                      {r.status === 'published' ? 'פורסם' : 'טיוטה'}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">חודש {r.month}{r.author ? ` · ${r.author}` : ''}{r.published_at ? ` · פורסם ${r.published_at}` : ''}</p>
                {r.summary && <p className="text-slate-300 text-sm mt-2 whitespace-pre-wrap">{r.summary}</p>}
                {r.docs && r.docs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.docs.map((d, i) => (
                      <a key={i} href={d.url} target="_blank" rel="noreferrer"
                        className="bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs px-2 py-1 rounded-lg">📎 {d.name || 'מסמך'}</a>
                    ))}
                  </div>
                )}
              </div>
              {isStaff && (
                <div className="flex flex-col gap-1.5 items-end">
                  <button onClick={() => openEdit(r)} className="text-blue-400 text-xs">✏️ ערוך</button>
                  {r.status === 'published'
                    ? <button onClick={() => setPublished(r, false)} className="text-amber-400 text-xs">↩️ בטל פרסום</button>
                    : <button onClick={() => setPublished(r, true)} className="text-emerald-400 text-xs">📢 פרסם לדיירים</button>}
                  <button onClick={() => del(r.id)} className="text-red-400 text-xs">🗑️</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-slate-500 text-center py-8">{isStaff ? 'אין דוחות עדיין' : 'טרם פורסמו דוחות'}</p>}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-bold text-white mb-4">{editing === 'new' ? 'דוח חודשי חדש' : 'עריכת דוח'}</h3>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">חודש</label>
              <input type="month" value={form.month} onChange={e => setForm(p => ({ ...p, month: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">כותרת</label>
              <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">תקציר הדוח</label>
              <textarea rows={4} value={form.summary || ''} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">📎 מסמכים מצורפים (עד 8MB כל אחד)</label>
              <input type="file" onChange={handleFile}
                className="w-full text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-200 file:px-3 file:py-1.5" />
              {uploading && <p className="text-amber-400 text-xs mt-1">מעלה...</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {(form.docs || []).map((d, i) => (
                  <span key={i} className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                    📎 {d.name} <button onClick={() => removeDoc(i)} className="text-red-400">✕</button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end flex-wrap">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">ביטול</button>
              <button onClick={() => save(false)} disabled={uploading} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm">שמור כטיוטה</button>
              <button onClick={() => save(true)} disabled={uploading} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm">📢 פרסם לדיירים</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
