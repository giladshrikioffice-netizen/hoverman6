const express = require('express');
const { db, q } = require('./db');
const { authenticate, requireAdmin, requireAdminOrCommittee } = require('./auth');

const router = express.Router();

// ── Dashboard ──────────────────────────────────────────────
router.get('/dashboard', authenticate, (req, res) => {
  const budgetRow = q('SELECT SUM(planned_amount) as planned, SUM(paid_amount) as paid FROM budget_items').get();
  const paymentsRow = q('SELECT SUM(amount_due) as due, SUM(amount_paid) as paid FROM payments').get();
  const contractorsCount = q("SELECT COUNT(*) as c FROM contractors WHERE status='פעיל'").get();
  const openComplaints = q("SELECT COUNT(*) as c FROM complaints WHERE status='פתוח'").get();
  const lastUpdate = q('SELECT * FROM updates ORDER BY visit_date DESC LIMIT 1').get();

  res.json({
    budget: { planned: budgetRow.planned || 0, paid: budgetRow.paid || 0, total: 6000000 },
    payments: { due: paymentsRow.due || 0, paid: paymentsRow.paid || 0 },
    activeContractors: contractorsCount.c,
    openComplaints: openComplaints.c,
    lastUpdate,
    targetDate: 'אוקטובר 2026',
  });
});

// ── Contractors ────────────────────────────────────────────
router.get('/contractors', authenticate, (req, res) => {
  res.json(q('SELECT * FROM contractors ORDER BY id').all());
});

router.post('/contractors', authenticate, requireAdmin, (req, res) => {
  const { name, trade, phone, contract_amount, status } = req.body;
  const r = q('INSERT INTO contractors (name,trade,phone,contract_amount,status) VALUES (?,?,?,?,?)').run(name, trade, phone, contract_amount || 0, status || 'פעיל');
  res.json(q('SELECT * FROM contractors WHERE id=?').get(r.lastInsertRowid));
});

router.put('/contractors/:id', authenticate, requireAdmin, (req, res) => {
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
  const items = q('SELECT *, (planned_amount - paid_amount) as balance FROM budget_items ORDER BY id').all();
  const totals = q('SELECT SUM(planned_amount) as planned, SUM(paid_amount) as paid FROM budget_items').get();
  res.json({ items, totals: { ...totals, balance: (totals.planned || 0) - (totals.paid || 0), project_total: 6000000 } });
});

router.post('/budget', authenticate, requireAdminOrCommittee, (req, res) => {
  const { category, planned_amount, paid_amount } = req.body;
  const r = q('INSERT INTO budget_items (category,planned_amount,paid_amount) VALUES (?,?,?)').run(category, planned_amount || 0, paid_amount || 0);
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
const paymentSelect = `
  SELECT p.*, u.unit_number, u.owner_name,
    (p.amount_due - p.amount_paid) as balance,
    CASE WHEN p.amount_paid >= p.amount_due THEN 'שולם במלואו'
         WHEN p.amount_paid > 0 THEN 'שולם חלקית'
         ELSE 'לא שולם' END as status
  FROM payments p JOIN units u ON p.unit_id=u.id`;

router.get('/payments', authenticate, (req, res) => {
  if (req.user.role === 'resident') {
    if (!req.user.unit_id) return res.json([]);
    return res.json(q(paymentSelect + ' WHERE p.unit_id=?').all(req.user.unit_id));
  }
  res.json(q(paymentSelect + ' ORDER BY u.unit_number').all());
});

router.put('/payments/:id', authenticate, requireAdminOrCommittee, (req, res) => {
  const { amount_due, amount_paid, due_date, note } = req.body;
  q('UPDATE payments SET amount_due=?,amount_paid=?,due_date=?,note=? WHERE id=?').run(amount_due, amount_paid, due_date, note, req.params.id);
  res.json(q(paymentSelect + ' WHERE p.id=?').get(req.params.id));
});

// ── Units ──────────────────────────────────────────────────
router.get('/units', authenticate, requireAdminOrCommittee, (req, res) => {
  res.json(q('SELECT * FROM units ORDER BY unit_number').all());
});

// ── Decisions ─────────────────────────────────────────────
router.get('/decisions', authenticate, (req, res) => {
  res.json(q('SELECT * FROM decisions ORDER BY date DESC').all());
});

router.post('/decisions', authenticate, requireAdminOrCommittee, (req, res) => {
  const { date, topic, approved_by, status } = req.body;
  const r = q('INSERT INTO decisions (date,topic,approved_by,status) VALUES (?,?,?,?)').run(date, topic, approved_by, status || 'ממתין');
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
  res.json(q('SELECT * FROM updates ORDER BY visit_date DESC').all());
});

router.post('/updates', authenticate, requireAdminOrCommittee, (req, res) => {
  const { visit_date, summary, blockers, next_steps } = req.body;
  const r = q('INSERT INTO updates (visit_date,summary,blockers,next_steps,author) VALUES (?,?,?,?,?)').run(visit_date, summary, blockers, next_steps, req.user.full_name);
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
const complaintSelect = 'SELECT c.*, u.unit_number FROM complaints c JOIN units u ON c.unit_id=u.id';

router.get('/complaints', authenticate, (req, res) => {
  if (req.user.role === 'resident') {
    if (!req.user.unit_id) return res.json([]);
    return res.json(q(complaintSelect + ' WHERE c.unit_id=? ORDER BY c.created_at DESC').all(req.user.unit_id));
  }
  res.json(q(complaintSelect + ' ORDER BY c.created_at DESC').all());
});

router.post('/complaints', authenticate, (req, res) => {
  const { subject, body, unit_id } = req.body;
  const uid = req.user.role === 'resident' ? req.user.unit_id : unit_id;
  if (!uid) return res.status(400).json({ error: 'חסר מספר דירה' });
  const r = q('INSERT INTO complaints (unit_id,subject,body,status) VALUES (?,?,?,?)').run(uid, subject, body || '', 'פתוח');
  res.json(q(complaintSelect + ' WHERE c.id=?').get(r.lastInsertRowid));
});

router.put('/complaints/:id', authenticate, requireAdminOrCommittee, (req, res) => {
  const { status } = req.body;
  q('UPDATE complaints SET status=? WHERE id=?').run(status, req.params.id);
  res.json(q(complaintSelect + ' WHERE c.id=?').get(req.params.id));
});

router.delete('/complaints/:id', authenticate, requireAdmin, (req, res) => {
  q('DELETE FROM complaints WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
