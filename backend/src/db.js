const bcrypt = require('bcryptjs');
const path = require('path');

// ── Driver selection ───────────────────────────────────────
// If DATABASE_URL is set  → PostgreSQL (production, persistent).
// Otherwise               → SQLite via node:sqlite (local dev).
const USE_PG = !!process.env.DATABASE_URL;

let driver;       // { get, all, run, exec }
let pgPool = null;

// Convert SQLite-style "?" placeholders to Postgres "$1,$2,..."
function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

if (USE_PG) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  driver = {
    async get(sql, params) { const r = await pgPool.query(toPgPlaceholders(sql), params); return r.rows[0]; },
    async all(sql, params) { const r = await pgPool.query(toPgPlaceholders(sql), params); return r.rows; },
    async run(sql, params) {
      let text = toPgPlaceholders(sql);
      if (/^\s*insert/i.test(text) && !/returning/i.test(text)) text += ' RETURNING *';
      const r = await pgPool.query(text, params);
      return { lastInsertRowid: r.rows[0]?.id, changes: r.rowCount, row: r.rows[0] };
    },
    async exec(sql) { await pgPool.query(sql); },
  };
} else {
  const { DatabaseSync } = require('node:sqlite');
  const DB_PATH = path.join(__dirname, '..', 'gspro.db');
  const sdb = new DatabaseSync(DB_PATH);
  sdb.exec(`PRAGMA journal_mode = WAL`);
  sdb.exec(`PRAGMA foreign_keys = ON`);
  driver = {
    async get(sql, params) { return sdb.prepare(sql).get(...params); },
    async all(sql, params) { return sdb.prepare(sql).all(...params); },
    async run(sql, params) { const r = sdb.prepare(sql).run(...params); return { lastInsertRowid: r.lastInsertRowid, changes: r.changes }; },
    async exec(sql) { sdb.exec(sql); },
  };
}

// Public query builder — every method returns a Promise.
// Usage: await q('SELECT ... WHERE x=?').get(x)
function q(sql) {
  return {
    get: (...params) => driver.get(sql, params),
    all: (...params) => driver.all(sql, params),
    run: (...params) => driver.run(sql, params),
  };
}

