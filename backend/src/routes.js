const express = require('express');
const bcrypt = require('bcryptjs');
const { q, addDays } = require('./db');
const { authenticate, requireAdmin, requireAdminOrCommittee } = require('./auth');
const { uploadDataUrl } = require('./cloud');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();

// Translate common Resend errors to clear Hebrew.
function mailError(msg) {
  if (!msg) return 'שגיאה בשליחת המייל';
  if (/testing emails|verify a domain|own email/i.test(msg))
    return 'כדי לשלוח מייל לכתובת שאינה שלך צריך לאמת תחילה את הדומיין ב-Resend. בינתיים: שלח לכתובת שלך, או העתק את הקישור ושלח ב-WhatsApp.';
  return msg;
}

// Wrap async handlers so rejected promises become proper 500s (Express 4).
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(e => {
  console.error('route error:', e);
  if (!res.headersSent) res.status(500).json({ error: 'שגיאת שרת' });
});

// ── Buildings (superadmin) ─────────────────────────────────
router.get('/buildings', authenticate, ah(async (req, res) => {
  if (req.user.role === 'superadmin') return res.json(await q('SELECT * FROM buildings ORDER BY id').all());
  const b = await q('SELECT * FROM buildings WHERE id=?').get(req.user.building_id);
  res.json(b ? [b] : []);
}));

router.post('/buildings', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { name, address, num_units, num_floors, budget, target_date, type } = req.body;
  const r = await q('INSERT INTO buildings (name,address,num_units,num_floors,budget,target_date,type) VALUES (?,?,?,?,?,?,?)').run(name, address, num_units || 0, num_floors || 0, budget || 0, target_date, type || 'supervision');
  const bid = r.lastInsertRowid;
  const n = parseInt(num_units) || 0;
  for (let i = 1; i <= n; i++) {
    await q('INSERT INTO units (building_id,unit_number,floor) VALUES (?,?,?)').run(bid, i, Math.ceil(i / 4));
  }
  res.json(await q('SELECT * FROM buildings WHERE id=?').get(bid));
}));

router.put('/buildings/:id', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { name, address, num_units, num_floors, budget, target_date, type } = req.body;
  await q('UPDATE buildings SET name=?,address=?,num_units=?,num_floors=?,budget=?,target_date=?,type=? WHERE id=?').run(name, address, num_units, num_floors, budget, target_date, type||'supervision', req.params.id);
  res.json(await q('SELECT * FROM buildings WHERE id=?').get(req.params.id));
}));

