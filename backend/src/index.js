const express = require('express');
const cors = require('cors');
const { init } = require('./db');
const { login, authenticate } = require('./auth');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// base64 files (documents up to 8MB, photos up to 5MB) inflate ~33% — allow up to 15mb
app.use(express.json({ limit: '15mb' }));

// Auth
app.post('/api/auth/login', login);
app.get('/api/auth/me', authenticate, (req, res) => res.json(req.user));

// All routes
app.use('/api', routes);

// Health check
app.get('/health', (_, res) => res.json({ ok: true }));

// ── Zapier Webhook — מפתח API קבוע ────────────────────────────
const ZAPIER_API_KEY = process.env.ZAPIER_API_KEY || 'gspro-zapier-2026';

app.post('/api/zapier/visit', async (req, res) => {
  try {
    const key = req.headers['x-api-key'] || req.body.api_key;
    if (key !== ZAPIER_API_KEY) return res.status(401).json({ error: 'מפתח API שגוי' });

    const { visit_date, summary, blockers, next_steps, building_id } = req.body;
    if (!visit_date || !summary) return res.status(400).json({ error: 'חסרים שדות חובה: visit_date, summary' });

    const { q } = require('./db');
    const bid = parseInt(building_id) || 1;
    const r = await q('INSERT INTO updates (building_id,visit_date,summary,blockers,next_steps,author) VALUES (?,?,?,?,?,?)')
      .run(bid, visit_date, summary, blockers || '', next_steps || '', 'זאפייר-אוטו');

    console.log(`📥 Zapier visit inserted: ${visit_date} → building ${bid}`);
    res.json({ ok: true, id: r.lastInsertRowid, visit_date, building_id: bid });
  } catch (e) {
    console.error('zapier error:', e);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

init()
  .then(() => app.listen(PORT, () => console.log(`✅ Backend רץ על http://localhost:${PORT}`)))
  .catch(e => { console.error('❌ DB init failed:', e); process.exit(1); });
