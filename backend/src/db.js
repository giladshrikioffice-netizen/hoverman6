const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'gspro.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

function q(sql) { return db.prepare(sql); }

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      num_units INTEGER DEFAULT 0,
      num_floors INTEGER DEFAULT 0,
      budget REAL DEFAULT 0,
      target_date TEXT,
      type TEXT DEFAULT 'supervision',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS unit_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL REFERENCES units(id),
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      module TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      UNIQUE(unit_id, module)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      building_id INTEGER REFERENCES buildings(id),
      unit_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      unit_number INTEGER NOT NULL,
      floor INTEGER,
      owner_name TEXT
    );

    CREATE TABLE IF NOT EXISTS contractors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      name TEXT NOT NULL,
      trade TEXT,
      phone TEXT,
      contract_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'פעיל'
    );

    CREATE TABLE IF NOT EXISTS budget_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      category TEXT NOT NULL,
      planned_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL REFERENCES units(id),
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      amount_due REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      due_date TEXT,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      date TEXT NOT NULL,
      topic TEXT NOT NULL,
      approved_by TEXT,
      status TEXT DEFAULT 'ממתין'
    );

    CREATE TABLE IF NOT EXISTS updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL REFERENCES buildings(id),
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
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      subject TEXT NOT NULL,
      body TEXT,
      status TEXT DEFAULT 'פתוח',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS professionals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      name TEXT NOT NULL,
      trade TEXT,
      phone TEXT,
      rating INTEGER DEFAULT 0,
      review TEXT,
      last_cost REAL,
      last_service_date TEXT
    );

    CREATE TABLE IF NOT EXISTS maintenance_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      name TEXT NOT NULL,
      frequency_days INTEGER DEFAULT 365,
      last_check TEXT,
      next_check TEXT,
      status TEXT DEFAULT 'תקין',
      professional_id INTEGER REFERENCES professionals(id),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS tutorials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT DEFAULT 'other',
      message TEXT NOT NULL,
      contact TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER REFERENCES buildings(id),
      name TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'general',
      file_data TEXT,
      file_type TEXT,
      file_name TEXT,
      file_size INTEGER DEFAULT 0,
      visibility TEXT DEFAULT 'committee',
      uploaded_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doc_checklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER REFERENCES buildings(id),
      item_key TEXT NOT NULL,
      status TEXT DEFAULT 'missing',
      note TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(building_id, item_key)
    );
  `);

  // Add photo column to complaints if not exists
  try { db.exec(`ALTER TABLE complaints ADD COLUMN photo TEXT`); } catch {}
  // Add email column to professionals if not exists
  try { db.exec(`ALTER TABLE professionals ADD COLUMN email TEXT`); } catch {}
  // Add visibility to documents if not exists (migration safety)
  try { db.exec(`ALTER TABLE documents ADD COLUMN visibility TEXT DEFAULT 'committee'`); } catch {}

  // Key/value meta table for one-time migration flags
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);

  seed();
}

// Run a migration only once, guarded by a flag in the meta table.
function runOnce(key, fn) {
  const done = q('SELECT value FROM meta WHERE key=?').get(key);
  if (done) return;
  fn();
  q('INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)').run(key, new Date().toISOString());
  console.log(`✅ Migration applied: ${key}`);
}

function addDays(dateStr, days) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function seed() {
  const count = q('SELECT COUNT(*) as c FROM users').get();

  // ONE-TIME fix: correct names + reset credentials for the 3 key users.
  // Runs only once (guarded by meta flag) so user-changed passwords are NOT clobbered on every restart.
  runOnce('fix_real_credentials_v1', () => {
    const existingAdmin = q("SELECT id FROM users WHERE role='superadmin' LIMIT 1").get();
    if (existingAdmin) {
      q("UPDATE users SET full_name=?,email=?,password=? WHERE id=?").run(
        'גלעד שריקי', 'giladshrikioffice@gmail.com', bcrypt.hashSync('gs4798', 10), existingAdmin.id
      );
    }
    const existingShira = q("SELECT id FROM users WHERE email LIKE '%shira%' AND role='committee' LIMIT 1").get();
    if (existingShira) {
      q("UPDATE users SET full_name=?,email=?,password=? WHERE id=?").run(
        'שירה אילן', 'shirailan10@gmail.com', bcrypt.hashSync('0522929529', 10), existingShira.id
      );
    }
    const existingAharon = q("SELECT id FROM users WHERE role='committee' AND id!=? LIMIT 1").get(existingShira?.id || 0);
    if (existingAharon) {
      q("UPDATE users SET full_name=?,email=?,password=? WHERE id=?").run(
        'אהרון שם טוב', 'ashemtov280860@gmail.com', bcrypt.hashSync('0584766555', 10), existingAharon.id
      );
    }
    // Fix fake names in decisions table
    q("UPDATE decisions SET approved_by='שירה אילן' WHERE approved_by='שירה כהן'").run();
    q("UPDATE decisions SET approved_by='אהרון שם טוב' WHERE approved_by='אהרון לוי'").run();
  });

  if (count.c > 0) return;

  // Super admin
  q('INSERT INTO users (full_name,email,password,role,building_id,unit_id) VALUES (?,?,?,?,?,?)').run(
    'גלעד שריקי', 'giladshrikioffice@gmail.com', bcrypt.hashSync('gs4798', 10), 'superadmin', null, null
  );

  // Building: הוברמן 6 (supervision)
  const b1 = q('INSERT INTO buildings (name,address,num_units,num_floors,budget,target_date,type) VALUES (?,?,?,?,?,?,?)').run(
    'הוברמן 6', 'רחוב הוברמן 6, פתח תקווה', 28, 7, 6000000, '2026-10-01', 'supervision'
  );
  const bid = b1.lastInsertRowid;

  // Units
  for (let i = 1; i <= 28; i++) {
    q('INSERT INTO units (building_id,unit_number,floor) VALUES (?,?,?)').run(bid, i, Math.ceil(i / 4));
  }

  // Committee users
  q('INSERT INTO users (full_name,email,password,role,building_id) VALUES (?,?,?,?,?)').run('שירה אילן','shirailan10@gmail.com',bcrypt.hashSync('0522929529',10),'committee',bid);
  q('INSERT INTO users (full_name,email,password,role,building_id) VALUES (?,?,?,?,?)').run('אהרון שם טוב','ashemtov280860@gmail.com',bcrypt.hashSync('0584766555',10),'committee',bid);

  // Resident
  const unit1 = q('SELECT id FROM units WHERE building_id=? AND unit_number=1').get(bid);
  q('INSERT INTO users (full_name,email,password,role,building_id,unit_id) VALUES (?,?,?,?,?,?)').run('דייר לדוגמה','resident@hoverman6.co.il',bcrypt.hashSync('123456',10),'resident',bid,unit1.id);

  // Contractors
  const contractors = [
    ['חמודי','קבלן ראשי','055-9607730',2500000,'פעיל'],
    ['איתי','תריסים','050-6804722',180000,'פעיל'],
    ['שלום פלד','מעקות','052-2727459',320000,'פעיל'],
    ['ויקטור פלד','התקנת מעקות','054-6378636',150000,'פעיל'],
    ['חמודי אלומיניום','אלומיניום','053-4727248',420000,'פעיל'],
    ['אייל','מיזוג','050-4050634',95000,'פעיל'],
    ['אלעד','אינסטלציה','050-8861398',210000,'פעיל'],
    ['א. דנן','בטיחות אש','04-6918200',85000,'פעיל'],
    ['ב.מ','משאבות','03-6249541',140000,'פעיל'],
  ];
  contractors.forEach(c => q('INSERT INTO contractors (building_id,name,trade,phone,contract_amount,status) VALUES (?,?,?,?,?,?)').run(bid,...c));

  // Budget
  const budget = [
    ['קבלן ראשי',2500000,800000],['תריסים',180000,180000],['מעקות',470000,200000],
    ['אלומיניום',420000,100000],['מיזוג',95000,0],['אינסטלציה',210000,50000],
    ['בטיחות אש',85000,85000],['משאבות',140000,0],['פיקוח ובלת"מ',900000,150000],
  ];
  budget.forEach(b => q('INSERT INTO budget_items (building_id,category,planned_amount,paid_amount) VALUES (?,?,?,?)').run(bid,...b));

  // Payments
  const units = q('SELECT id FROM units WHERE building_id=? ORDER BY unit_number').all(bid);
  units.forEach((u, i) => {
    const paid = i % 3 === 0 ? 15000 : i % 3 === 1 ? 7500 : 0;
    q('INSERT INTO payments (unit_id,building_id,amount_due,amount_paid,due_date) VALUES (?,?,?,?,?)').run(u.id,bid,15000,paid,'2026-03-01');
  });

  // Decisions
  q('INSERT INTO decisions (building_id,date,topic,approved_by,status) VALUES (?,?,?,?,?)').run(bid,'2026-01-15','אישור קבלן ראשי – חמודי','שירה אילן','מאושר');
  q('INSERT INTO decisions (building_id,date,topic,approved_by,status) VALUES (?,?,?,?,?)').run(bid,'2026-02-10','אישור ספק תריסים','אהרון שם טוב','מאושר');

  // Update
  q('INSERT INTO updates (building_id,visit_date,summary,blockers,next_steps,author) VALUES (?,?,?,?,?,?)').run(
    bid,'2026-06-01','הושלמה יציקת גגות קומה 6. התקנת שלד מרפסות בעיצומה.',
    'עיכוב באספקת ברזל – צפוי להסתדר עד 15 ביוני.',
    'המשך התקנת שלד קומות 5–6, תיאום עם ספק האלומיניום.','גלעד שריקי'
  );

  // Maintenance items
  const maintenance = [
    ['מעלית', 180, '2026-01-10', 'תקין'],
    ['גנרטור חירום', 365, '2025-12-01', 'תקין'],
    ['משאבות מים/ביוב', 180, '2026-03-15', 'תקין'],
    ['מערכת כיבוי אש ומטפים', 365, '2025-11-20', 'נדרש טיפול'],
    ['ביטוח מבנה משותף', 365, '2026-01-01', 'תקין'],
    ['מאגר מים', 365, '2025-10-01', 'תקין'],
    ['לוחות חשמל משותפים', 365, '2025-09-15', 'תקין'],
    ['דלתות/שערים ואינטרקום', 365, '2026-02-01', 'תקין'],
    ['גינון', 30, '2026-06-01', 'תקין'],
    ['ניקיון', 30, '2026-06-05', 'תקין'],
  ];
  maintenance.forEach(([name, freq, last, status]) => {
    const next = addDays(last, freq);
    q('INSERT INTO maintenance_items (building_id,name,frequency_days,last_check,next_check,status) VALUES (?,?,?,?,?,?)').run(bid,name,freq,last,next,status);
  });

  // Sample professional
  q('INSERT INTO professionals (building_id,name,trade,phone,rating,review) VALUES (?,?,?,?,?,?)').run(bid,'רפי חשמל','חשמלאי','052-1234567',5,'מקצועי ומהיר, ממליץ בחום');

  // Default permissions for resident (unit 1)
  const DEFAULT_MODULES = ['payments','complaints','updates','decisions','maintenance','professionals','tutorials'];
  DEFAULT_MODULES.forEach(mod => {
    q('INSERT OR IGNORE INTO unit_permissions (unit_id,building_id,module,enabled) VALUES (?,?,?,?)').run(unit1.id, bid, mod, 1);
  });

  // Building 2: maintenance-only demo
  const b2 = q('INSERT INTO buildings (name,address,num_units,num_floors,budget,target_date,type) VALUES (?,?,?,?,?,?,?)').run(
    'שיכון ותיקים 12', 'רחוב הרצל 12, רמת גן', 20, 5, 0, null, 'maintenance'
  );
  const bid2 = b2.lastInsertRowid;
  for (let i = 1; i <= 20; i++) q('INSERT INTO units (building_id,unit_number,floor) VALUES (?,?,?)').run(bid2,i,Math.ceil(i/4));
  q('INSERT INTO users (full_name,email,password,role,building_id) VALUES (?,?,?,?,?)').run('ועד רמת גן','vaad@rg12.co.il',bcrypt.hashSync('123456',10),'committee',bid2);

  console.log('✅ GS.pro seed data inserted');
}

module.exports = { db, init, q, addDays };
