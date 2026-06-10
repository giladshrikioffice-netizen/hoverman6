const express = require('express');
const { q, addDays } = require('./db');
const { authenticate, requireAdmin, requireAdminOrCommittee, requireBuilding } = require('./auth');

const router = express.Router();

// ── Buildings (superadmin) ─────────────────────────────────
router.get('/buildings', authenticate, (req, res) => {
  if (req.user.role === 'superadmin') return res.json(q('SELECT * FROM buildings ORDER BY id').all());
  const b = q('SELECT * FROM buildings WHERE id=?').get(req.user.building_id);
  res.json(b ? [b] : []);
});

router.post('/buildings', authenticate, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { name, address, num_units, num_floors, budget, target_date } = req.body;
  const r = q('INSERT INTO buildings (name,address,num_units,num_floors,budget,target_date) VALUES (?,?,?,?,?,?)').run(name, address, num_units || 0, num_floors || 0, budget || 0, target_date);
  const bid = r.lastInsertRowid;
  // Auto-create units
  const n = parseInt(num_units) || 0;
  for (let i = 1; i <= n; i++) {
    q('INSERT INTO units (building_id,unit_number,floor) VALUES (?,?,?)').run(bid, i, Math.ceil(i / 4));
  }
  res.json(q('SELECT * FROM buildings WHERE id=?').get(bid));
});

router.put('/buildings/:id', authenticate, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { name, address, num_units, num_floors, budget, target_date, type } = req.body;
  q('UPDATE buildings SET name=?,address=?,num_units=?,num_floors=?,budget=?,target_date=?,type=? WHERE id=?').run(name, address, num_units, num_floors, budget, target_date, type||'supervision', req.params.id);
  res.json(q('SELECT * FROM buildings WHERE id=?').get(req.params.id));
});

