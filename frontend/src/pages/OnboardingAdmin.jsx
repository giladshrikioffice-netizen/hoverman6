import { useEffect, useState } from 'react';
import { api } from '../api';

const STATUS = {
  pending:   { text: 'ממתין למילוי', cls: 'bg-slate-600/30 text-slate-300 border-slate-500/40' },
  submitted: { text: 'מולא — ממתין לאישור', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  approved:  { text: 'אושר — בניין הוקם', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
};

export default function OnboardingAdmin() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [expand, setExpand] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.onboarding.list().then(setRows).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);

  const flash = m => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const create = async (type) => {
    setBusy(true); setErr('');
    try { const r = await api.onboarding.create(type); await load(); flash('✅ טופס נוצר — העתק את הקישור ושלח ללקוח'); navigator.clipboard?.writeText(r.link); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const copy = (link) => { navigator.clipboard?.writeText(link); flash('📋 הקישור הועתק'); };
  const send = async (id) => {
    const to = prompt('לאיזה אימייל לשלוח את הטופס?');
    if (!to) return;
    try { await api.onboarding.send(id, to); flash('📧 נשלח ל-' + to); load(); }
    catch (e) { setErr(e.message); }
  };
  const approve = async (id) => {
    if (!confirm('לאשר ולהקים בניין חדש מנתוני הטופס?')) return;
    setBusy(true); setErr('');
    try { await api.onboarding.approve(id); flash('🏢 הבניין הוקם בהצלחה! מופיע ב"ניהול מערכת".'); load(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const del = async (id) => {
    if (!confirm('למחוק טופס זה?')) return;
    try { await api.onboarding.del(id); setRows(p => p.filter(x => x.id !== id)); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div className="max-w-3xl" dir="rtl">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-white">📨 טפסי קליטה</h2>
        <div className="flex gap-2">
          <button onClick={() => create('maintenance')} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">🟢 + טופס תחזוקה</button>
          <button onClick={() => create('supervision')} disabled={busy} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">🔵 + טופס פיקוח</button>
        </div>
      </div>

      <p className="text-slate-400 text-sm mb-4">צור טופס, שלח את הקישור ללקוח (מייל או העתקה ל-WhatsApp). כשהלקוח ממלא — תוכל לאשר ולהקים בניין בלחיצה אחת.</p>
      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}
      {msg && <div className="bg-emerald-900/30 border border-emerald-700 text-emerald-400 px-3 py-2 rounded mb-3 text-sm">{msg}</div>}

      <div className="space-y-3">
        {rows.map(r => {
          const st = STATUS[r.status] || STATUS.pending;
          const green = r.form_type === 'maintenance';
          return (
            <div key={r.id} className={`bg-slate-900 border rounded-xl p-4 ${green ? 'border-emerald-700/40' : 'border-blue-700/40'}`}>
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-white">{green ? '🟢 טופס תחזוקה שוטפת' : '🔵 טופס פרויקט פיקוח'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">נוצר {r.created_at?.slice(0,10)}{r.sent_to ? ` · נשלח ל-${r.sent_to}` : ''}{r.data?.address ? ` · ${r.data.address}` : ''}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${st.cls}`}>{st.text}</span>
              </div>

              <div className="flex gap-2 flex-wrap mt-3">
                <button onClick={() => copy(r.link)} className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-2.5 py-1 rounded">📋 העתק קישור</button>
                <button onClick={() => send(r.id)} className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-2.5 py-1 rounded">📧 שלח במייל</button>
                {r.status === 'submitted' && <>
                  <button onClick={() => setExpand(expand === r.id ? null : r.id)} className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-2.5 py-1 rounded">👁️ {expand === r.id ? 'הסתר' : 'צפה בפרטים'}</button>
                  <button onClick={() => approve(r.id)} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2.5 py-1 rounded disabled:opacity-50">✅ אשר והקם בניין</button>
                </>}
                {r.status !== 'approved' && <button onClick={() => del(r.id)} className="text-red-400 text-xs px-2 py-1">🗑️</button>}
              </div>

              {expand === r.id && r.data && (
                <pre className="mt-3 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 overflow-auto whitespace-pre-wrap" dir="rtl">
                  {renderData(r.data)}
                </pre>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-slate-500 text-center py-8">אין טפסים עדיין — צור טופס חדש למעלה</p>}
      </div>
    </div>
  );
}

function renderData(d) {
  const lines = [];
  const push = (k, v) => { if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) lines.push(`${k}: ${Array.isArray(v) ? v.map(x => typeof x === 'object' ? Object.values(x).filter(Boolean).join(' / ') : x).join(' | ') : (typeof v === 'object' ? Object.entries(v).filter(([,x])=>x).map(([kk,x])=>`${kk}=${x}`).join(', ') : v)}`); };
  push('כתובת', d.address); push('דירות', d.num_units); push('קומות', d.num_floors);
  push('איש קשר', d.contact); push('גבייה', d.collection); push('מערכות', d.systems); push('מערכות נוספות', d.systems_other);
  push('קבלנים', d.contractors); push('דחוף', d.urgent_note);
  push('סוג פרויקט', d.project_type); push('תיאור', d.description); push('נציגות', d.reps);
  push('תקציב', d.budget); push('מסמכים', d.documents); push('הערות מסמכים', d.documents_notes);
  return lines.join('\n');
}
