import {
  dayOfYear,
  isoWeek,
  localeWeek,
  quarterOf,
  weekday,
  type YMD,
} from "./dates";

export interface Clock {
  hour: number;
  minute: number;
  second: number;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_MIN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const TOKENS = [
  "YYYY",
  "MMMM",
  "DDDD",
  "dddd",
  "GGGG",
  "gggg",
  "MMM",
  "DDD",
  "ddd",
  "YY",
  "MM",
  "DD",
  "Do",
  "dd",
  "GG",
  "gg",
  "WW",
  "ww",
  "HH",
  "hh",
  "mm",
  "ss",
  "Qo",
  "M",
  "D",
  "d",
  "Q",
  "W",
  "w",
  "H",
  "h",
  "m",
  "s",
  "A",
  "a",
];

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

export function stripMomentLiterals(format: string): string {
  return format.replace(/\[[^\]]*\]/g, "");
}

/** ISO tokens (G, W) follow the ISO week. Otherwise the calendar uses the week-start setting. */
export function weekNumberingForFormat(format: string): "iso" | "locale" {
  const plain = stripMomentLiterals(format);
  if (/(GGGG|GG|WW|W)/.test(plain)) return "iso";
  return "locale";
}

export function formatUsesDayOfMonth(format: string): boolean {
  return /(DDDD|DDD|Do|DD|D)/.test(stripMomentLiterals(format));
}

function hour12(hour: number): number {
  const value = hour % 12;
  return value === 0 ? 12 : value;
}

function renderToken(token: string, date: YMD, weekStart: number, clock: Clock): string {
  const iso = isoWeek(date);
  const locale = localeWeek(date, weekStart);
  const dow = weekday(date);
  switch (token) {
    case "YYYY":
      return String(date.year);
    case "YY":
      return pad(date.year % 100, 2);
    case "MMMM":
      return MONTHS[date.month - 1];
    case "MMM":
      return MONTHS_SHORT[date.month - 1];
    case "MM":
      return pad(date.month, 2);
    case "M":
      return String(date.month);
    case "DDDD":
      return pad(dayOfYear(date), 3);
    case "DDD":
      return String(dayOfYear(date));
    case "DD":
      return pad(date.day, 2);
    case "Do":
      return ordinal(date.day);
    case "D":
      return String(date.day);
    case "dddd":
      return DAYS[dow];
    case "ddd":
      return DAYS_SHORT[dow];
    case "dd":
      return DAYS_MIN[dow];
    case "d":
      return String(dow);
    case "GGGG":
      return String(iso.year);
    case "GG":
      return pad(iso.year % 100, 2);
    case "gggg":
      return String(locale.year);
    case "gg":
      return pad(locale.year % 100, 2);
    case "WW":
      return pad(iso.week, 2);
    case "W":
      return String(iso.week);
    case "ww":
      return pad(locale.week, 2);
    case "w":
      return String(locale.week);
    case "Qo":
      return ordinal(quarterOf(date));
    case "Q":
      return String(quarterOf(date));
    case "HH":
      return pad(clock.hour, 2);
    case "H":
      return String(clock.hour);
    case "hh":
      return pad(hour12(clock.hour), 2);
    case "h":
      return String(hour12(clock.hour));
    case "mm":
      return pad(clock.minute, 2);
    case "m":
      return String(clock.minute);
    case "ss":
      return pad(clock.second, 2);
    case "s":
      return String(clock.second);
    case "A":
      return clock.hour < 12 ? "AM" : "PM";
    case "a":
      return clock.hour < 12 ? "am" : "pm";
    default:
      return token;
  }
}

const ZERO_CLOCK: Clock = { hour: 0, minute: 0, second: 0 };

/** Moment-style formatter for the filename tokens Periodic Notes and Daily notes use. */
export function formatDate(date: YMD, format: string, weekStart: number, clock: Clock = ZERO_CLOCK): string {
  let out = "";
  for (let index = 0; index < format.length; index++) {
    const char = format[index];
    if (char === "[") {
      const end = format.indexOf("]", index + 1);
      if (end === -1) {
        out += format.slice(index + 1);
        break;
      }
      out += format.slice(index + 1, end);
      index = end;
      continue;
    }
    const rest = format.slice(index);
    const token = TOKENS.find((candidate) => rest.startsWith(candidate));
    if (token) {
      out += renderToken(token, date, weekStart, clock);
      index += token.length - 1;
      continue;
    }
    out += char;
  }
  return out;
}

export function clockFromDate(date: Date): Clock {
  return { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() };
}
