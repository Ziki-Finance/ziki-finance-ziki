import { describe, expect, it } from "vitest";
import { addDays, eastern, easternMinutes, hasHolidayList, holidayName, isTradingDay, previousTradingDay, zonedParts } from "@/lib/finance/calendar";

describe("the US market calendar", () => {
  it("knows weekends and NYSE holidays", () => {
    expect(isTradingDay("2026-11-16")).toBe(true); // Monday
    expect(isTradingDay("2026-11-21")).toBe(false); // Saturday
    expect(isTradingDay("2026-11-26")).toBe(false); // Thanksgiving
    expect(isTradingDay("2027-07-05")).toBe(false); // Independence Day, observed
    expect(holidayName("2026-12-25")).toBe("Christmas Day");
    expect(holidayName("2026-11-26")).toBe("a US market holiday");
    expect(holidayName("2026-11-16")).toBeNull();
    expect(hasHolidayList("2027-03-01")).toBe(true);
    expect(hasHolidayList("2030-03-01")).toBe(false);
  });

  it("steps back over weekends and holidays", () => {
    expect(previousTradingDay("2026-11-16")).toBe("2026-11-13"); // Monday → Friday
    expect(previousTradingDay("2026-11-27")).toBe("2026-11-25"); // after Thanksgiving
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("reads Eastern time across daylight saving", () => {
    // 21:30 UTC is 16:30 EST in November and 17:30 EDT in July.
    expect(eastern(new Date("2026-11-16T21:30:00Z"))).toMatchObject({ date: "2026-11-16", hour: 16, minute: 30 });
    expect(easternMinutes(new Date("2026-07-15T21:30:00Z"))).toBe(17 * 60 + 30);
    // 03:00 UTC is still the previous evening in New York.
    expect(eastern(new Date("2026-11-17T03:00:00Z")).date).toBe("2026-11-16");
    expect(zonedParts(new Date("2026-11-16T06:00:00Z"), "Africa/Lagos")).toMatchObject({ date: "2026-11-16", hour: 7, weekday: 1 });
  });
});
