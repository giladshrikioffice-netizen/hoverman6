// Parses a pasted engineering visit summary into structured fields, and splits
// an archive document into separate visit records. Label-based, no AI — never invents data.

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

// Try to extract a YYYY-MM-DD date from a piece of text. Returns '' if none.
export function parseDate(text) {
  if (!text) return '';
  const t = text.replace(/[״"']/g, '');
  // ISO
  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  m = t.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (m) { let y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${pad(m[2])}-${pad(m[1])}`; }
  // Hebrew: "15 במרץ 2026" / "15 מרץ 2026"
  m = t.match(/(\d{1,2})\s*ב?\s*(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*,?\s*(\d{4})/);
  if (m) { const mo = HE_MONTHS.indexOf(m[2]) + 1; return `${m[3]}-${pad(mo)}-${pad(m[1])}`; }
  return '';
}
const pad = n => String(n).padStart(2, '0');

const LABELS = [
  { key: 'date',    re: /תאריך\s*:?/ },
  { key: 'time',    re: /שעה\s*:?/ },
  { key: 'project', re: /פרויקט\s*:?/ },
  { key: 'exec',    re: /ביצוע\s*נוכחי\s*:?/ },
  { key: 'tasks',   re: /משימות\s*לפי\s*קבלן\s*:?/ },
  { key: 'urgent',  re: /דגשים\s*דחופים\s*:?/ },
  { key: 'qc',      re: /הערות\s*תקן\s*\/?\s*בטיחות?\s*:?/ },
  { key: 'next',    re: /משימה\s*להמשך\s*:?/ },
];

export function parseVisitSummary(input) {
  // Strip markdown noise so labels match cleanly.
  const text = (input || '').replace(/\*\*/g, '').replace(/^#+\s*/gm, '').replace(/\r/g, '');
  // Find first occurrence of each label.
  const found = [];
  for (const l of LABELS) {
    const m = l.re.exec(text);
    if (m) found.push({ key: l.key, labelStart: m.index, contentStart: m.index + m[0].length });
  }
  found.sort((a, b) => a.labelStart - b.labelStart);

  const block = {};
  for (let i = 0; i < found.length; i++) {
    const end = i + 1 < found.length ? found[i + 1].labelStart : text.length;
    block[found[i].key] = text.slice(found[i].contentStart, end).trim();
  }

  // Anything before the first recognized label = preamble → general notes.
  const preamble = found.length ? text.slice(0, found[0].labelStart).trim() : text.trim();

  // Tasks: each line "קבלן: משימה"
  const tasks = (block.tasks || '').split('\n').map(s => s.replace(/^[-•*\s]+/, '').trim()).filter(Boolean).map(line => {
    const idx = line.indexOf(':');
    if (idx > 0) return { contractor: line.slice(0, idx).trim(), task: line.slice(idx + 1).trim() };
    return { contractor: '', task: line };
  });

  const visit_date = parseDate(((block.date || '') + ' ' + (block.time || '')).trim());

  const result = {
    visit_date,
    project: block.project || '',
    summary: block.exec || '',       // "ביצוע נוכחי"
    tasks,
    blockers: block.urgent || '',    // "דגשים דחופים"
    qc_notes: block.qc || '',        // "הערות תקן/בטיחות"
    next_steps: block.next || '',    // "משימה להמשך"
    general_notes: preamble,
    needsReview: found.length === 0, // no labels recognized at all
  };
  return result;
}

// Split an archive document (many summaries) into separate visit records.
// A new visit starts at a line containing the word "סיכום".
export function splitArchive(input) {
  const text = (input || '').replace(/\r/g, '');
  const lines = text.split('\n');
  const starts = [];
  lines.forEach((line, i) => { if (/סיכום/.test(line) && line.trim().length < 120) starts.push(i); });
  if (!starts.length) return [{ title: 'סיכום ביקור', visit_date: parseDate(text), raw_text: text.trim() }];
  const records = [];
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const chunk = lines.slice(from, to).join('\n').trim();
    const title = lines[from].trim();
    // look for a date in the first few lines of the chunk
    const visit_date = parseDate(lines.slice(from, from + 4).join(' '));
    records.push({ title, visit_date, raw_text: chunk });
  }
  return records;
}
