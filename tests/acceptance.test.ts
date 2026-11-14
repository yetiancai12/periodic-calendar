import { describe, expect, it } from "vitest";
import { buildCalendar } from "../src/calendar-model";
import { PRO_UPGRADE_LINE } from "../src/constants";
import { importExternalSettings } from "../src/import-settings";
import { finishLicenseFetch, planLicenseFetch } from "../src/license";
import { openPeriodNote, type NoteVault } from "../src/open-note";
import { notePath } from "../src/paths";
import { leafTargetForPlatform, simulateMobileMode } from "../src/platform";
import { buildReviewUpdate, reviewAccess, type VaultFile } from "../src/review";
import { resolveSettings } from "../src/settings";
import { formatDate } from "../src/format";
import { localDayStartMs } from "../src/dates";

const dec28 = { year: 2026, month: 12, day: 28 };

describe("acceptance checks", () => {
  it("Acceptance 1: imports ISO weekly settings and Monday, then keeps Monday after a reload", () => {
    const imported = importExternalSettings({
      periodicNotes: {
        showGettingStartedBanner: false,
        daily: { format: "YYYY-MM-DD", folder: "Daily", template: "Templates/Daily.md", enabled: true },
        weekly: { format: "GGGG-[W]WW", folder: "Weekly", template: "Templates/Weekly.md", enabled: true },
      },
      calendar: { weekStart: "monday", shouldConfirmBeforeCreate: true },
      localeWeekStart: 0,
    });
    expect(imported.weekStart).toBe(1);
    expect(notePath("weekly", dec28, imported.weekly, imported.weekStart)).toBe("Weekly/2026-W53.md");
    const reloaded = resolveSettings(JSON.parse(JSON.stringify(imported)), 0);
    expect(reloaded.weekStart).toBe(1);
    expect(notePath("weekly", dec28, reloaded.weekly, reloaded.weekStart)).toBe("Weekly/2026-W53.md");
  });

  it("Acceptance 2: filename and calendar both show 2026-W53 for 2026-12-28", () => {
    expect(formatDate(dec28, "GGGG-[W]WW", 1)).toBe("2026-W53");
    expect(formatDate({ year: 2027, month: 1, day: 3 }, "GGGG-[W]WW", 1)).toBe("2026-W53");
    const model = buildCalendar(2026, 12, dec28, 1, "iso");
    const row = model.weeks.find((week) => week.days.some((day) => day.date.day === 28 && day.date.month === 12));
    expect(row?.weekNumber).toBe(53);
    expect(formatDate(row!.anchor, "GGGG-[W]WW", 1)).toBe("2026-W53");
  });

  it("Acceptance 3: month and year clicks open existing notes and do not throw", async () => {
    const settings = importExternalSettings({
      periodicNotes: {
        monthly: { format: "YYYY-MM", folder: "Monthly", template: "Templates/Monthly.md", enabled: true },
        yearly: { format: "YYYY", folder: "Yearly", template: "Templates/Yearly.md", enabled: true },
      },
      calendar: { weekStart: "monday" },
      localeWeekStart: 0,
    });
    const files = new Map<string, string>([
      ["Monthly/2026-12.md", "existing month"],
      ["Yearly/2026.md", "existing year"],
    ]);
    const created: string[] = [];
    const vault: NoteVault = {
      exists: (path) => files.has(path),
      isFile: (path) => files.has(path),
      create: async (path, content) => {
        created.push(path);
        files.set(path, content);
      },
      createFolder: async () => undefined,
      open: async () => undefined,
      read: async (path) => files.get(path) ?? null,
    };
    const month = await openPeriodNote(vault, settings, "monthly", dec28, new Date());
    const year = await openPeriodNote(vault, settings, "yearly", dec28, new Date());
    expect(month.result).toBe("opened");
    expect(year.result).toBe("opened");
    expect(created).toEqual([]);
    expect(files.get("Monthly/2026-12.md")).toBe("existing month");
  });

  it("Acceptance 4: a failed or missing license check still produces the free weekly review", () => {
    const now = Date.UTC(2026, 10, 14);
    const missing = planLicenseFetch({ now, key: "", cache: null, force: false, productId: "prod_123" });
    expect(missing.kind).toBe("decision");
    const offline = finishLicenseFetch({ now, key: "KEY", cache: null }, { ok: false });
    expect(offline.decision.valid).toBe(false);
    const access = reviewAccess("weekly", offline.decision.valid);
    expect(access.proceed).toBe(true);
    expect(access.pro).toBe(false);

    const settings = importExternalSettings({
      periodicNotes: {
        daily: { format: "YYYY-MM-DD", folder: "Daily", template: "", enabled: true },
        weekly: { format: "GGGG-[W]WW", folder: "Weekly", template: "", enabled: true },
      },
      calendar: { weekStart: "monday" },
      localeWeekStart: 0,
    });
    const touched = localDayStartMs(dec28);
    const notes: VaultFile[] = [
      { path: "Daily/2026-12-28.md", extension: "md", stat: { ctime: touched, mtime: touched }, content: "- [ ] Task" },
      { path: "Projects/Plan.md", extension: "md", stat: { ctime: touched, mtime: touched } },
    ];
    const review = buildReviewUpdate({
      settings,
      period: "weekly",
      date: dec28,
      files: notes,
      existing: null,
      pro: access.pro,
    });
    expect(review.content).toContain("[[2026-12-28]]");
    expect(review.content).toContain(PRO_UPGRADE_LINE);
    expect(review.content).not.toContain("Plan");
    expect(review.content).not.toContain("Task");
  });

  it("Acceptance 5 and 6: free review is daily links only; Pro refresh keeps handwriting", () => {
    const settings = importExternalSettings({
      periodicNotes: {
        daily: { format: "YYYY-MM-DD", folder: "Daily", template: "", enabled: true },
        weekly: { format: "GGGG-[W]WW", folder: "Weekly", template: "", enabled: true },
      },
      calendar: { weekStart: "monday" },
      localeWeekStart: 0,
    });
    const touched = localDayStartMs({ year: 2026, month: 12, day: 29 });
    const notes: VaultFile[] = [
      {
        path: "Daily/2026-12-28.md",
        extension: "md",
        stat: { ctime: touched, mtime: touched },
        content: "- [ ] Buy milk\n",
      },
      { path: "Projects/Plan.md", extension: "md", stat: { ctime: touched, mtime: touched } },
    ];
    const free = buildReviewUpdate({ settings, period: "weekly", date: dec28, files: notes, existing: null, pro: false });
    expect(free.inner).toContain("[[2026-12-28]]");
    expect(free.inner).toContain(PRO_UPGRADE_LINE);
    expect(free.inner).not.toContain("Buy milk");
    expect(free.inner).not.toContain("Plan");

    const pro = buildReviewUpdate({ settings, period: "weekly", date: dec28, files: notes, existing: null, pro: true });
    expect(pro.inner).toContain("[[Plan]]");
    expect(pro.inner).toContain("- [ ] Buy milk ([[2026-12-28]])");
    const edited = pro.content.replace("%% kept-calendar:generated:end %%", "%% kept-calendar:generated:end %%\n\nMy notes.\n");
    const again = buildReviewUpdate({ settings, period: "weekly", date: dec28, files: notes, existing: edited, pro: true });
    expect(again.content.match(/My notes/g)).toHaveLength(1);
    expect(again.content.match(/Buy milk/g)).toHaveLength(1);
    expect(reviewAccess("monthly", false).proceed).toBe(false);
    expect(reviewAccess("monthly", true).proceed).toBe(true);
  });

  it("Acceptance 8: mobile mode still opens a calendar leaf and a review", () => {
    expect(leafTargetForPlatform(true)).toBe("current");
    expect(leafTargetForPlatform(false)).toBe("right-sidebar");
    const model = buildCalendar(2026, 12, dec28, 1, "iso");
    const row = model.weeks.find((week) => week.weekNumber === 53);
    const simulation = simulateMobileMode({
      weekNumber: row?.weekNumber ?? 0,
      reviewMarkdown: `- [[2026-12-28]]\n\n${PRO_UPGRADE_LINE}`,
      upgradeLine: PRO_UPGRADE_LINE,
      isDesktopOnly: false,
    });
    expect(simulation).toMatchObject({
      isMobile: true,
      leaf: "current",
      calendarWeekNumber: 53,
      reviewHasDailyLink: true,
      reviewHasUpgradeLine: true,
      desktopOnly: false,
    });
  });
});
