export interface YMD {
  year: number;
  month: number;
  day: number;
}

export interface YearWeek {
  year: number;
  week: number;
}

export function weekday(date: YMD): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function sameDay(a: YMD, b: YMD): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function compareYmd(a: YMD, b: YMD): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function addDays(date: YMD, days: number): YMD {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function addMonths(date: YMD, delta: number): YMD {
  const utc = new Date(Date.UTC(date.year, date.month - 1 + delta, 1));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: 1 };
}

export function todayLocal(now = new Date()): YMD {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year: number): number {
  return isLeap(year) ? 366 : 365;
}

export function dayOfYear(date: YMD): number {
  const start = Date.UTC(date.year, 0, 1);
  const current = Date.UTC(date.year, date.month - 1, date.day);
  return Math.floor((current - start) / 86400000) + 1;
}

/** ISO week: Monday start, week 1 contains the first Thursday. */
export function isoWeek(date: YMD): YearWeek {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const weekYear = utc.getUTCFullYear();
  const yearStart = Date.UTC(weekYear, 0, 1);
  const week = Math.ceil(((utc.getTime() - yearStart) / 86400000 + 1) / 7);
  return { year: weekYear, week };
}

export function startOfIsoWeek(date: YMD): YMD {
  const dow = weekday(date);
  const delta = dow === 0 ? 6 : dow - 1;
  return addDays(date, -delta);
}

export function startOfWeek(date: YMD, weekStart: number): YMD {
  const delta = (weekday(date) - weekStart + 7) % 7;
  return addDays(date, -delta);
}

/**
 * Locale week rules aligned with Moment's common locales.
 * Sunday: en (dow 0, doy 6). Monday: ISO (dow 1, doy 4). Saturday: dow 6, doy 12.
 */
export function localeWeekRules(weekStart: number): { dow: number; doy: number } {
  if (weekStart === 1) return { dow: 1, doy: 4 };
  if (weekStart === 6) return { dow: 6, doy: 12 };
  if (weekStart === 0) return { dow: 0, doy: 6 };
  return { dow: weekStart, doy: 6 };
}

function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function firstWeekOffset(year: number, dow: number, doy: number): number {
  const fwd = 7 + dow - doy;
  const fwdlw = (7 + weekdayOf(year, 1, fwd) - dow) % 7;
  return -fwdlw + fwd - 1;
}

function weeksInYear(year: number, dow: number, doy: number): number {
  const weekOffset = firstWeekOffset(year, dow, doy);
  const weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
  return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
}

export function localeWeek(date: YMD, weekStart: number): YearWeek {
  const { dow, doy } = localeWeekRules(weekStart);
  const weekOffset = firstWeekOffset(date.year, dow, doy);
  const week = Math.floor((dayOfYear(date) - weekOffset - 1) / 7) + 1;
  if (week < 1) {
    return { year: date.year - 1, week: weeksInYear(date.year - 1, dow, doy) };
  }
  const count = weeksInYear(date.year, dow, doy);
  if (week > count) {
    return { year: date.year + 1, week: week - count };
  }
  return { year: date.year, week };
}

export function quarterOf(date: YMD): number {
  return Math.floor((date.month - 1) / 3) + 1;
}

export function eachDay(start: YMD, end: YMD): YMD[] {
  const out: YMD[] = [];
  for (let cursor = start; compareYmd(cursor, end) <= 0; cursor = addDays(cursor, 1)) {
    out.push(cursor);
  }
  return out;
}

export function localDayStartMs(date: YMD): number {
  return new Date(date.year, date.month - 1, date.day, 0, 0, 0, 0).getTime();
}

export function localDayEndMs(date: YMD): number {
  return new Date(date.year, date.month - 1, date.day, 23, 59, 59, 999).getTime();
}

export interface DateRange {
  start: YMD;
  end: YMD;
}

export function monthRange(date: YMD): DateRange {
  const start = { year: date.year, month: date.month, day: 1 };
  const end = { year: date.year, month: date.month, day: daysInMonth(date.year, date.month) };
  return { start, end };
}

export function quarterRange(date: YMD): DateRange {
  const quarter = quarterOf(date);
  const startMonth = (quarter - 1) * 3 + 1;
  const start = { year: date.year, month: startMonth, day: 1 };
  const endMonth = startMonth + 2;
  const end = { year: date.year, month: endMonth, day: daysInMonth(date.year, endMonth) };
  return { start, end };
}

export function yearRange(date: YMD): DateRange {
  return {
    start: { year: date.year, month: 1, day: 1 },
    end: { year: date.year, month: 12, day: 31 },
  };
}

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayHeaders(weekStart: number): string[] {
  return Array.from({ length: 7 }, (_, index) => SHORT_WEEKDAYS[(weekStart + index) % 7]);
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * First day of the week used by the system locale.
 * Intl weekInfo uses 1 (Monday) through 7 (Sunday).
 */
export function detectLocaleWeekStart(language?: string): number {
  try {
    const locale = new Intl.Locale(language || "en");
    const withWeek = locale as Intl.Locale & {
      weekInfo?: { firstDay?: number };
      getWeekInfo?: () => { firstDay?: number };
    };
    const info = withWeek.getWeekInfo?.() ?? withWeek.weekInfo;
    if (info && typeof info.firstDay === "number") {
      return info.firstDay === 7 ? 0 : info.firstDay;
    }
  } catch {
    // Locales without week info fall through.
  }
  return 0;
}
