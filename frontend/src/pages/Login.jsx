import { useState } from 'react';
import { useAuth } from '../AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">אימייל</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-right placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">סיסמה</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-right placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••" required />
            </div>
            {error && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded-lg text-sm">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-blue-600/20">
              {loading ? 'מתחבר...' : 'כניסה למערכת'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-700 text-xs text-slate-500 space-y-1 text-center">
            <p>מנהל: gilad@gspro.co.il / admin123</p>
            <p>ועד הוברמן: shira@hoverman6.co.il / 123456</p>
            <p>דייר: resident@hoverman6.co.il / 123456</p>
          </div>
        </div>
      </div>
    </div>
  );
}
