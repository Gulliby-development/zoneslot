import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { addZone, defaultState, type PlannerState } from "../src/state";

const emptyState = () => defaultState(new Date("2026-03-10T12:34:00.000Z"));

describe("Add a time zone input hints", () => {
  test("trims valid input and adds the canonical zone with default hours", () => {
    const state = emptyState();

    expect(addZone(state, "  europe/berlin \t")).toEqual({
      state: {
        date: state.date,
        zones: [{ zone: "Europe/Berlin", from: 9, to: 17 }],
      },
      error: null,
    });
    expect(state.zones).toEqual([]);
  });

  test("returns exact empty and unknown-zone errors without changing state identity", () => {
    const state = emptyState();
    const emptyError = "Enter a time zone name, for example Europe/Berlin";
    for (const text of ["", " ", "\t", "\n "]) {
      const result = addZone(state, text);
      expect(result.state).toBe(state);
      expect(result.error).toBe(emptyError);
    }

    for (const text of [
      "Not/AZone",
      " Not/AZone  ",
      "Berlin",
      "nowhere",
      "Europe/Berlinn",
      "New York",
      "UTC+2",
    ]) {
      const trimmedText = text.trim();
      const result = addZone(state, text);
      expect(result.state).toBe(state);
      expect(result.error).toBe(
        `Unknown time zone: ${trimmedText} (try a name like Europe/Berlin)`,
      );
    }
  });

  test("treats canonical names and case-insensitive aliases as duplicates", () => {
    const state = addZone(emptyState(), "Europe/Berlin").state;

    for (const text of [" Europe/Berlin ", "europe/berlin"]) {
      const result = addZone(state, text);
      expect(result.state).toBe(state);
      expect(result.error).toBe("Zone already added");
    }
  });

  test("allows the eighth zone and checks duplicate, format, and empty errors before the limit", () => {
    const sevenZoneState: PlannerState = {
      date: "2026-03-10",
      zones: Array.from({ length: 7 }, (_, index) => ({
        zone: `Existing/${index}`,
        from: 9,
        to: 17,
      })),
    };
    const eighth = addZone(sevenZoneState, "UTC");

    expect(eighth).toEqual({
      state: {
        ...sevenZoneState,
        zones: [...sevenZoneState.zones, { zone: "UTC", from: 9, to: 17 }],
      },
      error: null,
    });
    expect(sevenZoneState.zones).toHaveLength(7);

    const fullState = eighth.state;
    const atLimit = addZone(fullState, "Europe/Berlin");
    expect(atLimit.state).toBe(fullState);
    expect(atLimit.error).toBe("At most 8 zones");

    const duplicate = addZone(fullState, " utc ");
    expect(duplicate.state).toBe(fullState);
    expect(duplicate.error).toBe("Zone already added");

    const unknown = addZone(fullState, "Not/AZone");
    expect(unknown.state).toBe(fullState);
    expect(unknown.error).toBe("Unknown time zone: Not/AZone (try a name like Europe/Berlin)");

    const empty = addZone(fullState, " \t");
    expect(empty.state).toBe(fullState);
    expect(empty.error).toBe("Enter a time zone name, for example Europe/Berlin");
  });

  test("documents the empty and unknown-zone error messages", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("`Unknown time zone: <text> (try a name like Europe/Berlin)`");
    expect(readme).toContain("`Enter a time zone name, for example Europe/Berlin`");
  });
});
