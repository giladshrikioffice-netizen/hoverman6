import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';

export default function Settings() {
  const { user } = useAuth();
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault();
    setErr(''); setMsg('');
    if (newPass !== confirm) { setErr('הסיסמאות החדשות אינן תואמות'); return; }
    if (newPass.length < 4) { setErr('סיסמה חייבת להיות לפחות 4 תווים'); return; }
    setSaving(true);
    try {
      await api.auth.changePassword(oldPass, newPass);
      setMsg('✅ הסיסמה שונתה בהצלחה!');
      setOldPass(''); setNewPass(''); setConfirm('');
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div dir="rtl" className="max-w-md">
      <h1 className="text-xl font-bold text-white mb-6">⚙️ הגדרות חשבון</h1>

      {/* User info card */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-600/30 border border-blue-600/50 rounded-full flex items-center justify-center text-xl font-bold text-blue-400">
          {user?.full_name?.[0] || '?'}
        </div>
        <div>
          <p className="text-white font-semibold">{user?.full_name}</p>
          <p className="text-slate-400 text-sm">{user?.email}</p>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
        <h2 className="text-base font-bold text-white mb-4">🔑 שינוי סיסמה</h2>

        {msg && <div className="bg-emerald-900/30 border border-emerald-700 text-emerald-400 px-4 py-2 rounded-lg text-sm mb-4">{msg}</div>}
        {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-2 rounded-lg text-sm mb-4">{err}</div>}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">סיסמה נוכחית</label>
            <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} required
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">סיסמה חדשה</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">אימות סיסמה חדשה</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors mt-2">
            {saving ? 'שומר...' : 'שמור סיסמה חדשה'}
          </button>
        </form>
      </div>
    </div>
  );
}
