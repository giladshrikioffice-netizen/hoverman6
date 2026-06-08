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
  const { name, address, num_units, num_floors, budget, target_date } = req.body;
  q('UPDATE buildings SET name=?,address=?,num_units=?,num_floors=?,budget=?,target_date=? WHERE id=?').run(name, address, num_units, num_floors, budget, target_date, req.params.id);
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
