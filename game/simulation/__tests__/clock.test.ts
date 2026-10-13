import { describe, expect, it } from "vitest";
import { formatGameClock, getGameClock } from "@/game/simulation/clock";

describe("game clock", () => {
  it("starts on Day 1 at 06:00", () => {
    const clock = getGameClock(0);
    expect(clock).toEqual({ day: 1, hour: 6, minute: 0 });
    expect(formatGameClock(clock)).toBe("06:00");
  });

  it("advances one full game day in 300 active seconds", () => {
    expect(getGameClock(300_000)).toEqual({ day: 2, hour: 6, minute: 0 });
  });

  it("rolls over at midnight", () => {
    expect(getGameClock(225_000)).toEqual({ day: 2, hour: 0, minute: 0 });
  });

  it("treats malformed elapsed time as the initial clock", () => {
    expect(getGameClock(Number.NaN)).toEqual({ day: 1, hour: 6, minute: 0 });
  });
});