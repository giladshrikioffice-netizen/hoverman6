const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'hoverman6-secret-2026';

function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'נדרש אימייל וסיסמה' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });

  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });

  const token = jwt.sign(
    { id: user.id, role: user.role, unit_id: user.unit_id, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role, unit_id: user.unit_id } });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'נדרש אימות' });
  const token = header.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'טוקן לא תקין' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'הרשאות אדמין נדרשות' });
  next();
}

function requireAdminOrCommittee(req, res, next) {
  if (!['admin', 'committee'].includes(req.user.role))
    return res.status(403).json({ error: 'הרשאות ועד נדרשות' });
  next();
}

module.exports = { login, authenticate, requireAdmin, requireAdminOrCommittee };
