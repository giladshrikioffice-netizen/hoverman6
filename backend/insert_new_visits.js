/**
 * insert_new_visits.js
 * מכניס 3 ביקורי פיקוח חדשים לבניין הוברמן 6
 * תאריכים: 04.06.2026, 07.06.2026, 09.06.2026
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'gspro.db'));

// מצא את ה-building_id של הוברמן 6
const building = db.prepare("SELECT id FROM buildings WHERE name LIKE '%הוברמן%'").get();
if (!building) {
  console.error('❌ לא נמצא בניין הוברמן 6 במסד הנתונים');
  process.exit(1);
}
const bid = building.id;
console.log(`✅ נמצא: הוברמן 6 (building_id=${bid})`);

// בדוק אם הביקורים כבר קיימים
const existing = db.prepare('SELECT visit_date FROM updates WHERE building_id=?').all(bid).map(r => r.visit_date);
console.log('ביקורים קיימים:', existing.join(', ') || 'אין');

const visits = [
  {
    visit_date: '2026-06-04',
    summary: 'אישור בדיקת הצפה קומה 6 — מפלס מים יציב במשך 72 שעות. עבודות ריצוף פנימי בעיצומן בקומות 4–5. קבלן האלומיניום לא הגיע לתיאום שנקבע — כשל תיאום.',
    blockers: 'קבלן האלומיניום לא מגיע לפגישות תיאום שנקבעו. פיגומים בחזית צפון עדיין לא תקניים — חסרים מעקות בגובה קומה 5.',
    next_steps: 'התראה בכתב לקבלן האלומיניום על אי-עמידה בלוח זמנים. בדיקת פיגומים ע"י בונה מוסמך לפני המשך עבודה בחזית צפון.',
    author: 'גלעד שריקי'
  },
  {
    visit_date: '2026-06-07',
    summary: 'ביקורת ריצוף קומות 3–4: נמצאו מספר יחידות ללא נקז כפול — ליקוי חמור הדורש תיקון לפני אישור. חיבורי חשמל גלויים בחדרי ממ"ד לא אושרו ע"י חשמלאי מוסמך.',
    blockers: 'ריצוף בחלק מהיחידות בוצע ללא נקז כפול — נדרש פירוק ובנייה מחדש. חדירות חשמל לא תקניות בממ"דים — סיכון בטיחותי.',
    next_steps: 'הקבלן יגיש רשימת יחידות עם ליקויי נקז עד 10.06. חשמלאי מוסמך יבצע בדיקה ויחתום על תוכנית חשמל מעודכנת.',
    author: 'גלעד שריקי'
  },
  {
    visit_date: '2026-06-09',
    summary: 'ביצוע שליכט חיצוני בחזית דרום — עבודה החלה ביום שישי בצהריים ונפסקה בחצי. טיח פנים ממ"דים קומות 6–7 הושלם. בדיקת הצפה קומה 7 — מפלס יציב, אישור ניתן.',
    blockers: 'שליכט חיצוני בחזית דרום לא הושלם — הקבלן עצר עבודה לפני סוף יום שישי ולא חזר. אי-עקביות בעובי טיח בין יחידות שונות בקומה 6.',
    next_steps: 'השלמת שליכט חזית דרום עד 12.06. בדיקת עובי טיח בכל יחידות קומה 6 ותיעוד. תיאום עם קבלן צביעה לגבי לוח זמנים.',
    author: 'גלעד שריקי'
  }
];

const insert = db.prepare(
  'INSERT INTO updates (building_id,visit_date,summary,blockers,next_steps,author) VALUES (?,?,?,?,?,?)'
);

let added = 0;
for (const v of visits) {
  if (existing.includes(v.visit_date)) {
    console.log(`⏭️  ${v.visit_date} — כבר קיים, מדלג`);
    continue;
  }
  insert.run(bid, v.visit_date, v.summary, v.blockers, v.next_steps, v.author);
  console.log(`✅ הוכנס: ${v.visit_date}`);
  added++;
}

console.log(`\n🎉 סיום — ${added} ביקורים חדשים הוכנסו`);
console.log('כנס ל-GS.pro → יומן פיקוח ותראה את הביקורים החדשים');

db.close();
