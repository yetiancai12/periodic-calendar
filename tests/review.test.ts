import { describe, expect, it } from "vitest";
import { BLOCK_END, BLOCK_START, PRO_UPGRADE_LINE } from "../src/constants";
import { localDayStartMs } from "../src/dates";
import { importExternalSettings } from "../src/import-settings";
import { extractOpenTasks, buildReviewUpdate, replaceGeneratedBlock, type VaultFile } from "../src/review";
import type { PluginSettings } from "../src/settings";

const date = { year: 2026, month: 12, day: 28 };

function settings(): PluginSettings {
  const imported = importExternalSettings({
    periodicNotes: {
      daily: { format: "YYYY-MM-DD", folder: "Daily", template: "", enabled: true },
      weekly: { format: "GGGG-[W]WW", folder: "Weekly", template: "", enabled: true },
      monthly: { format: "YYYY-MM", folder: "Monthly", template: "", enabled: true },
    },
    calendar: { weekStart: "monday" },
    localeWeekStart: 0,
  });
  imported.excludeFolders = "Archive";
  return imported;
}

function files(): VaultFile[] {
  const inside = localDayStartMs({ year: 2026, month: 12, day: 30 });
  const outside = localDayStartMs({ year: 2026, month: 11, day: 1 });
  return [
    {
      path: "Daily/2026-12-28.md",
      extension: "md",
      stat: { ctime: inside, mtime: inside },
      content: "- [ ] Buy milk\n- [x] Done\n```\n- [ ] hidden\n```\n",
    },
    {
      path: "Daily/2026-12-29.md",
      extension: "md",
      stat: { ctime: inside, mtime: inside },
      content: "  - [ ] Write notes\n",
    },
    {
      path: "Daily/2026-12-27.md",
      extension: "md",
      stat: { ctime: outside, mtime: outside },
      content: "- [ ] Outside the ISO week\n",
    },
    { path: "Projects/Plan.md", extension: "md", stat: { ctime: inside, mtime: inside }, content: "plan" },
    { path: "Archive/Old.md", extension: "md", stat: { ctime: inside, mtime: inside }, content: "- [ ] Skip\n" },
    { path: "Projects/Earlier.md", extension: "md", stat: { ctime: outside, mtime: outside }, content: "old" },
  ];
}

describe("reviews", () => {
  it("extracts only open tasks outside fenced code", () => {
    expect(extractOpenTasks("- [ ] Buy milk\n- [x] Done\n```\n- [ ] hidden\n```\n")).toEqual(["Buy milk"]);
  });

  it("keeps user text when the generated block is replaced", () => {
    const existing = `# Title\n\nIntro stays.\n\n${BLOCK_START}\nold\n${BLOCK_END}\n\nRemember to call.\n`;
    const next = replaceGeneratedBlock(existing, "## Daily notes\n- [[2026-12-28]]");
    expect(next).toContain("Intro stays.");
    expect(next).toContain("Remember to call.");
    expect(next).not.toContain("old");
    expect(next.match(/## Daily notes/g)).toHaveLength(1);
    const again = replaceGeneratedBlock(next, "## Daily notes\n- [[2026-12-28]]\n- [[2026-12-29]]");
    expect(again.match(/2026-12-28/g)).toHaveLength(1);
    expect(again).toContain("Remember to call.");
    expect(again.match(/Remember to call/g)).toHaveLength(1);
  });

  it("builds a free weekly review with daily links and one upgrade line", () => {
    const review = buildReviewUpdate({
      settings: settings(),
      period: "weekly",
      date,
      files: files(),
      existing: null,
      pro: false,
    });
    expect(review.path).toBe("Reviews/2026-W53 Weekly Review.md");
    expect(review.content).toContain("[[2026-12-28]]");
    expect(review.content).toContain("[[2026-12-29]]");
    expect(review.content).not.toContain("2026-12-27");
    expect(review.content).not.toContain("Plan");
    expect(review.content).not.toContain("Buy milk");
    expect(review.content).not.toContain("## Notes changed");
    expect(review.content.split(PRO_UPGRADE_LINE)).toHaveLength(2);
  });

  it("builds a Pro review and a second refresh does not duplicate or drop handwriting", () => {
    const first = buildReviewUpdate({
      settings: settings(),
      period: "weekly",
      date,
      files: files(),
      existing: null,
      pro: true,
    });
    expect(first.content).toContain("[[2026-12-28]]");
    expect(first.content).toContain("[[2026-12-29]]");
    expect(first.content).toContain("[[Plan]]");
    expect(first.content).toContain("- [ ] Buy milk ([[2026-12-28]])");
    expect(first.content).toContain("- [ ] Write notes ([[2026-12-29]])");
    expect(first.content).not.toContain("Done");
    expect(first.content).not.toContain("hidden");
    expect(first.content).not.toContain("Old");
    expect(first.content).not.toContain("Earlier");
    expect(first.content).not.toContain("2026-12-27");
    expect(first.content).not.toContain(PRO_UPGRADE_LINE);

    const handwritten = first.content.replace(/^# .+$/m, "# My week") + "\nRemember to call.\n";
    const second = buildReviewUpdate({
      settings: settings(),
      period: "weekly",
      date,
      files: files(),
      existing: handwritten,
      pro: true,
    });
    expect(second.content.startsWith("# My week")).toBe(true);
    expect(second.content.match(/Remember to call/g)).toHaveLength(1);
    expect(second.content.match(/Buy milk/g)).toHaveLength(1);
    expect(second.content.match(/\[\[Plan\]\]/g)).toHaveLength(1);
    expect(second.content.match(/## Daily notes/g)).toHaveLength(1);
  });

  it("limits a monthly review to that month", () => {
    const touched = localDayStartMs({ year: 2026, month: 12, day: 2 });
    const november = localDayStartMs({ year: 2026, month: 11, day: 30 });
    const notes: VaultFile[] = [
      { path: "Daily/2026-12-02.md", extension: "md", stat: { ctime: touched, mtime: touched }, content: "- [ ] December\n" },
      { path: "Daily/2026-11-30.md", extension: "md", stat: { ctime: november, mtime: november }, content: "- [ ] November\n" },
      { path: "Projects/December.md", extension: "md", stat: { ctime: touched, mtime: touched } },
    ];
    const review = buildReviewUpdate({
      settings: settings(),
      period: "monthly",
      date,
      files: notes,
      existing: null,
      pro: true,
    });
    expect(review.path).toBe("Reviews/2026-12 Monthly Review.md");
    expect(review.content).toContain("[[2026-12-02]]");
    expect(review.content).toContain("[[December]]");
    expect(review.content).toContain("- [ ] December ([[2026-12-02]])");
    expect(review.content).not.toContain("2026-11-30");
    expect(review.content).not.toContain("November");
  });
});
