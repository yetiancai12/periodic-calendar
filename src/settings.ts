export type PeriodKind = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface PeriodConfig {
  folder: string;
  format: string;
  template: string;
  enabled: boolean;
}

export interface LicenseCache {
  key: string;
  valid: boolean;
  reason: string;
  message: string;
  checkedAt: number;
}

export interface PluginSettings {
  weekStart: number;
  hasImportedExternal: boolean;
  daily: PeriodConfig;
  weekly: PeriodConfig;
  monthly: PeriodConfig;
  quarterly: PeriodConfig;
  yearly: PeriodConfig;
  reviewFolder: string;
  weeklyReviewFormat: string;
  monthlyReviewFormat: string;
  excludeFolders: string;
  licenseKey: string;
  licenseCache: LicenseCache | null;
  dateFormat: string;
  timeFormat: string;
}

export const DEFAULT_FORMATS: Record<PeriodKind, string> = {
  daily: "YYYY-MM-DD",
  weekly: "gggg-[W]ww",
  monthly: "YYYY-MM",
  quarterly: "YYYY-[Q]Q",
  yearly: "YYYY",
};

function period(format: string, enabled: boolean): PeriodConfig {
  return { folder: "", format, template: "", enabled };
}

export function defaultSettings(weekStart = 1): PluginSettings {
  return {
    weekStart,
    hasImportedExternal: false,
    daily: period(DEFAULT_FORMATS.daily, true),
    weekly: period(DEFAULT_FORMATS.weekly, true),
    monthly: period(DEFAULT_FORMATS.monthly, true),
    quarterly: period(DEFAULT_FORMATS.quarterly, true),
    yearly: period(DEFAULT_FORMATS.yearly, true),
    reviewFolder: "Reviews",
    weeklyReviewFormat: "GGGG-[W]WW [Weekly Review]",
    monthlyReviewFormat: "YYYY-MM [Monthly Review]",
    excludeFolders: "",
    licenseKey: "",
    licenseCache: null,
    dateFormat: "YYYY-MM-DD",
    timeFormat: "HH:mm",
  };
}

function asPeriod(value: unknown, fallback: PeriodConfig): PeriodConfig {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Partial<PeriodConfig>;
  return {
    folder: typeof record.folder === "string" ? record.folder : fallback.folder,
    format: typeof record.format === "string" && record.format.trim() ? record.format : fallback.format,
    template: typeof record.template === "string" ? record.template : fallback.template,
    enabled: typeof record.enabled === "boolean" ? record.enabled : fallback.enabled,
  };
}

function asCache(value: unknown): LicenseCache | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<LicenseCache>;
  if (typeof record.key !== "string" || typeof record.checkedAt !== "number") return null;
  if (typeof record.valid !== "boolean" || typeof record.reason !== "string" || typeof record.message !== "string") {
    return null;
  }
  return {
    key: record.key,
    valid: record.valid,
    reason: record.reason,
    message: record.message,
    checkedAt: record.checkedAt,
  };
}

/** Fill anything missing so a saved data.json from an older build still loads. */
export function resolveSettings(saved: unknown, localeWeekStart = 1): PluginSettings {
  const defaults = defaultSettings(localeWeekStart);
  if (!saved || typeof saved !== "object") return defaults;
  const record = saved as Partial<PluginSettings>;
  const weekStart =
    typeof record.weekStart === "number" && record.weekStart >= 0 && record.weekStart <= 6
      ? record.weekStart
      : defaults.weekStart;
  return {
    weekStart,
    hasImportedExternal: record.hasImportedExternal === true,
    daily: { ...asPeriod(record.daily, defaults.daily), enabled: true },
    weekly: { ...asPeriod(record.weekly, defaults.weekly), enabled: true },
    monthly: { ...asPeriod(record.monthly, defaults.monthly), enabled: true },
    quarterly: asPeriod(record.quarterly, defaults.quarterly),
    yearly: asPeriod(record.yearly, defaults.yearly),
    reviewFolder: typeof record.reviewFolder === "string" ? record.reviewFolder : defaults.reviewFolder,
    weeklyReviewFormat:
      typeof record.weeklyReviewFormat === "string" && record.weeklyReviewFormat.trim()
        ? record.weeklyReviewFormat
        : defaults.weeklyReviewFormat,
    monthlyReviewFormat:
      typeof record.monthlyReviewFormat === "string" && record.monthlyReviewFormat.trim()
        ? record.monthlyReviewFormat
        : defaults.monthlyReviewFormat,
    excludeFolders: typeof record.excludeFolders === "string" ? record.excludeFolders : defaults.excludeFolders,
    licenseKey: typeof record.licenseKey === "string" ? record.licenseKey : "",
    licenseCache: asCache(record.licenseCache),
    dateFormat: typeof record.dateFormat === "string" && record.dateFormat.trim() ? record.dateFormat : defaults.dateFormat,
    timeFormat: typeof record.timeFormat === "string" && record.timeFormat.trim() ? record.timeFormat : defaults.timeFormat,
  };
}

export function periodConfig(settings: PluginSettings, period: PeriodKind): PeriodConfig {
  return settings[period];
}