router.delete('/buildings/:id', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  await q('DELETE FROM buildings WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// Helper: get building_id from request (superadmin can pass ?building_id=X)
function getBid(req) {
  if (req.user.role === 'superadmin') return parseInt(req.query.building_id || req.body.building_id || 0);
  return req.user.building_id;
}

// ── Dashboard ──────────────────────────────────────────────
router.get('/dashboard', authenticate, ah(async (req, res) => {
  const bid = getBid(req);
  if (!bid) return res.status(400).json({ error: 'חסר building_id' });
  const building = await q('SELECT * FROM buildings WHERE id=?').get(bid);
  const budgetRow = await q('SELECT SUM(planned_amount) as planned, SUM(paid_amount) as paid FROM budget_items WHERE building_id=?').get(bid);
  const paymentsRow = await q('SELECT SUM(amount_due) as due, SUM(amount_paid) as paid FROM payments WHERE building_id=?').get(bid);
  const contractorsCount = await q("SELECT CAST(COUNT(*) AS INTEGER) as c FROM contractors WHERE building_id=? AND status='פעיל'").get(bid);
  const openComplaints = await q("SELECT CAST(COUNT(*) AS INTEGER) as c FROM complaints WHERE building_id=? AND status='פתוח'").get(bid);
  const lastUpdate = await q('SELECT * FROM updates WHERE building_id=? ORDER BY visit_date DESC LIMIT 1').get(bid);
  const today = new Date().toISOString().slice(0, 10);
  const alertCount = await q("SELECT CAST(COUNT(*) AS INTEGER) as c FROM maintenance_items WHERE building_id=? AND next_check <= ?").get(bid, addDays(today, 14));

  res.json({
    building,
    budget: { planned: budgetRow.planned || 0, paid: budgetRow.paid || 0, total: building?.budget || 0 },
    payments: { due: paymentsRow.due || 0, paid: paymentsRow.paid || 0 },
    activeContractors: contractorsCount.c,
    openComplaints: openComplaints.c,
    maintenanceAlerts: alertCount.c,
    lastUpdate,
  });
}));

// ── Contractors ────────────────────────────────────────────
router.get('/contractors', authenticate, ah(async (req, res) => {
  const bid = getBid(req);
  res.json(await q('SELECT * FROM contractors WHERE building_id=? ORDER BY id').all(bid));
}));
router.post('/contractors', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const { name, trade, phone, contract_amount, status } = req.body;
  const r = await q('INSERT INTO contractors (building_id,name,trade,phone,contract_amount,status) VALUES (?,?,?,?,?,?)').run(bid, name, trade, phone, contract_amount || 0, status || 'פעיל');
  res.json(await q('SELECT * FROM contractors WHERE id=?').get(r.lastInsertRowid));
}));
router.put('/contractors/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const { name, trade, phone, contract_amount, status } = req.body;
  await q('UPDATE contractors SET name=?,trade=?,phone=?,contract_amount=?,status=? WHERE id=?').run(name, trade, phone, contract_amount, status, req.params.id);
  res.json(await q('SELECT * FROM contractors WHERE id=?').get(req.params.id));
}));
router.delete('/contractors/:id', authenticate, requireAdmin, ah(async (req, res) => {
  await q('DELETE FROM contractors WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Budget ─────────────────────────────────────────────────
router.get('/budget', authenticate, ah(async (req, res) => {
  const bid = getBid(req);
  const building = await q('SELECT budget FROM buildings WHERE id=?').get(bid);
  const items = await q('SELECT *, (planned_amount-paid_amount) as balance FROM budget_items WHERE building_id=? ORDER BY id').all(bid);
  const totals = await q('SELECT SUM(planned_amount) as planned, SUM(paid_amount) as paid FROM budget_items WHERE building_id=?').get(bid);
  res.json({ items, totals: { ...totals, balance: (totals.planned||0)-(totals.paid||0), project_total: building?.budget||0 } });
}));
router.post('/budget', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const { category, planned_amount, paid_amount, track } = req.body;
  const r = await q('INSERT INTO budget_items (building_id,category,planned_amount,paid_amount,track) VALUES (?,?,?,?,?)').run(bid, category, planned_amount||0, paid_amount||0, track||'project');
  res.json(await q('SELECT * FROM budget_items WHERE id=?').get(r.lastInsertRowid));
}));
router.put('/budget/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const { category, planned_amount, paid_amount, track } = req.body;
  await q('UPDATE budget_items SET category=?,planned_amount=?,paid_amount=?,track=? WHERE id=?').run(category, planned_amount, paid_amount, track||'project', req.params.id);
  res.json(await q('SELECT * FROM budget_items WHERE id=?').get(req.params.id));
}));
router.delete('/budget/:id', authenticate, requireAdmin, ah(async (req, res) => {
  await q('DELETE FROM budget_items WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Payments ───────────────────────────────────────────────
const paymentSelect = `SELECT p.*, u.unit_number, u.owner_name,
  (p.amount_due-p.amount_paid) as balance,
  CASE WHEN p.amount_paid>=p.amount_due THEN 'שולם במלואו'
       WHEN p.amount_paid>0 THEN 'שולם חלקית'
       ELSE 'לא שולם' END as status
  FROM payments p JOIN units u ON p.unit_id=u.id`;

router.get('/payments', authenticate, ah(async (req, res) => {
  const bid = getBid(req);
  if (req.user.role === 'resident') {
    if (!req.user.unit_id) return res.json([]);
    return res.json(await q(paymentSelect + ' WHERE p.unit_id=? AND p.building_id=?').all(req.user.unit_id, bid));
  }
  res.json(await q(paymentSelect + ' WHERE p.building_id=? ORDER BY u.unit_number').all(bid));
}));
router.post('/payments', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const { unit_id, area, amount_due, amount_paid, due_date, note, payment_type, period_label } = req.body;
  if (!unit_id) return res.status(400).json({ error: 'חסרה דירה' });
  const r = await q('INSERT INTO payments (unit_id,building_id,amount_due,amount_paid,due_date,note,payment_type,period_label,area) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(unit_id, bid, amount_due||0, amount_paid||0, due_date||null, note||'', payment_type||'חד-פעמי', period_label||'', area||'maintenance');
  res.json(await q(paymentSelect + ' WHERE p.id=?').get(r.lastInsertRowid));
}));
router.put('/payments/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const { amount_due, amount_paid, due_date, note, payment_type, period_label, area } = req.body;
  await q('UPDATE payments SET amount_due=?,amount_paid=?,due_date=?,note=?,payment_type=?,period_label=?,area=? WHERE id=?')
    .run(amount_due, amount_paid, due_date, note, payment_type||'חד-פעמי', period_label||'', area||'maintenance', req.params.id);
  res.json(await q(paymentSelect + ' WHERE p.id=?').get(req.params.id));
}));

// Send a payment-demand email to the unit's resident (req #11)
router.post('/payments/:id/demand', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(503).json({ error: 'שירות המייל לא מוגדר — הוסף RESEND_API_KEY ל-Render' });

  const pay = await q(paymentSelect + ' WHERE p.id=?').get(req.params.id);
  if (!pay) return res.status(404).json({ error: 'תשלום לא נמצא' });
  const balance = (pay.amount_due || 0) - (pay.amount_paid || 0);
  if (balance <= 0) return res.status(400).json({ error: 'אין יתרת חוב לדירה זו' });

  // Find the resident user of this unit (they hold the email)
  const resident = await q("SELECT full_name,email FROM users WHERE unit_id=? AND role='resident' LIMIT 1").get(pay.unit_id);
  const toEmail = req.body.to_email || resident?.email;
  if (!toEmail) return res.status(400).json({ error: 'לא נמצא אימייל לדייר של דירה זו — הוסף דייר עם אימייל, או ספק כתובת ידנית' });

  const building = await q('SELECT name FROM buildings WHERE id=?').get(pay.building_id);
  const typeLabel = pay.payment_type || 'חד-פעמי';
  const appUrl = process.env.APP_URL || 'https://gspro-app.vercel.app';
  const html = `
<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155">
  <div style="text-align:center;margin-bottom:20px">
    <div style="display:inline-block;background:#2563eb;color:#fff;font-weight:900;font-size:20px;padding:8px 18px;border-radius:10px">GS</div>
    <h1 style="color:#fff;font-size:18px;margin:10px 0 4px">דרישת תשלום — ${building?.name || ''}</h1>
  </div>
  <p style="color:#cbd5e1;line-height:1.7">שלום ${resident?.full_name || 'דייר יקר'},</p>
  <p style="color:#cbd5e1;line-height:1.7">להלן פירוט החוב עבור דירה ${pay.unit_number}${pay.period_label ? ' — ' + pay.period_label : ''}:</p>
  <div style="background:#0f172a;border-radius:10px;padding:18px;margin:16px 0;border:1px solid #1e40af">
    <p style="margin:4px 0;color:#94a3b8">סוג תשלום: <span style="color:#fff">${typeLabel}</span></p>
    <p style="margin:4px 0;color:#94a3b8">סכום לתשלום: <span style="color:#fff">₪${(pay.amount_due||0).toLocaleString()}</span></p>
    <p style="margin:4px 0;color:#94a3b8">שולם: <span style="color:#fff">₪${(pay.amount_paid||0).toLocaleString()}</span></p>
    <p style="margin:8px 0 0;color:#f87171;font-weight:bold;font-size:17px">יתרה לתשלום: ₪${balance.toLocaleString()}</p>
    ${pay.due_date ? `<p style="margin:8px 0 0;color:#fbbf24">מועד גבייה: ${pay.due_date}</p>` : ''}
  </div>
  <p style="color:#64748b;font-size:12px;text-align:center;margin-top:20px">נשלח ממערכת GS.pro · גלעד שריקי פרויקטים · 050-6774798</p>
</div></body></html>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'GS.pro <onboarding@resend.dev>', to: [toEmail], subject: `דרישת תשלום — דירה ${pay.unit_number} | ${building?.name || 'GS.pro'}`, html }),
  });
  const data = await r.json();
  if (!r.ok) return res.status(400).json({ error: mailError(data.message) });
  res.json({ ok: true, to: toEmail, balance });
}));

// ── Units ──────────────────────────────────────────────────
router.get('/units', authenticate, ah(async (req, res) => {
  const bid = getBid(req);
  res.json(await q('SELECT * FROM units WHERE building_id=? ORDER BY unit_number').all(bid));
}));
router.put('/units/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const { owner_name } = req.body;
  await q('UPDATE units SET owner_name=? WHERE id=?').run(owner_name, req.params.id);
  res.json(await q('SELECT * FROM units WHERE id=?').get(req.params.id));
}));

// ── File upload (auth) — uploads base64 to Cloudinary, returns a URL ──
router.post('/upload', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const { file_data, file_name } = req.body;
  if (!file_data) return res.status(400).json({ error: 'חסר קובץ' });
  const { url, stored } = await uploadDataUrl(file_data, file_name);
  res.json({ url, stored, file_name: file_name || '' });
}));

// ── Decisions ─────────────────────────────────────────────
router.get('/decisions', authenticate, ah(async (req, res) => {
  const bid = getBid(req);
  res.json(await q('SELECT * FROM decisions WHERE building_id=? ORDER BY date DESC').all(bid));
}));
router.post('/decisions', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const { date, topic, approved_by, status, doc_url, doc_name } = req.body;
  const r = await q('INSERT INTO decisions (building_id,date,topic,approved_by,status,doc_url,doc_name) VALUES (?,?,?,?,?,?,?)').run(bid, date, topic, approved_by, status||'ממתין', doc_url||null, doc_name||null);
  res.json(await q('SELECT * FROM decisions WHERE id=?').get(r.lastInsertRowid));
}));
router.put('/decisions/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const { date, topic, approved_by, status, doc_url, doc_name } = req.body;
  await q('UPDATE decisions SET date=?,topic=?,approved_by=?,status=?,doc_url=?,doc_name=? WHERE id=?').run(date, topic, approved_by, status, doc_url||null, doc_name||null, req.params.id);
  res.json(await q('SELECT * FROM decisions WHERE id=?').get(req.params.id));
}));
router.delete('/decisions/:id', authenticate, requireAdmin, ah(async (req, res) => {
  await q('DELETE FROM decisions WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Updates (routine visit logs — committee/staff only, req #3) ─────
router.get('/updates', authenticate, ah(async (req, res) => {
  if (req.user.role === 'resident') return res.status(403).json({ error: 'אזור זה מיועד לוועד הבית' });
  const bid = getBid(req);
  res.json(await q('SELECT * FROM updates WHERE building_id=? ORDER BY visit_date DESC').all(bid));
}));
router.post('/updates', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const { visit_date, summary, blockers, next_steps, kind, title, tasks, qc_notes, general_notes, raw_text } = req.body;
  const r = await q('INSERT INTO updates (building_id,visit_date,summary,blockers,next_steps,author,kind,title,tasks,qc_notes,general_notes,raw_text) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(bid, visit_date, summary||'', blockers||'', next_steps||'', req.user.full_name, kind||'new', title||'', tasks||'', qc_notes||'', general_notes||'', raw_text||'');
  res.json(await q('SELECT * FROM updates WHERE id=?').get(r.lastInsertRowid));
}));

// Bulk-insert archive visit summaries (read-only records split from one document)
router.post('/updates/archive-bulk', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'אין פריטים' });
  let count = 0;
  for (const it of items) {
    if (!it || !it.raw_text) continue;
    await q('INSERT INTO updates (building_id,visit_date,title,raw_text,author,kind) VALUES (?,?,?,?,?,?)')
      .run(bid, it.visit_date || null, it.title || 'סיכום ביקור', it.raw_text, req.user.full_name, 'archive');
    count++;
  }
  res.json({ ok: true, inserted: count });
}));
router.put('/updates/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const { visit_date, summary, blockers, next_steps } = req.body;
  await q('UPDATE updates SET visit_date=?,summary=?,blockers=?,next_steps=? WHERE id=?').run(visit_date, summary, blockers, next_steps, req.params.id);
  res.json(await q('SELECT * FROM updates WHERE id=?').get(req.params.id));
}));
router.delete('/updates/:id', authenticate, requireAdmin, ah(async (req, res) => {
  await q('DELETE FROM updates WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Search (full-text across all update fields) ────────────
router.get('/search', authenticate, ah(async (req, res) => {
  if (req.user.role === 'resident') return res.status(403).json({ error: 'גישה מוגבלת' });
  const bid = getBid(req);
  if (!bid) return res.status(400).json({ error: 'חסר building_id' });
  const raw = (req.query.q || '').trim();
  if (!raw) return res.json([]);
  const terms = raw.split(/\s+/).filter(Boolean);
  // All terms must appear somewhere in the record (AND logic across terms, OR across fields)
  const conditions = terms.map(() =>
    `(title LIKE ? OR summary LIKE ? OR blockers LIKE ? OR next_steps LIKE ? OR qc_notes LIKE ? OR general_notes LIKE ? OR tasks LIKE ? OR raw_text LIKE ?)`
  ).join(' AND ');
  const params = [bid, ...terms.flatMap(t => Array(8).fill(`%${t}%`))];
  const rows = await q(
    `SELECT id,building_id,visit_date,title,kind,summary,blockers,next_steps,qc_notes,general_notes
     FROM updates WHERE building_id=? AND (${conditions})
     ORDER BY visit_date DESC LIMIT 100`
  ).all(...params);
  res.json(rows);
}));

// ── Standards Advisor (יועץ תקנים) ────────────────────────
const STANDARDS_SYSTEM = `אתה יועץ תקנים ישראליים לפיקוח הנדסי, עוזר לגלעד שריקי – הנדסאי בניין ומנהל עבודה מוסמך (לא מהנדס רשוי), מפעיל GS Projects / GS.pro.

## כללי עבודה
1. התייחס רק לתקנים המפורטים ברשימה למטה (אלה שקיימים במאגר). אם שאלה נוגעת לתקן שאינו ברשימה – ציין זאת מפורשות.
2. כל ציטוט חייב לכלול: **שם התקן + מספרו + מספר הסעיף ככל הניתן + הדרישה הספציפית**.
3. כאשר הנושא דורש שיקול הנדסי מבני (עומסים, חוזק מבני, תכן קונסטרוקטיבי) – ציין: "נושא זה מחייב אישור מהנדס מבנה רשוי".
4. מסמכי הגא (פיקוד העורף) ≠ תקני ת.י. – ציין תמיד "על פי הנחיות הגא [מספר] של פיקוד העורף".
5. הפלט בעברית, ממוקד ומקצועי – מתאים לשילוב בדוח ביקור או חוות דעת.
6. אם לא ניתן להצביע על תקן ספציפי – ציין זאת ישירות, אל תנחש.
7. הרשימה למטה מכילה את שמות התקנים בלבד – לא את תוכנם המלא. כשאתה מצטט ערך מספרי או מספר סעיף מזיכרונך – סייג במפורש: "מומלץ לאמת מול נוסח התקן המלא במאגר". לעולם אל תציג ערך מספרי לא ודאי כעובדה מוחלטת.

## פורמט תשובה
- **התקן הרלוונטי:** ת.י. [מספר] – [שם]
- **הדרישה:** [ניסוח קצר של מה התקן דורש]
- **סעיף:** [אם ידוע]
- **הערה לדוח:** [משפט מוכן לשילוב ישיר בדוח, בגוף שלישי]
- **מחייב מהנדס רשוי:** [כן/לא + הסבר קצר אם כן]

## תקנים קיימים במאגר
ת.י. 1 צמנט | ת.י. 2 שיטות לבדיקת צמנט | ת.י. 3 אגרגאטים מינרליים | ת.י. 5 בלוקי בטון | ת.י. 6 אריחי רצפה מטראצו | ת.י. 8 מוצרי בטון טרומים לריצוף | ת.י. 19 אבני שפה מבטון | ת.י. 24 מעליות נוסעים ומשא | ת.י. 26 בדיקות בטון | ת.י. 27 צינורות גליליים מבטון | ת.י. 37 לבידים | ת.י. 42 מדרגות טרומות מבטון | ת.י. 68 איטום גגות שטוחים | ת.י. 75 סיד חי לבנייה | ת.י. 109 משקל חומרי בנייה | ת.י. 110 לוחות צמנט מחוזק בסיבים | ת.י. 118 בטון לשימושים מבניים | ת.י. 158 מתקנים לגז פחמימני | ת.י. 215 רעפים | ת.י. 252 ניסוי העמסה תקרות | ת.י. 253 מיון קרקעות | ת.י. 268 בלוקי בטון תאי | ת.י. 362 תערובות אספלטיות | ת.י. 412 עומסים אופייניים | ת.י. 413 עמידות ברעידות אדמה | ת.י. 414 עומס רוח | ת.י. 462 הספקת גפ"מ | ת.י. 466 חוקת הבטון | ת.י. 601 בטון מובא | ת.י. 669 לוחות פוליויניל | ת.י. 750 צמר מינרלי לבידוד | ת.י. 751 צמר מינרלי מוצרים | ת.י. 755 תגובות בשרפה | ת.י. 789 סטיות מותרות בבנייה | ת.י. 812 עמודי תאורה | ת.י. 838 תנור ארובה | ת.י. 896 מוספים לבטון | ת.י. 904 טפסות לבטון | ת.י. 921 תגובות בשרפה-דרישות | ת.י. 931 עמידות אש אלמנטים | ת.י. 932 בטיחות אש חדרי הסקה | ת.י. 938 לוחות זכוכית לבניינים | ת.י. 940 תכן גאוטכני-ביסוס | ת.י. 985 בידוד אקוסטי | ת.י. 1001 מיזוג ואוורור-בטיחות אש | ת.י. 1004 בידוד אקוסטי מגורים | ת.י. 1032 אישור נוהלי ריתוך | ת.י. 1034 מדידת בידוד קול | ת.י. 1045 בידוד תרמי בניינים | ת.י. 1068 חלונות-דרישות | ת.י. 1099 זיגוג חלונות ודלתות | ת.י. 1139 פיגומים | ת.י. 1142 מעקים ומסעדים | ת.י. 1161 מלבני פלדה לדלתות | ת.י. 1173 הגנה מפני ברק | ת.י. 1182 גרמי מדרגות מבטון | ת.י. 1205 התקנת מתקני תברואה | ת.י. 1209 אפר פחם לבטון | ת.י. 1212 דלתות אש | ת.י. 1220 מערכת גילוי אש | ת.י. 1225 חוקת מבני פלדה | ת.י. 1226 סרטוטים למבנים | ת.י. 1229 פלסטיק מוקצף לבידוד | ת.י. 1239 דגימת בטון יצוק באתר | ת.י. 1267 צבעים תופחים | ת.י. 1269 חיפוי רצפה מטראצו | ת.י. 1353 אריחי פסיפס | ת.י. 1375 התנגדות תרמית קירות | ת.י. 1378 ביסוס כלונסאות | ת.י. 1414 מערכות בידוד תרמי | ת.י. 1418 רעש מתקני מים | ת.י. 1430 יריעות איטום PVC | ת.י. 1454 בדיקת צפיפות קרקע | ת.י. 1458 צינורות פלדה | ת.י. 1476 אטימות מעטפת הבניין | ת.י. 1490 מחיצות וחיפויי גבס | ת.י. 1504 בלוקי גבס | ת.י. 1508 פחי סיכוך | ת.י. 1513 בטון קל לא מבני | ת.י. 1523 קירות בני לא נושאים | ת.י. 1525 ניהול תחזוקת בניינים | ת.י. 1530 הגנה מאש במעבדות | ת.י. 1542 אטמים גמישים לחלונות | ת.י. 1547 תוכניות ביצוע | ת.י. 1554 לוחות חיפוי מדרגות | ת.י. 1555 פסיפס ואריחי קרמיקה | ת.י. 1556 סיכוך גגות קלים | ת.י. 1571 מיסעות מאבני ריצוף | ת.י. 1629 חיפוי רצפה טראצו | ת.י. 1630 קירות תמך | ת.י. 1635 סורגים לפתחים | ת.י. 1733 ציפוי פלדה מפני שרפה | ת.י. 1735 פלדה לדריכת בטון | ת.י. 1752 איטום גגות שטוחים | ת.י. 1861 מדידת עבודות בנייה | ת.י. 1865 בדיקות סלילה | ת.י. 1878 לוחות פלסטיק לחלונות | ת.י. 1885 אגרגט גרוס | ת.י. 1886 מצע לכבישים | ת.י. 1913 לוחות OSB | ת.י. 1918 נגישות | ת.י. 1920 טיח | ת.י. 1922 מערכות צבע | ת.י. 1923 בטון יצוק באתר | ת.י. 2142 בטיחות בשטחים פתוחים | ת.י. 2263 בלוקי תבנית | ת.י. 2378 קירות מחופים אבן | ת.י. 2413 עמידות מבנים לרעידות-קיימים | ת.י. 2931 בטיחות אש מערכות | ת.י. 4001 דלתות אלומיניום | ת.י. 4004 דבקים לאריחים | ת.י. 4030 ארגזי רוח בגגות | ת.י. 4068 חלונות ותריסים | ת.י. 4273 גדרות פלדה | ת.י. 4402 פרופילי אלומיניום | ת.י. 4422 פריטי מסגרות למקלטים | ת.י. 4439 פרגולה מעץ | ת.י. 4440 משטחי עבודה מאבן | ת.י. 4466 פלדה לזיון בטון | ת.י. 4467 פלדה לזיון-ריתוך | ת.י. 4491 אבן פולימרית | ת.י. 4577 בדיקת אטימות מרחבים מוגנים | ת.י. 5044 מכללי דלתות מגן | ת.י. 5075 ציפויים במרחבים מוגנים | ת.י. 5098 יסודות רדיואקטיביים בחומרים
הגא 101 ממ"ד | הגא 243 ביצוע מרחבים מוגנים | הגא 244 מרחבים מוגנים קומתיים | הגא 483 מקלטים ציבוריים | הגא 1131 תוכנית מיגון | הגא 1140 מרחב מוגן | הגא 1141 ממ"ק | הגא 1204 חיזוק מבנים | הגא 1207 מקלט קומתי | הגא 1228 הגנה פסיבית | הגא 1233 מקלט ציבורי`;

router.post('/standards-query', authenticate, ah(async (req, res) => {
  if (req.user.role === 'resident') return res.status(403).json({ error: 'גישה מוגבלת' });
  const { question, defect_text, context_title } = req.body;
  if (!question && !defect_text) return res.status(400).json({ error: 'חסר שאלה או תיאור ליקוי' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'מפתח Anthropic לא מוגדר — ראה הגדרות Render' });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userMsg = [
    context_title && `**הקשר:** ${context_title}`,
    defect_text && `**תיאור הליקוי / הממצא:**\n${defect_text}`,
    question && `**שאלה:** ${question}`,
  ].filter(Boolean).join('\n\n');

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: STANDARDS_SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });

  res.json({ answer: msg.content[0].text, input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens });
}));

// ── Complaints ─────────────────────────────────────────────
const cSelect = 'SELECT c.*, u.unit_number FROM complaints c JOIN units u ON c.unit_id=u.id';
router.get('/complaints', authenticate, ah(async (req, res) => {
  const bid = getBid(req);
  if (req.user.role === 'resident') {
    if (!req.user.unit_id) return res.json([]);
    return res.json(await q(cSelect + ' WHERE c.unit_id=? AND c.building_id=? ORDER BY c.created_at DESC').all(req.user.unit_id, bid));
  }
  // The מפקח (superadmin) only sees complaints the committee forwarded to him.
  if (req.user.role === 'superadmin') {
    return res.json(await q(cSelect + ' WHERE c.building_id=? AND c.forwarded=1 ORDER BY c.forwarded_at DESC, c.created_at DESC').all(bid));
  }
  // Committee / building-admin see all complaints for the building.
  res.json(await q(cSelect + ' WHERE c.building_id=? ORDER BY c.created_at DESC').all(bid));
}));
router.post('/complaints', authenticate, ah(async (req, res) => {
  const bid = getBid(req);
  const { subject, body, unit_id, photo } = req.body;
  const uid = req.user.role === 'resident' ? req.user.unit_id : unit_id;
  if (!uid) return res.status(400).json({ error: 'חסר מספר דירה' });
  const r = await q('INSERT INTO complaints (unit_id,building_id,subject,body,status,photo) VALUES (?,?,?,?,?,?)').run(uid, bid, subject, body||'', 'פתוח', photo||null);
  res.json(await q(cSelect + ' WHERE c.id=?').get(r.lastInsertRowid));
}));
router.put('/complaints/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const { status } = req.body;
  await q('UPDATE complaints SET status=? WHERE id=?').run(status, req.params.id);
  res.json(await q(cSelect + ' WHERE c.id=?').get(req.params.id));
}));

// Committee forwards a complaint to the מפקח (admin)
router.put('/complaints/:id/forward', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const now = new Date().toISOString().slice(0,10);
  const fwd = req.body.forwarded === false ? 0 : 1;
  await q('UPDATE complaints SET forwarded=?,forwarded_at=? WHERE id=?').run(fwd, fwd ? now : null, req.params.id);
  res.json(await q(cSelect + ' WHERE c.id=?').get(req.params.id));
}));

// The מפקח responds (initial status + optional final response)
router.put('/complaints/:id/admin-response', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'מיועד למפקח בלבד' });
  const { admin_status, admin_response } = req.body;
  await q('UPDATE complaints SET admin_status=?,admin_response=? WHERE id=?').run(admin_status||'', admin_response||'', req.params.id);
  res.json(await q(cSelect + ' WHERE c.id=?').get(req.params.id));
}));
router.delete('/complaints/:id', authenticate, requireAdmin, ah(async (req, res) => {
  await q('DELETE FROM complaints WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Monthly inspection reports (req #3) ────────────────────
// Committee composes a report (with attached docs) and publishes it;
// residents see it ONLY once published.
router.get('/monthly-reports', authenticate, ah(async (req, res) => {
  const bid = getBid(req);
  const staff = ['superadmin','admin','committee'].includes(req.user.role);
  const rows = staff
    ? await q('SELECT * FROM monthly_reports WHERE building_id=? ORDER BY month DESC, id DESC').all(bid)
    : await q("SELECT * FROM monthly_reports WHERE building_id=? AND status='published' ORDER BY month DESC, id DESC").all(bid);
  res.json(rows.map(r => ({ ...r, docs: r.docs ? JSON.parse(r.docs) : [] })));
}));
router.post('/monthly-reports', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const { month, title, summary, docs } = req.body;
  if (!month) return res.status(400).json({ error: 'חסר חודש' });
  const r = await q('INSERT INTO monthly_reports (building_id,month,title,summary,docs,status,author) VALUES (?,?,?,?,?,?,?)')
    .run(bid, month, title||'', summary||'', JSON.stringify(docs||[]), 'draft', req.user.full_name);
  const row = await q('SELECT * FROM monthly_reports WHERE id=?').get(r.lastInsertRowid);
  res.json({ ...row, docs: row.docs ? JSON.parse(row.docs) : [] });
}));
router.put('/monthly-reports/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const { month, title, summary, docs, status } = req.body;
  const publishedAt = status === 'published' ? new Date().toISOString().slice(0,10) : null;
  await q('UPDATE monthly_reports SET month=?,title=?,summary=?,docs=?,status=?,published_at=? WHERE id=?')
    .run(month, title||'', summary||'', JSON.stringify(docs||[]), status||'draft', publishedAt, req.params.id);
  const row = await q('SELECT * FROM monthly_reports WHERE id=?').get(req.params.id);
  res.json({ ...row, docs: row.docs ? JSON.parse(row.docs) : [] });
}));
router.delete('/monthly-reports/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  await q('DELETE FROM monthly_reports WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Onboarding forms (client self-service intake → new building) ──
const APP_URL = () => process.env.APP_URL || 'https://gspro-app.vercel.app';

// Build a new building (and related records) from a submitted form's data.
async function buildFromForm(form) {
  const d = form.data ? JSON.parse(form.data) : {};
  const type = form.form_type === 'maintenance' ? 'maintenance' : 'supervision';
  const name = d.address || (type === 'maintenance' ? 'בניין תחזוקה' : 'פרויקט פיקוח');
  const numUnits = parseInt(d.num_units) || 0;
  const budgetTotal = type === 'supervision' ? (parseFloat(d.budget?.total) || 0) : 0;
  const target = type === 'supervision' ? (d.budget?.target_date || null) : null;

  const b = await q('INSERT INTO buildings (name,address,num_units,num_floors,budget,target_date,type) VALUES (?,?,?,?,?,?,?)')
    .run(name, d.address || '', numUnits, parseInt(d.num_floors) || 0, budgetTotal, target, type);
  const bid = b.lastInsertRowid;

  for (let i = 1; i <= numUnits; i++)
    await q('INSERT INTO units (building_id,unit_number,floor) VALUES (?,?,?)').run(bid, i, Math.ceil(i / 4));

  // Contractors (both form types may include a dynamic list)
  for (const c of (d.contractors || [])) {
    if (!c || !c.name) continue;
    await q('INSERT INTO contractors (building_id,name,trade,phone,status) VALUES (?,?,?,?,?)').run(bid, c.name, c.trade || '', c.phone || '', 'פעיל');
  }

  if (type === 'maintenance') {
    // Maintenance systems → maintenance items
    const today = new Date().toISOString().slice(0, 10);
    for (const sys of (d.systems || [])) {
      await q('INSERT INTO maintenance_items (building_id,name,frequency_days,last_check,next_check,status) VALUES (?,?,?,?,?,?)')
        .run(bid, sys, 365, today, addDays(today, 365), 'תקין');
    }
    if (d.systems_other) await q('INSERT INTO maintenance_items (building_id,name,frequency_days,status) VALUES (?,?,?,?)').run(bid, d.systems_other, 365, 'תקין');
    // Monthly running collection per unit
    const monthly = parseFloat(d.collection?.monthly_per_unit) || 0;
    if (monthly > 0) {
      const units = await q('SELECT id FROM units WHERE building_id=?').all(bid);
      for (const u of units)
        await q('INSERT INTO payments (unit_id,building_id,amount_due,amount_paid,payment_type,area) VALUES (?,?,?,?,?,?)').run(u.id, bid, monthly, 0, 'חודשי', 'maintenance');
    }
  } else {
    // Supervision: project budget total + paid
    const paid = parseFloat(d.budget?.paid) || 0;
    await q('INSERT INTO budget_items (building_id,category,planned_amount,paid_amount,track) VALUES (?,?,?,?,?)')
      .run(bid, 'תקציב כולל מאושר', budgetTotal, paid, 'project');
  }

  // Create a committee contact user if an email was provided (best-effort)
  const contact = type === 'maintenance' ? d.contact : (d.reps && d.reps[0]);
  if (contact && contact.email) {
    try {
      const exists = await q('SELECT id FROM users WHERE email=?').get(contact.email.toLowerCase().trim());
      if (!exists) {
        await q('INSERT INTO users (full_name,email,password,role,building_id,areas) VALUES (?,?,?,?,?,?)')
          .run(contact.name || 'נציג ועד', contact.email.toLowerCase().trim(), bcrypt.hashSync('123456', 10), 'committee', bid, type === 'maintenance' ? 'maintenance' : 'supervision');
      }
    } catch { /* ignore */ }
  }

  return bid;
}

// Admin: create a new form (generates a unique link)
router.post('/onboarding', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { form_type } = req.body;
  if (!['maintenance', 'supervision'].includes(form_type)) return res.status(400).json({ error: 'סוג טופס לא תקין' });
  const token = (global.crypto || require('crypto')).randomUUID();
  const r = await q('INSERT INTO onboarding_forms (token,form_type,status,created_by) VALUES (?,?,?,?)').run(token, form_type, 'pending', req.user.full_name);
  res.json({ id: r.lastInsertRowid, token, form_type, link: `${APP_URL()}/?form=${token}` });
}));

// Admin: list forms
router.get('/onboarding', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const rows = await q('SELECT * FROM onboarding_forms ORDER BY id DESC').all();
  res.json(rows.map(r => ({ ...r, data: r.data ? JSON.parse(r.data) : null, link: `${APP_URL()}/?form=${r.token}` })));
}));

// PUBLIC: client opens the form (no login)
router.get('/onboarding/public/:token', ah(async (req, res) => {
  const f = await q('SELECT id,form_type,status FROM onboarding_forms WHERE token=?').get(req.params.token);
  if (!f) return res.status(404).json({ error: 'הטופס לא נמצא' });
  res.json(f);
}));

// PUBLIC: client submits the form (no login)
router.put('/onboarding/public/:token', ah(async (req, res) => {
  const f = await q('SELECT * FROM onboarding_forms WHERE token=?').get(req.params.token);
  if (!f) return res.status(404).json({ error: 'הטופס לא נמצא' });
  if (f.status === 'approved') return res.status(400).json({ error: 'הטופס כבר אושר ואינו ניתן לעריכה' });
  const now = new Date().toISOString().slice(0, 10);
  await q('UPDATE onboarding_forms SET data=?,status=?,submitted_at=? WHERE token=?')
    .run(JSON.stringify(req.body.data || {}), 'submitted', now, req.params.token);
  res.json({ ok: true });
}));

// Admin: email the form link to a client
router.post('/onboarding/:id/send', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(503).json({ error: 'שירות המייל לא מוגדר — הוסף RESEND_API_KEY ל-Render' });
  const f = await q('SELECT * FROM onboarding_forms WHERE id=?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'לא נמצא' });
  const { to_email } = req.body;
  if (!to_email) return res.status(400).json({ error: 'חסר אימייל' });
  const link = `${APP_URL()}/?form=${f.token}`;
  const green = f.form_type === 'maintenance';
  const html = `
<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155">
  <div style="text-align:center;margin-bottom:20px">
    <div style="display:inline-block;background:#2D5BFF;color:#fff;font-weight:900;font-size:22px;padding:10px 20px;border-radius:12px">GS</div>
    <h1 style="color:#fff;font-size:20px;margin:12px 0 4px">GS.pro — טופס קליטה</h1>
  </div>
  <div style="background:${green ? '#064e3b' : '#1e3a8a'};border-radius:10px;padding:14px;text-align:center;margin-bottom:18px">
    <p style="color:#fff;margin:0;font-weight:bold">${green ? '🟢 טופס תחזוקה שוטפת' : '🔵 טופס פרויקט פיקוח הנדסי'}</p>
  </div>
  <p style="color:#cbd5e1;line-height:1.7">שלום, הוזמנת למלא טופס קליטה קצר שיאפשר לנו להקים עבורך את תיק הבניין הדיגיטלי במערכת GS.pro.</p>
  <div style="text-align:center;margin:24px 0">
    <a href="${link}" style="display:inline-block;background:#2D5BFF;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:bold;font-size:16px">למילוי הטופס →</a>
  </div>
  <p style="color:#64748b;font-size:12px;text-align:center">גלעד שריקי פרויקטים · 050-6774798</p>
</div></body></html>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'GS.pro <onboarding@resend.dev>', to: [to_email], subject: 'טופס קליטה — GS.pro', html }),
  });
  const data = await r.json();
  if (!r.ok) return res.status(400).json({ error: mailError(data.message) });
  await q('UPDATE onboarding_forms SET sent_to=? WHERE id=?').run(to_email, req.params.id);
  res.json({ ok: true, to: to_email });
}));

