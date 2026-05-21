const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export type DateInput = Date | number;

const toDate = (input: DateInput): Date => input instanceof Date ? input : new Date(input);

const pad2 = (n: number) => String(n).padStart(2, '0');

export function format(input: DateInput, pattern: string): string {
  const date = toDate(input);
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const h24 = date.getHours();
  const min = date.getMinutes();
  const h12 = ((h24 + 11) % 12) + 1;
  const ampm = h24 < 12 ? 'AM' : 'PM';

  const tokens: Array<[RegExp, string]> = [
    [/yyyy/g, String(y)],
    [/MMM/g,  MONTHS_SHORT[m]],
    [/MM/g,   pad2(m + 1)],
    [/dd/g,   pad2(d)],
    [/EEE/g,  WEEKDAYS_SHORT[date.getDay()]],
    [/\bd\b/g, String(d)],
    [/\bh\b/g, String(h12)],
    [/mm/g,   pad2(min)],
    [/\ba\b/g, ampm],
  ];

  let out = pattern;
  for (const [re, val] of tokens) out = out.replace(re, val);
  return out;
}

export function subDays(input: DateInput, n: number): Date {
  const r = new Date(toDate(input));
  r.setDate(r.getDate() - n);
  return r;
}

export function addWeeks(input: DateInput, n: number): Date {
  const r = new Date(toDate(input));
  r.setDate(r.getDate() + n * 7);
  return r;
}

export function subWeeks(input: DateInput, n: number): Date {
  return addWeeks(input, -n);
}

type WeekOpts = { weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 };

export function startOfWeek(input: DateInput, opts: WeekOpts = {}): Date {
  const weekStartsOn = opts.weekStartsOn ?? 0;
  const r = new Date(toDate(input));
  r.setHours(0, 0, 0, 0);
  const day = r.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  r.setDate(r.getDate() - diff);
  return r;
}

export function endOfWeek(input: DateInput, opts: WeekOpts = {}): Date {
  const start = startOfWeek(input, opts);
  const r = new Date(start);
  r.setDate(r.getDate() + 6);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function eachDayOfInterval({ start, end }: { start: DateInput; end: DateInput }): Date[] {
  const days: Date[] = [];
  const cur = new Date(toDate(start));
  cur.setHours(0, 0, 0, 0);
  const stop = new Date(toDate(end));
  stop.setHours(0, 0, 0, 0);
  while (cur.getTime() <= stop.getTime()) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  const da = toDate(a);
  const db = toDate(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}
