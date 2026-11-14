import { describe, expect, it } from "vitest";
import { importExternalSettings } from "../src/import-settings";
import { notePath } from "../src/paths";
import { resolveSettings } from "../src/settings";
import { fillTemplate } from "../src/template";
import { openOrCreate, openPeriodNote, type NoteVault } from "../src/open-note";

class MemoryVault implements NoteVault {
  files = new Map<string, string>();
  folders = new Set<string>();
  opened: string[] = [];
  created: string[] = [];
  reads: string[] = [];
  throwExistsOnCreate = false;

  exists(path: string): boolean {
    return this.files.has(path) || this.folders.has(path);
  }

  isFile(path: string): boolean {
    return this.files.has(path);
  }

  async create(path: string, content: string): Promise<void> {
    if (this.throwExistsOnCreate) {
      this.throwExistsOnCreate = false;
      this.files.set(path, this.files.get(path) ?? content);
      throw new Error("File already exists");
    }
    if (this.files.has(path)) throw new Error("File already exists");
    this.files.set(path, content);
    this.created.push(path);
  }

  async createFolder(path: string): Promise<void> {
    this.folders.add(path);
  }

  async open(path: string): Promise<void> {
    this.opened.push(path);
  }

  async read(path: string): Promise<string | null> {
    this.reads.push(path);
    return this.files.get(path) ?? null;
  }
}

describe("settings import and note paths", () => {
  it("keeps an empty Periodic Notes daily block from wiping core Daily notes", () => {
    const settings = importExternalSettings({
      dailyNotes: { folder: "Journal", format: "YYYY-MM-DD", template: "Templates/Daily.md" },
      periodicNotes: {
        daily: { format: "", folder: "", template: "", enabled: true },
        weekly: { format: "gggg-[W]ww", folder: "Weekly", template: "", enabled: true },
      },
      localeWeekStart: 0,
    });
    expect(settings.daily).toMatchObject({
      folder: "Journal",
      format: "YYYY-MM-DD",
      template: "Templates/Daily.md",
    });
    expect(notePath("daily", { year: 2026, month: 12, day: 28 }, settings.daily, settings.weekStart)).toBe(
      "Journal/2026-12-28.md",
    );
  });

  it("lets a set Periodic Notes daily format override core Daily notes, including subfolders", () => {
    const settings = importExternalSettings({
      dailyNotes: { folder: "Journal", format: "YYYY-MM-DD", template: "" },
      periodicNotes: {
        daily: { format: "YYYY/MM/YYYY-MM-DD", folder: "Notes", template: "Templates/Day.md", enabled: true },
      },
      localeWeekStart: 1,
    });
    expect(notePath("daily", { year: 2026, month: 12, day: 28 }, settings.daily, 1)).toBe(
      "Notes/2026/12/2026-12-28.md",
    );
    expect(settings.daily.template).toBe("Templates/Day.md");
  });

  it("does not turn yearly notes off when Periodic Notes stored an empty disabled period", () => {
    const settings = importExternalSettings({
      periodicNotes: {
        yearly: { format: "", folder: "", template: "", enabled: false },
        quarterly: { format: "YYYY-[Q]Q", folder: "Quarterly", template: "", enabled: false },
      },
      localeWeekStart: 1,
    });
    expect(settings.yearly.enabled).toBe(true);
    expect(settings.quarterly.enabled).toBe(false);
    expect(settings.quarterly.format).toBe("YYYY-[Q]Q");
  });

  it("reads Calendar weekStart names and ignores locale when a weekday is set", () => {
    const monday = importExternalSettings({
      calendar: { weekStart: "monday", wordsPerDot: 250 },
      localeWeekStart: 0,
    });
    expect(monday.weekStart).toBe(1);
    const locale = importExternalSettings({
      calendar: { weekStart: "locale" },
      localeWeekStart: 1,
    });
    expect(locale.weekStart).toBe(1);
    const sunday = importExternalSettings({
      calendar: { weekStart: "Sunday" },
      localeWeekStart: 1,
    });
    expect(sunday.weekStart).toBe(0);
  });

  it("round-trips week start through saved settings", () => {
    const imported = importExternalSettings({
      periodicNotes: {
        weekly: { format: "GGGG-[W]WW", folder: "Weekly", template: "Templates/Weekly.md", enabled: true },
      },
      calendar: { weekStart: "monday" },
      localeWeekStart: 0,
    });
    const saved = resolveSettings(JSON.parse(JSON.stringify(imported)), 0);
    expect(saved.weekStart).toBe(1);
    expect(saved.weekly.format).toBe("GGGG-[W]WW");
    expect(saved.hasImportedExternal).toBe(true);
  });
});

