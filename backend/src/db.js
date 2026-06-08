const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'hoverman6.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_number INTEGER UNIQUE NOT NULL,
      floor INTEGER,
      owner_name TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      unit_id INTEGER REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS contractors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      trade TEXT,
      phone TEXT,
      contract_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'פעיל'
    );

    CREATE TABLE IF NOT EXISTS budget_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      planned_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL REFERENCES units(id),
      amount_due REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      due_date TEXT,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      topic TEXT NOT NULL,
      approved_by TEXT,
      status TEXT DEFAULT 'ממתין'
    );

    CREATE TABLE IF NOT EXISTS updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_date TEXT NOT NULL,
      summary TEXT,
      blockers TEXT,
      next_steps TEXT,
      author TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL REFERENCES units(id),
      subject TEXT NOT NULL,
      body TEXT,
      status TEXT DEFAULT 'פתוח',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  seed();
}

function q(sql) { return db.prepare(sql); }

function seed() {
  const count = q('SELECT COUNT(*) as c FROM users').get();
  if (count.c > 0) return;

  // Units 1-28
  for (let i = 1; i <= 28; i++) {
    q('INSERT OR IGNORE INTO units (unit_number, floor) VALUES (?, ?)').run(i, Math.ceil(i / 4));
  }

  // Users
  const users = [
    ['גלעד שריקי', 'gilad@hoverman6.co.il', bcrypt.hashSync('admin123', 10), 'admin', null],
    ['שירה כהן', 'shira@hoverman6.co.il', bcrypt.hashSync('123456', 10), 'committee', null],
    ['אהרון לוי', 'aharon@hoverman6.co.il', bcrypt.hashSync('123456', 10), 'committee', null],
    ['דייר לדוגמה', 'resident@hoverman6.co.il', bcrypt.hashSync('123456', 10), 'resident', 1],
  ];
  users.forEach(u => q('INSERT INTO users (full_name,email,password,role,unit_id) VALUES (?,?,?,?,?)').run(...u));

  // Contractors
  const contractors = [
    ['חמודי', 'קבלן ראשי', '055-9607730', 2500000, 'פעיל'],
    ['איתי', 'תריסים', '050-6804722', 180000, 'פעיל'],
    ['שלום פלד', 'מעקות', '052-2727459', 320000, 'פעיל'],
    ['ויקטור פלד', 'התקנת מעקות', '054-6378636', 150000, 'פעיל'],
    ['חמודי אלומיניום', 'אלומיניום', '053-4727248', 420000, 'פעיל'],
    ['אייל', 'מיזוג', '050-4050634', 95000, 'פעיל'],
    ['אלעד', 'אינסטלציה', '050-8861398', 210000, 'פעיל'],
    ['א. דנן', 'בטיחות אש', '04-6918200', 85000, 'פעיל'],
    ['ב.מ', 'משאבות', '03-6249541', 140000, 'פעיל'],
  ];
  contractors.forEach(c => q('INSERT INTO contractors (name,trade,phone,contract_amount,status) VALUES (?,?,?,?,?)').run(...c));

  // Budget
  const budget = [
    ['קבלן ראשי', 2500000, 800000],
    ['תריסים', 180000, 180000],
    ['מעקות', 470000, 200000],
    ['אלומיניום', 420000, 100000],
    ['מיזוג', 95000, 0],
    ['אינסטלציה', 210000, 50000],
    ['בטיחות אש', 85000, 85000],
    ['משאבות', 140000, 0],
    ['פיקוח ובלת"מ', 900000, 150000],
  ];
  budget.forEach(b => q('INSERT INTO budget_items (category,planned_amount,paid_amount) VALUES (?,?,?)').run(...b));

  // Payments for 28 units
  const units = q('SELECT id FROM units ORDER BY unit_number').all();
  units.forEach((u, i) => {
    const paid = i % 3 === 0 ? 15000 : i % 3 === 1 ? 7500 : 0;
    q('INSERT INTO payments (unit_id,amount_due,amount_paid,due_date) VALUES (?,?,?,?)').run(u.id, 15000, paid, '2026-03-01');
  });

  // Decisions
  q('INSERT INTO decisions (date,topic,approved_by,status) VALUES (?,?,?,?)').run('2026-01-15', 'אישור קבלן ראשי – חמודי', 'שירה כהן', 'מאושר');
  q('INSERT INTO decisions (date,topic,approved_by,status) VALUES (?,?,?,?)').run('2026-02-10', 'אישור ספק תריסים', 'אהרון לוי', 'מאושר');
  q('INSERT INTO decisions (date,topic,approved_by,status) VALUES (?,?,?,?)').run('2026-03-05', 'שינוי מפרט מעקות', 'שירה כהן', 'מאושר');

  // Update
  q('INSERT INTO updates (visit_date,summary,blockers,next_steps,author) VALUES (?,?,?,?,?)').run(
    '2026-06-01',
    'הושלמה יציקת גגות קומה 6. התקנת שלד מרפסות בעיצומה.',
    'עיכוב באספקת ברזל – צפוי להסתדר עד 15 ביוני.',
    'המשך התקנת שלד קומות 5–6, תיאום עם ספק האלומיניום.',
    'גלעד שריקי'
  );

  console.log('✅ Seed data inserted');
}

module.exports = { db, init, q };
