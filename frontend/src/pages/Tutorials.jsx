import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Tutorials() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', url: '', description: '' });
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { api.tutorials.list().then(setItems).catch(e => setErr(e.message)); }, []);

  const submit = async () => {
    try {
      const r = await api.tutorials.create(form);
      setItems(p => [r, ...p]);
      setForm({ title: '', url: '', description: '' });
      setShowNew(false);
    } catch(e) { setErr(e.message); }
  };

  const del = async id => {
    await api.tutorials.del(id).catch(e => setErr(e.message));
    setItems(p => p.filter(x => x.id !== id));
  };

  const getYoutubeId = url => {
    const m = url?.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
    return m ? m[1] : null;
  };

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">🎓 מדריכים וסרטוני הדרכה</h2>
        {isSuperAdmin && (
          <button onClick={() => setShowNew(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm">
            + הוסף מדריך
          </button>
        )}
      </div>

      {err && <div className="bg-red-900/30 border border-red-700 text-red-400 px-3 py-2 rounded mb-3 text-sm">{err}</div>}

      {items.length === 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-slate-300 font-medium">מדריכי הדרכה יתווספו בקרוב</p>
          <p className="text-slate-500 text-sm mt-1">כאן תוכלו למצוא סרטוני הסבר על השימוש במערכת</p>
        </div>
      )}

      <div className="space-y-4">
        {items.map(item => {
          const ytId = getYoutubeId(item.url);
          return (
            <div key={item.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-white">{item.title}</h3>
                {isSuperAdmin && <button onClick={() => del(item.id)} className="text-red-400 hover:text-red-300 text-xs">🗑️</button>}
              </div>
              {item.description && <p className="text-slate-400 text-sm mb-3">{item.description}</p>}
              {ytId && (
                <div className="rounded-lg overflow-hidden aspect-video bg-slate-800">
                  <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen />
                </div>
              )}
              {item.url && !ytId && (
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm underline">
                  צפה במדריך ←
                </a>
              )}
            </div>
          );
        })}
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">מדריך חדש</h3>
            {[['title','כותרת'],['url','קישור (YouTube / URL)'],['description','תיאור']].map(([k,l]) => (
              <div key={k} className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">{l}</label>
                <input value={form[k]} onChange={e => setForm(p=>({...p,[k]:e.target.value}))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="flex gap-2 justify-end mt-2">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm">ביטול</button>
              <button onClick={submit} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">שמירה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
