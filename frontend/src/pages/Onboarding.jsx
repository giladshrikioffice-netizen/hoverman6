import { useState } from 'react';
import { useAuth } from '../AuthContext';

const ROLE_CONTENT = {
  superadmin: {
    title: 'ברוך הבא, גלעד',
    sub: 'GS.pro — פיקוח הנדסי וניהול בניינים במקום אחד',
    steps: [
      {
        icon: '🏗️',
        title: 'תיק בניין דיגיטלי',
        text: 'כל בניין מקבל תיק מלא — חוזים, תקציב, יומן פיקוח, תחזוקה ואנשי מקצוע. מה שאף מתחרה לא נותן.',
      },
      {
        icon: '📋',
        title: 'יומן פיקוח הנדסי',
        text: 'תעד כל ביקור, חסמים וצעדים הבאים. הדיירים רואים מה קורה בבניין שלהם בזמן אמת.',
      },
      {
        icon: '🔧',
        title: 'תחזוקה שוטפת עם התראות',
        text: 'צ׳קליסט תחזוקה אוטומטי — התראות 14 יום מראש לכל פריט. מתאים גם לבניינים ללא פיקוח.',
      },
      {
        icon: '🏢',
        title: 'ניהול מרובה בניינים',
        text: 'נהל כמה בניינים במקביל — כל אחד מבודד לחלוטין. הוסף בניין חדש ב-30 שניות.',
      },
    ],
  },
  committee: {
    title: 'ברוכים הבאים לוועד הבית',
    sub: 'תיק הבניין שלכם — הכל במקום אחד',
    steps: [
      {
        icon: '🏗️',
        title: 'הבניין שלכם בשקיפות מלאה',
        text: 'מעקב אחרי קבלנים, תקציב, החלטות ועדכוני פיקוח — הכל נגיש לכם ולדיירים בכל רגע.',
      },
      {
        icon: '🔧',
        title: 'תחזוקה שוטפת',
        text: 'צ׳קליסט תחזוקה עם תזכורות אוטומטיות — מעלית, גנרטור, ביטוח, ניקיון ועוד.',
      },
      {
        icon: '⭐',
        title: 'ספריית בעלי מקצוע',
        text: 'שמרו את אנשי המקצוע שעבדתם איתם עם דירוגים, מחירים ותאריכי שירות אחרונים.',
      },
      {
        icon: '📩',
        title: 'ניהול פניות דיירים',
        text: 'קבלו פניות ישירות מהדיירים, עדכנו סטטוס וסגרו לופ — הכל בממשק אחד.',
      },
    ],
  },
  resident: {
    title: 'ברוכים הבאים',
    sub: 'המידע על הבניין שלכם — שקוף ונגיש',
    steps: [
      {
        icon: '🏗️',
        title: 'מה קורה בבניין שלי?',
        text: 'ראו עדכוני פיקוח, החלטות ועד ומצב הפרויקט — בזמן אמת, ללא צורך לשאול.',
      },
      {
        icon: '💳',
        title: 'מצב התשלום שלי',
        text: 'צפו ביתרת התשלום ובמצב החוב שלכם בכל עת.',
      },
      {
        icon: '📩',
        title: 'פנייה ישירה לוועד',
        text: 'שלחו פנייה לוועד הבית וקבלו עדכון על הטיפול — הכל מתועד.',
      },
    ],
  },
};

export default function Onboarding({ onDone }) {
  const { user, isSupervision } = useAuth();
  const role = user?.role === 'admin' ? 'committee' : (user?.role || 'resident');
  const content = ROLE_CONTENT[role] || ROLE_CONTENT.resident;
  const [step, setStep] = useState(0);
  const total = content.steps.length;

  const finish = () => {
    localStorage.setItem('onboarding_done', '1');
    onDone();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg" dir="rtl">

        {/* Logo + title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-3 shadow-lg shadow-blue-600/30">
            <span className="text-white font-black text-xl">GS</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{content.title}</h1>
          <p className="text-slate-400 text-sm mt-1">{content.sub}</p>
          {isSupervision && role !== 'superadmin' && (
            <span className="inline-block mt-2 bg-blue-600/20 border border-blue-600/40 text-blue-400 text-xs px-3 py-1 rounded-full">
              🏗️ בניין בפיקוח הנדסי — גלעד שריקי פרוייקטים
            </span>
          )}
          {!isSupervision && role !== 'superadmin' && (
            <span className="inline-block mt-2 bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 text-xs px-3 py-1 rounded-full">
              🔧 בניין בתחזוקה שוטפת
            </span>
          )}
        </div>

        {/* Step card */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center mb-4 min-h-[11rem] flex flex-col items-center justify-center">
          <div className="text-5xl mb-4">{content.steps[step].icon}</div>
          <h2 className="text-xl font-bold text-white mb-2">{content.steps[step].title}</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{content.steps[step].text}</p>
        </div>

        {/* Step counter */}
        <div className="flex justify-center gap-2 mb-6">
          {content.steps.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${i === step ? 'bg-blue-500 w-6' : 'bg-slate-600 w-2'}`} />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-1 border border-slate-600 text-slate-300 py-2.5 rounded-xl text-sm hover:bg-slate-800 transition-colors">
              הקודם
            </button>
          )}
          {step < total - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              הבא ←
            </button>
          ) : (
            <button onClick={finish}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20">
              כניסה למערכת →
            </button>
          )}
        </div>

        <button onClick={finish} className="w-full text-center text-slate-600 text-xs mt-4 hover:text-slate-400 transition-colors">
          דלג
        </button>

      </div>
    </div>
  );
}
