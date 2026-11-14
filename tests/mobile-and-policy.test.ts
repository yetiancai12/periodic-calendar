import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { GUMROAD_VERIFY_URL, PRO_UPGRADE_LINE } from "../src/constants";

const root = path.resolve(__dirname, "..");

function sourceFiles(): string[] {
  const dir = path.join(root, "src");
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join(dir, name));
}

describe("plugin policy", () => {
  it("Acceptance 8 and 9: manifest is mobile-capable and versions.json matches", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")) as {
      id: string;
      version: string;
      minAppVersion: string;
      description: string;
      isDesktopOnly: boolean;
    };
    const versions = JSON.parse(fs.readFileSync(path.join(root, "versions.json"), "utf8")) as Record<string, string>;
    expect(manifest.id).toBe("kept-calendar");
    expect(manifest.isDesktopOnly).toBe(false);
    expect(manifest.description.endsWith(".")).toBe(true);
    expect(manifest.description.length).toBeLessThanOrEqual(250);
    expect(versions[manifest.version]).toBe(manifest.minAppVersion);
  });

  it("Acceptance 9: README discloses payment, network use, and the upgrade line", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    expect(readme).toContain("$25");
    expect(readme).toContain("Gumroad");
    expect(readme).toContain("Note contents are not sent.");
    expect(readme).toContain("7 days");
    expect(readme).toContain("14 days");
    expect(readme).toContain(PRO_UPGRADE_LINE);
    expect(readme).toContain("MIT");
    expect(readme).not.toMatch(/\bAI\b/);
    expect(readme).not.toMatch(/generative/i);
    const acceptance = fs.readFileSync(path.join(root, "docs", "acceptance.md"), "utf8");
    for (let index = 1; index <= 9; index++) {
      expect(acceptance).toContain(`Acceptance ${index}`);
    }
  });

  it("Acceptance 4 and 8: source avoids desktop-only APIs, innerHTML, and copied plugin names", () => {
    const files = sourceFiles();
    const combined = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    expect(combined).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
    expect(combined).not.toMatch(/from ["']electron["']|from ["']fs["']|from ["']child_process["']|from ["']os["']/);
    expect(combined).not.toMatch(/\(\?<=|\(\?<!/);
    expect(combined).not.toMatch(/liamcain|obsidian-calendar-plugin|obsidian-periodic-notes/);
    expect(combined).not.toMatch(/hotkeys/);
    const urls = combined.match(/https?:\/\/[^\s"'`)]+/g) ?? [];
    expect(urls).toEqual([GUMROAD_VERIFY_URL]);

    const main = fs.readFileSync(path.join(root, "src", "main.ts"), "utf8");
    const reveal = main.slice(main.indexOf("async revealCalendar"), main.indexOf("async openDate"));
    const openDate = main.slice(main.indexOf("async openDate"), main.indexOf("async importExternal"));
    expect(reveal).not.toContain("resolveLicense");
    expect(reveal).not.toContain("requestUrl");
    expect(openDate).not.toContain("resolveLicense");
    expect(openDate).not.toContain("requestUrl");
    expect(main).toContain("requestUrl");
    expect(main).toContain("detachLeavesOfType");
  });
});