describe("open or create", () => {
  it("opens a note that already exists and does not create or read a template", async () => {
    const settings = importExternalSettings({
      periodicNotes: {
        weekly: { format: "GGGG-[W]WW", folder: "Weekly", template: "Templates/Weekly.md", enabled: true },
        monthly: { format: "YYYY-MM", folder: "Monthly", template: "Templates/Monthly.md", enabled: true },
        yearly: { format: "YYYY", folder: "Yearly", template: "Templates/Yearly.md", enabled: true },
      },
      calendar: { weekStart: "monday" },
      localeWeekStart: 0,
    });
    const vault = new MemoryVault();
    vault.files.set("Weekly/2026-W53.md", "already here");
    vault.files.set("Monthly/2026-12.md", "month");
    vault.files.set("Yearly/2026.md", "year");

    const week = await openPeriodNote(vault, settings, "weekly", { year: 2026, month: 12, day: 28 }, new Date());
    const month = await openPeriodNote(vault, settings, "monthly", { year: 2026, month: 12, day: 28 }, new Date());
    const year = await openPeriodNote(vault, settings, "yearly", { year: 2026, month: 12, day: 28 }, new Date());

    expect(week.result).toBe("opened");
    expect(month.result).toBe("opened");
    expect(year.result).toBe("opened");
    expect(vault.created).toEqual([]);
    expect(vault.reads).toEqual([]);
    expect(vault.opened).toEqual(["Weekly/2026-W53.md", "Monthly/2026-12.md", "Yearly/2026.md"]);
    expect(vault.files.get("Weekly/2026-W53.md")).toBe("already here");
  });

  it("opens the file when create reports that it already exists", async () => {
    const vault = new MemoryVault();
    vault.throwExistsOnCreate = true;
    const result = await openOrCreate(vault, "Monthly/2026-12.md", "new");
    expect(result).toBe("opened");
    expect(vault.opened).toEqual(["Monthly/2026-12.md"]);
  });

  it("fills a weekly template from the week that contains the date", async () => {
    const settings = importExternalSettings({
      calendar: { weekStart: "monday" },
      localeWeekStart: 0,
    });
    settings.weekly = {
      folder: "Weekly",
      format: "GGGG-[W]WW",
      template: "Templates/Weekly.md",
      enabled: true,
    };
    const vault = new MemoryVault();
    vault.files.set("Templates/Weekly.md", "# {{title}}\n{{monday:YYYY-MM-DD}} to {{sunday:YYYY-MM-DD}}");
    const result = await openPeriodNote(vault, settings, "weekly", { year: 2026, month: 12, day: 30 }, new Date("2026-12-30T09:00:00"));
    expect(result.result).toBe("created");
    expect(vault.files.get("Weekly/2026-W53.md")).toBe("# 2026-W53\n2026-12-28 to 2027-01-03");
    expect(vault.folders.has("Weekly")).toBe(true);
  });

  it("finds a template that was stored without the .md extension", async () => {
    const settings = importExternalSettings({ localeWeekStart: 1, calendar: { weekStart: "monday" } });
    settings.daily.folder = "Daily";
    settings.daily.template = "Templates/Daily";
    const vault = new MemoryVault();
    vault.files.set("Templates/Daily.md", "# {{title}}");
    const result = await openPeriodNote(vault, settings, "daily", { year: 2026, month: 12, day: 28 }, new Date());
    expect(result).toEqual({ result: "created", missingTemplate: false });
    expect(vault.files.get("Daily/2026-12-28.md")).toBe("# 2026-12-28");
  });

  it("leaves unknown template tags in place and substitutes date and time", () => {
    const filled = fillTemplate("{{date:YYYY-MM-DD}} {{time:HH:mm}} {{nope}}", {
      title: "Note",
      date: { year: 2026, month: 12, day: 28 },
      now: new Date(2026, 11, 28, 9, 5, 0),
      weekStart: 1,
      dateFormat: "YYYY-MM-DD",
      timeFormat: "HH:mm",
      period: "daily",
    });
    expect(filled).toBe("2026-12-28 09:05 {{nope}}");
  });
});
