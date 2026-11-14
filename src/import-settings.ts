import { defaultSettings, type PeriodConfig, type PluginSettings } from "./settings";

export interface ExternalSettingsSources {
  dailyNotes?: unknown;
  periodicNotes?: unknown;
  calendar?: unknown;
  templates?: unknown;
  localeWeekStart: number;
}

const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function applyPeriod(target: PeriodConfig, source: unknown, allowDisable: boolean): void {
  if (!source || typeof source !== "object") return;
  const record = source as Record<string, unknown>;
  const format = readString(record, "format");
  const folder = readString(record, "folder");
  const template = readString(record, "template");
  if (format && format.trim()) target.format = format.trim();
  if (folder && folder.trim()) target.folder = folder.trim();
  if (template && template.trim()) target.template = template.trim();
  if (allowDisable && typeof record.enabled === "boolean") {
    const configured = Boolean(format?.trim() || folder?.trim() || template?.trim());
    // An untouched period is often stored as enabled:false with empty fields.
    // Only an explicit disable of a period that has settings turns the control off.
    if (record.enabled || configured) target.enabled = record.enabled;
  }
}

export function weekStartFromCalendar(value: unknown, localeWeekStart: number): number {
  if (typeof value === "number" && value >= 0 && value <= 6) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const named = WEEKDAY_NAMES.indexOf(normalized);
    if (named >= 0) return named;
  }
  return localeWeekStart;
}

/**
 * Read folder, format, and template fields already stored by Daily notes,
 * Periodic Notes, and Calendar. Empty Periodic Notes strings do not override
 * a core Daily notes value.
 */
export function importExternalSettings(sources: ExternalSettingsSources): PluginSettings {
  const settings = defaultSettings(sources.localeWeekStart);
  const dailyNotes =
    sources.dailyNotes && typeof sources.dailyNotes === "object"
      ? (sources.dailyNotes as Record<string, unknown>)
      : undefined;
  if (dailyNotes) {
    applyPeriod(settings.daily, dailyNotes, false);
  }

  const periodic =
    sources.periodicNotes && typeof sources.periodicNotes === "object"
      ? (sources.periodicNotes as Record<string, unknown>)
      : undefined;
  if (periodic) {
    applyPeriod(settings.daily, periodic.daily, false);
    applyPeriod(settings.weekly, periodic.weekly, false);
    applyPeriod(settings.monthly, periodic.monthly, false);
    applyPeriod(settings.quarterly, periodic.quarterly, true);
    applyPeriod(settings.yearly, periodic.yearly, true);
  }

  const calendar =
    sources.calendar && typeof sources.calendar === "object"
      ? (sources.calendar as Record<string, unknown>)
      : undefined;
  if (calendar && "weekStart" in calendar) {
    settings.weekStart = weekStartFromCalendar(calendar.weekStart, sources.localeWeekStart);
  }

  const templates =
    sources.templates && typeof sources.templates === "object"
      ? (sources.templates as Record<string, unknown>)
      : undefined;
  if (templates) {
    const dateFormat = readString(templates, "dateFormat");
    const timeFormat = readString(templates, "timeFormat");
    if (dateFormat && dateFormat.trim()) settings.dateFormat = dateFormat.trim();
    if (timeFormat && timeFormat.trim()) settings.timeFormat = timeFormat.trim();
  }

  settings.daily.enabled = true;
  settings.weekly.enabled = true;
  settings.monthly.enabled = true;
  settings.hasImportedExternal = true;
  return settings;
}
