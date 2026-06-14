import { useEffect, useState } from 'react';
import { api } from '../api';

// Req #2: due-diligence area for contractors/professionals. Access limited to
// the supervisor (superadmin) and committee members the supervisor approved.
export default function BackgroundChecks() {
  const [state, setState] = useState({ loading: true, allowed: false, links: [] });
  const [err, setErr] = useState('');

  useEffect(() => {
    api.bgChecks()
      .then(d => setState({ loading: false, allowed: d.allowed, links: d.links }))
      .catch(e => { setErr(e.message); setState(s => ({ ...s, loading: false })); });
  }, []);

  if (state.loading) return <div className="text-slate-500 text-sm">טוען...</div>;

  return (
    <div className="max-w-3xl" dir="rtl">
      <h2 className="text-xl font-bold text-white mb-1">🔎 בדיקות רקע לאנשי מקצוע</h2>
      <p className="text-slate-400 text-sm mb-4">בדיקת נאותות לקבלנים ואנשי מקצוע לפני כניסתם לאתר.</p>

      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      {!state.allowed ? (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-6 text-center">
          <p className="text-3xl mb-2">🔒</p>
          <p className="text-amber-300 font-medium">אזור מוגבל</p>
          <p className="text-amber-400/70 text-sm mt-1">הגישה לאזור זה מותנית באישור פרטני של המפקח (גלעד). פנה אליו כדי לקבל גישה.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {state.links.map(l => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
              className="block bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-blue-500/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">{l.title}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">{l.desc}</p>
                </div>
                <span className="text-blue-400 text-sm">פתח ↗</span>
              </div>
            </a>
          ))}
          <p className="text-slate-600 text-xs mt-2">הקישורים מובילים לאתרים רשמיים. ודא שאתה בודק את הפרטים מול המקור הרשמי.</p>
        </div>
      )}
    </div>
  );
}
