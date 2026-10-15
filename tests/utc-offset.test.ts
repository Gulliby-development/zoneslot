import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../src/App";
import { utcOffset } from "../src/overlap";

const fixedNow = () => new Date("2026-03-10T12:34:00.000Z");

const offsetCases: [string, string, string][] = [
  ["Europe/Berlin", "2026-03-10", "UTC+1"],
  ["Europe/Berlin", "2026-03-28", "UTC+1"],
  ["Europe/Berlin", "2026-03-29", "UTC+2"],
  ["Europe/Berlin", "2026-10-25", "UTC+1"],
  ["America/New_York", "2026-03-07", "UTC-5"],
  ["America/New_York", "2026-03-10", "UTC-4"],
  ["Asia/Kolkata", "2026-03-10", "UTC+5:30"],
  ["Asia/Kathmandu", "2026-03-10", "UTC+5:45"],
  ["Asia/Tokyo", "2026-03-10", "UTC+9"],
  ["Pacific/Kiritimati", "2026-03-10", "UTC+14"],
  ["Pacific/Pago_Pago", "2026-03-10", "UTC-11"],
  ["Etc/GMT+5", "2026-03-10", "UTC-5"],
  ["UTC", "2026-03-10", "UTC+0"],
  ["America/St_Johns", "2026-01-15", "UTC-3:30"],
  ["America/St_Johns", "2026-03-10", "UTC-2:30"],
  ["Australia/Lord_Howe", "2026-01-15", "UTC+11"],
  ["Australia/Lord_Howe", "2026-07-15", "UTC+10:30"],
];

const renderApp = (initialHash: string, now = fixedNow) =>
  renderToStaticMarkup(createElement(App, { now, initialHash }));

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("date-specific UTC offsets", () => {
  for (const [zone, date, expected] of offsetCases) {
    test(`returns ${expected} for ${zone} on ${date}`, () => {
      expect(utcOffset(zone, date)).toBe(expected);
    });
  }

  test("returns the same result for repeated calls", () => {
    const first = utcOffset("Australia/Lord_Howe", "2026-07-15");
    const second = utcOffset("Australia/Lord_Howe", "2026-07-15");

    expect(first).toBe("UTC+10:30");
    expect(second).toBe(first);
  });

  test("accepts leap day", () => {
    expect(utcOffset("UTC", "2024-02-29")).toBe("UTC+0");
  });

  for (const date of ["2026-02-30", "2026-3-1", ""]) {
    test(`rejects invalid date ${JSON.stringify(date)} with an exact error`, () => {
      const error = thrownBy(() => utcOffset("UTC", date));

      expect(error).toBeInstanceOf(RangeError);
      expect(error instanceof RangeError ? error.message : "").toBe(`Invalid date: ${date}`);
    });
  }
});

describe("UTC offsets in grid headers", () => {
  test("renders exact headers using the canonical stored Kolkata name", () => {
    const markup = renderApp(
      "#d=2026-03-10&z=Europe/Berlin@9-17,America/New_York@9-17,Asia/Kolkata@9-17",
    );
    const canonicalKolkata = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
    }).resolvedOptions().timeZone;

    expect(markup).toContain(
      '<th scope="row">Europe/Berlin<span class="zone-offset">UTC+1</span></th>',
    );
    expect(markup).toContain(
      '<th scope="row">America/New_York<span class="zone-offset">UTC-4</span></th>',
    );
    expect(markup).toContain(
      `<th scope="row">${canonicalKolkata}<span class="zone-offset">UTC+5:30</span></th>`,
    );
  });

  test("uses the hash date for the Berlin offset instead of the fixed current date", () => {
    const markup = renderApp(
      "#d=2026-03-29&z=Europe/Berlin@9-17",
      () => new Date("2026-03-10T12:34:00.000Z"),
    );

    expect(markup).toContain('value="2026-03-29"');
    expect(markup).toContain(
      '<th scope="row">Europe/Berlin<span class="zone-offset">UTC+2</span></th>',
    );
  });

  test("does not render offsets when there are no zones", () => {
    const markup = renderApp("#d=2026-03-10");

    expect(markup).not.toContain("zone-offset");
  });

  test("preserves the existing grid, summary, local ranges, legend, and zone controls", () => {
    const markup = renderApp("#d=2026-03-10&z=Europe/Berlin@9-17,America/New_York@9-17");

    expect(markup).toContain(
      '<thead><tr><th scope="col">Time zone</th><th scope="col" data-overlap="false">00:00</th><th scope="col" data-overlap="false">01:00</th>',
    );
    expect(markup).toContain(
      '<td data-state="work" data-overlap="true" class="hours-grid__work">14:00</td>',
    );
    expect(markup).toContain(
      '<p class="summary" data-testid="summary" aria-live="polite">All 2 zones overlap: 13:00-16:00 UTC</p>',
    );
    expect(markup).toContain(
      '<ul class="local-ranges" aria-label="Shared hours in local time" data-testid="local-ranges"><li data-zone="Europe/Berlin">Europe/Berlin: 14:00-17:00</li><li data-zone="America/New_York">America/New_York: 09:00-12:00</li></ul>',
    );
    expect(markup).toContain(
      '<p class="grid-legend">+1d and -1d mark a local date after or before the UTC date.</p>',
    );
    expect(markup).toContain(
      '<form class="add-zone-form"><label for="zone-input">Add a time zone</label>',
    );
    expect(markup).toContain(
      '<div class="zone-row"><strong class="zone-row__name">Europe/Berlin</strong><label><span>From</span><select aria-label="Europe/Berlin from">',
    );
    expect(markup).toContain('<button type="button" class="button button--quiet">Remove</button>');
  });
});

describe("UTC-offset documentation", () => {
  test("documents the exact section in the required position", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8").replace(
      /\r\n?/g,
      "\n",
    );
    const section = [
      "### UTC offsets",
      "",
      "The row header of each zone shows the zone's offset from UTC on the chosen date, measured at 12:00 UTC: `UTC+1`, `UTC-4`, `UTC+5:30`, `UTC+0`. Hours have no leading zero, and the minutes appear only when they are not 0. Because the offset follows the date, Berlin reads `UTC+1` on 2026-03-10 and `UTC+2` on 2026-03-29, the day daylight saving starts.",
    ].join("\n");
    const sectionIndex = readme.indexOf(section);
    const secondSectionIndex = readme.indexOf(section, sectionIndex + section.length);
    const skipWeekendsIndex = readme.indexOf("### Skip weekends");
    const developmentIndex = readme.indexOf("## Development");

    expect(sectionIndex).toBeGreaterThanOrEqual(0);
    expect(secondSectionIndex).toBe(-1);
    expect(skipWeekendsIndex).toBeLessThan(sectionIndex);
    expect(sectionIndex).toBeLessThan(developmentIndex);
    expect(readme.slice(0, developmentIndex).trimEnd()).toEndWith(section);
  });
});
