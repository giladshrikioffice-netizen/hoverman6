import { useEffect, useState } from 'react';
import { api } from '../api';

const NAVY = '#1F3864';
const BLUE = '#2D5BFF';
const MAINT_SYSTEMS = ['מעלית','גנרטור חירום','משאבות מים/לחץ','מערכת כיבוי אש ומטפים','לוחות חשמל משותפים','אינטרקום/שער חשמלי','מאגר/בריכת מים','גינון','ניקיון'];
const PROJECT_TYPES = ['תוספת מרפסות','תוספת ממ"דים','תמ"א 38','חיזוק מבני','שיפוץ חזיתות','אחר'];
const DOC_OPTIONS = ['היתר בנייה','חוזה קבלן','תוכניות','ביטוח','ערבויות'];
const COLLECT_METHODS = ['כולם שווה','לפי שטח','רק חלק מהדיירים','טרם הוחלט'];

const card = 'bg-white/5 border border-white/10 rounded-2xl p-4 mb-4';
const inp = 'w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2.5 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-white/40';
const lbl = 'block text-xs text-white/70 mb-1';

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="mb-3">
      <label className={lbl}>{label}</label>
      <input type={type} value={value || ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} className={inp} />
    </div>
  );
}

// Dynamic list of {a,b,c} rows
function DynamicList({ items, setItems, cols }) {
  const add = () => setItems([...items, Object.fromEntries(cols.map(c => [c.key, '']))]);
  const upd = (i, k, v) => setItems(items.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const rem = i => setItems(items.filter((_, idx) => idx !== i));
  return (
    <div>
      {items.map((row, i) => (
        <div key={i} className="flex gap-2 mb-2 items-end">
          {cols.map(c => (
            <div key={c.key} className="flex-1">
              <label className="block text-[10px] text-white/50 mb-0.5">{c.label}</label>
              <input value={row[c.key] || ''} onChange={e => upd(i, c.key, e.target.value)} className={inp} />
            </div>
          ))}
          <button type="button" onClick={() => rem(i)} className="text-red-300 text-lg px-1 pb-1">✕</button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-sm text-blue-300 hover:text-blue-200">+ הוסף שורה</button>
    </div>
  );
}

function CheckGroup({ options, selected, setSelected }) {
  const toggle = o => setSelected(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o]);
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(o => (
        <label key={o} className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer border ${selected.includes(o) ? 'bg-blue-500/30 border-blue-400' : 'bg-white/5 border-white/10'}`}>
          <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} className="accent-blue-500" />
          <span className="text-sm text-white">{o}</span>
        </label>
      ))}
    </div>
  );
}

export default function OnboardingPublic({ token }) {
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [d, setD] = useState({
    address: '', num_units: '', num_floors: '',
    contact: { name: '', phone: '', email: '' },
    collection: { monthly_per_unit: '', has_debtors: '', fund_balance: '' },
    systems: [], systems_other: '', contractors: [], urgent_note: '',
    project_type: '', description: '',
    reps: [], budget: { total: '', paid: '', target_date: '', collection_method: '' },
    documents: [], documents_notes: '',
  });
  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const setNested = (group, k, v) => setD(p => ({ ...p, [group]: { ...p[group], [k]: v } }));

  useEffect(() => {
    api.onboarding.publicGet(token)
      .then(setMeta)
      .catch(e => setErr(e.message));
  }, [token]);

  const submit = async () => {
    if (!d.address) { setErr('נא למלא לפחות כתובת'); return; }
    setSending(true); setErr('');
    try { await api.onboarding.publicSubmit(token, d); setDone(true); }
    catch (e) { setErr(e.message); }
    setSending(false);
  };

  if (err && !meta) return <Shell><p className="text-red-300 text-center">{err}</p></Shell>;
  if (!meta) return <Shell><p className="text-white/60 text-center">טוען...</p></Shell>;
  if (meta.status === 'approved') return <Shell><p className="text-white text-center">טופס זה כבר עובד והבניין הוקם. תודה!</p></Shell>;
  if (done) return (
    <Shell>
      <div className="text-center py-8">
        <p className="text-5xl mb-4">✅</p>
        <h2 className="text-xl font-bold text-white mb-2">הטופס נשלח בהצלחה!</h2>
        <p className="text-white/70 text-sm">תודה רבה. גלעד יסקור את הפרטים ויקים עבורך את תיק הבניין במערכת.</p>
      </div>
    </Shell>
  );

  const green = meta.form_type === 'maintenance';

  return (
    <Shell>
      {/* Colored header banner */}
      <div className="rounded-2xl p-5 mb-5 text-center" style={{ background: green ? '#065f46' : NAVY }}>
        <p className="text-white font-bold text-lg">{green ? '🟢 טופס תחזוקה שוטפת' : '🔵 טופס פרויקט פיקוח הנדסי'}</p>
        <p className="text-white/80 text-sm mt-2 leading-relaxed">
          {green
            ? 'שלום! מילוי הטופס הקצר הזה יאפשר לנו להקים עבורכם תיק בניין דיגיטלי לניהול התחזוקה השוטפת — מעקב מערכות, ספקים, גבייה ופניות דיירים — הכול במקום אחד.'
            : 'שלום! מילוי הטופס הקצר הזה יאפשר לנו להקים עבורכם תיק פרויקט דיגיטלי לפיקוח ההנדסי — תקציב, קבלנים, יומני ביקור, דוחות חודשיים ומסמכים — בשקיפות מלאה.'}
        </p>
      </div>

      {err && <div className="bg-red-500/20 border border-red-400/40 text-red-200 px-3 py-2 rounded-lg mb-3 text-sm">{err}</div>}

      {/* Building details (both) */}
      <div className={card}>
        <h3 className="text-white font-bold mb-3">🏢 פרטי הבניין</h3>
        <Field label="כתובת הבניין" value={d.address} onChange={v => set('address', v)} placeholder="רחוב, מספר, עיר" />
        <div className="grid grid-cols-2 gap-2">
          <Field label="מספר דירות" value={d.num_units} onChange={v => set('num_units', v)} type="number" />
          <Field label="מספר קומות" value={d.num_floors} onChange={v => set('num_floors', v)} type="number" />
        </div>
      </div>

      {green ? (
        <>
          <div className={card}>
            <h3 className="text-white font-bold mb-3">👤 איש קשר בוועד</h3>
            <Field label="שם מלא" value={d.contact.name} onChange={v => setNested('contact', 'name', v)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="טלפון" value={d.contact.phone} onChange={v => setNested('contact', 'phone', v)} />
              <Field label="דוא״ל" value={d.contact.email} onChange={v => setNested('contact', 'email', v)} type="email" />
            </div>
          </div>

          <div className={card}>
            <h3 className="text-white font-bold mb-3">💰 גבייה</h3>
            <Field label="כמה כל דייר מפקיד לוועד בחודש (₪)" value={d.collection.monthly_per_unit} onChange={v => setNested('collection', 'monthly_per_unit', v)} type="number" />
            <div className="mb-3">
              <label className={lbl}>האם יש דיירים בחוב?</label>
              <select value={d.collection.has_debtors} onChange={e => setNested('collection', 'has_debtors', e.target.value)} className={inp}>
                <option value="">בחר</option><option>כן</option><option>לא</option><option>לא בטוח</option>
              </select>
            </div>
            <Field label="יתרת קופת הוועד הנוכחית (₪)" value={d.collection.fund_balance} onChange={v => setNested('collection', 'fund_balance', v)} type="number" />
          </div>

          <div className={card}>
            <h3 className="text-white font-bold mb-3">🔧 מערכות הבניין לתחזוקה</h3>
            <CheckGroup options={MAINT_SYSTEMS} selected={d.systems} setSelected={v => set('systems', v)} />
            <div className="mt-3"><Field label="מערכות נוספות (חופשי)" value={d.systems_other} onChange={v => set('systems_other', v)} /></div>
          </div>

          <div className={card}>
            <h3 className="text-white font-bold mb-3">👷 קבלני תחזוקה קבועים</h3>
            <DynamicList items={d.contractors} setItems={v => set('contractors', v)}
              cols={[{ key: 'trade', label: 'תחום' }, { key: 'name', label: 'שם' }, { key: 'phone', label: 'טלפון' }]} />
          </div>

          <div className={card}>
            <h3 className="text-white font-bold mb-3">📝 מה הכי דורש טיפול כרגע?</h3>
            <textarea rows={3} value={d.urgent_note} onChange={e => set('urgent_note', e.target.value)} className={inp} />
          </div>
        </>
      ) : (
        <>
          <div className={card}>
            <h3 className="text-white font-bold mb-3">📐 פרטי הפרויקט</h3>
            <div className="mb-3">
              <label className={lbl}>סוג הפרויקט</label>
              <select value={d.project_type} onChange={e => set('project_type', e.target.value)} className={inp}>
                <option value="">בחר</option>{PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={lbl}>תיאור קצר</label><textarea rows={2} value={d.description} onChange={e => set('description', e.target.value)} className={inp} /></div>
          </div>

          <div className={card}>
            <h3 className="text-white font-bold mb-3">👥 נציגות הפרויקט</h3>
            <DynamicList items={d.reps} setItems={v => set('reps', v)}
              cols={[{ key: 'name', label: 'שם' }, { key: 'role', label: 'תפקיד' }, { key: 'phone', label: 'טלפון' }]} />
            <p className="text-[11px] text-white/40 mt-1">ניתן להזין דוא״ל לנציג הראשון כדי שיקבל גישה למערכת לאחר ההקמה.</p>
            <Field label="דוא״ל הנציג הראשון (אופציונלי)" value={(d.reps[0] && d.reps[0].email) || ''} onChange={v => { const reps = [...d.reps]; if (!reps[0]) reps[0] = { name: '', role: '', phone: '' }; reps[0] = { ...reps[0], email: v }; set('reps', reps); }} type="email" />
          </div>

          <div className={card}>
            <h3 className="text-white font-bold mb-3">💰 תקציב</h3>
            <div className="grid grid-cols-2 gap-2">
              <Field label="תקציב כולל מאושר (₪)" value={d.budget.total} onChange={v => setNested('budget', 'total', v)} type="number" />
              <Field label="שולם עד כה (₪)" value={d.budget.paid} onChange={v => setNested('budget', 'paid', v)} type="number" />
            </div>
            <Field label="יעד סיום" value={d.budget.target_date} onChange={v => setNested('budget', 'target_date', v)} type="date" />
            <div className="mb-1">
              <label className={lbl}>אופן הגבייה לפרויקט</label>
              <select value={d.budget.collection_method} onChange={e => setNested('budget', 'collection_method', e.target.value)} className={inp}>
                <option value="">בחר</option>{COLLECT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className={card}>
            <h3 className="text-white font-bold mb-3">👷 קבלנים</h3>
            <DynamicList items={d.contractors} setItems={v => set('contractors', v)}
              cols={[{ key: 'trade', label: 'תחום' }, { key: 'name', label: 'שם' }, { key: 'phone', label: 'טלפון' }]} />
          </div>

          <div className={card}>
            <h3 className="text-white font-bold mb-3">📄 מסמכים קיימים</h3>
            <CheckGroup options={DOC_OPTIONS} selected={d.documents} setSelected={v => set('documents', v)} />
            <div className="mt-3"><Field label="הערות" value={d.documents_notes} onChange={v => set('documents_notes', v)} /></div>
          </div>
        </>
      )}

      <button onClick={submit} disabled={sending}
        className="w-full text-white font-bold py-3.5 rounded-xl text-base disabled:opacity-50 shadow-lg"
        style={{ background: BLUE }}>
        {sending ? 'שולח...' : 'שליחת הטופס'}
      </button>
      <p className="text-white/40 text-xs text-center mt-3">GS.pro · גלעד שריקי פרויקטים</p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div dir="rtl" className="min-h-screen flex justify-center" style={{ background: '#0b1020' }}>
      <div className="w-full max-w-lg p-4">
        <div className="text-center my-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-white font-black text-xl" style={{ background: BLUE }}>GS</div>
          <h1 className="text-white font-bold text-lg mt-2">GS.pro</h1>
          <p className="text-white/50 text-xs">ניהול בניינים ופרויקטים</p>
        </div>
        {children}
      </div>
    </div>
  );
}
