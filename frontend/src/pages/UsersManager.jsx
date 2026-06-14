import { useState, useEffect } from 'react';
import { api } from '../api';
import DemoBadge from '../components/DemoBadge';

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
const EMPTY_FORM = { full_name: '', email: '', password: '', role: 'resident', building_id: '', unit_id: '' };

export default function UsersManager() {
  const [users, setUsers]       = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');
  const [search, setSearch]     = useState('');

  // Modals
  const [showAdd, setShowAdd]   = useState(false);
  const [editUser, setEditUser] = useState(null);   // user object being edited
  const [resetId, setResetId]   = useState(null);
  const [newPass, setNewPass]   = useState('');
  const [inviteUser, setInviteUser] = useState(null); // user object to invite
  const [invitePass, setInvitePass] = useState('123456');

  const [form, setForm]   = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    Promise.all([api.users.list(), api.buildings.list()])
      .then(([u, b]) => { setUsers(u); setBuildings(b); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  const buildingName = id => buildings.find(b => b.id === id)?.name || '—';

  const flash = msg => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  // ── Add user ──────────────────────────────────────────────
  const addUser = async () => {
    if (!form.full_name || !form.email || !form.password) { setErr('שם, אימייל וסיסמה הם חובה'); return; }
    setSaving(true); setErr('');
    try {
      const u = await api.users.create({ ...form, building_id: form.building_id || null, unit_id: form.unit_id || null });
      setUsers(p => [...p, u]);
      setShowAdd(false); setForm(EMPTY_FORM);
      flash('✅ משתמש נוסף בהצלחה');
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };

  // ── Edit user ─────────────────────────────────────────────
  const saveEdit = async () => {
    if (!editUser.full_name || !editUser.email) { setErr('שם ואימייל הם חובה'); return; }
    setSaving(true); setErr('');
    try {
      const u = await api.users.update(editUser.id, {
        full_name: editUser.full_name,
        email: editUser.email,
        role: editUser.role,
        building_id: editUser.building_id || null,
        unit_id: editUser.unit_id || null,
      });
      setUsers(p => p.map(x => x.id === u.id ? u : x));
      setEditUser(null);
      flash('✅ פרטי משתמש עודכנו');
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };

  // ── Reset password ────────────────────────────────────────
  const resetPassword = async () => {
    if (!newPass || newPass.length < 4) { setErr('סיסמה חייבת להיות לפחות 4 תווים'); return; }
    setSaving(true); setErr('');
    try {
      await api.users.resetPassword(resetId, newPass);
      setResetId(null); setNewPass('');
      flash('✅ סיסמה אופסה בהצלחה');
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };

  // ── Delete user ───────────────────────────────────────────
  const deleteUser = async (id, name) => {
    if (!window.confirm(`למחוק את ${name}?`)) return;
    try {
      await api.users.del(id);
      setUsers(p => p.filter(u => u.id !== id));
      flash('🗑️ משתמש נמחק');
    } catch(e) { setErr(e.message); }
  };

  // ── Toggle background-checks access (committee) ───────────
  const toggleBg = async (u) => {
    const next = u.bg_access ? 0 : 1;
    try {
      await api.users.setBgAccess(u.id, !!next);
      setUsers(p => p.map(x => x.id === u.id ? { ...x, bg_access: next } : x));
      flash(next ? '🔓 ניתנה גישה לבדיקות רקע' : '🔒 הגישה לבדיקות רקע בוטלה');
    } catch(e) { setErr(e.message); }
  };

  // ── Send invite email ────────────────────────────────────
  const sendInvite = async () => {
    setSaving(true); setErr('');
    try {
      await api.users.invite({
        to_email: inviteUser.email,
        to_name: inviteUser.full_name,
        building_name: buildingName(inviteUser.building_id),
        temp_password: invitePass,
      });
      setInviteUser(null); setInvitePass('123456');
      flash('📧 הזמנה נשלחה בהצלחה!');
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };

  const filtered = users.filter(u =>
    !search || u.full_name?.includes(search) || u.email?.includes(search) || buildingName(u.building_id)?.includes(search)
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
        <button onClick={() => { setShowAdd(true); setErr(''); setForm(EMPTY_FORM); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + משתמש חדש
        </button>
      </div>

      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-4 py-2 rounded-lg mb-3">{err}</div>}
      {successMsg && <div className="bg-emerald-900/30 border border-emerald-700 text-emerald-400 text-sm px-4 py-2 rounded-lg mb-3">{successMsg}</div>}

      {/* Search */}
      <input type="text" placeholder="חיפוש לפי שם, אימייל או בניין..."
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
              <tr key={u.id} className={`border-b border-slate-800 ${i%2===0?'':'bg-slate-900/40'} hover:bg-slate-800/30 transition-colors`}>
                <td className="px-4 py-3 text-white font-medium"><span className="flex items-center gap-2">{u.full_name} <DemoBadge show={u.is_demo} /></span></td>
                <td className="px-4 py-3 text-slate-400 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`border text-xs px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role]}`}>
                    {ROLE_LABEL[u.role] || u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{buildingName(u.building_id)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => { setEditUser({...u}); setErr(''); }}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded text-xs transition-colors">✏️ ערוך</button>
                    <button onClick={() => { setResetId(u.id); setNewPass(''); setErr(''); }}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded text-xs transition-colors">🔑 סיסמה</button>
                    {u.email && u.role !== 'superadmin' && (
                      <button onClick={() => { setInviteUser(u); setErr(''); }}
                        className="bg-blue-900/40 hover:bg-blue-900/60 text-blue-400 px-2 py-1 rounded text-xs transition-colors">📧 הזמן</button>
                    )}
                    {u.role === 'committee' && (
                      <button onClick={() => toggleBg(u)} title="גישה לאזור בדיקות רקע"
                        className={`px-2 py-1 rounded text-xs transition-colors ${u.bg_access ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                        {u.bg_access ? '🔓 בדיקות רקע' : '🔒 בדיקות רקע'}
                      </button>
                    )}
                    {u.role !== 'superadmin' && (
                      <button onClick={() => deleteUser(u.id, u.full_name)}
                        className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-2 py-1 rounded text-xs transition-colors">🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Add User Modal ── */}
      {showAdd && (
        <Modal title="➕ הוספת משתמש חדש" onClose={() => { setShowAdd(false); setErr(''); }}>
          {err && <ErrBox msg={err} />}
          <FormFields form={form} setForm={setForm} buildings={buildings} showPassword />
          <ModalFooter onCancel={() => { setShowAdd(false); setErr(''); }} onSave={addUser} saving={saving} saveLabel="הוסף משתמש" />
        </Modal>
      )}

      {/* ── Edit User Modal ── */}
      {editUser && (
        <Modal title="✏️ עריכת משתמש" onClose={() => { setEditUser(null); setErr(''); }}>
          {err && <ErrBox msg={err} />}
          <FormFields form={editUser} setForm={setEditUser} buildings={buildings} showPassword={false} />
          <ModalFooter onCancel={() => { setEditUser(null); setErr(''); }} onSave={saveEdit} saving={saving} saveLabel="שמור שינויים" />
        </Modal>
      )}

      {/* ── Reset Password Modal ── */}
      {resetId && (
        <Modal title="🔑 איפוס סיסמה" onClose={() => { setResetId(null); setErr(''); }}>
          <p className="text-slate-400 text-xs mb-3">{users.find(u => u.id === resetId)?.full_name}</p>
          {err && <ErrBox msg={err} />}
          <input type="password" placeholder="סיסמה חדשה (מינימום 4)" value={newPass}
            onChange={e => { setNewPass(e.target.value); setErr(''); }}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <ModalFooter onCancel={() => { setResetId(null); setErr(''); }} onSave={resetPassword} saving={saving} saveLabel="אפס סיסמה" />
        </Modal>
      )}

      {/* ── Invite Modal ── */}
      {inviteUser && (
        <Modal title="📧 שליחת הזמנה" onClose={() => { setInviteUser(null); setErr(''); }}>
          {err && <ErrBox msg={err} />}
          <div className="bg-slate-800 rounded-lg p-3 mb-3 text-sm">
            <p className="text-slate-400 text-xs mb-1">נשלח אל:</p>
            <p className="text-white font-medium">{inviteUser.full_name}</p>
            <p className="text-slate-400 text-xs">{inviteUser.email}</p>
            <p className="text-slate-400 text-xs">{buildingName(inviteUser.building_id)}</p>
          </div>
          <label className="block text-xs text-slate-400 mb-1">סיסמה זמנית שתופיע במייל</label>
          <input type="text" value={invitePass} onChange={e => setInvitePass(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-slate-500 text-xs mb-4">⚠️ וודא שסיסמה זו זהה לסיסמה שנשמרה בMערכת</p>
          <ModalFooter onCancel={() => { setInviteUser(null); setErr(''); }} onSave={sendInvite} saving={saving} saveLabel="📧 שלח הזמנה" />
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl">
        <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ErrBox({ msg }) {
  return <div className="bg-red-900/30 border border-red-700 text-red-400 text-xs px-3 py-2 rounded-lg mb-3">{msg}</div>;
}

function ModalFooter({ onCancel, onSave, saving, saveLabel }) {
  return (
    <div className="flex gap-2">
      <button onClick={onCancel} className="flex-1 border border-slate-600 text-slate-300 py-2 rounded-lg text-sm hover:bg-slate-800">ביטול</button>
      <button onClick={onSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold">
        {saving ? 'שומר...' : saveLabel}
      </button>
    </div>
  );
}

function FormFields({ form, setForm, buildings, showPassword }) {
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <>
      {[['full_name','שם מלא *','text','ישראל ישראלי'],['email','אימייל *','email','user@example.com']].map(([k,l,t,ph]) => (
        <div key={k} className="mb-3">
          <label className="block text-xs text-slate-400 mb-1">{l}</label>
          <input type={t} placeholder={ph} value={form[k]||''} onChange={e => set(k, e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      ))}
      {showPassword && (
        <div className="mb-3">
          <label className="block text-xs text-slate-400 mb-1">סיסמה *</label>
          <input type="password" placeholder="לפחות 4 תווים" value={form.password||''} onChange={e => set('password', e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}
      <div className="mb-3">
        <label className="block text-xs text-slate-400 mb-1">תפקיד *</label>
        <select value={form.role||'resident'} onChange={e => set('role', e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1">בניין</label>
        <select value={form.building_id||''} onChange={e => set('building_id', e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">— ללא בניין —</option>
          {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
    </>
  );
}
