import { useState, useEffect } from 'react';
import { api } from '../api';

const ROLES = [
  { value: 'superadmin', label: '👑 מנהל מערכת' },
  { value: 'committee',  label: '🏛️ ועד בית' },
  { value: 'resident',   label: '🏠 דייר' },
];

const ROLE_BADGE = {
  superadmin: 'bg-purple-600/20 text-purple-400 border-purple-600/40',
  committee:  'bg-blue-600/20 text-blue-400 border-blue-600/40',
  resident:   'bg-slate-600/20 text-slate-400 border-slate-600/40',
};
const ROLE_LABEL = { superadmin: 'מנהל מערכת', committee: 'ועד בית', resident: 'דייר' };

const EMPTY_FORM = { full_name: '', email: '', password: '', role: 'committee', building_id: '', unit_id: '' };

export default function UsersManager() {
  const [users, setUsers]       = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [resetId, setResetId]   = useState(null);
  const [newPass, setNewPass]   = useState('');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    Promise.all([api.users.list(), api.buildings.list()])
      .then(([u, b]) => { setUsers(u); setBuildings(b); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  const buildingName = id => buildings.find(b => b.id === id)?.name || '—';

  const addUser = async () => {
    if (!form.full_name || !form.email || !form.password) { setErr('שם, אימייל וסיסמה הם שדות חובה'); return; }
    setSaving(true); setErr('');
    try {
      const u = await api.users.create({ ...form, building_id: form.building_id || null, unit_id: form.unit_id || null });
      setUsers(p => [...p, u]);
      setShowAdd(false); setForm(EMPTY_FORM);
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };

  const resetPassword = async (id) => {
    if (!newPass || newPass.length < 4) { setErr('סיסמה חייבת להיות לפחות 4 תווים'); return; }
    setSaving(true); setErr('');
    try {
      await api.users.resetPassword(id, newPass);
      setResetId(null); setNewPass('');
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };

  const deleteUser = async (id, name) => {
    if (!window.confirm(`למחוק את ${name}?`)) return;
    try {
      await api.users.del(id);
      setUsers(p => p.filter(u => u.id !== id));
    } catch(e) { setErr(e.message); }
  };

  const filtered = users.filter(u =>
    u.full_name?.includes(search) || u.email?.includes(search) || buildingName(u.building_id)?.includes(search)
  );

  if (loading) return <div className="text-slate-500 text-sm">טוען...</div>;

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">👥 ניהול משתמשים</h1>
          <p className="text-slate-400 text-sm mt-0.5">{users.length} משתמשים רשומים</p>
        </div>
        <button onClick={() => { setShowAdd(true); setErr(''); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + משתמש חדש
        </button>
      </div>

      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-4 py-2 rounded-lg mb-4">{err}</div>}

      {/* Search */}
      <input
        type="text" placeholder="חיפוש לפי שם, אימייל או בניין..."
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/50 text-right">
              <th className="px-4 py-3 text-slate-300 font-semibold">שם</th>
              <th className="px-4 py-3 text-slate-300 font-semibold">אימייל</th>
              <th className="px-4 py-3 text-slate-300 font-semibold">תפקיד</th>
              <th className="px-4 py-3 text-slate-300 font-semibold">בניין</th>
              <th className="px-4 py-3 text-slate-300 font-semibold">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id} className={`border-b border-slate-800 ${i % 2 === 0 ? '' : 'bg-slate-900/40'} hover:bg-slate-800/30 transition-colors`}>
                <td className="px-4 py-3 text-white font-medium">{u.full_name}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`border text-xs px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role]}`}>
                    {ROLE_LABEL[u.role] || u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{buildingName(u.building_id)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => { setResetId(u.id); setNewPass(''); setErr(''); }}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded text-xs transition-colors">
                      🔑 סיסמה
                    </button>
                    {u.role !== 'superadmin' && (
                      <button onClick={() => deleteUser(u.id, u.full_name)}
                        className="bg-red-900/30 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded text-xs transition-colors">
                        🗑️
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl">
            <h3 className="text-lg font-bold text-white mb-4">➕ הוספת משתמש חדש</h3>
            {err && <div className="bg-red-900/30 border border-red-700 text-red-400 text-xs px-3 py-2 rounded-lg mb-3">{err}</div>}
            {[
              ['full_name', 'שם מלא *', 'text', 'ישראל ישראלי'],
              ['email', 'אימייל *', 'email', 'user@example.com'],
              ['password', 'סיסמה *', 'password', 'לפחות 4 תווים'],
            ].map(([k, l, t, ph]) => (
              <div key={k} className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">{l}</label>
                <input type={t} placeholder={ph} value={form[k]}
                  onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">תפקיד *</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-1">בניין</label>
              <select value={form.building_id} onChange={e => setForm(p => ({ ...p, building_id: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— ללא בניין —</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowAdd(false); setErr(''); }} className="flex-1 border border-slate-600 text-slate-300 py-2 rounded-lg text-sm hover:bg-slate-800">ביטול</button>
              <button onClick={addUser} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold">
                {saving ? 'שומר...' : 'הוסף משתמש'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl" dir="rtl">
            <h3 className="text-lg font-bold text-white mb-1">🔑 איפוס סיסמה</h3>
            <p className="text-slate-400 text-xs mb-4">{users.find(u => u.id === resetId)?.full_name}</p>
            {err && <div className="bg-red-900/30 border border-red-700 text-red-400 text-xs px-3 py-2 rounded-lg mb-3">{err}</div>}
            <input type="password" placeholder="סיסמה חדשה" value={newPass}
              onChange={e => { setNewPass(e.target.value); setErr(''); }}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <button onClick={() => { setResetId(null); setErr(''); }} className="flex-1 border border-slate-600 text-slate-300 py-2 rounded-lg text-sm hover:bg-slate-800">ביטול</button>
              <button onClick={() => resetPassword(resetId)} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold">
                {saving ? 'שומר...' : 'אפס סיסמה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
