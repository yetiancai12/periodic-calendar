import { describe, expect, it } from "vitest";
import { buildCalendar } from "../src/calendar-model";
import { addDays, isoWeek, startOfIsoWeek } from "../src/dates";
import { formatDate } from "../src/format";

const dec28 = { year: 2026, month: 12, day: 28 };
const jan3 = { year: 2027, month: 1, day: 3 };
const jan4 = { year: 2027, month: 1, day: 4 };

describe("ISO weeks", () => {
  it("maps 2026-12-28 through 2027-01-03 to 2026-W53", () => {
    expect(isoWeek(dec28)).toEqual({ year: 2026, week: 53 });
    expect(isoWeek(jan3)).toEqual({ year: 2026, week: 53 });
    expect(formatDate(dec28, "GGGG-[W]WW", 1)).toBe("2026-W53");
    expect(formatDate(jan3, "GGGG-[W]WW", 0)).toBe("2026-W53");
    expect(formatDate(jan3, "YYYY-MM-DD", 1)).toBe("2027-01-03");
    expect(startOfIsoWeek(jan3)).toEqual(dec28);
    expect(addDays(dec28, 6)).toEqual(jan3);
  });

  it("starts 2027-W01 on 2027-01-04", () => {
    expect(isoWeek(jan4)).toEqual({ year: 2027, week: 1 });
    expect(formatDate(jan4, "GGGG-[W]WW", 1)).toBe("2027-W01");
    expect(isoWeek({ year: 2026, month: 12, day: 27 })).toEqual({ year: 2026, week: 52 });
  });

  it("shows week 53 on the calendar row and week 1 on the next row", () => {
    const december = buildCalendar(2026, 12, dec28, 1, "iso");
    const row = december.weeks.find((week) =>
      week.days.some((day) => day.date.year === 2026 && day.date.month === 12 && day.date.day === 28),
    );
    expect(row?.weekNumber).toBe(53);
    expect(row?.weekYear).toBe(2026);
    expect(formatDate(row!.anchor, "GGGG-[W]WW", 1)).toBe("2026-W53");
    expect(row?.days[0].date).toEqual(dec28);

    const january = buildCalendar(2027, 1, dec28, 1, "iso");
    const last = january.weeks.find((week) =>
      week.days.some((day) => day.date.year === 2027 && day.date.month === 1 && day.date.day === 3),
    );
    const first = january.weeks.find((week) =>
      week.days.some((day) => day.date.year === 2027 && day.date.month === 1 && day.date.day === 4),
    );
    expect(last?.weekNumber).toBe(53);
    expect(last?.weekYear).toBe(2026);
    expect(first?.weekNumber).toBe(1);
    expect(first?.weekYear).toBe(2027);
  });
});
