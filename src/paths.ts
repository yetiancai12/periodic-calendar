import { quarterOf, startOfIsoWeek, startOfWeek, type YMD } from "./dates";
import { formatDate, formatUsesDayOfMonth, weekNumberingForFormat } from "./format";
import { DEFAULT_FORMATS, type PeriodConfig, type PeriodKind, type PluginSettings } from "./settings";

export function joinNotePath(folder: string, formatted: string): string {
  const combined = [folder, formatted].filter((part) => part && part.trim()).join("/");
  const cleaned: string[] = [];
  for (const part of combined.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      cleaned.pop();
      continue;
    }
    cleaned.push(part);
  }
  let path = cleaned.join("/");
  if (!path.toLowerCase().endsWith(".md")) path += ".md";
  return path;
}

export function parentFolder(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

export function anchorFor(period: PeriodKind, date: YMD, weekStart: number, format: string): YMD {
  if (period === "daily") return date;
  if (period === "weekly") {
    if (formatUsesDayOfMonth(format)) {
      return weekNumberingForFormat(format) === "iso" ? startOfIsoWeek(date) : startOfWeek(date, weekStart);
    }
    return date;
  }
  if (period === "monthly") return { year: date.year, month: date.month, day: 1 };
  if (period === "quarterly") {
    const quarter = quarterOf(date);
    return { year: date.year, month: (quarter - 1) * 3 + 1, day: 1 };
  }
  return { year: date.year, month: 1, day: 1 };
}

export function notePath(period: PeriodKind, date: YMD, config: PeriodConfig, weekStart: number): string {
  const format = config.format.trim() || DEFAULT_FORMATS[period];
  const anchor = anchorFor(period, date, weekStart, format);
  return joinNotePath(config.folder, formatDate(anchor, format, weekStart));
}

export function reviewNotePath(settings: PluginSettings, period: "weekly" | "monthly", date: YMD): string {
  const format = period === "weekly" ? settings.weeklyReviewFormat : settings.monthlyReviewFormat;
  const anchor = anchorFor(period, date, settings.weekStart, format);
  return joinNotePath(settings.reviewFolder, formatDate(anchor, format, settings.weekStart));
}

export function reviewTitle(settings: PluginSettings, period: "weekly" | "monthly", date: YMD): string {
  const format = period === "weekly" ? settings.weeklyReviewFormat : settings.monthlyReviewFormat;
  const anchor = anchorFor(period, date, settings.weekStart, format);
  return formatDate(anchor, format, settings.weekStart);
}
