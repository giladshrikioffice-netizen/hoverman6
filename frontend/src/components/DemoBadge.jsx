// Highlights data that was seeded by the system (is_demo=1) and not entered by the user,
// so it can be reviewed, verified, or replaced. See req #1.
export default function DemoBadge({ show }) {
  if (!show) return null;
  return (
    <span
      title="נתון לדוגמה שנוצר אוטומטית — לאימות/החלפה"
      className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
    >
      ⚠️ לדוגמה
    </span>
  );
}

// Tailwind class to tint a whole row/card that is demo data.
export const demoTint = (isDemo) => isDemo ? 'ring-1 ring-amber-500/30 bg-amber-500/5' : '';
