import { addDays, startOfWeek, weekday, type YMD } from "./dates";
import { clockFromDate, formatDate, type Clock } from "./format";
import type { PeriodKind } from "./settings";

const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export interface TemplateContext {
  title: string;
  date: YMD;
  now: Date;
  weekStart: number;
  dateFormat: string;
  timeFormat: string;
  period: PeriodKind;
}

function weekdayInSameWeek(date: YMD, targetDow: number, weekStart: number): YMD {
  const start = startOfWeek(date, weekStart);
  const delta = (targetDow - weekday(start) + 7) % 7;
  return addDays(start, delta);
}

function renderTag(tag: string, context: TemplateContext, clock: Clock): string {
  const colon = tag.indexOf(":");
  const key = (colon === -1 ? tag : tag.slice(0, colon)).trim().toLowerCase();
  const explicit = colon === -1 ? "" : tag.slice(colon + 1).trim();
  if (key === "title") return context.title;
  if (key === "date") return formatDate(context.date, explicit || context.dateFormat, context.weekStart, clock);
  if (key === "time") return formatDate(context.date, explicit || context.timeFormat, context.weekStart, clock);
  if (key === "yesterday") {
    return formatDate(addDays(context.date, -1), explicit || context.dateFormat, context.weekStart, clock);
  }
  if (key === "tomorrow") {
    return formatDate(addDays(context.date, 1), explicit || context.dateFormat, context.weekStart, clock);
  }
  const weekdayIndex = WEEKDAY_NAMES.indexOf(key as (typeof WEEKDAY_NAMES)[number]);
  if (weekdayIndex >= 0) {
    const day = weekdayInSameWeek(context.date, weekdayIndex, context.weekStart);
    return formatDate(day, explicit || context.dateFormat, context.weekStart, clock);
  }
  return `{{${tag}}}`;
}

/** Daily notes / Periodic Notes template tags. Unknown tags are left in place. */
export function fillTemplate(template: string, context: TemplateContext): string {
  const clock = clockFromDate(context.now);
  return template.replace(/\{\{([^{}]+)\}\}/g, (_match, tag: string) => renderTag(tag, context, clock));
}
