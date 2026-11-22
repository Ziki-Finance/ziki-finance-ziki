/**
 * US market days and Eastern time for Ziki Finance's daily cycle (PRD §7.2).
 *
 * Holidays are the NYSE full-day closures. The list must be extended each year;
 * a year that isn't listed counts only weekends as closed (`hasHolidayList`).
 */

const NYSE_HOLIDAYS: Record<number, readonly string[]> = {
  2026: ["2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25"],
  2027: ["2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24"],
};

const HOLIDAY_NAMES: Record<string, string> = {
  "01-01": "New Year's Day",
  "07-03": "Independence Day",
  "07-05": "Independence Day",
  "12-24": "Christmas Day",
  "12-25": "Christmas Day",
};

export const EASTERN = "America/New_York";

/** The parts of a moment in a time zone. */
export function zonedParts(at: Date, timeZone: string): { date: string; hour: number; minute: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")), weekday };
}

/** The Eastern date and time. */
export function eastern(at: Date) {
  return zonedParts(at, EASTERN);
}

function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function hasHolidayList(date: string): boolean {
  return Number(date.slice(0, 4)) in NYSE_HOLIDAYS;
}

export function isMarketHoliday(date: string): boolean {
  return (NYSE_HOLIDAYS[Number(date.slice(0, 4))] ?? []).includes(date);
}

/** A plain name for a holiday, for "No briefing today: …"; null when it isn't one. */
export function holidayName(date: string): string | null {
  if (!isMarketHoliday(date)) return null;
  return HOLIDAY_NAMES[date.slice(5)] ?? "a US market holiday";
}

export function isTradingDay(date: string): boolean {
  const day = weekdayOf(date);
  return day !== 0 && day !== 6 && !isMarketHoliday(date);
}

/** "2026-11-16" plus n calendar days. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The last trading day strictly before a date. */
export function previousTradingDay(date: string): string {
  let d = addDays(date, -1);
  while (!isTradingDay(d)) d = addDays(d, -1);
  return d;
}

/** Minutes since Eastern midnight. */
export function easternMinutes(at: Date): number {
  const { hour, minute } = eastern(at);
  return hour * 60 + minute;
}
