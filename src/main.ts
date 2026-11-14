import { Notice, Plugin, Platform, TFile, normalizePath, requestUrl, type WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE } from "./constants";
import { detectLocaleWeekStart, todayLocal, type YMD } from "./dates";
import { importExternalSettings } from "./import-settings";
import { finishLicenseFetch, planLicenseFetch, type LicenseDecision, type LicenseRequest } from "./license";
import { openPeriodNote, type NoteVault } from "./open-note";
import { reviewNotePath } from "./paths";
import { leafTargetForPlatform } from "./platform";
import { buildReviewUpdate, dailyNotesInRange, reviewAccess, reviewRange, type VaultFile } from "./review";
import { resolveSettings, type PeriodKind, type PluginSettings } from "./settings";
import { KeptCalendarSettingTab } from "./settings-tab";
import { CalendarView, dailyPathFor } from "./view";

export default class KeptCalendarPlugin extends Plugin {
  settings: PluginSettings = resolveSettings(null);
  private licenseDecision: LicenseDecision | null = null;

  async onload(): Promise<void> {
    this.settings = resolveSettings(await this.loadData(), detectLocaleWeekStart());
    if (!this.settings.hasImportedExternal) await this.importExternal(false);

    this.registerView(VIEW_TYPE, (leaf) => new CalendarView(leaf, this));
    this.addRibbonIcon("calendar", "Open Kept Calendar", () => {
      void this.revealCalendar();
    });
    this.addSettingTab(new KeptCalendarSettingTab(this.app, this));
    this.addCommands();

    this.registerEvent(this.app.vault.on("create", () => this.refreshCalendars()));
    this.registerEvent(this.app.vault.on("delete", () => this.refreshCalendars()));
    this.registerEvent(this.app.vault.on("rename", () => this.refreshCalendars()));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  lastLicenseMessage(): string {
    return this.licenseDecision?.message ?? "No license checked yet. The calendar works without one.";
  }

  refreshCalendars(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof CalendarView) leaf.view.render();
    }
  }

  dailyNoteExists(date: YMD): boolean {
    const path = dailyPathFor(this.settings, date);
    return this.app.vault.getAbstractFileByPath(normalizePath(path)) instanceof TFile;
  }

  async revealCalendar(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (existing) {
      workspace.revealLeaf(existing);
      return;
    }
    const leaf = this.leafForNewCalendar();
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }

  async openDate(period: PeriodKind, date: YMD): Promise<void> {
    const outcome = await openPeriodNote(this.noteVault(), this.settings, period, date, new Date());
    if (outcome.result === "disabled") {
      new Notice(`${labelFor(period)} notes are turned off in Kept Calendar settings. The calendar still works.`);
      return;
    }
    if (outcome.missingTemplate) {
      const template = this.settings[period].template;
      new Notice(`Template not found (${template}). Created an empty note.`);
    }
  }

  async importExternal(notify: boolean): Promise<void> {
    const previous = this.settings;
    const dir = this.app.vault.configDir;
    const imported = importExternalSettings({
      dailyNotes: await this.readConfigJson(`${dir}/daily-notes.json`),
      periodicNotes: await this.readConfigJson(`${dir}/plugins/periodic-notes/data.json`),
      calendar: await this.readConfigJson(`${dir}/plugins/calendar/data.json`),
      templates: await this.readConfigJson(`${dir}/templates.json`),
      localeWeekStart: detectLocaleWeekStart(),
    });
    this.settings = {
      ...imported,
      licenseKey: previous.licenseKey,
      licenseCache: previous.licenseCache,
      reviewFolder: previous.hasImportedExternal ? previous.reviewFolder : imported.reviewFolder,
      weeklyReviewFormat: previous.hasImportedExternal ? previous.weeklyReviewFormat : imported.weeklyReviewFormat,
      monthlyReviewFormat: previous.hasImportedExternal ? previous.monthlyReviewFormat : imported.monthlyReviewFormat,
      excludeFolders: previous.hasImportedExternal ? previous.excludeFolders : imported.excludeFolders,
    };
    await this.saveSettings();
    if (notify) new Notice("Reloaded folders and formats from Daily notes, Calendar, and Periodic Notes.");
  }

  async resolveLicense(force: boolean): Promise<LicenseDecision> {
    const now = Date.now();
    const plan = planLicenseFetch({
      now,
      key: this.settings.licenseKey,
      cache: this.settings.licenseCache,
      force,
    });
    const outcome =
      plan.kind === "decision" ? plan : await this.fetchLicense(plan.request, now);
    if (JSON.stringify(outcome.nextCache) !== JSON.stringify(this.settings.licenseCache)) {
      this.settings.licenseCache = outcome.nextCache;
      await this.saveSettings();
    }
    this.licenseDecision = outcome.decision;
    this.refreshCalendars();
    return outcome.decision;
  }

  async refreshReview(period: "weekly" | "monthly"): Promise<void> {
    const license = await this.resolveLicense(false);
    const access = reviewAccess(period, license.valid);
    if (!access.proceed) {
      if (access.notice) new Notice(access.notice);
      return;
    }
    const date = todayLocal();
    const files = await this.filesForReview(period, date, access.pro);
    const path = reviewNotePath(this.settings, period, date);
    const existingFile = this.app.vault.getAbstractFileByPath(normalizePath(path));
    const existing = existingFile instanceof TFile ? await this.app.vault.read(existingFile) : null;
    const update = buildReviewUpdate({
      settings: this.settings,
      period,
      date,
      files,
      existing,
      pro: access.pro,
    });
    await this.writeNote(update.path, update.content);
    if (access.pro) new Notice(period === "weekly" ? "Weekly review updated." : "Monthly review updated.");
    else new Notice("Weekly review updated with daily notes.");
  }

  private leafForNewCalendar(): WorkspaceLeaf {
    const target = leafTargetForPlatform(Platform.isMobile);
    if (target === "right-sidebar") {
      return this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(false);
    }
    return this.app.workspace.getLeaf(false);
  }

  private addCommands(): void {
    this.addCommand({ id: "open-calendar", name: "Open calendar", callback: () => void this.revealCalendar() });
    this.addCommand({
      id: "open-daily",
      name: "Open today's note",
      callback: () => void this.openDate("daily", todayLocal()),
    });
    this.addCommand({
      id: "open-weekly",
      name: "Open this week's note",
      callback: () => void this.openDate("weekly", todayLocal()),
    });
    this.addCommand({
      id: "open-monthly",
      name: "Open this month's note",
      callback: () => void this.openDate("monthly", todayLocal()),
    });
    this.addCommand({
      id: "open-quarterly",
      name: "Open this quarter's note",
      callback: () => void this.openDate("quarterly", todayLocal()),
    });
    this.addCommand({
      id: "open-yearly",
      name: "Open this year's note",
      callback: () => void this.openDate("yearly", todayLocal()),
    });
    this.addCommand({
      id: "refresh-weekly-review",
      name: "Create or refresh weekly review",
      callback: () => void this.refreshReview("weekly"),
    });
    this.addCommand({
      id: "refresh-monthly-review",
      name: "Create or refresh monthly review",
      callback: () => void this.refreshReview("monthly"),
    });
  }

  private noteVault(): NoteVault {
    const { vault, workspace } = this.app;
    return {
      exists: (path) => vault.getAbstractFileByPath(normalizePath(path)) !== null,
      isFile: (path) => vault.getAbstractFileByPath(normalizePath(path)) instanceof TFile,
      create: async (path, content) => {
        await vault.create(normalizePath(path), content);
      },
      createFolder: async (path) => {
        await vault.createFolder(normalizePath(path));
      },
      open: async (path) => {
        const file = vault.getAbstractFileByPath(normalizePath(path));
        if (file instanceof TFile) await workspace.getLeaf(false).openFile(file);
      },
      read: async (path) => {
        const file = vault.getAbstractFileByPath(normalizePath(path));
        if (!(file instanceof TFile)) return null;
        return vault.cachedRead(file);
      },
    };
  }

  private async filesForReview(period: "weekly" | "monthly", date: YMD, pro: boolean): Promise<VaultFile[]> {
    const files: VaultFile[] = this.app.vault.getFiles().map((file) => ({
      path: file.path,
      extension: file.extension,
      stat: { ctime: file.stat.ctime, mtime: file.stat.mtime },
    }));
    if (!pro) return files;
    const dailies = dailyNotesInRange(this.settings, reviewRange(this.settings, period, date), files);
    for (const path of dailies) {
      const file = this.app.vault.getAbstractFileByPath(path);
      const listed = files.find((candidate) => candidate.path === path);
      if (file instanceof TFile && listed) listed.content = await this.app.vault.cachedRead(file);
    }
    return files;
  }

  private async writeNote(path: string, content: string): Promise<void> {
    const normalized = normalizePath(path);
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
      await this.app.workspace.getLeaf(false).openFile(existing);
      return;
    }
    await this.ensureFolder(normalized.split("/").slice(0, -1).join("/"));
    try {
      const created = await this.app.vault.create(normalized, content);
      await this.app.workspace.getLeaf(false).openFile(created);
    } catch (error) {
      const raced = this.app.vault.getAbstractFileByPath(normalized);
      if (raced instanceof TFile) {
        await this.app.vault.modify(raced, content);
        await this.app.workspace.getLeaf(false).openFile(raced);
        return;
      }
      throw error;
    }
  }

  private async ensureFolder(folder: string): Promise<void> {
    if (!folder) return;
    const parts = folder.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  private async fetchLicense(
    request: LicenseRequest,
    now: number,
  ): Promise<{ decision: LicenseDecision; nextCache: PluginSettings["licenseCache"] }> {
    try {
      const response = await requestUrl({
        url: request.url,
        method: "POST",
        contentType: "application/x-www-form-urlencoded",
        body: request.body,
        throw: false,
      });
      if (response.status === 0 || response.status >= 500) {
        return finishLicenseFetch(
          { now, key: this.settings.licenseKey, cache: this.settings.licenseCache },
          { ok: false },
        );
      }
      let body: unknown = null;
      try {
        body = response.json;
      } catch {
        body = null;
      }
      return finishLicenseFetch(
        { now, key: this.settings.licenseKey, cache: this.settings.licenseCache },
        { ok: true, body },
      );
    } catch {
      return finishLicenseFetch(
        { now, key: this.settings.licenseKey, cache: this.settings.licenseCache },
        { ok: false },
      );
    }
  }

  private async readConfigJson(path: string): Promise<unknown | undefined> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(path))) return undefined;
    try {
      return JSON.parse(await adapter.read(path)) as unknown;
    } catch {
      return undefined;
    }
  }
}

function labelFor(period: PeriodKind): string {
  if (period === "daily") return "Daily";
  if (period === "weekly") return "Weekly";
  if (period === "monthly") return "Monthly";
  if (period === "quarterly") return "Quarterly";
  return "Yearly";
}
