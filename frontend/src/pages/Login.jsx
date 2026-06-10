import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';

const API = (import.meta.env.VITE_API_URL || '') + '/api';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [waking, setWaking]     = useState(true);   // backend wake-up state
  const [wakeFailed, setWakeFailed] = useState(false);

  // Wake up the backend on page load
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000); // 25s timeout

    fetch(`${API}/auth/me`, { signal: controller.signal })
      .then(() => { clearTimeout(timer); setWaking(false); })
      .catch(() => { clearTimeout(timer); setWaking(false); setWakeFailed(true); });

    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try { await login(email, password); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
            <span className="text-white font-black text-2xl">GS</span>
          </div>
          <h1 className="text-2xl font-bold text-white">GS.pro</h1>
          <p className="text-slate-400 text-sm mt-1">גלעד שריקי — ניהול פרויקטים</p>
        </div>

        {/* Waking up banner */}
        {waking && (
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-amber-400 text-sm font-medium">מעיר את השרת...</p>
              <p className="text-amber-600 text-xs mt-0.5">הכניסה הראשונה לוקחת עד 30 שניות</p>
            </div>
          </div>
        )}

        {wakeFailed && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-400 text-sm">⚠️ השרת לא מגיב — נסה לרענן את הדף</p>
          </div>
        )}

        {!waking && !wakeFailed && (
          <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <span className="text-emerald-400 text-sm">✅ השרת מוכן</span>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">אימייל</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                disabled={waking}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-right placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                placeholder="your@email.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">סיסמה</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                disabled={waking}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-right placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                placeholder="••••••" required />
            </div>
            {error && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded-lg text-sm">{error}</div>}
            <button type="submit" disabled={loading || waking}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-blue-600/20">
              {waking ? 'ממתין לשרת...' : loading ? 'מתחבר...' : 'כניסה למערכת'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-700 text-xs text-slate-500 text-center">
            <p>לתמיכה: giladshrikioffice@gmail.com · 050-6774798</p>
          </div>
        </div>
      </div>
    </div>
  );
}
