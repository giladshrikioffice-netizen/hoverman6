# הוברמן 6 – מערכת ניהול פרויקט

## הפעלה מקומית (על המחשב שלך)

### דרישות מוקדמות
- Node.js גרסה 22 ומעלה

### שלב 1 – Backend (שרת)

```bash
cd backend
npm install
npm start
```

השרת יעלה על: http://localhost:3001

### שלב 2 – Frontend (ממשק)

בטרמינל חדש:

```bash
cd frontend
npm install
npm run dev
```

הממשק יפתח על: http://localhost:5173

---

## משתמשים לכניסה

| תפקיד | אימייל | סיסמה |
|---|---|---|
| מנהל פרויקט (אדמין) | gilad@hoverman6.co.il | admin123 |
| ועד – שירה | shira@hoverman6.co.il | 123456 |
| ועד – אהרון | aharon@hoverman6.co.il | 123456 |
| דייר לדוגמה | resident@hoverman6.co.il | 123456 |

---

## הרשאות

| פעולה | אדמין | ועד | דייר |
|---|---|---|---|
| צפייה בכל הנתונים | ✅ | ✅ | ✅ (חלקי) |
| הוספה/עריכה | ✅ | ✅ | רק פניות |
| מחיקה | ✅ | ❌ | ❌ |
| גבייה – עריכה | ✅ | ✅ | רק שלי |

---

## מבנה הפרויקט

```
hoverman6/
├── backend/
│   ├── src/
│   │   ├── index.js      ← נקודת כניסה לשרת
│   │   ├── db.js         ← מסד נתונים SQLite
│   │   ├── auth.js       ← JWT אימות
│   │   └── routes.js     ← כל ה-API endpoints
│   └── hoverman6.db      ← קובץ מסד הנתונים (נוצר אוטומטית)
└── frontend/
    └── src/
        ├── App.jsx
        ├── api.js         ← קריאות לשרת
        ├── AuthContext.jsx
        ├── pages/         ← כל המסכים
        └── components/    ← Layout, Navbar
```