// Admin: approve a submitted form → create the building
router.post('/onboarding/:id/approve', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const f = await q('SELECT * FROM onboarding_forms WHERE id=?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'לא נמצא' });
  if (f.status === 'approved') return res.status(400).json({ error: 'כבר אושר' });
  if (!f.data) return res.status(400).json({ error: 'הטופס טרם מולא' });
  const bid = await buildFromForm(f);
  const now = new Date().toISOString().slice(0, 10);
  await q('UPDATE onboarding_forms SET status=?,building_id=?,approved_at=? WHERE id=?').run('approved', bid, now, req.params.id);
  res.json({ ok: true, building_id: bid });
}));

router.delete('/onboarding/:id', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  await q('DELETE FROM onboarding_forms WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Maintenance ────────────────────────────────────────────
router.get('/maintenance', authenticate, ah(async (req, res) => {
  const bid = getBid(req);
  const today = new Date().toISOString().slice(0, 10);
  const items = await q(`SELECT m.*, p.name as professional_name FROM maintenance_items m
    LEFT JOIN professionals p ON m.professional_id=p.id
    WHERE m.building_id=? ORDER BY m.next_check ASC`).all(bid);
  const result = items.map(item => ({
    ...item,
    alert: item.next_check && item.next_check <= addDays(today, 14)
  }));
  res.json(result);
}));
router.post('/maintenance', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const { name, frequency_days, last_check, status, professional_id, notes } = req.body;
  const next = addDays(last_check, parseInt(frequency_days) || 365);
  const r = await q('INSERT INTO maintenance_items (building_id,name,frequency_days,last_check,next_check,status,professional_id,notes) VALUES (?,?,?,?,?,?,?,?)').run(bid, name, frequency_days||365, last_check||null, next, status||'תקין', professional_id||null, notes||'');
  res.json(await q('SELECT * FROM maintenance_items WHERE id=?').get(r.lastInsertRowid));
}));
router.put('/maintenance/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const { name, frequency_days, last_check, status, professional_id, notes } = req.body;
  const next = addDays(last_check, parseInt(frequency_days) || 365);
  await q('UPDATE maintenance_items SET name=?,frequency_days=?,last_check=?,next_check=?,status=?,professional_id=?,notes=? WHERE id=?').run(name, frequency_days, last_check, next, status, professional_id||null, notes, req.params.id);
  res.json(await q('SELECT * FROM maintenance_items WHERE id=?').get(req.params.id));
}));
router.delete('/maintenance/:id', authenticate, requireAdmin, ah(async (req, res) => {
  await q('DELETE FROM maintenance_items WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Professionals ──────────────────────────────────────────
router.get('/professionals', authenticate, ah(async (req, res) => {
  const bid = getBid(req);
  res.json(await q('SELECT * FROM professionals WHERE building_id=? ORDER BY rating DESC, name').all(bid));
}));
router.post('/professionals', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const { name, trade, phone, email, rating, review, last_cost, last_service_date, service_years } = req.body;
  const r = await q('INSERT INTO professionals (building_id,name,trade,phone,email,rating,review,last_cost,last_service_date,service_years,added_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(bid, name, trade, phone, email||'', rating||0, review||'', last_cost||null, last_service_date||null, service_years||'', req.user.full_name);
  res.json(await q('SELECT * FROM professionals WHERE id=?').get(r.lastInsertRowid));
}));
router.put('/professionals/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const { name, trade, phone, email, rating, review, last_cost, last_service_date, service_years } = req.body;
  await q('UPDATE professionals SET name=?,trade=?,phone=?,email=?,rating=?,review=?,last_cost=?,last_service_date=?,service_years=? WHERE id=?').run(name, trade, phone, email||'', rating, review, last_cost, last_service_date, service_years||'', req.params.id);
  res.json(await q('SELECT * FROM professionals WHERE id=?').get(req.params.id));
}));
router.delete('/professionals/:id', authenticate, requireAdmin, ah(async (req, res) => {
  await q('DELETE FROM professionals WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Unit Permissions ──────────────────────────────────────
const DEFAULT_MODULES = ['payments','complaints','updates','decisions','maintenance','professionals','tutorials'];

router.get('/permissions/:unit_id', authenticate, ah(async (req, res) => {
  const uid = parseInt(req.params.unit_id);
  if (req.user.role === 'resident' && req.user.unit_id !== uid)
    return res.status(403).json({ error: 'גישה נדחתה' });
  const perms = await q('SELECT module, enabled FROM unit_permissions WHERE unit_id=?').all(uid);
  const result = {};
  DEFAULT_MODULES.forEach(mod => { result[mod] = 1; });
  perms.forEach(p => { result[p.module] = p.enabled; });
  res.json(result);
}));

router.get('/permissions', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const units = await q('SELECT u.id, u.unit_number, u.owner_name FROM units u WHERE u.building_id=? ORDER BY u.unit_number').all(bid);
  const perms = await q('SELECT unit_id, module, enabled FROM unit_permissions WHERE building_id=?').all(bid);
  const permMap = {};
  perms.forEach(p => {
    if (!permMap[p.unit_id]) permMap[p.unit_id] = {};
    permMap[p.unit_id][p.module] = p.enabled;
  });
  const residents = await q("SELECT unit_id, full_name FROM users WHERE building_id=? AND role='resident'").all(bid);
  const residentMap = {};
  residents.forEach(r => { residentMap[r.unit_id] = r.full_name; });
  res.json(units.map(u => ({
    unit_id: u.id,
    unit_number: u.unit_number,
    resident_name: residentMap[u.id] || u.owner_name || null,
    perms: Object.fromEntries(DEFAULT_MODULES.map(mod => [mod, permMap[u.id]?.[mod] ?? 1]))
  })));
}));

router.put('/permissions/:unit_id/:module', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const uid = parseInt(req.params.unit_id);
  const mod = req.params.module;
  const { enabled } = req.body;
  const bid = getBid(req);
  await q('INSERT INTO unit_permissions (unit_id,building_id,module,enabled) VALUES (?,?,?,?) ON CONFLICT(unit_id,module) DO UPDATE SET enabled=excluded.enabled')
    .run(uid, bid, mod, enabled ? 1 : 0);
  res.json({ ok: true, unit_id: uid, module: mod, enabled: enabled ? 1 : 0 });
}));

// ── Users Management (superadmin) ─────────────────────────
router.get('/users', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const users = await q('SELECT id,full_name,email,role,building_id,unit_id,is_demo,bg_access,areas FROM users ORDER BY building_id,role,full_name').all();
  res.json(users);
}));

