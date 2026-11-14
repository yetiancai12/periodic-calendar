import {
  daysInMonth,
  isoWeek,
  localeWeek,
  quarterOf,
  startOfWeek,
  weekday,
  weekdayHeaders,
  addDays,
  sameDay,
  type YMD,
} from "./dates";

export interface CalendarDay {
  date: YMD;
  inMonth: boolean;
  isToday: boolean;
}

export interface CalendarWeek {
  weekNumber: number;
  weekYear: number;
  /** Date used to open the weekly note for this row. */
  anchor: YMD;
  days: CalendarDay[];
}

export interface CalendarModel {
  year: number;
  month: number;
  quarter: number;
  weekdayLabels: string[];
  weeks: CalendarWeek[];
}

export type WeekNumbering = "iso" | "locale";

function rowAnchor(days: CalendarDay[], numbering: WeekNumbering): YMD {
  if (numbering === "iso") {
    const thursday = days.find((day) => weekday(day.date) === 4);
    return thursday?.date ?? days[0].date;
  }
  return days[0].date;
}

/** Month grid. Week numbers follow the weekly filename format (ISO or locale). */
export function buildCalendar(
  year: number,
  month: number,
  today: YMD,
  weekStart: number,
  numbering: WeekNumbering,
): CalendarModel {
  const first = { year, month, day: 1 };
  let cursor = startOfWeek(first, weekStart);
  const lastDay = daysInMonth(year, month);
  const weeks: CalendarWeek[] = [];
  let includedLast = false;

  while (weeks.length < 6) {
    const days: CalendarDay[] = [];
    for (let index = 0; index < 7; index++) {
      days.push({
        date: cursor,
        inMonth: cursor.year === year && cursor.month === month,
        isToday: sameDay(cursor, today),
      });
      if (cursor.year === year && cursor.month === month && cursor.day === lastDay) includedLast = true;
      cursor = addDays(cursor, 1);
    }
    const anchor = rowAnchor(days, numbering);
    const info = numbering === "iso" ? isoWeek(anchor) : localeWeek(anchor, weekStart);
    weeks.push({ weekNumber: info.week, weekYear: info.year, anchor, days });
    if (includedLast) break;
  }

  return {
    year,
    month,
    quarter: quarterOf(first),
    weekdayLabels: weekdayHeaders(weekStart),
    weeks,
  };
}

export type CalendarClick =
  | { kind: "day"; date: YMD }
  | { kind: "week"; date: YMD }
  | { kind: "month"; year: number; month: number }
  | { kind: "quarter"; year: number; quarter: number }
  | { kind: "year"; year: number };

export function dateForClick(click: CalendarClick): YMD {
  if (click.kind === "day" || click.kind === "week") return click.date;
  if (click.kind === "month") return { year: click.year, month: click.month, day: 1 };
  if (click.kind === "quarter") return { year: click.year, month: (click.quarter - 1) * 3 + 1, day: 1 };
  return { year: click.year, month: 1, day: 1 };
}
