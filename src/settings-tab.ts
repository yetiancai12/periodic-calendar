import { App, PluginSettingTab, Setting } from "obsidian";
import { PRO_UPGRADE_LINE } from "./constants";
import type KeptCalendarPlugin from "./main";
import type { PeriodKind } from "./settings";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export class KeptCalendarSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: KeptCalendarPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Kept Calendar" });
    containerEl.createEl("p", {
      text: "The calendar and a basic weekly review are free and do not use the network. Pro is a $25 per year Gumroad license.",
    });
    containerEl.createEl("p", { cls: "kept-calendar-upgrade", text: PRO_UPGRADE_LINE });

    new Setting(containerEl)
      .setName("Week starts on")
      .setDesc("Saved in this plugin. Restarting Obsidian keeps this choice.")
      .addDropdown((dropdown) => {
        WEEKDAYS.forEach((label, index) => dropdown.addOption(String(index), label));
        dropdown.setValue(String(this.plugin.settings.weekStart));
        dropdown.onChange(async (value) => {
          this.plugin.settings.weekStart = Number(value);
          await this.plugin.saveSettings();
          this.plugin.refreshCalendars();
        });
      });

    new Setting(containerEl)
      .setName("Reload folders and formats")
      .setDesc("Read Daily notes, Calendar, and Periodic Notes again. License and review settings stay as they are.")
      .addButton((button) =>
        button.setButtonText("Reload").onClick(async () => {
          await this.plugin.importExternal(true);
          this.display();
          this.plugin.refreshCalendars();
        }),
      );

    this.periodSection("daily", "Daily notes");
    this.periodSection("weekly", "Weekly notes");
    this.periodSection("monthly", "Monthly notes");
    this.periodSection("quarterly", "Quarterly notes", true);
    this.periodSection("yearly", "Yearly notes", true);

    containerEl.createEl("h3", { text: "Reviews" });
    new Setting(containerEl)
      .setName("Review folder")
      .addText((text) =>
        text.setValue(this.plugin.settings.reviewFolder).onChange(async (value) => {
          this.plugin.settings.reviewFolder = value.trim();
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("Weekly review name")
      .setDesc("Filename format. Brackets escape literal text, for example GGGG-[W]WW.")
      .addText((text) =>
        text.setValue(this.plugin.settings.weeklyReviewFormat).onChange(async (value) => {
          this.plugin.settings.weeklyReviewFormat = value;
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("Monthly review name")
      .addText((text) =>
        text.setValue(this.plugin.settings.monthlyReviewFormat).onChange(async (value) => {
          this.plugin.settings.monthlyReviewFormat = value;
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("Exclude folders")
      .setDesc("One folder per line. Pro reviews skip notes in these folders.")
      .addTextArea((text) =>
        text.setValue(this.plugin.settings.excludeFolders).onChange(async (value) => {
          this.plugin.settings.excludeFolders = value;
          await this.plugin.saveSettings();
        }),
      );

    containerEl.createEl("h3", { text: "License" });
    containerEl.createEl("p", {
      text: "Checking a key contacts Gumroad and sends only the key and the product id. Note contents stay on this device. A successful check is cached for 7 days and keeps working offline for 14 days.",
    });
    const status = containerEl.createEl("p", { cls: "kept-calendar-license-status" });
    status.setText(this.plugin.lastLicenseMessage());

    new Setting(containerEl)
      .setName("Gumroad license key")
      .addText((text) => {
        text.inputEl.type = "password";
        text.setValue(this.plugin.settings.licenseKey).onChange(async (value) => {
          this.plugin.settings.licenseKey = value.trim();
          await this.plugin.saveSettings();
        });
      })
      .addButton((button) =>
        button.setButtonText("Check license").onClick(async () => {
          const result = await this.plugin.resolveLicense(true);
          status.setText(result.message);
        }),
      );
  }

  private periodSection(period: PeriodKind, heading: string, optional = false): void {
    const { containerEl } = this;
    containerEl.createEl("h3", { text: heading });
    const config = this.plugin.settings[period];
    if (optional) {
      new Setting(containerEl).setName(`Enable ${heading.toLowerCase()}`).addToggle((toggle) =>
        toggle.setValue(config.enabled).onChange(async (value) => {
          config.enabled = value;
          await this.plugin.saveSettings();
          this.plugin.refreshCalendars();
        }),
      );
    }
    new Setting(containerEl).setName("Folder").addText((text) =>
      text.setValue(config.folder).onChange(async (value) => {
        config.folder = value.trim();
        await this.plugin.saveSettings();
      }),
    );
    new Setting(containerEl)
      .setName("Filename format")
      .addText((text) =>
        text.setValue(config.format).onChange(async (value) => {
          config.format = value;
          await this.plugin.saveSettings();
          this.plugin.refreshCalendars();
        }),
      );
    new Setting(containerEl)
      .setName("Template")
      .setDesc("Vault path of a template file. Supports {{date}}, {{time}}, {{title}}, and weekday tags.")
      .addText((text) =>
        text.setPlaceholder("Templates/Daily.md").setValue(config.template).onChange(async (value) => {
          config.template = value.trim();
          await this.plugin.saveSettings();
        }),
      );
  }
}