router.post('/users', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { full_name, email, password, role, building_id, unit_id, areas } = req.body;
  if (!full_name || !email || !password || !role) return res.status(400).json({ error: 'חסרים שדות חובה' });
  const existing = await q('SELECT id FROM users WHERE email=?').get(email.toLowerCase().trim());
  if (existing) return res.status(400).json({ error: 'אימייל כבר קיים' });
  const hashed = bcrypt.hashSync(password, 10);
  const r = await q('INSERT INTO users (full_name,email,password,role,building_id,unit_id,areas) VALUES (?,?,?,?,?,?,?)')
    .run(full_name, email.toLowerCase().trim(), hashed, role, building_id || null, unit_id || null, areas || 'both');
  res.json(await q('SELECT id,full_name,email,role,building_id,unit_id,areas FROM users WHERE id=?').get(r.lastInsertRowid));
}));

router.put('/users/:id/password', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { password } = req.body;
  if (!password || password.length < 4) return res.status(400).json({ error: 'סיסמה חייבת להיות לפחות 4 תווים' });
  const hashed = bcrypt.hashSync(password, 10);
  await q('UPDATE users SET password=? WHERE id=?').run(hashed, req.params.id);
  res.json({ ok: true });
}));

router.put('/users/:id', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { full_name, email, building_id, unit_id, role, areas } = req.body;
  if (!full_name || !email) return res.status(400).json({ error: 'שם ואימייל הם חובה' });
  const existing = await q('SELECT id FROM users WHERE email=? AND id!=?').get(email.toLowerCase().trim(), req.params.id);
  if (existing) return res.status(400).json({ error: 'אימייל כבר קיים אצל משתמש אחר' });
  await q('UPDATE users SET full_name=?,email=?,building_id=?,unit_id=?,role=?,areas=? WHERE id=?')
    .run(full_name, email.toLowerCase().trim(), building_id || null, unit_id || null, role, areas || 'both', req.params.id);
  res.json(await q('SELECT id,full_name,email,role,building_id,unit_id,areas FROM users WHERE id=?').get(req.params.id));
}));

