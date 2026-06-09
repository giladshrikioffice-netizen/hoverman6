import { useState, useEffect } from 'react';
import { api } from '../api';

const MODULE_LABELS = {
  payments: '💳 גבייה',
  complaints: '📩 פניות',
  updates: '📅 עדכונים',
  decisions: '📋 החלטות',
  maintenance: '🔧 תחזוקה',
  professionals: '⭐ אנשי מקצוע',
  tutorials: '🎓 מדריכים',
};

export default function PermissionsManager() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    api.permissions.all()
      .then(data => { setUnits(data); setLoading(false); })
      .catch(() => { setError('שגיאה בטעינת ההרשאות'); setLoading(false); });
  }, []);

  const toggle = async (unit_id, mod, current) => {
    const key = `${unit_id}_${mod}`;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await api.permissions.update(unit_id, mod, !current);
      setUnits(prev => prev.map(u =>
        u.unit_id === unit_id
          ? { ...u, perms: { ...u.perms, [mod]: !current ? 1 : 0 } }
          : u
      ));
    } catch {
      setError('שגיאה בשמירה');
    }
    setSaving(s => ({ ...s, [key]: false }));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400">טוען הרשאות...</div>
    </div>
  );

  return (
    <div dir="rtl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">🔐 הרשאות דיירים</h1>
        <p className="text-slate-400 text-sm mt-1">קבעו לאילו מודולים כל דייר יכול לגשת</p>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm px-4 py-2 rounded-lg mb-4">
          {error}
        </div>
      )}

      {units.length === 0 ? (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 text-center text-slate-500">
          אין דיירים רשומים עם חשבון משתמש
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-right px-4 py-3 text-slate-300 font-semibold">דירה</th>
                <th className="text-right px-4 py-3 text-slate-300 font-semibold">דייר</th>
                {Object.entries(MODULE_LABELS).map(([mod, label]) => (
                  <th key={mod} className="text-center px-3 py-3 text-slate-300 font-semibold whitespace-nowrap">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u, i) => (
                <tr key={u.unit_id}
                  className={`border-b border-slate-800 ${i % 2 === 0 ? '' : 'bg-slate-900/40'} hover:bg-slate-800/30 transition-colors`}>
                  <td className="px-4 py-3 text-white font-semibold">דירה {u.unit_number}</td>
                  <td className="px-4 py-3 text-slate-300">{u.resident_name || '—'}</td>
                  {Object.keys(MODULE_LABELS).map(mod => {
                    const enabled = u.perms?.[mod] !== 0;
                    const key = `${u.unit_id}_${mod}`;
                    return (
                      <td key={mod} className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggle(u.unit_id, mod, enabled)}
                          disabled={saving[key]}
                          className={`w-10 h-6 rounded-full transition-all relative ${
                            enabled ? 'bg-blue-600' : 'bg-slate-700'
                          } ${saving[key] ? 'opacity-50' : 'hover:opacity-80'}`}
                        >
                          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                            enabled ? 'right-1' : 'left-1'
                          }`} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
