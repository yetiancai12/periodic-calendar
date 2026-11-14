import { ItemView, WorkspaceLeaf } from "obsidian";
import { buildCalendar, dateForClick, type CalendarClick } from "./calendar-model";
import { VIEW_TYPE } from "./constants";
import { addMonths, MONTH_NAMES, todayLocal, type YMD } from "./dates";
import { weekNumberingForFormat } from "./format";
import type KeptCalendarPlugin from "./main";
import { notePath } from "./paths";
import type { PeriodKind } from "./settings";

export class CalendarView extends ItemView {
  private cursor: YMD;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: KeptCalendarPlugin,
  ) {
    super(leaf);
    const today = todayLocal();
    this.cursor = { year: today.year, month: today.month, day: 1 };
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Kept Calendar";
  }

  getIcon(): string {
    return "calendar";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("kept-calendar");

    const settings = this.plugin.settings;
    const today = todayLocal();
    const numbering = weekNumberingForFormat(settings.weekly.format);
    const model = buildCalendar(this.cursor.year, this.cursor.month, today, settings.weekStart, numbering);

    const nav = root.createDiv({ cls: "kept-calendar-nav" });
    this.button(nav, "‹", "Previous month", "kept-calendar-nav-btn", () => {
      this.cursor = addMonths(this.cursor, -1);
      this.render();
    });

    const title = nav.createDiv({ cls: "kept-calendar-title" });
    this.button(title, MONTH_NAMES[model.month - 1], `Open monthly note for ${MONTH_NAMES[model.month - 1]} ${model.year}`, "kept-calendar-heading", () => {
      this.activate({ kind: "month", year: model.year, month: model.month });
    });
    this.button(title, String(model.year), `Open yearly note for ${model.year}`, "kept-calendar-heading", () => {
      this.activate({ kind: "year", year: model.year });
    });
    if (settings.quarterly.enabled) {
      this.button(title, `Q${model.quarter}`, `Open quarterly note for ${model.year} Q${model.quarter}`, "kept-calendar-heading", () => {
        this.activate({ kind: "quarter", year: model.year, quarter: model.quarter });
      });
    }

    this.button(nav, "›", "Next month", "kept-calendar-nav-btn", () => {
      this.cursor = addMonths(this.cursor, 1);
      this.render();
    });

    const grid = root.createDiv({ cls: "kept-calendar-grid" });
    grid.createDiv({ cls: "kept-calendar-corner" });
    for (const label of model.weekdayLabels) {
      grid.createDiv({ cls: "kept-calendar-dow", text: label });
    }

    for (const week of model.weeks) {
      this.button(
        grid,
        String(week.weekNumber),
        `Open weekly note ${week.weekYear}-W${String(week.weekNumber).padStart(2, "0")}`,
        "kept-calendar-week",
        () => {
          this.activate({ kind: "week", date: week.anchor });
        },
      );
      for (const day of week.days) {
        const classes = ["kept-calendar-day"];
        if (!day.inMonth) classes.push("is-outside");
        if (day.isToday) classes.push("is-today");
        if (this.plugin.dailyNoteExists(day.date)) classes.push("has-note");
        const label = `${MONTH_NAMES[day.date.month - 1]} ${day.date.day}, ${day.date.year}`;
        this.button(grid, String(day.date.day), `Open daily note ${label}`, classes.join(" "), () => {
          this.activate({ kind: "day", date: day.date });
        });
      }
    }

    const footer = root.createDiv({ cls: "kept-calendar-footer" });
    this.button(footer, "Today", "Show the current month and open today's note", "kept-calendar-today", () => {
      this.cursor = { year: today.year, month: today.month, day: 1 };
      this.render();
      this.activate({ kind: "day", date: today });
    });
  }

  private activate(click: CalendarClick): void {
    const period = periodForClick(click);
    void this.plugin.openDate(period, dateForClick(click));
  }

  private button(parent: HTMLElement, text: string, aria: string, cls: string, onClick: () => void): HTMLButtonElement {
    const button = parent.createEl("button", { cls, text });
    button.setAttr("type", "button");
    button.setAttr("aria-label", aria);
    button.addEventListener("click", onClick);
    return button;
  }
}

export function periodForClick(click: CalendarClick): PeriodKind {
  if (click.kind === "day") return "daily";
  if (click.kind === "week") return "weekly";
  if (click.kind === "month") return "monthly";
  if (click.kind === "quarter") return "quarterly";
  return "yearly";
}

export function dailyPathFor(pluginSettings: KeptCalendarPlugin["settings"], date: YMD): string {
  return notePath("daily", date, pluginSettings.daily, pluginSettings.weekStart);
}