// ── Schema (dialect-aware via tokens) ──────────────────────
function buildSchema() {
  const PK  = USE_PG ? 'SERIAL PRIMARY KEY'      : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const TS  = USE_PG ? 'TIMESTAMPTZ'             : 'TEXT';
  const NOW = USE_PG ? 'now()'                   : "(datetime('now'))";
  return `
    CREATE TABLE IF NOT EXISTS buildings (
      id ${PK},
      name TEXT NOT NULL,
      address TEXT,
      num_units INTEGER DEFAULT 0,
      num_floors INTEGER DEFAULT 0,
      budget REAL DEFAULT 0,
      target_date TEXT,
      type TEXT DEFAULT 'supervision',
      created_at ${TS} DEFAULT ${NOW}
    );

    CREATE TABLE IF NOT EXISTS units (
      id ${PK},
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      unit_number INTEGER NOT NULL,
      floor INTEGER,
      owner_name TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id ${PK},
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      building_id INTEGER REFERENCES buildings(id),
      unit_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS unit_permissions (
      id ${PK},
      unit_id INTEGER NOT NULL REFERENCES units(id),
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      module TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      UNIQUE(unit_id, module)
    );

    CREATE TABLE IF NOT EXISTS contractors (
      id ${PK},
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      name TEXT NOT NULL,
      trade TEXT,
      phone TEXT,
      contract_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'פעיל'
    );

    CREATE TABLE IF NOT EXISTS budget_items (
      id ${PK},
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      category TEXT NOT NULL,
      planned_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id ${PK},
      unit_id INTEGER NOT NULL REFERENCES units(id),
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      amount_due REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      due_date TEXT,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id ${PK},
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      date TEXT NOT NULL,
      topic TEXT NOT NULL,
      approved_by TEXT,
      status TEXT DEFAULT 'ממתין'
    );

    CREATE TABLE IF NOT EXISTS updates (
      id ${PK},
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      visit_date TEXT NOT NULL,
      summary TEXT,
      blockers TEXT,
      next_steps TEXT,
      author TEXT,
      created_at ${TS} DEFAULT ${NOW}
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id ${PK},
      unit_id INTEGER NOT NULL REFERENCES units(id),
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      subject TEXT NOT NULL,
      body TEXT,
      status TEXT DEFAULT 'פתוח',
      photo TEXT,
      created_at ${TS} DEFAULT ${NOW}
    );

    CREATE TABLE IF NOT EXISTS professionals (
      id ${PK},
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      name TEXT NOT NULL,
      trade TEXT,
      phone TEXT,
      email TEXT,
      rating INTEGER DEFAULT 0,
      review TEXT,
      last_cost REAL,
      last_service_date TEXT
    );

    CREATE TABLE IF NOT EXISTS maintenance_items (
      id ${PK},
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
      id ${PK},
      title TEXT NOT NULL,
      url TEXT,
      description TEXT,
      created_at ${TS} DEFAULT ${NOW}
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id ${PK},
      category TEXT DEFAULT 'other',
      message TEXT NOT NULL,
      contact TEXT,
      created_at ${TS} DEFAULT ${NOW}
    );

    CREATE TABLE IF NOT EXISTS documents (
      id ${PK},
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
      created_at ${TS} DEFAULT ${NOW}
    );

    CREATE TABLE IF NOT EXISTS doc_checklist (
      id ${PK},
      building_id INTEGER REFERENCES buildings(id),
      item_key TEXT NOT NULL,
      status TEXT DEFAULT 'missing',
      note TEXT,
      updated_at TEXT,
      UNIQUE(building_id, item_key)
    );

    CREATE TABLE IF NOT EXISTS onboarding_forms (
      id ${PK},
      token TEXT UNIQUE NOT NULL,
      form_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      data TEXT,
      sent_to TEXT,
      created_by TEXT,
      building_id INTEGER REFERENCES buildings(id),
      created_at ${TS} DEFAULT ${NOW},
      submitted_at TEXT,
      approved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS monthly_reports (
      id ${PK},
      building_id INTEGER NOT NULL REFERENCES buildings(id),
      month TEXT NOT NULL,
      title TEXT,
      summary TEXT,
      docs TEXT,
      status TEXT DEFAULT 'draft',
      author TEXT,
      published_at TEXT,
      created_at ${TS} DEFAULT ${NOW}
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `;
}

