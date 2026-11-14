import moment from "moment";
import { afterEach, describe, expect, it } from "vitest";
import { localeWeekRules, type YMD } from "../src/dates";
import { formatDate } from "../src/format";

const FORMATS = ["YYYY-MM-DD", "GGGG-[W]WW", "gggg-[W]ww", "YYYY-MM", "YYYY-[Q]Q", "YYYY", "MMMM D, dddd"];

function eachUtcDay(start: string, end: string, visit: (date: YMD, stamp: moment.Moment) => void): void {
  const cursor = moment.utc(start);
  const last = moment.utc(end);
  while (cursor.isBefore(last)) {
    visit({ year: cursor.year(), month: cursor.month() + 1, day: cursor.date() }, cursor.clone());
    cursor.add(1, "day");
  }
}

describe("filename formats match Moment", () => {
  afterEach(() => {
    moment.updateLocale("en", { week: { dow: 0, doy: 6 } });
  });

  it("matches ISO and locale tokens for the week starts this plugin uses", () => {
    for (const weekStart of [0, 1, 6]) {
      const rules = localeWeekRules(weekStart);
      moment.updateLocale("en", { week: { dow: rules.dow, doy: rules.doy } });
      eachUtcDay("2025-12-01", "2027-02-01", (date, stamp) => {
        for (const format of FORMATS) {
          expect(formatDate(date, format, weekStart)).toBe(stamp.format(format));
        }
      });
    }
  });
});