router.delete('/users/:id', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'לא ניתן למחוק את עצמך' });
  await q('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Change own password (all authenticated users) ──────────
router.put('/auth/change-password', authenticate, ah(async (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.status(400).json({ error: 'חסרים שדות' });
  if (new_password.length < 4) return res.status(400).json({ error: 'סיסמה חייבת להיות לפחות 4 תווים' });
  const user = await q('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(old_password, user.password)) return res.status(400).json({ error: 'הסיסמה הנוכחית שגויה' });
  await q('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(new_password, 10), req.user.id);
  res.json({ ok: true });
}));

// ── Invite resident by email ───────────────────────────────
router.post('/invite', authenticate, ah(async (req, res) => {
  if (!['superadmin','committee'].includes(req.user.role)) return res.status(403).json({ error: 'אין הרשאה' });
  const { to_email, to_name, building_name, temp_password } = req.body;
  if (!to_email || !to_name) return res.status(400).json({ error: 'חסרים שדות' });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(503).json({ error: 'שירות המייל לא מוגדר — הוסף RESEND_API_KEY ל-Render' });

  const appUrl = process.env.APP_URL || 'https://gspro-app.vercel.app';
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155">
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:#2563eb;color:#fff;font-weight:900;font-size:22px;padding:10px 20px;border-radius:12px">GS</div>
      <h1 style="color:#fff;font-size:22px;margin:12px 0 4px">GS.pro</h1>
      <p style="color:#94a3b8;margin:0;font-size:14px">ניהול בניינים חכם</p>
    </div>
    <h2 style="color:#fff;font-size:18px;margin-bottom:8px">שלום ${to_name} 👋</h2>
    <p style="color:#cbd5e1;line-height:1.7;margin-bottom:20px">
      הוזמנת להצטרף למערכת <strong style="color:#60a5fa">GS.pro</strong> — תיק הבניין הדיגיטלי של <strong>${building_name || 'הבניין שלך'}</strong>.
    </p>
    <div style="background:#0f172a;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #1e40af">
      <p style="margin:0 0 8px;color:#94a3b8;font-size:13px">פרטי כניסה:</p>
      <p style="margin:4px 0;color:#fff"><strong>אימייל:</strong> ${to_email}</p>
      <p style="margin:4px 0;color:#fff"><strong>סיסמה זמנית:</strong> <span style="background:#1e3a8a;padding:2px 8px;border-radius:4px;font-family:monospace">${temp_password || '123456'}</span></p>
    </div>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${appUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:bold;font-size:16px">
        כניסה למערכת →
      </a>
    </div>
    <p style="color:#64748b;font-size:12px;text-align:center;margin:0">
      מומלץ לשנות סיסמה לאחר הכניסה הראשונה.<br>
      שאלות? פנה לגלעד שריקי · giladshrikioffice@gmail.com
    </p>
  </div>
</body>
</html>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'GS.pro <onboarding@resend.dev>',
      to: [to_email],
      subject: `הזמנה למערכת GS.pro — ${building_name || 'הבניין שלך'}`,
      html,
    }),
  });
  const data = await r.json();
  if (!r.ok) return res.status(400).json({ error: mailError(data.message) });
  res.json({ ok: true, id: data.id });
}));