async function init() {
  await driver.exec(buildSchema());

  // Add columns that may be missing on existing DBs (both dialects; duplicate-column errors are ignored).
  const addCol = async (sql) => { try { await driver.exec(sql); } catch {} };
  if (!USE_PG) {
    await addCol(`ALTER TABLE complaints ADD COLUMN photo TEXT`);
    await addCol(`ALTER TABLE professionals ADD COLUMN email TEXT`);
    await addCol(`ALTER TABLE documents ADD COLUMN visibility TEXT DEFAULT 'committee'`);
  }
  // building type (maintenance/supervision/both) — safety for older DBs missing it
  await addCol(`ALTER TABLE buildings ADD COLUMN type TEXT DEFAULT 'supervision'`);
  // is_demo flag — marks data seeded by the system (not entered by the user) so the UI can highlight it.
  await addCol(`ALTER TABLE buildings ADD COLUMN is_demo INTEGER DEFAULT 0`);
  await addCol(`ALTER TABLE users ADD COLUMN is_demo INTEGER DEFAULT 0`);
  await addCol(`ALTER TABLE professionals ADD COLUMN is_demo INTEGER DEFAULT 0`);
  await addCol(`ALTER TABLE decisions ADD COLUMN is_demo INTEGER DEFAULT 0`);
  await addCol(`ALTER TABLE payments ADD COLUMN is_demo INTEGER DEFAULT 0`);
  // professionals: who added the provider + how long they've serviced (req #10)
  await addCol(`ALTER TABLE professionals ADD COLUMN added_by TEXT`);
  await addCol(`ALTER TABLE professionals ADD COLUMN service_years TEXT`);
  // payments: type (monthly/yearly/one-time) + a free-text period label (req #11)
  await addCol(`ALTER TABLE payments ADD COLUMN payment_type TEXT DEFAULT 'חד-פעמי'`);
  await addCol(`ALTER TABLE payments ADD COLUMN period_label TEXT`);
  // budget track: project vs maintenance budget (new req #1)
  await addCol(`ALTER TABLE budget_items ADD COLUMN track TEXT DEFAULT 'project'`);
  // decision attachment (new req #4): reference document URL + name
  await addCol(`ALTER TABLE decisions ADD COLUMN doc_url TEXT`);
  await addCol(`ALTER TABLE decisions ADD COLUMN doc_name TEXT`);
  // background-checks area access for committee members (new req #2) — superadmin grants
  await addCol(`ALTER TABLE users ADD COLUMN bg_access INTEGER DEFAULT 0`);
  // area assignment: 'maintenance' | 'supervision' | 'both' (structural reorg)
  await addCol(`ALTER TABLE users ADD COLUMN areas TEXT DEFAULT 'both'`);
  // payments: which area a unit's payment belongs to (running maintenance vs project)
  await addCol(`ALTER TABLE payments ADD COLUMN area TEXT DEFAULT 'maintenance'`);
  // visit-summary intake (req): structured fields + archive support on updates
  await addCol(`ALTER TABLE updates ADD COLUMN kind TEXT DEFAULT 'new'`);
  await addCol(`ALTER TABLE updates ADD COLUMN title TEXT`);
  await addCol(`ALTER TABLE updates ADD COLUMN tasks TEXT`);
  await addCol(`ALTER TABLE updates ADD COLUMN qc_notes TEXT`);
  await addCol(`ALTER TABLE updates ADD COLUMN general_notes TEXT`);
  await addCol(`ALTER TABLE updates ADD COLUMN raw_text TEXT`);
  // complaints approval flow (structural reorg): committee forwards to admin (מפקח)
  await addCol(`ALTER TABLE complaints ADD COLUMN forwarded INTEGER DEFAULT 0`);
  await addCol(`ALTER TABLE complaints ADD COLUMN forwarded_at TEXT`);
  await addCol(`ALTER TABLE complaints ADD COLUMN admin_status TEXT`);
  await addCol(`ALTER TABLE complaints ADD COLUMN admin_response TEXT`);

  await seed();
  console.log(`✅ DB ready (${USE_PG ? 'PostgreSQL' : 'SQLite'})`);
}

