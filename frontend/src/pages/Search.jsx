import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';

const KIND_LABEL = {
  new: 'ביקור פיקוח', status: 'סטטוס פרויקט', archive: 'ארכיון',
  email: 'מייל / התכתבות', event: 'אירוע', visit: 'ביקור',
};
const KIND_COLOR = {
  new: 'bg-blue-600/20 text-blue-300 border-blue-600/40',
  status: 'bg-amber-600/20 text-amber-300 border-amber-600/40',
  archive: 'bg-slate-600/20 text-slate-400 border-slate-600/40',
  email: 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40',
  event: 'bg-purple-600/20 text-purple-300 border-purple-600/40',
};

function highlight(text, terms) {
  if (!text || !terms.length) return text;
  const re = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p)
      ? <mark key={i} className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">{p}</mark>
      : p
  );
}

function Snippet({ label, text, terms }) {
  if (!text || !text.trim()) return null;
  // Find the first match position and show context around it
  const lower = text.toLowerCase();
  const firstHit = terms.reduce((pos, t) => {
    const i = lower.indexOf(t.toLowerCase());
    return i >= 0 && (pos < 0 || i < pos) ? i : pos;
  }, -1);
  const start = Math.max(0, firstHit - 60);
  const end = Math.min(text.length, firstHit + 200);
  const excerpt = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');

  return (
    <div className="mt-1.5">
      <span className="text-xs text-slate-500 ml-1">{label}:</span>
      <span className="text-sm text-slate-300">{highlight(excerpt, terms)}</span>
    </div>
  );
}

function ResultCard({ item, terms }) {
  const [open, setOpen] = useState(false);
  const kindLabel = KIND_LABEL[item.kind] || item.kind;
  const kindCls = KIND_COLOR[item.kind] || 'bg-slate-600/20 text-slate-400 border-slate-600/40';

  const fields = [
    { label: 'סיכום / תוכן', text: item.summary },
    { label: 'חוסמים / דגשים', text: item.blockers },
    { label: 'משימות להמשך', text: item.next_steps },
    { label: 'הערות QC / בטיחות', text: item.qc_notes },
    { label: 'הערות כלליות', text: item.general_notes },
  ].filter(f => f.text && f.text.trim());

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-slate-500 text-xs">{item.visit_date}</span>
            <span className={`border text-xs px-1.5 py-0.5 rounded-full ${kindCls}`}>{kindLabel}</span>
          </div>
          <h3 className="text-white font-medium text-sm leading-snug">
            {highlight(item.title || 'ללא כותרת', terms)}
          </h3>
        </div>
        {fields.length > 0 && (
          <button onClick={() => setOpen(o => !o)}
            className="text-slate-400 hover:text-white text-xs flex-shrink-0 mt-0.5 transition-colors">
            {open ? '▲ פחות' : '▼ פרטים'}
          </button>
        )}
      </div>

      {/* Always show first snippet */}
      {fields.slice(0, 1).map(f => <Snippet key={f.label} label={f.label} text={f.text} terms={terms} />)}

      {/* Expanded: show all fields */}
      {open && fields.slice(1).map(f => <Snippet key={f.label} label={f.label} text={f.text} terms={terms} />)}
    </div>
  );
}

export default function Search() {
  const { user, building } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  const [query, setQuery] = useState('');
  const [selectedBid, setSelectedBid] = useState(building?.id || '');
  const [allBuildings, setAllBuildings] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  // Load buildings list for superadmin project switcher
  useEffect(() => {
    if (isSuperadmin) {
      api.buildings.list().then(bs => {
        setAllBuildings(bs);
        if (!selectedBid && bs.length > 0) setSelectedBid(String(bs[0].id));
      }).catch(() => {});
    }
  }, []);

  const doSearch = useCallback(async (q, bid) => {
    if (!q.trim() || q.trim().length < 2) { setResults(null); return; }
    setLoading(true); setError('');
    try {
      const data = await api.search(q.trim(), bid);
      setResults(data);
    } catch (e) {
      setError(e.message || 'שגיאה בחיפוש');
      setResults(null);
    } finally { setLoading(false); }
  }, []);

  const handleInput = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val, selectedBid), 350);
  };

  const handleBidChange = (bid) => {
    setSelectedBid(bid);
    if (query.trim().length >= 2) doSearch(query, bid);
  };

  const terms = query.trim().split(/\s+/).filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto space-y-5" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-white mb-1">🔍 חיפוש בפרויקט</h1>
        <p className="text-slate-400 text-sm">חפש בכל הביקורים, ההתכתבויות, הדוחות והמיילים של הפרויקט</p>
      </div>

      {/* Search controls */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
        {/* Project selector — superadmin only */}
        {isSuperadmin && allBuildings && allBuildings.length > 1 && (
          <div>
            <label className="text-xs text-slate-400 block mb-1">פרויקט</label>
            <select
              value={selectedBid}
              onChange={e => handleBidChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {allBuildings.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Search box */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder="הקלד נושא לחיפוש... (למשל: ממ״ד, טייח, חשמל, מעלית)"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            autoFocus
          />
          {loading && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">⟳</div>
          )}
        </div>

        {query.trim().length >= 2 && (
          <p className="text-xs text-slate-500">
            מחפש: {terms.map(t => <span key={t} className="text-slate-300 mx-0.5">"{t}"</span>)}
          </p>
        )}
      </div>

      {/* Results */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-300 text-sm">{error}</div>
      )}

      {results !== null && !loading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-400">
              {results.length === 0
                ? 'לא נמצאו תוצאות'
                : `נמצאו ${results.length} תוצאות`}
            </span>
            {results.length > 0 && (
              <div className="flex gap-2 text-xs text-slate-500">
                {Object.entries(
                  results.reduce((acc, r) => {
                    const k = KIND_LABEL[r.kind] || r.kind;
                    acc[k] = (acc[k] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([k, c]) => <span key={k}>{k}: {c}</span>)}
              </div>
            )}
          </div>

          {results.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <div className="text-4xl mb-3">🔍</div>
              <p>לא נמצאו רשומות שמכילות את <span className="text-slate-300">"{query}"</span></p>
              <p className="text-xs mt-2">נסה מילה אחרת או חלק מהמילה</p>
            </div>
          )}

          <div className="space-y-3">
            {results.map(item => (
              <ResultCard key={item.id} item={item} terms={terms} />
            ))}
          </div>
        </div>
      )}

      {results === null && !loading && !query && (
        <div className="text-center py-16 text-slate-600">
          <div className="text-5xl mb-4">🔎</div>
          <p className="text-slate-400">הקלד נושא כלשהו — הוברמן, פיגום, ממ"ד, חשבונית...</p>
          <p className="text-sm mt-2">החיפוש עובר על כל הביקורים, הדוחות וההתכתבויות</p>
        </div>
      )}
    </div>
  );
}
