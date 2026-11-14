import { parentFolder, notePath } from "./paths";
import type { PeriodKind, PluginSettings } from "./settings";
import { fillTemplate } from "./template";
import type { YMD } from "./dates";

export interface NoteVault {
  /** True when a file or folder already exists at this path. */
  exists(path: string): boolean;
  isFile(path: string): boolean;
  create(path: string, content: string): Promise<void>;
  createFolder(path: string): Promise<void>;
  open(path: string): Promise<void>;
  read(path: string): Promise<string | null>;
}

export type OpenResult = "opened" | "created" | "disabled";

export interface OpenOutcome {
  result: OpenResult;
  missingTemplate: boolean;
}

async function readTemplate(vault: NoteVault, templatePath: string): Promise<string | null> {
  const normalized = templatePath.trim().replace(/\\/g, "/");
  const direct = await vault.read(normalized);
  if (direct !== null) return direct;
  if (!normalized.toLowerCase().endsWith(".md")) return vault.read(`${normalized}.md`);
  return null;
}

async function ensureFolders(vault: NoteVault, folder: string): Promise<void> {
  if (!folder) return;
  const parts = folder.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!vault.exists(current)) await vault.createFolder(current);
  }
}

/**
 * Open the note when it already exists. Create it only when it does not.
 * A create race that finds the file afterwards opens the file and does not throw.
 */
export async function openOrCreate(
  vault: NoteVault,
  path: string,
  content: string,
): Promise<"opened" | "created"> {
  if (vault.isFile(path)) {
    await vault.open(path);
    return "opened";
  }
  await ensureFolders(vault, parentFolder(path));
  try {
    await vault.create(path, content);
  } catch (error) {
    if (vault.isFile(path)) {
      await vault.open(path);
      return "opened";
    }
    throw error;
  }
  await vault.open(path);
  return "created";
}

export async function openPeriodNote(
  vault: NoteVault,
  settings: PluginSettings,
  period: PeriodKind,
  date: YMD,
  now: Date,
): Promise<OpenOutcome> {
  const config = settings[period];
  if (!config.enabled) return { result: "disabled", missingTemplate: false };
  const path = notePath(period, date, config, settings.weekStart);
  if (vault.isFile(path)) {
    await vault.open(path);
    return { result: "opened", missingTemplate: false };
  }
  let content = "";
  let missingTemplate = false;
  if (config.template.trim()) {
    const raw = await readTemplate(vault, config.template);
    if (raw === null) missingTemplate = true;
    else {
      const title = path.split("/").pop()?.replace(/\.md$/i, "") ?? path;
      content = fillTemplate(raw, {
        title,
        date,
        now,
        weekStart: settings.weekStart,
        dateFormat: settings.dateFormat,
        timeFormat: settings.timeFormat,
        period,
      });
    }
  }
  const result = await openOrCreate(vault, path, content);
  return { result, missingTemplate };
}
