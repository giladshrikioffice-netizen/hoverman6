import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const STATUS_COLOR = {
  'פתוח':   'bg-red-500/20 text-red-400 border-red-500/30',
  'בטיפול': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'טופל':   'bg-green-500/20 text-green-400 border-green-500/30',
};

const ADMIN_STATUSES = ['הנושא ייבדק', 'בטיפול', 'לא רלוונטי', 'טופל'];

export default function Complaints() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'superadmin';
  const isCommittee = ['committee','admin'].includes(user?.role);
  const canManage = isAdmin || isCommittee;
  const [rows, setRows]     = useState([]);
  const [form, setForm]     = useState({ subject: '', body: '', photo: null });
  const [showNew, setShowNew] = useState(false);
  const [err, setErr]       = useState('');
  const [expandPhoto, setExpandPhoto] = useState(null);
  const [respDraft, setRespDraft] = useState({});
  const fileRef = useRef();

  useEffect(() => { api.complaints.list().then(setRows).catch(e => setErr(e.message)); }, []);

  const patch = (id, r) => setRows(p => p.map(x => x.id === id ? r : x));

  const forward = async (id, val) => {
    try { patch(id, await api.complaints.forward(id, val)); } catch(e) { setErr(e.message); }
  };
  const setAdminStatus = async (id, admin_status) => {
    try { patch(id, await api.complaints.adminResponse(id, { admin_status, admin_response: rows.find(x=>x.id===id)?.admin_response || '' })); }
    catch(e) { setErr(e.message); }
  };
  const saveAdminResponse = async (id) => {
    const row = rows.find(x=>x.id===id);
    try { patch(id, await api.complaints.adminResponse(id, { admin_status: row?.admin_status || '', admin_response: respDraft[id] ?? row?.admin_response ?? '' })); setErr(''); }
    catch(e) { setErr(e.message); }
  };

  const handlePhoto = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setErr('התמונה גדולה מ-5MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setForm(p => ({ ...p, photo: ev.target.result }));
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!form.subject) { setErr('נושא חובה'); return; }
    try {
      const r = await api.complaints.create(form);
      setRows(p => [r, ...p]);
      setForm({ subject: '', body: '', photo: null });
      setShowNew(false); setErr('');
    } catch(e) { setErr(e.message); }
  };

  const updateStatus = async (id, status) => {
    const r = await api.complaints.update(id, { status }).catch(e => { setErr(e.message); return null; });
    if (r) setRows(p => p.map(x => x.id === id ? r : x));
  };

  return (
    <div className="max-w-3xl" dir="rtl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">📩 פניות דיירים</h2>
        <button onClick={() => { setShowNew(true); setErr(''); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">+ פנייה חדשה</button>
      </div>

      {/* Admin sees only forwarded complaints */}
      {isAdmin && (
        <div className="bg-purple-900/20 border border-purple-700/40 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
          <span className="text-purple-400 text-lg mt-0.5">📨</span>
          <div>
            <p className="text-purple-300 text-sm font-medium">פניות שהועברו אליך מטעם הוועד</p>
            <p className="text-purple-400/70 text-xs mt-0.5">כאן מוצגות רק פניות שהוועד בחן והחליט להעביר אליך. תוכל לסמן מענה ראשוני ולהוסיף תגובה סופית.</p>
          </div>
        </div>
      )}

      {/* Info banner for residents */}
      {!canManage && (
        <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
          <span className="text-blue-400 text-lg mt-0.5">ℹ️</span>
          <div>
            <p className="text-blue-300 text-sm font-medium">הפנייה מועברת לוועד הבית</p>
            <p className="text-blue-400/70 text-xs mt-0.5">הוועד יטפל בפנייה ויחזור אליך. פניות דחופות יועברו לגורם המטפל הרלוונטי.</p>
          </div>
        </div>
      )}

      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.id} className={`bg-slate-900 border rounded-xl p-4 ${r.forwarded ? 'border-purple-700/50' : 'border-slate-700'}`}>
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white flex items-center gap-2">
                  {r.subject}
                  {r.forwarded && <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded-full">📨 הועברה למפקח</span>}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">דירה {r.unit_number} | {new Date(r.created_at).toLocaleDateString('he-IL')}</p>
                {r.body && <p className="text-sm text-slate-400 mt-2">{r.body}</p>}
                {r.photo && (
                  <img src={r.photo} alt="תמונה מצורפת"
                    onClick={() => setExpandPhoto(r.photo)}
                    className="mt-2 max-h-32 rounded-lg cursor-pointer hover:opacity-80 border border-slate-700 transition-opacity" />
                )}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[r.status] || ''}`}>{r.status}</span>
                {canManage && (
                  <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                    className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white focus:outline-none">
                    {['פתוח','בטיפול','טופל'].map(s => <option key={s}>{s}</option>)}
                  </select>
                )}
                {/* Committee: forward to / unforward from מפקח */}
                {isCommittee && (
                  <button onClick={() => forward(r.id, !r.forwarded)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${r.forwarded ? 'bg-slate-700 text-slate-300' : 'bg-purple-700/40 hover:bg-purple-700/60 text-purple-300'}`}>
                    {r.forwarded ? '↩️ בטל העברה' : '📤 העבר למפקח'}
                  </button>
                )}
              </div>
            </div>

            {/* מפקח response area */}
            {isAdmin && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-400 mb-1.5">מענה ראשוני:</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ADMIN_STATUSES.map(s => (
                    <button key={s} onClick={() => setAdminStatus(r.id, s)}
                      className={`text-xs px-2 py-1 rounded-full border ${r.admin_status === s ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'}`}>{s}</button>
                  ))}
                </div>
                <textarea rows={2} placeholder="תגובה סופית לאחר בדיקה בשטח (אופציונלי)..."
                  value={respDraft[r.id] ?? r.admin_response ?? ''}
                  onChange={e => setRespDraft(p => ({ ...p, [r.id]: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => saveAdminResponse(r.id)} className="mt-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded-lg">שמור מענה</button>
              </div>
            )}
            {/* Committee sees the מפקח's response */}
            {isCommittee && (r.admin_status || r.admin_response) && (
              <div className="mt-3 pt-3 border-t border-slate-800 text-sm">
                <p className="text-purple-300 text-xs font-medium">מענה המפקח:</p>
                {r.admin_status && <p className="text-slate-300 text-xs mt-0.5">סטטוס: {r.admin_status}</p>}
                {r.admin_response && <p className="text-slate-400 text-xs mt-0.5">{r.admin_response}</p>}
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-slate-500 text-sm text-center py-8">אין פניות</p>}
      </div>

      {/* New complaint modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl">
            <h3 className="text-lg font-bold text-white mb-4">📩 פנייה חדשה</h3>
            {err && <div className="bg-red-900/30 border border-red-700 text-red-400 text-xs px-3 py-2 rounded-lg mb-3">{err}</div>}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">נושא *</label>
              <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="לדוגמה: רטיבות בחדר המדרגות"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">פרטים</label>
              <textarea rows={3} value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                placeholder="תאר את הבעיה בפירוט..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Photo upload */}
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">📷 צרף תמונה (אופציונלי, עד 5MB)</label>
              {form.photo ? (
                <div className="relative">
                  <img src={form.photo} alt="תצוגה מקדימה" className="max-h-40 rounded-lg border border-slate-700 w-full object-cover" />
                  <button onClick={() => setForm(p => ({ ...p, photo: null }))}
                    className="absolute top-1 left-1 bg-black/60 text-white text-xs px-2 py-1 rounded">הסר</button>
                </div>
              ) : (
                <div onClick={() => fileRef.current.click()}
                  className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-lg p-4 text-center cursor-pointer transition-colors">
                  <p className="text-slate-500 text-sm">📷 לחץ לבחירת תמונה</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setShowNew(false); setErr(''); }} className="flex-1 border border-slate-600 text-slate-300 py-2 rounded-lg text-sm hover:bg-slate-800">ביטול</button>
              <button onClick={submit} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold">שלח פנייה</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {expandPhoto && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setExpandPhoto(null)}>
          <img src={expandPhoto} alt="תמונה" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
