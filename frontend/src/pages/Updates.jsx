import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { parseVisitSummary, splitArchive } from '../lib/visitParser';

const fmt = d => d ? new Date(d).toLocaleDateString('he-IL', { day:'numeric', month:'long', year:'numeric' }) : '';
const kindCls = k => k === 'archive' ? 'bg-slate-700 text-slate-300' : 'bg-blue-900/60 text-blue-300';
const kindLabel = k => k === 'archive' ? '📁 ארכיון' : '✨ פורמט חדש';

// ─── PasteModal — הדבק + נתח + תצוגה מקדימה ─────────────────────────────
function PasteModal({ onClose, onSaved }) {
  const [step, setStep]     = useState('paste');
  const [raw, setRaw]       = useState('');
  const [parsed, setParsed] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const analyze = () => {
    if (!raw.trim()) { setErr('הדבק טקסט לפני הניתוח'); return; }
    setParsed(parseVisitSummary(raw));
    setStep('preview');
    setErr('');
  };

  const set = (k,v) => setParsed(p => ({ ...p, [k]: v }));
  const setTask = (i,k,v) => setParsed(p => {
    const tasks = [...(p.tasks||[])]; tasks[i] = { ...tasks[i], [k]: v }; return { ...p, tasks };
  });
  const addTask = () => setParsed(p => ({ ...p, tasks: [...(p.tasks||[]), { contractor:'', task:'' }] }));
  const delTask = i => setParsed(p => ({ ...p, tasks: p.tasks.filter((_,j)=>j!==i) }));

  const save = async () => {
    setSaving(true); setErr('');
    try {
      await api.updates.create({
        visit_date:    parsed.visit_date,
        summary:       parsed.summary,
        blockers:      parsed.blockers,
        next_steps:    parsed.next_steps,
        kind:          'new',
        tasks:         JSON.stringify(parsed.tasks||[]),
        qc_notes:      parsed.qc_notes,
        general_notes: parsed.general_notes,
        raw_text:      raw,
      });
      onSaved();
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };

  const Field = ({ label, val, onChange, rows=2, highlight }) => (
    <div className="mb-3">
      <label className="block text-xs mb-1 text-slate-400">{label}</label>
      <textarea rows={rows} value={val||''} onChange={e=>onChange(e.target.value)}
        className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${highlight?'border-orange-600/60':'border-slate-600'}`} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl my-8">
        {step === 'paste' && <>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-bold text-white">📋 הדבק סיכום ביקור מ-Gemini</h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
          </div>
          <p className="text-slate-400 text-sm mb-3">העתק את הטקסט כולו מ-Gemini והדבק כאן. המערכת תנתח אוטומטית לפי תוויות.</p>
          <textarea rows={14} value={raw} onChange={e=>setRaw(e.target.value)} dir="rtl"
            placeholder={"תאריך: 20/06/2026\nשעה: 09:00\nפרויקט: תוספת מרפסות\n\nביצוע נוכחי:\n...\n\nמשימות לפי קבלן:\nשלד בע\"מ: להשלים יציקות קומה 3\n\nדגשים דחופים:\n...\n\nהערות תקן/בטיחות:\n...\n\nמשימה להמשך:\n..."}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">ביטול</button>
            <button onClick={analyze} className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">🔍 נתח אוטומטית</button>
          </div>
        </>}

        {step === 'preview' && parsed && <>
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-lg font-bold text-white">👁️ תצוגה מקדימה — ערוך לפני אישור</h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
          </div>

          {parsed.needsReview && (
            <div className="bg-yellow-900/30 border border-yellow-600/50 text-yellow-400 text-sm px-3 py-2 rounded-lg mb-3">
              ⚠️ לא זוהו תוויות — הטקסט נשמר כ"הערות כלליות". בדוק ידנית.
            </div>
          )}
          {parsed.project && (
            <div className="bg-slate-800 border border-slate-600 text-slate-300 text-sm px-3 py-2 rounded-lg mb-3">
              📌 פרויקט שזוהה: <span className="font-semibold text-white">{parsed.project}</span>
            </div>
          )}

          <div className="mb-3">
            <label className="block text-xs text-slate-400 mb-1">תאריך ביקור</label>
            <input type="date" value={parsed.visit_date||''} onChange={e=>set('visit_date',e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <Field label="סטטוס ביצוע נוכחי" val={parsed.summary} onChange={v=>set('summary',v)} rows={3} />
          <Field label="⚠️ ליקויים / דגשים דחופים" val={parsed.blockers} onChange={v=>set('blockers',v)} highlight={!!parsed.blockers} />
          <Field label="🔬 הערות תקן / בטיחות" val={parsed.qc_notes} onChange={v=>set('qc_notes',v)} />
          <Field label="➡️ צעדים הבאים" val={parsed.next_steps} onChange={v=>set('next_steps',v)} />
          {parsed.general_notes && <Field label="📝 הערות כלליות (טקסט לא מזוהה)" val={parsed.general_notes} onChange={v=>set('general_notes',v)} rows={3} />}

          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-slate-400">משימות לפי קבלן</label>
              <button onClick={addTask} className="text-xs text-blue-400 hover:text-blue-300">+ הוסף שורה</button>
            </div>
            {(parsed.tasks||[]).length === 0 && <p className="text-slate-600 text-xs">אין משימות שזוהו</p>}
            {(parsed.tasks||[]).map((t,i) => (
              <div key={i} className="flex gap-2 mb-1.5 items-center">
                <input value={t.contractor||''} onChange={e=>setTask(i,'contractor',e.target.value)} placeholder="שם קבלן"
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm w-32 focus:outline-none" />
                <input value={t.task||''} onChange={e=>setTask(i,'task',e.target.value)} placeholder="משימה"
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm flex-1 focus:outline-none" />
                <button onClick={()=>delTask(i)} className="text-red-500 hover:text-red-400 text-xs px-1">✕</button>
              </div>
            ))}
          </div>

          {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
          <div className="flex gap-2 justify-between mt-4">
            <button onClick={()=>setStep('paste')} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">← חזור לטקסט</button>
            <button onClick={save} disabled={saving} className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold disabled:opacity-50">
              {saving ? 'שומר...' : '✅ אשר ושמור'}
            </button>
          </div>
        </>}
      </div>
    </div>
  );
}

// ─── ArchiveModal — חלק 2: העלאת מסמך ──────────────────────────────────────
function ArchiveModal({ onClose, onSaved }) {
  const fileRef = useRef();
  const [text, setText]       = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  const readFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => { setText(ev.target.result); setPreview(null); };
    reader.readAsText(f, 'utf-8');
  };

  const analyze = () => {
    if (!text.trim()) { setErr('הדבק טקסט או בחר קובץ'); return; }
    const records = splitArchive(text).sort((a,b)=>(a.visit_date||'').localeCompare(b.visit_date||''));
    setPreview(records); setErr('');
  };

  const save = async () => {
    if (!preview?.length) return;
    setSaving(true); setErr('');
    try { const res = await api.updates.archiveBulk(preview); onSaved(res.inserted); }
    catch(e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl my-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">📂 העלאת ארכיון סיכומי ביקור</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">✕</button>
        </div>
        <p className="text-slate-400 text-sm mb-3">העלה קובץ .txt אחד עם כל הסיכומים ברצף — המערכת תחלק לפי כותרת "סיכום" + תאריך.</p>

        <button onClick={()=>fileRef.current.click()} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg mb-2">📄 בחר קובץ .txt</button>
        <input ref={fileRef} type="file" accept=".txt,.text" className="hidden" onChange={readFile} />
        <textarea rows={6} value={text} onChange={e=>{setText(e.target.value);setPreview(null);}} dir="rtl"
          placeholder={"סיכום סיור פיקוח — 15 במרץ 2026\nתאריך: 15/03/2026\n...\n\nסיכום סיור פיקוח — 20 אפריל 2026\n..."}
          className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm mb-3 focus:outline-none" />

        {!preview && (
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">ביטול</button>
            <button onClick={analyze} className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">🔍 חלק לביקורים</button>
          </div>
        )}

        {preview && <>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 mb-4 max-h-64 overflow-y-auto">
            <p className="text-slate-400 text-xs mb-2">זוהו <span className="text-white font-semibold">{preview.length}</span> ביקורים (סדר כרונולוגי):</p>
            {preview.map((r,i)=>(
              <div key={i} className="flex items-center gap-2 py-1 border-b border-slate-700/50 last:border-0">
                <span className="text-slate-500 text-xs w-5">{i+1}.</span>
                <span className="text-white text-sm flex-1 truncate">{r.title}</span>
                <span className="text-slate-400 text-xs">{fmt(r.visit_date)||'—'}</span>
              </div>
            ))}
          </div>
          {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
          <div className="flex gap-2 justify-between">
            <button onClick={()=>setPreview(null)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">← חזור</button>
            <button onClick={save} disabled={saving} className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold disabled:opacity-50">
              {saving ? 'שומר...' : `✅ שמור ${preview.length} ביקורים`}
            </button>
          </div>
        </>}
        {err && !preview && <p className="text-red-400 text-sm mt-2">{err}</p>}
      </div>
    </div>
  );
}

// ─── UpdateCard ──────────────────────────────────────────────────────────────
function UpdateCard({ r, canEdit, onEdit }) {
  const [open, setOpen] = useState(false);
  const tasks = (() => { try { return JSON.parse(r.tasks||'[]'); } catch { return []; } })();
  const isArchive = r.kind === 'archive';

  return (
    <div className={`bg-slate-900 border rounded-xl p-4 ${isArchive ? 'border-slate-700' : 'border-blue-900/50'}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white">{r.title || ('ביקור ' + (r.visit_date||''))}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${kindCls(r.kind)}`}>{kindLabel(r.kind)}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{fmt(r.visit_date)} · {r.author}</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={()=>setOpen(o=>!o)} className="text-slate-400 hover:text-white text-xs">{open?'▲':'▼ קרא'}</button>
          {canEdit && !isArchive && <button onClick={()=>onEdit(r)} className="text-blue-400 text-xs">✏️</button>}
        </div>
      </div>
      {!open && r.summary && <p className="text-slate-400 text-sm truncate">{r.summary}</p>}
      {!open && isArchive && r.raw_text && <p className="text-slate-500 text-xs truncate">{r.raw_text.slice(0,120)}…</p>}
      {open && (isArchive
        ? <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed mt-2">{r.raw_text}</pre>
        : <div className="mt-2 space-y-2">
            {r.summary    && <p className="text-slate-300 text-sm">{r.summary}</p>}
            {tasks.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-1">משימות לפי קבלן:</p>
                {tasks.map((t,i)=>(
                  <div key={i} className="flex gap-2 text-sm">
                    {t.contractor && <span className="text-blue-400 font-medium min-w-[80px]">{t.contractor}:</span>}
                    <span className="text-slate-300">{t.task}</span>
                  </div>
                ))}
              </div>
            )}
            {r.blockers   && <div className="bg-orange-900/20 border border-orange-700/40 rounded-lg px-3 py-1.5 text-sm text-orange-300">⚠️ {r.blockers}</div>}
            {r.qc_notes   && <div className="bg-purple-900/20 border border-purple-700/40 rounded-lg px-3 py-1.5 text-sm text-purple-300">🔬 {r.qc_notes}</div>}
            {r.next_steps && <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg px-3 py-1.5 text-sm text-blue-300">➡️ {r.next_steps}</div>}
            {r.general_notes && <div className="bg-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-400">📝 {r.general_notes}</div>}
          </div>
      )}
    </div>
  );
}

// ─── EditModal ───────────────────────────────────────────────────────────────
function EditModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    visit_date: row.visit_date||'', summary: row.summary||'', blockers: row.blockers||'',
    next_steps: row.next_steps||'', qc_notes: row.qc_notes||'', general_notes: row.general_notes||'',
  });
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const [err, setErr] = useState('');
  const save = async () => {
    try { await api.updates.update(row.id, form); onSaved(); }
    catch(e) { setErr(e.message); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-4">עריכת ביקור</h3>
        <div className="mb-3">
          <label className="text-xs text-slate-400 block mb-1">תאריך</label>
          <input type="date" value={form.visit_date} onChange={e=>set('visit_date',e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none" />
        </div>
        {[['summary','סטטוס ביצוע'],['blockers','ליקויים דחופים'],['qc_notes','הערות תקן/בטיחות'],['next_steps','צעדים הבאים'],['general_notes','הערות כלליות']].map(([k,l])=>(
          <div key={k} className="mb-3">
            <label className="text-xs text-slate-400 block mb-1">{l}</label>
            <textarea rows={2} value={form[k]} onChange={e=>set(k,e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none" />
          </div>
        ))}
        {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">ביטול</button>
          <button onClick={save} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">שמור</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Updates() {
  const { user } = useAuth();
  const canEdit = ['superadmin','admin','committee'].includes(user?.role);
  const [rows, setRows]     = useState([]);
  const [modal, setModal]   = useState(null);
  const [editing, setEditing] = useState(null);
  const [tab, setTab]       = useState('new');
  const [flash, setFlash]   = useState('');
  const [err, setErr]       = useState('');

  const load = () => api.updates.list().then(setRows).catch(e=>setErr(e.message));
  useEffect(() => { load(); }, []);

  const newRows     = rows.filter(r => r.kind !== 'archive');
  const archiveRows = rows.filter(r => r.kind === 'archive');
  const showFlash   = msg => { setFlash(msg); setTimeout(()=>setFlash(''), 4000); };

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <h2 className="text-xl font-bold text-white">📋 יומן פיקוח</h2>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={()=>setModal('archive')} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm">📂 ארכיון ישן</button>
            <button onClick={()=>setModal('paste')} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">📋 + הדבק סיכום ביקור</button>
          </div>
        )}
      </div>

      {flash && <div className="bg-green-900/30 border border-green-700 text-green-400 px-3 py-2 rounded-lg mb-3 text-sm">{flash}</div>}
      {err   && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded-lg mb-3 text-sm">{err}</div>}

      <div className="flex gap-2 mb-4 border-b border-slate-700 pb-2">
        <button onClick={()=>setTab('new')}
          className={`text-sm px-3 py-1 ${tab==='new'?'text-blue-400 border-b-2 border-blue-400':'text-slate-500 hover:text-slate-300'}`}>
          ✨ ביקורים חדשים ({newRows.length})
        </button>
        <button onClick={()=>setTab('archive')}
          className={`text-sm px-3 py-1 ${tab==='archive'?'text-slate-300 border-b-2 border-slate-400':'text-slate-500 hover:text-slate-300'}`}>
          📁 ארכיון ({archiveRows.length})
        </button>
      </div>

      <div className="space-y-4">
        {tab === 'new' && (newRows.length
          ? newRows.map(r => <UpdateCard key={r.id} r={r} canEdit={canEdit} onEdit={setEditing} />)
          : <div className="text-center py-12 text-slate-500">
              <p className="text-4xl mb-3">📋</p><p>אין ביקורים עדיין.</p>
              {canEdit && <p className="text-sm mt-1">לחץ <span className="text-blue-400">+ הדבק סיכום ביקור</span> להוספה.</p>}
            </div>
        )}
        {tab === 'archive' && (archiveRows.length
          ? archiveRows.map(r => <UpdateCard key={r.id} r={r} canEdit={canEdit} onEdit={setEditing} />)
          : <div className="text-center py-12 text-slate-500">
              <p className="text-4xl mb-3">📂</p><p>אין סיכומי ארכיון.</p>
              {canEdit && <p className="text-sm mt-1">לחץ <span className="text-slate-300">📂 ארכיון ישן</span> להעלאה.</p>}
            </div>
        )}
      </div>

      {modal==='paste'   && <PasteModal   onClose={()=>setModal(null)} onSaved={()=>{ setModal(null); load(); showFlash('✅ הביקור נשמר!'); }} />}
      {modal==='archive' && <ArchiveModal onClose={()=>setModal(null)} onSaved={n=>{ setModal(null); load(); setTab('archive'); showFlash(`📂 ${n} ביקורים נשמרו לארכיון!`); }} />}
      {editing           && <EditModal    row={editing} onClose={()=>setEditing(null)} onSaved={()=>{ setEditing(null); load(); showFlash('✅ עודכן.'); }} />}
    </div>
  );
}
