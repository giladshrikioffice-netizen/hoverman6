const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { q } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'gspro-secret-2026';

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'נדרש אימייל וסיסמה' });
    const user = await q('SELECT * FROM users WHERE email=?').get(email.toLowerCase().trim());
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
    const areas = user.areas || 'both';
    const token = jwt.sign(
      { id: user.id, role: user.role, building_id: user.building_id, unit_id: user.unit_id, full_name: user.full_name, areas },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role, building_id: user.building_id, unit_id: user.unit_id, areas } });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'נדרש אימות' });
  try { req.user = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'טוקן לא תקין' }); }
}

function requireAdmin(req, res, next) {
  if (!['superadmin', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'הרשאות אדמין נדרשות' });
  next();
}

function requireAdminOrCommittee(req, res, next) {
  if (!['superadmin', 'admin', 'committee'].includes(req.user.role)) return res.status(403).json({ error: 'הרשאות ועד נדרשות' });
  next();
}

module.exports = { login, authenticate, requireAdmin, requireAdminOrCommittee };
