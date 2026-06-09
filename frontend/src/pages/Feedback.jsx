import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';

const CATEGORIES = [
  { value: 'bug', label: '🐛 תקלה טכנית' },
  { value: 'feature', label: '💡 רעיון לפיצ׳ר חדש' },
  { value: 'ux', label: '🎨 שיפור ממשק' },
  { value: 'content', label: '📝 תוכן או נתונים' },
  { value: 'other', label: '💬 אחר' },
];

export default function Feedback() {
  const { user } = useAuth();
  const [form, setForm] = useState({ category: 'feature', message: '', contact: user?.email || '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    if (!form.message.trim()) { setErr('נא לכתוב הודעה'); return; }
    setLoading(true);
    try {
      await api.feedback.create(form);
      setSent(true);
    } catch {
      // שמור מקומית אם API לא זמין
      const saved = JSON.parse(localStorage.getItem('feedback_queue') || '[]');
      saved.push({ ...form, date: new Date().toISOString(), user: user?.full_name });
      localStorage.setItem('feedback_queue', JSON.stringify(saved));
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) return (
    <div className="max-w-lg mx-auto mt-16 text-center" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-10">
        <div className="text-5xl mb-4">🙏</div>
        <h2 className="text-xl font-bold text-white mb-2">תודה על הפידבק!</h2>
        <p className="text-slate-400 text-sm mb-6">הפנייה התקבלה ותיבדק בהקדם.</p>
        <button onClick={() => { setSent(false); setForm(f => ({ ...f, message: '' })); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-sm transition-colors">
          שלח פידבק נוסף
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">💬 פידבק ושיפורים</h1>
        <p className="text-slate-400 text-sm mt-1">
          עזרו לנו לשפר את GS.pro — כל הערה חשובה
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { icon: '🚀', label: 'גרסה', value: '1.0 Beta' },
          { icon: '🏗️', label: 'בניינים פעילים', value: '2' },
          { icon: '💡', label: 'פיצ׳רים מתוכננים', value: '12+' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-center">
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-white font-bold text-sm">{s.value}</div>
            <div className="text-slate-500 text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">שלח פידבק</h2>

        {err && <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-3 py-2 rounded-lg mb-4">{err}</div>}

        {/* Category */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-2">קטגוריה</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value }))}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  form.category === c.value
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1">הודעה *</label>
          <textarea
            rows={5}
            placeholder="תארו את הבעיה, הרעיון, או השיפור שהייתם רוצים לראות..."
            value={form.message}
            onChange={e => { setForm(f => ({ ...f, message: e.target.value })); setErr(''); }}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm text-right resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Contact */}
        <div className="mb-5">
          <label className="block text-xs text-slate-400 mb-1">איש קשר (אופציונלי)</label>
          <input
            type="text"
            placeholder="שם או אימייל לחזרה"
            value={form.contact}
            onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button onClick={send} disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
          {loading ? 'שולח...' : 'שלח פידבק →'}
        </button>
      </div>

      {/* Roadmap teaser */}
      <div className="mt-4 bg-blue-600/10 border border-blue-600/30 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-400 mb-2">🗺️ בפיתוח — Coming Soon</h3>
        <ul className="text-slate-400 text-xs space-y-1">
          <li>• 📱 אפליקציית מובייל (iOS + Android)</li>
          <li>• 📧 התראות אימייל אוטומטיות</li>
          <li>• 📊 דוחות PDF מעוצבים</li>
          <li>• 🔗 ייבוא אוטומטי מGoogle Docs</li>
          <li>• 👥 פורום בין ועדי בתים</li>
        </ul>
      </div>
    </div>
  );
}
