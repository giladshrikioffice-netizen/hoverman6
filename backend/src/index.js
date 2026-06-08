const express = require('express');
const cors = require('cors');
const { init } = require('./db');
const { login, authenticate } = require('./auth');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Auth
app.post('/api/auth/login', login);
app.get('/api/auth/me', authenticate, (req, res) => res.json(req.user));

// All routes
app.use('/api', routes);

// Health check
app.get('/health', (_, res) => res.json({ ok: true }));

init();
app.listen(PORT, () => console.log(`✅ Backend רץ על http://localhost:${PORT}`));