// ── Feedback ──────────────────────────────────────────────
router.post('/feedback', ah(async (req, res) => {
  const { category, message, contact } = req.body;
  if (!message) return res.status(400).json({ error: 'חסרה הודעה' });
  try {
    await q('INSERT INTO feedback (category,message,contact) VALUES (?,?,?)')
      .run(category || 'other', message, contact || '');
  } catch { /* ignore */ }
  console.log(`💬 Feedback [${category}]: ${message.substring(0, 80)}`);
  res.json({ ok: true });
}));

router.get('/feedback', authenticate, ah(async (req, res) => {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  try {
    res.json(await q('SELECT * FROM feedback ORDER BY created_at DESC').all());
  } catch { res.json([]); }
}));

// ── Documents ─────────────────────────────────────────────
const CHECKLIST_ITEMS = [
  { key: 'building_permit',    label: 'היתר בנייה' },
  { key: 'architect_plans',    label: 'תוכניות אדריכל מאושרות' },
  { key: 'main_contract',      label: 'חוזה קבלן ראשי חתום' },
  { key: 'insurance_contractor', label: 'ביטוח קבלן / אחריות צד ג\'' },
  { key: 'insurance_building', label: 'ביטוח מבנה משותף' },
  { key: 'vaad_protocol',      label: 'פרוטוקול אסיפת דיירים מאשר פרויקט' },
  { key: 'payment_schedule',   label: 'לוח תשלומים מוסכם' },
  { key: 'fire_safety',        label: 'אישור בטיחות אש' },
  { key: 'structural_engineer', label: 'חוות דעת מהנדס קונסטרוקציה' },
  { key: 'elevator_permit',    label: 'רישיון מעלית תקף' },
  { key: 'warranty_docs',      label: 'אחריות יצרן לחומרים (תריסים, מעקות, אלומיניום)' },
  { key: 'building_book',      label: 'ספר הבניין (תיק הבניין הדיגיטלי)' },
  { key: 'tax_clearance',      label: 'אישור ניכוי מס במקור — קבלן ראשי' },
  { key: 'subcontractors',     label: 'חוזי קבלני משנה חתומים' },
  { key: 'completion_cert',    label: 'תעודת גמר / טופס 4 (בסיום)' },
];

