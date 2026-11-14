import { BLOCK_END, BLOCK_START, PRO_UPGRADE_LINE } from "./constants";
import { addDays, eachDay, localDayEndMs, localDayStartMs, startOfIsoWeek, startOfWeek, type DateRange, type YMD } from "./dates";
import { weekNumberingForFormat } from "./format";
import { notePath, reviewNotePath, reviewTitle } from "./paths";
import type { PluginSettings } from "./settings";

export interface VaultFile {
  path: string;
  extension: string;
  stat: { ctime: number; mtime: number };
  content?: string;
}

export function parseExcludeFolders(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((part) => part.trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
}

export function isUnderFolder(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

export function wikiLink(path: string): string {
  const base = path.split("/").pop()?.replace(/\.md$/i, "") ?? path;
  return `[[${base.replace(/\[|\]/g, "")}]]`;
}

export function extractOpenTasks(markdown: string): string[] {
  const tasks: string[] = [];
  let fence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^[ \t]*(```|~~~)/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const match = /^[ \t]*- \[ \][ \t]+(.+?)\s*$/.exec(line);
    if (match?.[1]) tasks.push(match[1]);
  }
  return tasks;
}

export function replaceGeneratedBlock(existing: string | null, inner: string): string {
  const block = `${BLOCK_START}\n${inner.trim()}\n${BLOCK_END}`;
  if (existing === null || existing.trim() === "") return `${block}\n`;
  const start = existing.indexOf(BLOCK_START);
  const end = existing.indexOf(BLOCK_END);
  if (start === -1 || end === -1 || end < start) {
    const base = existing.replace(/\s*$/, "");
    return `${base}\n\n${block}\n`;
  }
  const after = existing.slice(end + BLOCK_END.length);
  return existing.slice(0, start) + block + after;
}

export function reviewRange(settings: PluginSettings, period: "weekly" | "monthly", date: YMD): DateRange {
  if (period === "monthly") {
    const start = { year: date.year, month: date.month, day: 1 };
    const last = new Date(Date.UTC(date.year, date.month, 0)).getUTCDate();
    return { start, end: { year: date.year, month: date.month, day: last } };
  }
  if (weekNumberingForFormat(settings.weekly.format) === "iso") {
    const start = startOfIsoWeek(date);
    return { start, end: addDays(start, 6) };
  }
  const start = startOfWeek(date, settings.weekStart);
  return { start, end: addDays(start, 6) };
}

export function dailyNotesInRange(settings: PluginSettings, range: DateRange, files: VaultFile[]): string[] {
  const known = new Set(files.filter((file) => file.extension === "md").map((file) => file.path));
  const paths: string[] = [];
  for (const day of eachDay(range.start, range.end)) {
    const path = notePath("daily", day, settings.daily, settings.weekStart);
    if (known.has(path)) paths.push(path);
  }
  return paths;
}

export function notesChangedInPeriod(
  files: VaultFile[],
  range: DateRange,
  exclude: { paths: string[]; folders: string[]; reviewPath: string },
): string[] {
  const startMs = localDayStartMs(range.start);
  const endMs = localDayEndMs(range.end);
  const skip = new Set(exclude.paths);
  return files
    .filter((file) => {
      if (file.extension !== "md") return false;
      if (skip.has(file.path) || file.path === exclude.reviewPath) return false;
      if (exclude.folders.some((folder) => isUnderFolder(file.path, folder))) return false;
      const created = file.stat.ctime >= startMs && file.stat.ctime <= endMs;
      const modified = file.stat.mtime >= startMs && file.stat.mtime <= endMs;
      return created || modified;
    })
    .map((file) => file.path)
    .sort((a, b) => a.localeCompare(b));
}

export function buildGeneratedInner(input: {
  pro: boolean;
  dailyPaths: string[];
  changedPaths: string[];
  tasks: { text: string; sourcePath: string }[];
}): string {
  const lines: string[] = ["## Daily notes"];
  if (input.dailyPaths.length === 0) lines.push("_No daily notes in this period._");
  else for (const path of input.dailyPaths) lines.push(`- ${wikiLink(path)}`);
  if (!input.pro) {
    lines.push("", PRO_UPGRADE_LINE);
    return lines.join("\n");
  }
  lines.push("", "## Notes changed");
  if (input.changedPaths.length === 0) lines.push("_No other notes created or changed in this period._");
  else for (const path of input.changedPaths) lines.push(`- ${wikiLink(path)}`);
  lines.push("", "## Open tasks");
  if (input.tasks.length === 0) lines.push("_No open tasks in daily notes._");
  else for (const task of input.tasks) lines.push(`- [ ] ${task.text} (${wikiLink(task.sourcePath)})`);
  return lines.join("\n");
}

export interface ReviewAccess {
  proceed: boolean;
  pro: boolean;
  notice?: string;
}

export function reviewAccess(period: "weekly" | "monthly", licenseValid: boolean): ReviewAccess {
  if (period === "weekly") return { proceed: true, pro: licenseValid };
  if (licenseValid) return { proceed: true, pro: true };
  return {
    proceed: false,
    pro: false,
    notice:
      "Monthly reviews are part of Pro. Pro is unavailable with the current license. The calendar still works.",
  };
}

export function buildReviewDocument(existing: string | null, title: string, inner: string): string {
  const replaced = replaceGeneratedBlock(existing, inner);
  if (existing === null || existing.trim() === "") return `# ${title}\n\n${replaced}`;
  return replaced;
}

export interface BuiltReview {
  path: string;
  content: string;
  inner: string;
  pro: boolean;
}

export function buildReviewUpdate(input: {
  settings: PluginSettings;
  period: "weekly" | "monthly";
  date: YMD;
  files: VaultFile[];
  existing: string | null;
  pro: boolean;
}): BuiltReview {
  const range = reviewRange(input.settings, input.period, input.date);
  const path = reviewNotePath(input.settings, input.period, input.date);
  const dailyPaths = dailyNotesInRange(input.settings, range, input.files);
  const folders = parseExcludeFolders(input.settings.excludeFolders);
  const changedPaths = input.pro
    ? notesChangedInPeriod(input.files, range, { paths: dailyPaths, folders, reviewPath: path })
    : [];
  const tasks = input.pro
    ? dailyPaths.flatMap((dailyPath) => {
        const file = input.files.find((candidate) => candidate.path === dailyPath);
        return extractOpenTasks(file?.content ?? "").map((text) => ({ text, sourcePath: dailyPath }));
      })
    : [];
  const inner = buildGeneratedInner({ pro: input.pro, dailyPaths, changedPaths, tasks });
  const content = buildReviewDocument(input.existing, reviewTitle(input.settings, input.period, input.date), inner);
  return { path, content, inner, pro: input.pro };
}
