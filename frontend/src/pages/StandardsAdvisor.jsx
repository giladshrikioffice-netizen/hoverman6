import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';

const KIND_LABEL = { new: 'ביקור', status: 'סטטוס', email: 'מייל', archive: 'ארכיון' };

function MarkdownLine({ text }) {
  // bold **text**, no-op otherwise
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : p
      )}
    </span>
  );
}

function Answer({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-200 text-right" dir="rtl">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        if (line.startsWith('- ') || line.startsWith('• '))
          return <div key={i} className="flex gap-2 items-start"><span className="text-blue-400 mt-0.5">•</span><span><MarkdownLine text={line.slice(2)} /></span></div>;
        return <div key={i}><MarkdownLine text={line} /></div>;
      })}
    </div>
  );
}

export default function StandardsAdvisor() {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [defectText, setDefectText] = useState('');
  const [contextTitle, setContextTitle] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [copied, setCopied] = useState(false);
  const answerRef = useRef(null);

  useEffect(() => {
    api.updates?.list?.()?.then(rows => {
      setRecentUpdates((rows || []).slice(0, 30));
    }).catch(() => {});
  }, []);

  const loadFromUpdate = (u) => {
    const parts = [u.summary, u.blockers, u.qc_notes].filter(Boolean).join('\n');
    setDefectText(parts.slice(0, 600));
    setContextTitle(`${u.visit_date || ''} – ${u.title || KIND_LABEL[u.kind] || ''}`);
    setQuestion('');
    setAnswer('');
  };

  const submit = async () => {
    if (!question.trim() && !defectText.trim()) return;
    setLoading(true);
    setError('');
    setAnswer('');
    try {
      const res = await api.req('POST', '/standards-query', {
        question: question.trim(),
        defect_text: defectText.trim(),
        context_title: contextTitle.trim(),
      });
      setAnswer(res.answer || '');
    } catch (e) {
      setError(e.message || 'שגיאת שרת');
    } finally {
      setLoading(false);
    }
  };

  const copyAnswer = () => {
    if (!answer) return;
    navigator.clipboard.writeText(answer).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!['superadmin', 'admin'].includes(user?.role)) {
    return <div className="p-8 text-slate-400 text-center">גישה מוגבלת</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-white">יועץ תקנים</h1>
        <p className="text-slate-400 text-sm mt-0.5">הצמד ליקוי או שאלה מהשטח — קבל הפניה לתקן הישראלי הרלוונטי לדוח</p>
      </div>

      {/* Load from visit */}
      {recentUpdates.length > 0 && (
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">טען מביקור / רשומה קיימת</label>
          <select
            onChange={e => { const u = recentUpdates.find(x => String(x.id) === e.target.value); if (u) loadFromUpdate(u); }}
            defaultValue=""
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>בחר רשומה...</option>
            {recentUpdates.map(u => (
              <option key={u.id} value={u.id}>
                {u.visit_date ? u.visit_date + ' — ' : ''}{u.title || KIND_LABEL[u.kind] || 'רשומה'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Defect / context */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">תיאור הליקוי / הממצא <span className="text-slate-600">(ניתן להדביק ישירות מהדוח)</span></label>
        <textarea
          value={defectText}
          onChange={e => setDefectText(e.target.value)}
          rows={4}
          placeholder="לדוגמה: סדקים אלכסוניים ברוחב 2 מ&quot;מ בקיר חיצוני בקומה 3. חשד לשקיעה בביסוס."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Question */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">שאלה <span className="text-slate-600">(אופציונלי — אם יש שאלה ספציפית)</span></label>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
          placeholder="לדוגמה: מה הסטייה המותרת לפי תקן? האם נדרש מהנדס?"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={submit}
        disabled={loading || (!question.trim() && !defectText.trim())}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading
          ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /><span>בודק תקנים...</span></>
          : <><span>📋</span><span>בדוק לפי תקנים</span></>
        }
      </button>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {answer && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3" ref={answerRef}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">תוצאה — ניתן להעתיק ולשלב בדוח</span>
            <button
              onClick={copyAnswer}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-md transition-colors"
            >
              {copied ? '✓ הועתק' : 'העתק'}
            </button>
          </div>
          <Answer text={answer} />
        </div>
      )}

      {/* Usage tips */}
      {!answer && !loading && (
        <div className="text-xs text-slate-600 space-y-1 border-t border-slate-800 pt-4">
          <p className="text-slate-500 font-medium mb-2">דוגמאות לשאלות:</p>
          {[
            'מה תקן הסטיות המותרות בבנייה לפי ת.י. 789?',
            'איזה תקן מתייחס לאיטום גגות שטוחים?',
            'מה הדרישות לממ"ד לפי הגא 101?',
            'מה הכיסוי המינימלי לברזל זיון בבטון?',
            'מה תקן הבידוד האקוסטי בין דירות?',
          ].map((ex, i) => (
            <button
              key={i}
              onClick={() => setQuestion(ex)}
              className="block w-full text-right text-slate-500 hover:text-slate-300 transition-colors py-0.5"
            >
              ← {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