router.get('/documents', authenticate, ah(async (req, res) => {
  const bid = getBid(req);
  if (!bid) return res.status(400).json({ error: 'חסר building_id' });
  const isPrivileged = ['superadmin','committee'].includes(req.user.role);
  const docs = isPrivileged
    ? await q('SELECT id,name,description,category,file_type,file_name,file_size,visibility,uploaded_by,created_at FROM documents WHERE building_id=? ORDER BY created_at DESC').all(bid)
    : await q("SELECT id,name,description,category,file_type,file_name,file_size,visibility,uploaded_by,created_at FROM documents WHERE building_id=? AND visibility='all' ORDER BY created_at DESC").all(bid);
  res.json(docs);
}));

router.get('/documents/:id/download', authenticate, ah(async (req, res) => {
  const doc = await q('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'לא נמצא' });
  const isPrivileged = ['superadmin','committee'].includes(req.user.role);
  if (doc.visibility !== 'all' && !isPrivileged) return res.status(403).json({ error: 'אין גישה' });
  if (!doc.file_data) return res.status(404).json({ error: 'אין קובץ' });
  res.json({ file_data: doc.file_data, file_type: doc.file_type, file_name: doc.file_name });
}));

router.post('/documents', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const { name, description, category, file_data, file_type, file_name, file_size, visibility } = req.body;
  if (!name) return res.status(400).json({ error: 'שם חובה' });
  const r = await q('INSERT INTO documents (building_id,name,description,category,file_data,file_type,file_name,file_size,visibility,uploaded_by) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(bid, name, description||'', category||'general', file_data||null, file_type||'', file_name||'', file_size||0, visibility||'committee', req.user.full_name);
  res.json(await q('SELECT id,name,description,category,file_type,file_name,file_size,visibility,uploaded_by,created_at FROM documents WHERE id=?').get(r.lastInsertRowid));
}));

router.put('/documents/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const { name, description, category, visibility } = req.body;
  await q('UPDATE documents SET name=?,description=?,category=?,visibility=? WHERE id=?').run(name, description, category, visibility, req.params.id);
  res.json(await q('SELECT id,name,description,category,file_type,file_name,file_size,visibility,uploaded_by,created_at FROM documents WHERE id=?').get(req.params.id));
}));

router.delete('/documents/:id', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  await q('DELETE FROM documents WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// Checklist
router.get('/documents/checklist', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const saved = await q('SELECT item_key, status, note, updated_at FROM doc_checklist WHERE building_id=?').all(bid);
  const savedMap = Object.fromEntries(saved.map(s => [s.item_key, s]));
  res.json(CHECKLIST_ITEMS.map(item => ({
    ...item,
    status: savedMap[item.key]?.status || 'missing',
    note: savedMap[item.key]?.note || '',
    updated_at: savedMap[item.key]?.updated_at || null,
  })));
}));