function addDays(dateStr, days) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Run a migration only once, guarded by a flag in the meta table.
async function runOnce(key, fn) {
  const done = await q('SELECT value FROM meta WHERE key=?').get(key);
  if (done) return;
  await fn();
  await q('INSERT INTO meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, new Date().toISOString());
  console.log(`✅ Migration applied: ${key}`);
}

async function seed() {
  const count = await q('SELECT CAST(COUNT(*) AS INTEGER) as c FROM users').get();

  // ONE-TIME fix: correct names + reset credentials for the 3 key users.
  // Runs only once (guarded by meta flag) so user-changed passwords are NOT clobbered on every restart.
  await runOnce('fix_real_credentials_v1', async () => {
    const existingAdmin = await q("SELECT id FROM users WHERE role='superadmin' LIMIT 1").get();
    if (existingAdmin) {
      await q("UPDATE users SET full_name=?,email=?,password=? WHERE id=?").run(
        'גלעד שריקי', 'giladshrikioffice@gmail.com', bcrypt.hashSync('gs4798', 10), existingAdmin.id
      );
    }
    const existingShira = await q("SELECT id FROM users WHERE email LIKE '%shira%' AND role='committee' LIMIT 1").get();
    if (existingShira) {
      await q("UPDATE users SET full_name=?,email=?,password=? WHERE id=?").run(
        'שירה אילן', 'shirailan10@gmail.com', bcrypt.hashSync('0522929529', 10), existingShira.id
      );
    }
    const existingAharon = await q("SELECT id FROM users WHERE role='committee' AND id!=? LIMIT 1").get(existingShira?.id || 0);
    if (existingAharon) {
      await q("UPDATE users SET full_name=?,email=?,password=? WHERE id=?").run(
        'אהרון שם טוב', 'ashemtov280860@gmail.com', bcrypt.hashSync('0584766555', 10), existingAharon.id
      );
    }
    await q("UPDATE decisions SET approved_by='שירה אילן' WHERE approved_by='שירה כהן'").run();
    await q("UPDATE decisions SET approved_by='אהרון שם טוב' WHERE approved_by='אהרון לוי'").run();
  });

  // ONE-TIME: flag the data the SYSTEM fabricated (no user sourcing) so the UI highlights it.
  // The user reviews/edits/deletes these; real data they entered stays unmarked.
  await runOnce('mark_demo_v1', async () => {
    await q("UPDATE buildings SET is_demo=1 WHERE name='שיכון ותיקים 12'").run();
    await q("UPDATE users SET is_demo=1 WHERE email IN ('resident@hoverman6.co.il','vaad@rg12.co.il')").run();
    await q("UPDATE professionals SET is_demo=1 WHERE name='רפי חשמל'").run();
    // sample decisions seeded by the system
    await q("UPDATE decisions SET is_demo=1 WHERE topic IN ('אישור קבלן ראשי – חמודי','אישור ספק תריסים')").run();
    // all seeded payment amounts are placeholders (15000 due) — flag for review
    await q("UPDATE payments SET is_demo=1 WHERE amount_due=15000 AND due_date='2026-03-01'").run();
  });

  if (count.c > 0) return;

  // ── Initial seed (first boot only) ──
  // Super admin
  await q('INSERT INTO users (full_name,email,password,role,building_id,unit_id) VALUES (?,?,?,?,?,?)').run(
    'גלעד שריקי', 'giladshrikioffice@gmail.com', bcrypt.hashSync('gs4798', 10), 'superadmin', null, null
  );

  // Building: הוברמן 6 (supervision)
  const b1 = await q('INSERT INTO buildings (name,address,num_units,num_floors,budget,target_date,type) VALUES (?,?,?,?,?,?,?)').run(
    'הוברמן 6', 'רחוב הוברמן 6, פתח תקווה', 28, 7, 6000000, '2026-10-01', 'supervision'
  );
  const bid = b1.lastInsertRowid;

  for (let i = 1; i <= 28; i++) {
    await q('INSERT INTO units (building_id,unit_number,floor) VALUES (?,?,?)').run(bid, i, Math.ceil(i / 4));
  }

  // Committee users
  await q('INSERT INTO users (full_name,email,password,role,building_id) VALUES (?,?,?,?,?)').run('שירה אילן','shirailan10@gmail.com',bcrypt.hashSync('0522929529',10),'committee',bid);
  await q('INSERT INTO users (full_name,email,password,role,building_id) VALUES (?,?,?,?,?)').run('אהרון שם טוב','ashemtov280860@gmail.com',bcrypt.hashSync('0584766555',10),'committee',bid);

  // Resident
  const unit1 = await q('SELECT id FROM units WHERE building_id=? AND unit_number=1').get(bid);
  await q('INSERT INTO users (full_name,email,password,role,building_id,unit_id) VALUES (?,?,?,?,?,?)').run('דייר לדוגמה','resident@hoverman6.co.il',bcrypt.hashSync('123456',10),'resident',bid,unit1.id);

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
  for (const c of contractors) await q('INSERT INTO contractors (building_id,name,trade,phone,contract_amount,status) VALUES (?,?,?,?,?,?)').run(bid,...c);

  // Budget
  const budget = [
    ['קבלן ראשי',2500000,800000],['תריסים',180000,180000],['מעקות',470000,200000],
    ['אלומיניום',420000,100000],['מיזוג',95000,0],['אינסטלציה',210000,50000],
    ['בטיחות אש',85000,85000],['משאבות',140000,0],['פיקוח ובלת"מ',900000,150000],
  ];
  for (const b of budget) await q('INSERT INTO budget_items (building_id,category,planned_amount,paid_amount) VALUES (?,?,?,?)').run(bid,...b);

  // Payments
  const units = await q('SELECT id FROM units WHERE building_id=? ORDER BY unit_number').all(bid);
  for (let i = 0; i < units.length; i++) {
    const paid = i % 3 === 0 ? 15000 : i % 3 === 1 ? 7500 : 0;
    await q('INSERT INTO payments (unit_id,building_id,amount_due,amount_paid,due_date) VALUES (?,?,?,?,?)').run(units[i].id,bid,15000,paid,'2026-03-01');
  }

  // Decisions
  await q('INSERT INTO decisions (building_id,date,topic,approved_by,status) VALUES (?,?,?,?,?)').run(bid,'2026-01-15','אישור קבלן ראשי – חמודי','שירה אילן','מאושר');
  await q('INSERT INTO decisions (building_id,date,topic,approved_by,status) VALUES (?,?,?,?,?)').run(bid,'2026-02-10','אישור ספק תריסים','אהרון שם טוב','מאושר');

  // Update
  await q('INSERT INTO updates (building_id,visit_date,summary,blockers,next_steps,author) VALUES (?,?,?,?,?,?)').run(
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
  for (const [name, freq, last, status] of maintenance) {
    const next = addDays(last, freq);
    await q('INSERT INTO maintenance_items (building_id,name,frequency_days,last_check,next_check,status) VALUES (?,?,?,?,?,?)').run(bid,name,freq,last,next,status);
  }

  // Sample professional
  await q('INSERT INTO professionals (building_id,name,trade,phone,rating,review) VALUES (?,?,?,?,?,?)').run(bid,'רפי חשמל','חשמלאי','052-1234567',5,'מקצועי ומהיר, ממליץ בחום');

  // Default permissions for resident (unit 1)
  const DEFAULT_MODULES = ['payments','complaints','updates','decisions','maintenance','professionals','tutorials'];
  for (const mod of DEFAULT_MODULES) {
    await q('INSERT INTO unit_permissions (unit_id,building_id,module,enabled) VALUES (?,?,?,?) ON CONFLICT(unit_id,module) DO NOTHING').run(unit1.id, bid, mod, 1);
  }

  // Building 2: maintenance-only demo
  const b2 = await q('INSERT INTO buildings (name,address,num_units,num_floors,budget,target_date,type) VALUES (?,?,?,?,?,?,?)').run(
    'שיכון ותיקים 12', 'רחוב הרצל 12, רמת גן', 20, 5, 0, null, 'maintenance'
  );
  const bid2 = b2.lastInsertRowid;
  for (let i = 1; i <= 20; i++) await q('INSERT INTO units (building_id,unit_number,floor) VALUES (?,?,?)').run(bid2,i,Math.ceil(i/4));
  await q('INSERT INTO users (full_name,email,password,role,building_id) VALUES (?,?,?,?,?)').run('ועד רמת גן','vaad@rg12.co.il',bcrypt.hashSync('123456',10),'committee',bid2);

  console.log('✅ GS.pro seed data inserted');
}

module.exports = { q, init, addDays };