router.delete('/buildings/:id', authenticate, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  q('DELETE FROM buildings WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Helper: get building_id from request (superadmin can pass ?building_id=X)
function getBid(req) {
  if (req.user.role === 'superadmin') return parseInt(req.query.building_id || req.body.building_id || 0);
  return req.user.building_id;
}

// ── Dashboard ──────────────────────────────────────────────
router.get('/dashboard', authenticate, (req, res) => {
  const bid = getBid(req);
  if (!bid) return res.status(400).json({ error: 'חסר building_id' });
  const building = q('SELECT * FROM buildings WHERE id=?').get(bid);
  const budgetRow = q('SELECT SUM(planned_amount) as planned, SUM(paid_amount) as paid FROM budget_items WHERE building_id=?').get(bid);
  const paymentsRow = q('SELECT SUM(amount_due) as due, SUM(amount_paid) as paid FROM payments WHERE building_id=?').get(bid);
  const contractorsCount = q("SELECT COUNT(*) as c FROM contractors WHERE building_id=? AND status='פעיל'").get(bid);
  const openComplaints = q("SELECT COUNT(*) as c FROM complaints WHERE building_id=? AND status='פתוח'").get(bid);
  const lastUpdate = q('SELECT * FROM updates WHERE building_id=? ORDER BY visit_date DESC LIMIT 1').get(bid);
  const today = new Date().toISOString().slice(0, 10);
  const alertCount = q("SELECT COUNT(*) as c FROM maintenance_items WHERE building_id=? AND next_check <= date(?,'+14 days')").get(bid, today);

  res.json({
    building,
    budget: { planned: budgetRow.planned || 0, paid: budgetRow.paid || 0, total: building?.budget || 0 },
    payments: { due: paymentsRow.due || 0, paid: paymentsRow.paid || 0 },
    activeContractors: contractorsCount.c,
    openComplaints: openComplaints.c,
    maintenanceAlerts: alertCount.c,
    lastUpdate,
  });
});

// ── Contractors ────────────────────────────────────────────
router.get('/contractors', authenticate, (req, res) => {
  const bid = getBid(req);
  res.json(q('SELECT * FROM contractors WHERE building_id=? ORDER BY id').all(bid));
});
router.post('/contractors', authenticate, requireAdminOrCommittee, (req, res) => {
  const bid = getBid(req);
  const { name, trade, phone, contract_amount, status } = req.body;
  const r = q('INSERT INTO contractors (building_id,name,trade,phone,contract_amount,status) VALUES (?,?,?,?,?,?)').run(bid, name, trade, phone, contract_amount || 0, status || 'פעיל');
  res.json(q('SELECT * FROM contractors WHERE id=?').get(r.lastInsertRowid));
});
router.put('/contractors/:id', authenticate, requireAdminOrCommittee, (req, res) => {
  const { name, trade, phone, contract_amount, status } = req.body;
  q('UPDATE contractors SET name=?,trade=?,phone=?,contract_amount=?,status=? WHERE id=?').run(name, trade, phone, contract_amount, status, req.params.id);
  res.json(q('SELECT * FROM contractors WHERE id=?').get(req.params.id));
});
router.delete('/contractors/:id', authenticate, requireAdmin, (req, res) => {
  q('DELETE FROM contractors WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Budget ─────────────────────────────────────────────────
router.get('/budget', authenticate, (req, res) => {
  const bid = getBid(req);
  const building = q('SELECT budget FROM buildings WHERE id=?').get(bid);
  const items = q('SELECT *, (planned_amount-paid_amount) as balance FROM budget_items WHERE building_id=? ORDER BY id').all(bid);
  const totals = q('SELECT SUM(planned_amount) as planned, SUM(paid_amount) as paid FROM budget_items WHERE building_id=?').get(bid);
  res.json({ items, totals: { ...totals, balance: (totals.planned||0)-(totals.paid||0), project_total: building?.budget||0 } });
});
router.post('/budget', authenticate, requireAdminOrCommittee, (req, res) => {
  const bid = getBid(req);
  const { category, planned_amount, paid_amount } = req.body;
  const r = q('INSERT INTO budget_items (building_id,category,planned_amount,paid_amount) VALUES (?,?,?,?)').run(bid, category, planned_amount||0, paid_amount||0);
  res.json(q('SELECT * FROM budget_items WHERE id=?').get(r.lastInsertRowid));
});
router.put('/budget/:id', authenticate, requireAdminOrCommittee, (req, res) => {
  const { category, planned_amount, paid_amount } = req.body;
  q('UPDATE budget_items SET category=?,planned_amount=?,paid_amount=? WHERE id=?').run(category, planned_amount, paid_amount, req.params.id);
  res.json(q('SELECT * FROM budget_items WHERE id=?').get(req.params.id));
});
router.delete('/budget/:id', authenticate, requireAdmin, (req, res) => {
  q('DELETE FROM budget_items WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Payments ───────────────────────────────────────────────
const paymentSelect = `SELECT p.*, u.unit_number, u.owner_name,
  (p.amount_due-p.amount_paid) as balance,
  CASE WHEN p.amount_paid>=p.amount_due THEN 'שולם במלואו'
       WHEN p.amount_paid>0 THEN 'שולם חלקית'
       ELSE 'לא שולם' END as status
  FROM payments p JOIN units u ON p.unit_id=u.id`;

router.get('/payments', authenticate, (req, res) => {
  const bid = getBid(req);
  if (req.user.role === 'resident') {
    if (!req.user.unit_id) return res.json([]);
    return res.json(q(paymentSelect + ' WHERE p.unit_id=? AND p.building_id=?').all(req.user.unit_id, bid));
  }
  res.json(q(paymentSelect + ' WHERE p.building_id=? ORDER BY u.unit_number').all(bid));
});
router.put('/payments/:id', authenticate, requireAdminOrCommittee, (req, res) => {
  const { amount_due, amount_paid, due_date, note } = req.body;
  q('UPDATE payments SET amount_due=?,amount_paid=?,due_date=?,note=? WHERE id=?').run(amount_due, amount_paid, due_date, note, req.params.id);
  res.json(q(paymentSelect + ' WHERE p.id=?').get(req.params.id));
});

// ── Units ──────────────────────────────────────────────────
router.get('/units', authenticate, (req, res) => {
  const bid = getBid(req);
  res.json(q('SELECT * FROM units WHERE building_id=? ORDER BY unit_number').all(bid));
});
router.put('/units/:id', authenticate, requireAdminOrCommittee, (req, res) => {
  const { owner_name } = req.body;
  q('UPDATE units SET owner_name=? WHERE id=?').run(owner_name, req.params.id);
  res.json(q('SELECT * FROM units WHERE id=?').get(req.params.id));
});

// ── Decisions ─────────────────────────────────────────────
router.get('/decisions', authenticate, (req, res) => {
  const bid = getBid(req);
  res.json(q('SELECT * FROM decisions WHERE building_id=? ORDER BY date DESC').all(bid));
});
router.post('/decisions', authenticate, requireAdminOrCommittee, (req, res) => {
  const bid = getBid(req);
  const { date, topic, approved_by, status } = req.body;
  const r = q('INSERT INTO decisions (building_id,date,topic,approved_by,status) VALUES (?,?,?,?,?)').run(bid, date, topic, approved_by, status||'ממתין');
  res.json(q('SELECT * FROM decisions WHERE id=?').get(r.lastInsertRowid));
});
router.put('/decisions/:id', authenticate, requireAdminOrCommittee, (req, res) => {
  const { date, topic, approved_by, status } = req.body;
  q('UPDATE decisions SET date=?,topic=?,approved_by=?,status=? WHERE id=?').run(date, topic, approved_by, status, req.params.id);
  res.json(q('SELECT * FROM decisions WHERE id=?').get(req.params.id));
});
router.delete('/decisions/:id', authenticate, requireAdmin, (req, res) => {
  q('DELETE FROM decisions WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Updates ────────────────────────────────────────────────
router.get('/updates', authenticate, (req, res) => {
  const bid = getBid(req);
  res.json(q('SELECT * FROM updates WHERE building_id=? ORDER BY visit_date DESC').all(bid));
});
router.post('/updates', authenticate, requireAdminOrCommittee, (req, res) => {
  const bid = getBid(req);
  const { visit_date, summary, blockers, next_steps } = req.body;
  const r = q('INSERT INTO updates (building_id,visit_date,summary,blockers,next_steps,author) VALUES (?,?,?,?,?,?)').run(bid, visit_date, summary, blockers, next_steps, req.user.full_name);
  res.json(q('SELECT * FROM updates WHERE id=?').get(r.lastInsertRowid));
});
router.put('/updates/:id', authenticate, requireAdminOrCommittee, (req, res) => {
  const { visit_date, summary, blockers, next_steps } = req.body;
  q('UPDATE updates SET visit_date=?,summary=?,blockers=?,next_steps=? WHERE id=?').run(visit_date, summary, blockers, next_steps, req.params.id);
  res.json(q('SELECT * FROM updates WHERE id=?').get(req.params.id));
});
router.delete('/updates/:id', authenticate, requireAdmin, (req, res) => {
  q('DELETE FROM updates WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Complaints ─────────────────────────────────────────────
const cSelect = 'SELECT c.*, u.unit_number FROM complaints c JOIN units u ON c.unit_id=u.id';
router.get('/complaints', authenticate, (req, res) => {
  const bid = getBid(req);
  if (req.user.role === 'resident') {
    if (!req.user.unit_id) return res.json([]);
    return res.json(q(cSelect + ' WHERE c.unit_id=? AND c.building_id=? ORDER BY c.created_at DESC').all(req.user.unit_id, bid));
  }
  res.json(q(cSelect + ' WHERE c.building_id=? ORDER BY c.created_at DESC').all(bid));
});
router.post('/complaints', authenticate, (req, res) => {
  const bid = getBid(req);
  const { subject, body, unit_id } = req.body;
  const uid = req.user.role === 'resident' ? req.user.unit_id : unit_id;
  if (!uid) return res.status(400).json({ error: 'חסר מספר דירה' });
  const r = q('INSERT INTO complaints (unit_id,building_id,subject,body,status) VALUES (?,?,?,?,?)').run(uid, bid, subject, body||'', 'פתוח');
  res.json(q(cSelect + ' WHERE c.id=?').get(r.lastInsertRowid));
});
router.put('/complaints/:id', authenticate, requireAdminOrCommittee, (req, res) => {
  const { status } = req.body;
  q('UPDATE complaints SET status=? WHERE id=?').run(status, req.params.id);
  res.json(q(cSelect + ' WHERE c.id=?').get(req.params.id));
});
router.delete('/complaints/:id', authenticate, requireAdmin, (req, res) => {
  q('DELETE FROM complaints WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Maintenance ────────────────────────────────────────────
router.get('/maintenance', authenticate, (req, res) => {
  const bid = getBid(req);
  const today = new Date().toISOString().slice(0, 10);
  const items = q(`SELECT m.*, p.name as professional_name FROM maintenance_items m
    LEFT JOIN professionals p ON m.professional_id=p.id
    WHERE m.building_id=? ORDER BY m.next_check ASC`).all(bid);
  // Mark alert flag
  const result = items.map(item => ({
    ...item,
    alert: item.next_check && item.next_check <= addDays(today, 14)
  }));
  res.json(result);
});

router.post('/maintenance', authenticate, requireAdminOrCommittee, (req, res) => {
  const bid = getBid(req);
  const { name, frequency_days, last_check, status, professional_id, notes } = req.body;
  const next = addDays(last_check, parseInt(frequency_days) || 365);
  const r = q('INSERT INTO maintenance_items (building_id,name,frequency_days,last_check,next_check,status,professional_id,notes) VALUES (?,?,?,?,?,?,?,?)').run(bid, name, frequency_days||365, last_check||null, next, status||'תקין', professional_id||null, notes||'');
  res.json(q('SELECT * FROM maintenance_items WHERE id=?').get(r.lastInsertRowid));
});

router.put('/maintenance/:id', authenticate, requireAdminOrCommittee, (req, res) => {
  const { name, frequency_days, last_check, status, professional_id, notes } = req.body;
  const next = addDays(last_check, parseInt(frequency_days) || 365);
  q('UPDATE maintenance_items SET name=?,frequency_days=?,last_check=?,next_check=?,status=?,professional_id=?,notes=? WHERE id=?').run(name, frequency_days, last_check, next, status, professional_id||null, notes, req.params.id);
  res.json(q('SELECT * FROM maintenance_items WHERE id=?').get(req.params.id));
});

router.delete('/maintenance/:id', authenticate, requireAdmin, (req, res) => {
  q('DELETE FROM maintenance_items WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Professionals ──────────────────────────────────────────
router.get('/professionals', authenticate, (req, res) => {
  const bid = getBid(req);
  res.json(q('SELECT * FROM professionals WHERE building_id=? ORDER BY rating DESC, name').all(bid));
});
router.post('/professionals', authenticate, requireAdminOrCommittee, (req, res) => {
  const bid = getBid(req);
  const { name, trade, phone, rating, review, last_cost, last_service_date } = req.body;
  const r = q('INSERT INTO professionals (building_id,name,trade,phone,rating,review,last_cost,last_service_date) VALUES (?,?,?,?,?,?,?,?)').run(bid, name, trade, phone, rating||0, review||'', last_cost||null, last_service_date||null);
  res.json(q('SELECT * FROM professionals WHERE id=?').get(r.lastInsertRowid));
});
router.put('/professionals/:id', authenticate, requireAdminOrCommittee, (req, res) => {
  const { name, trade, phone, rating, review, last_cost, last_service_date } = req.body;
  q('UPDATE professionals SET name=?,trade=?,phone=?,rating=?,review=?,last_cost=?,last_service_date=? WHERE id=?').run(name, trade, phone, rating, review, last_cost, last_service_date, req.params.id);
  res.json(q('SELECT * FROM professionals WHERE id=?').get(req.params.id));
});
router.delete('/professionals/:id', authenticate, requireAdmin, (req, res) => {
  q('DELETE FROM professionals WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Unit Permissions ──────────────────────────────────────
const DEFAULT_MODULES = ['payments','complaints','updates','decisions','maintenance','professionals','tutorials'];

// Get permissions for a unit (committee sees all units, resident sees own)
router.get('/permissions/:unit_id', authenticate, (req, res) => {
  const uid = parseInt(req.params.unit_id);
  // Residents can only query their own unit
  if (req.user.role === 'resident' && req.user.unit_id !== uid)
    return res.status(403).json({ error: 'גישה נדחתה' });
  const perms = q('SELECT module, enabled FROM unit_permissions WHERE unit_id=?').all(uid);
  // Fill in defaults for any missing modules
  const result = {};
  DEFAULT_MODULES.forEach(mod => { result[mod] = 1; }); // default: all enabled
  perms.forEach(p => { result[p.module] = p.enabled; });
  res.json(result);
});

// Get all permissions for building (committee use)
router.get('/permissions', authenticate, requireAdminOrCommittee, (req, res) => {
  const bid = getBid(req);
  const units = q('SELECT u.id, u.unit_number, u.owner_name FROM units u WHERE u.building_id=? ORDER BY u.unit_number').all(bid);
  const perms = q('SELECT unit_id, module, enabled FROM unit_permissions WHERE building_id=?').all(bid);
  const permMap = {};
  perms.forEach(p => {
    if (!permMap[p.unit_id]) permMap[p.unit_id] = {};
    permMap[p.unit_id][p.module] = p.enabled;
  });
  // Also join resident name if there's a resident user for this unit
  const residents = q("SELECT unit_id, full_name FROM users WHERE building_id=? AND role='resident'").all(bid);
  const residentMap = {};
  residents.forEach(r => { residentMap[r.unit_id] = r.full_name; });
  res.json(units.map(u => ({
    unit_id: u.id,
    unit_number: u.unit_number,
    resident_name: residentMap[u.id] || u.owner_name || null,
    perms: Object.fromEntries(DEFAULT_MODULES.map(mod => [mod, permMap[u.id]?.[mod] ?? 1]))
  })));
});

// Update permission for a unit+module
router.put('/permissions/:unit_id/:module', authenticate, requireAdminOrCommittee, (req, res) => {
  const uid = parseInt(req.params.unit_id);
  const mod = req.params.module;
  const { enabled } = req.body;
  const bid = getBid(req);
  q('INSERT INTO unit_permissions (unit_id,building_id,module,enabled) VALUES (?,?,?,?) ON CONFLICT(unit_id,module) DO UPDATE SET enabled=excluded.enabled')
    .run(uid, bid, mod, enabled ? 1 : 0);
  res.json({ ok: true, unit_id: uid, module: mod, enabled: enabled ? 1 : 0 });
});

// ── Users Management (superadmin) ─────────────────────────
const bcrypt = require('bcryptjs');

router.get('/users', authenticate, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const users = q('SELECT id,full_name,email,role,building_id,unit_id FROM users ORDER BY building_id,role,full_name').all();
  res.json(users);
});

router.post('/users', authenticate, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { full_name, email, password, role, building_id, unit_id } = req.body;
  if (!full_name || !email || !password || !role) return res.status(400).json({ error: 'חסרים שדות חובה' });
  const existing = q('SELECT id FROM users WHERE email=?').get(email.toLowerCase().trim());
  if (existing) return res.status(400).json({ error: 'אימייל כבר קיים' });
  const hashed = bcrypt.hashSync(password, 10);
  const r = q('INSERT INTO users (full_name,email,password,role,building_id,unit_id) VALUES (?,?,?,?,?,?)')
    .run(full_name, email.toLowerCase().trim(), hashed, role, building_id || null, unit_id || null);
  res.json(q('SELECT id,full_name,email,role,building_id,unit_id FROM users WHERE id=?').get(r.lastInsertRowid));
});

router.put('/users/:id/password', authenticate, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { password } = req.body;
  if (!password || password.length < 4) return res.status(400).json({ error: 'סיסמה חייבת להיות לפחות 4 תווים' });
  const hashed = bcrypt.hashSync(password, 10);
  q('UPDATE users SET password=? WHERE id=?').run(hashed, req.params.id);
  res.json({ ok: true });
});

router.put('/users/:id', authenticate, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { full_name, email, building_id, unit_id, role } = req.body;
  if (!full_name || !email) return res.status(400).json({ error: 'שם ואימייל הם חובה' });
  // check email not taken by someone else
  const existing = q('SELECT id FROM users WHERE email=? AND id!=?').get(email.toLowerCase().trim(), req.params.id);
  if (existing) return res.status(400).json({ error: 'אימייל כבר קיים אצל משתמש אחר' });
  q('UPDATE users SET full_name=?,email=?,building_id=?,unit_id=?,role=? WHERE id=?')
    .run(full_name, email.toLowerCase().trim(), building_id || null, unit_id || null, role, req.params.id);
  res.json(q('SELECT id,full_name,email,role,building_id,unit_id FROM users WHERE id=?').get(req.params.id));
});

router.delete('/users/:id', authenticate, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'לא ניתן למחוק את עצמך' });
  q('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Change own password (all authenticated users) ──────────
router.put('/auth/change-password', authenticate, (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.status(400).json({ error: 'חסרים שדות' });
  if (new_password.length < 4) return res.status(400).json({ error: 'סיסמה חייבת להיות לפחות 4 תווים' });
  const user = q('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(old_password, user.password)) return res.status(400).json({ error: 'הסיסמה הנוכחית שגויה' });
  q('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(new_password, 10), req.user.id);
  res.json({ ok: true });
});

// ── Invite resident by email ───────────────────────────────
router.post('/invite', authenticate, async (req, res) => {
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

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'GS.pro <onboarding@resend.dev>',
        to: [to_email],
        subject: `הזמנה למערכת GS.pro — ${building_name || 'הבניין שלך'}`,
        html,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'שגיאה בשליחה');
    res.json({ ok: true, id: data.id });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Feedback ──────────────────────────────────────────────
router.post('/feedback', (req, res) => {
  const { category, message, contact } = req.body;
  if (!message) return res.status(400).json({ error: 'חסרה הודעה' });
  // שמור ב-DB (טבלת feedback) אם קיימת, אחרת log
  try {
    q('INSERT OR IGNORE INTO feedback (category,message,contact,created_at) VALUES (?,?,?,datetime("now"))')
      .run(category || 'other', message, contact || '');
  } catch { /* טבלה לא קיימת עדיין */ }
  console.log(`💬 Feedback [${category}]: ${message.substring(0, 80)}`);
  res.json({ ok: true });
});

router.get('/feedback', (req, res) => {
  if (req.user?.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  try {
    res.json(q('SELECT * FROM feedback ORDER BY created_at DESC').all());
  } catch { res.json([]); }
});

// ── Tutorials (public) ─────────────────────────────────────
router.get('/tutorials', (req, res) => {
  res.json(q('SELECT * FROM tutorials ORDER BY id DESC').all());
});
router.post('/tutorials', authenticate, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  const { title, url, description } = req.body;
  const r = q('INSERT INTO tutorials (title,url,description) VALUES (?,?,?)').run(title, url||'', description||'');
  res.json(q('SELECT * FROM tutorials WHERE id=?').get(r.lastInsertRowid));
});
router.delete('/tutorials/:id', authenticate, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'אדמין בלבד' });
  q('DELETE FROM tutorials WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