router.put('/documents/checklist/:key', authenticate, requireAdminOrCommittee, ah(async (req, res) => {
  const bid = getBid(req);
  const { status, note } = req.body;
  const now = new Date().toISOString().slice(0,10);
  await q('INSERT INTO doc_checklist (building_id,item_key,status,note,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(building_id,item_key) DO UPDATE SET status=excluded.status,note=excluded.note,updated_at=excluded.updated_at')
    .run(bid, req.params.key, status, note||'', now);
  res.json({ ok: true });
}));

// ── Cron: send alert emails ───────────────────────────────
router.post('/cron/alerts', ah(async (req, res) => {
  const secret = req.headers['x-cron-secret'] || req.body.secret;
  if (secret !== (process.env.CRON_SECRET || 'gspro-cron-2026')) return res.status(401).json({ error: 'לא מורשה' });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(503).json({ error: 'RESEND_API_KEY חסר' });

  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14*86400000).toISOString().slice(0, 10);

  const buildings = await q('SELECT * FROM buildings').all();
  const results = [];

  for (const b of buildings) {
    const committee = await q("SELECT email,full_name FROM users WHERE building_id=? AND role IN ('committee','superadmin')").all(b.id);
    if (!committee.length) continue;

    const maintAlerts = await q(`SELECT name, next_check FROM maintenance_items WHERE building_id=? AND next_check <= ? AND next_check >= ?`).all(b.id, in14, today);

    const payAlerts = await q(`SELECT u.unit_number, p.amount_due, p.amount_paid, p.due_date
      FROM payments p JOIN units u ON p.unit_id=u.id
      WHERE p.building_id=? AND p.due_date < ? AND p.amount_paid < p.amount_due`).all(b.id, today);

    if (!maintAlerts.length && !payAlerts.length) continue;

    const appUrl = process.env.APP_URL || 'https://gspro-app.vercel.app';

    let bodyHtml = `
<!DOCTYPE html><html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px">
<div style="max-width:560px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155">
  <div style="text-align:center;margin-bottom:24px">
    <div style="display:inline-block;background:#2563eb;color:#fff;font-weight:900;font-size:20px;padding:8px 18px;border-radius:10px">GS</div>
    <h1 style="color:#fff;font-size:18px;margin:10px 0 4px">GS.pro — התראות ${b.name}</h1>
    <p style="color:#94a3b8;font-size:13px;margin:0">${today}</p>
  </div>`;

    if (maintAlerts.length) {
      bodyHtml += `<div style="background:#1e3a5f;border-radius:10px;padding:16px;margin-bottom:16px;border:1px solid #1e40af">
        <h2 style="color:#60a5fa;font-size:15px;margin:0 0 10px">🔧 פריטי תחזוקה מתקרבים לתאריך בדיקה</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">`;
      maintAlerts.forEach(m => {
        bodyHtml += `<tr><td style="padding:4px 8px;color:#e2e8f0">${m.name}</td><td style="padding:4px 8px;color:#fbbf24;text-align:left">${m.next_check}</td></tr>`;
      });
      bodyHtml += `</table></div>`;
    }

    if (payAlerts.length) {
      const total = payAlerts.reduce((s,p) => s + (p.amount_due - p.amount_paid), 0);
      bodyHtml += `<div style="background:#3b1f1f;border-radius:10px;padding:16px;margin-bottom:16px;border:1px solid #7f1d1d">
        <h2 style="color:#f87171;font-size:15px;margin:0 0 10px">💳 תשלומים באיחור — ${payAlerts.length} דירות</h2>
        <p style="color:#fca5a5;font-size:13px;margin:0 0 8px">סה"כ חוב: ₪${total.toLocaleString()}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">`;
      payAlerts.forEach(p => {
        bodyHtml += `<tr><td style="padding:4px 8px;color:#e2e8f0">דירה ${p.unit_number}</td><td style="padding:4px 8px;color:#f87171;text-align:left">₪${(p.amount_due-p.amount_paid).toLocaleString()} חוב</td></tr>`;
      });
      bodyHtml += `</table></div>`;
    }

    bodyHtml += `<div style="text-align:center;margin-top:20px">
      <a href="${appUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 28px;border-radius:8px;font-weight:bold;font-size:14px">כניסה למערכת →</a>
    </div>
    <p style="color:#475569;font-size:11px;text-align:center;margin-top:16px">GS.pro · גלעד שריקי פרויקטים · 050-6774798</p>
  </div></body></html>`;

    for (const cm of committee) {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.MAIL_FROM || 'GS.pro <onboarding@resend.dev>',
            to: [cm.email],
            subject: `⚠️ התראות GS.pro — ${b.name} | ${today}`,
            html: bodyHtml,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok) results.push({ building: b.name, to: cm.email, ok: true });
        else results.push({ building: b.name, to: cm.email, ok: false, err: data.message || `HTTP ${resp.status}` });
      } catch(e) {
        results.push({ building: b.name, to: cm.email, ok: false, err: e.message });
      }
    }
  }

  const okCount = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  res.json({ ok: true, sent: okCount, failed: failed.length, results });
}));

// ── Manual alert trigger (superadmin from dashboard) ──────
router.post('/alerts/send', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const secret = process.env.CRON_SECRET || 'gspro-cron-2026';
  const base = `http://localhost:${process.env.PORT || 3001}`;
  const r = await fetch(`${base}/api/cron/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
    body: JSON.stringify({}),
  });
  const data = await r.json();
  res.json(data);
}));

// ── Background checks area (req #2) — curated due-diligence links ──
const BG_LINKS = [
  { title: 'רשם הקבלנים — בדיקת קבלן רשום', url: 'https://www.gov.il/he/service/contractor_registration_status', desc: 'בדיקת רישום וסיווג קבלן במרשם רשם הקבלנים' },
  { title: 'רישוי חשמלאים מוסמכים', url: 'https://www.gov.il/he/service/electrician-license', desc: 'בדיקת רישיון והסמכת חשמלאי' },
  { title: 'בטיחות בעבודה — מנהל עבודה מוסמך', url: 'https://www.gov.il/he/departments/topics/safety_at_work', desc: 'מידע על הסמכת מנהלי עבודה ובטיחות באתר' },
  { title: 'המוסד לבטיחות ולגיהות', url: 'https://www.osh.org.il', desc: 'משאבים ובדיקות בטיחות' },
  { title: 'רשות התאגידים — בדיקת חברה/עוסק', url: 'https://www.gov.il/he/departments/corporations_authority', desc: 'אימות פרטי חברה/עוסק מורשה' },
  { title: 'אתר העירייה / רשות מקומית', url: 'https://www.gov.il/he/departments/local_authorities', desc: 'קישור לרשויות מקומיות לבירורים ובדיקות' },
];

async function bgAllowed(reqUser) {
  if (reqUser.role === 'superadmin' || reqUser.role === 'admin') return true;
  if (reqUser.role !== 'committee') return false;
  const u = await q('SELECT bg_access FROM users WHERE id=?').get(reqUser.id);
  return !!(u && u.bg_access);
}

router.get('/bg-checks', authenticate, ah(async (req, res) => {
  const allowed = await bgAllowed(req.user);
  res.json({ allowed, links: allowed ? BG_LINKS : [] });
}));

router.put('/users/:id/bg-access', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  await q('UPDATE users SET bg_access=? WHERE id=?').run(req.body.allowed ? 1 : 0, req.params.id);
  res.json({ ok: true, id: Number(req.params.id), bg_access: req.body.allowed ? 1 : 0 });
}));

// ── Diagnostics (superadmin) — which integrations are configured ──
router.get('/diag', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  res.json({
    db: process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite',
    resend: !!process.env.RESEND_API_KEY,
    cloudinary: !!process.env.CLOUDINARY_URL,
    app_url: process.env.APP_URL || null,
  });
}));

// ── Tutorials (public) ─────────────────────────────────────
router.get('/tutorials', ah(async (req, res) => {
  res.json(await q('SELECT * FROM tutorials ORDER BY id DESC').all());
}));
router.post('/tutorials', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { title, url, description } = req.body;
  const r = await q('INSERT INTO tutorials (title,url,description) VALUES (?,?,?)').run(title, url||'', description||'');
  res.json(await q('SELECT * FROM tutorials WHERE id=?').get(r.lastInsertRowid));
}));
router.delete('/tutorials/:id', authenticate, ah(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  await q('DELETE FROM tutorials WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

module.exports = router;
