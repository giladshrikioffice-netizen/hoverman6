import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const CATEGORIES = [
  { value: 'permit',     label: '📋 היתרים ואישורים' },
  { value: 'contract',   label: '📝 חוזים' },
  { value: 'insurance',  label: '🛡️ ביטוחים' },
  { value: 'plans',      label: '📐 תוכניות' },
  { value: 'financial',  label: '💰 כספי' },
  { value: 'protocol',   label: '🏛️ פרוטוקולים' },
  { value: 'handover',   label: '🏠 פרוטוקולי מסירה' },
  { value: 'report',     label: '📊 דוחות פיקוח' },
  { value: 'general',    label: '📁 כללי' },
];
const CAT_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

const STATUS_COLORS = {
  exists:  'bg-emerald-900/30 text-emerald-400 border-emerald-700',
  partial: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
  missing: 'bg-red-900/30 text-red-400 border-red-700',
};
const STATUS_LABEL = { exists: '✅ קיים', partial: '⚠️ חלקי', missing: '❌ חסר' };

const MAX_SIZE = 8 * 1024 * 1024; // 8MB

export default function Documents() {
  const { user } = useAuth();
  const isPrivileged = ['superadmin','committee'].includes(user?.role);
  const [tab, setTab] = useState('docs');
  const [docs, setDocs] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [units, setUnits] = useState([]);
  const fileRef = useRef();

  const [form, setForm] = useState({ name: '', description: '', category: 'general', visibility: 'committee', unit_id: '', file: null });

  const flash = m => { setSuccessMsg(m); setTimeout(() => setSuccessMsg(''), 3000); };

  useEffect(() => {
    Promise.all([
      api.documents.list(),
      isPrivileged ? api.documents.checklist() : Promise.resolve([]),
      isPrivileged ? api.units.list() : Promise.resolve([]),
    ]).then(([d, c, u]) => { setDocs(d); setChecklist(c); setUnits(u); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  const handleFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > MAX_SIZE) { setErr('הקובץ גדול מ-8MB. כווץ אותו לפני ההעלאה.'); return; }
    const reader = new FileReader();
    reader.onload = ev => setForm(p => ({ ...p, file: { data: ev.target.result, type: f.type, name: f.name, size: f.size } }));
    reader.readAsDataURL(f);
  };

  const upload = async () => {
    if (!form.name) { setErr('שם המסמך חובה'); return; }
    if (form.visibility === 'unit' && !form.unit_id) { setErr('יש לבחור דירה עבור מסמך המיועד לדירה ספציפית'); return; }
    setUploading(true); setErr('');
    try {
      const d = await api.documents.create({
        name: form.name, description: form.description,
        category: form.category, visibility: form.visibility,
        unit_id: form.visibility === 'unit' ? Number(form.unit_id) : null,
        file_data: form.file?.data || null,
        file_type: form.file?.type || '',
        file_name: form.file?.name || '',
        file_size: form.file?.size || 0,
      });
      setDocs(p => [d, ...p]);
      setShowAdd(false); setForm({ name: '', description: '', category: 'general', visibility: 'committee', unit_id: '', file: null });
      flash('✅ מסמך הועלה בהצלחה');
    } catch(e) { setErr(e.message); }
    setUploading(false);
  };

  const download = async (doc) => {
    try {
      const r = await api.documents.download(doc.id);
      const a = document.createElement('a');
      a.href = r.file_data;
      a.download = r.file_name || doc.name;
      a.click();
    } catch(e) { setErr(e.message); }
  };

  const toggleVisibility = async (doc) => {
    const newVis = doc.visibility === 'committee' ? 'all' : 'committee';
    try {
      const updated = await api.documents.update(doc.id, { ...doc, visibility: newVis });
      setDocs(p => p.map(d => d.id === updated.id ? updated : d));
      flash(newVis === 'all' ? '✅ המסמך נחשף לדיירים' : '✅ המסמך הוגבל לוועד בלבד');
    } catch(e) { setErr(e.message); }
  };

  const deleteDoc = async (id) => {
    if (!window.confirm('למחוק מסמך זה?')) return;
    await api.documents.del(id);
    setDocs(p => p.filter(d => d.id !== id));
  };

  const updateChecklist = async (key, status) => {
    await api.documents.updateChecklist(key, status, '');
    setChecklist(p => p.map(i => i.key === key ? { ...i, status } : i));
  };

  if (loading) return <div className="text-slate-500 text-sm">טוען...</div>;

  const missing = checklist.filter(i => i.status === 'missing').length;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">📁 תיק בניין</h1>
          <p className="text-slate-400 text-sm mt-0.5">{docs.length} מסמכים{isPrivileged && checklist.length ? ` · ${missing} מסמכים חסרים` : ''}</p>
        </div>
        {isPrivileged && (
          <button onClick={() => { setShowAdd(true); setErr(''); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            + העלה מסמך
          </button>
        )}
      </div>

      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-4 py-2 rounded-lg mb-3">{err}</div>}
      {successMsg && <div className="bg-emerald-900/30 border border-emerald-700 text-emerald-400 text-sm px-4 py-2 rounded-lg mb-3">{successMsg}</div>}

      {/* Tabs */}
      {isPrivileged && (
        <div className="flex gap-1 mb-5 bg-slate-900 p-1 rounded-lg w-fit">
          {[['docs','📁 מסמכים'],['checklist','✅ צ\'קליסט']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${tab===k ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{l}</button>
          ))}
        </div>
      )}

      {/* ── Documents Tab ── */}
      {tab === 'docs' && (
        <div>
          {docs.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <p className="text-4xl mb-3">📂</p>
              <p>אין מסמכים עדיין</p>
              {isPrivileged && <p className="text-xs mt-1">לחץ "העלה מסמך" כדי להתחיל</p>}
            </div>
          )}
          <div className="grid gap-3">
            {docs.map(doc => (
              <div key={doc.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-start justify-between gap-3 hover:border-slate-600 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{doc.name}</span>
                    <span className="text-slate-500 text-xs">{CAT_LABEL[doc.category] || doc.category}</span>
                    <span className={`border text-xs px-1.5 py-0.5 rounded ${doc.visibility==='all' ? 'border-emerald-700 text-emerald-400 bg-emerald-900/20' : doc.visibility==='unit' ? 'border-purple-700 text-purple-400 bg-purple-900/20' : 'border-slate-700 text-slate-500'}`}>
                      {doc.visibility === 'all' ? '🌐 גלוי לדיירים' : doc.visibility === 'unit' ? `🏠 דירה ${units.find(u=>u.id===doc.unit_id)?.unit_number ?? doc.unit_id}` : '🔒 ועד בלבד'}
                    </span>
                  </div>
                  {doc.description && <p className="text-slate-400 text-xs mt-1">{doc.description}</p>}
                  <p className="text-slate-600 text-xs mt-1">
                    {doc.file_name && `${doc.file_name} · `}
                    {doc.file_size ? `${(doc.file_size/1024).toFixed(0)}KB · ` : ''}
                    {doc.uploaded_by} · {doc.created_at?.slice(0,10)}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {doc.file_name && (
                    <button onClick={() => download(doc)}
                      className="bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 px-2 py-1 rounded text-xs transition-colors">
                      ⬇️ הורד
                    </button>
                  )}
                  {isPrivileged && (
                    <>
                      {doc.visibility !== 'unit' && (
                        <button onClick={() => toggleVisibility(doc)}
                          className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded text-xs transition-colors">
                          {doc.visibility === 'all' ? '🔒 הגבל' : '🌐 שתף'}
                        </button>
                      )}
                      <button onClick={() => deleteDoc(doc.id)}
                        className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-2 py-1 rounded text-xs transition-colors">🗑️</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Checklist Tab ── */}
      {tab === 'checklist' && isPrivileged && (
        <div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">מסמכים נדרשים לפרויקט בנייה</h3>
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-400">✅ {checklist.filter(i=>i.status==='exists').length} קיים</span>
                <span className="text-yellow-400">⚠️ {checklist.filter(i=>i.status==='partial').length} חלקי</span>
                <span className="text-red-400">❌ {missing} חסר</span>
              </div>
            </div>
            <div className="divide-y divide-slate-800">
              {checklist.map(item => (
                <div key={item.key} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors">
                  <span className="text-slate-300 text-sm">{item.label}</span>
                  <div className="flex gap-1.5">
                    {['exists','partial','missing'].map(s => (
                      <button key={s} onClick={() => updateChecklist(item.key, s)}
                        className={`border text-xs px-2 py-0.5 rounded transition-colors ${item.status === s ? STATUS_COLORS[s] : 'border-slate-700 text-slate-600 hover:text-slate-400'}`}>
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-slate-600 text-xs mt-3 text-center">לחץ על הסטטוס כדי לעדכן. סמן ✅ רק כשהמסמך נמצא בידיך.</p>
        </div>
      )}

      {/* ── Upload Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl">
            <h3 className="text-lg font-bold text-white mb-4">📎 העלאת מסמך</h3>
            {err && <div className="bg-red-900/30 border border-red-700 text-red-400 text-xs px-3 py-2 rounded-lg mb-3">{err}</div>}

            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">שם המסמך *</label>
              <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))}
                placeholder="לדוגמה: חוזה קבלן ראשי — חמודי"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">תיאור (אופציונלי)</label>
              <input value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))}
                placeholder="גרסה חתומה, כולל נספחים"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">קטגוריה</label>
              <select value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">נראות</label>
              <select value={form.visibility} onChange={e => setForm(p=>({...p,visibility:e.target.value}))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="committee">🔒 ועד ומנהל בלבד</option>
                <option value="all">🌐 גלוי לכל הדיירים</option>
                <option value="unit">🏠 גלוי לדירה ספציפית</option>
              </select>
            </div>
            {form.visibility === 'unit' && (
              <div className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">דירה *</label>
                <select value={form.unit_id} onChange={e => setForm(p=>({...p,unit_id:e.target.value}))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">בחר דירה...</option>
                  {units.map(u => <option key={u.id} value={u.id}>דירה {u.unit_number}{u.owner_name ? ` — ${u.owner_name}` : ''}</option>)}
                </select>
              </div>
            )}

            {/* File picker */}
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">קובץ (PDF / תמונה, עד 8MB)</label>
              <div onClick={() => fileRef.current.click()}
                className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-lg p-4 text-center cursor-pointer transition-colors">
                {form.file ? (
                  <p className="text-emerald-400 text-sm">✅ {form.file.name} ({(form.file.size/1024).toFixed(0)}KB)</p>
                ) : (
                  <p className="text-slate-500 text-sm">לחץ לבחירת קובץ</p>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} />
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setShowAdd(false); setErr(''); }} className="flex-1 border border-slate-600 text-slate-300 py-2 rounded-lg text-sm hover:bg-slate-800">ביטול</button>
              <button onClick={upload} disabled={uploading} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold">
                {uploading ? '⏳ מעלה...' : '📎 העלה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
