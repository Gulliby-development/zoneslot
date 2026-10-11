import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AddZoneForm } from "../src/AddZoneForm";
import { App } from "../src/App";
import { formatHash, parseHash } from "../src/hash";
import { dayOffset, findOverlap, isWorking } from "../src/overlap";
import {
  addZone,
  defaultState,
  type PlannerState,
  removeZone,
  setDate,
  setRange,
} from "../src/state";

const sampleHash = "#d=2026-03-10&z=Europe/Berlin@9-17,America/New_York@9-17";
const fixedNow = () => new Date("2026-03-10T12:34:00.000Z");
const instant = (date: string, hour: number) =>
  new Date(`${date}T${String(hour).padStart(2, "0")}:00:00.000Z`);
const berlinNewYork: PlannerState = {
  date: "2026-03-10",
  zones: [
    { zone: "Europe/Berlin", from: 9, to: 17 },
    { zone: "America/New_York", from: 9, to: 17 },
  ],
};

function renderedCells(date: string, zone: string, from: number, to: number) {
  const markup = renderToStaticMarkup(
    createElement(App, {
      now: fixedNow,
      initialHash: `#d=${date}&z=${zone}@${from}-${to}`,
    }),
  );
  const row = markup.match(new RegExp(`<tr><th scope="row">${zone}</th>(.*?)</tr>`))?.[1];
  return [...(row ?? "").matchAll(/<td([^>]*)>([^<]*)<\/td>/g)].map(([, attributes, text]) => ({
    attributes,
    text,
  }));
}

describe("Intl time and overlap calculations", () => {
  test("compares local and UTC calendar-day offsets", () => {
    expect(dayOffset("Asia/Kolkata", new Date("2026-03-10T20:00:00Z"))).toBe(1);
    expect(dayOffset("Europe/Berlin", new Date("2026-03-10T23:00:00Z"))).toBe(1);
    expect(dayOffset("Europe/Berlin", new Date("2026-03-10T12:00:00Z"))).toBe(0);
    expect(dayOffset("America/New_York", new Date("2026-03-10T02:00:00Z"))).toBe(-1);
    expect(dayOffset("Pacific/Honolulu", new Date("2026-03-10T09:00:00Z"))).toBe(-1);
    expect(dayOffset("Pacific/Kiritimati", new Date("2026-03-10T10:00:00Z"))).toBe(1);
    expect(dayOffset("Pacific/Kiritimati", new Date("2026-03-10T09:00:00Z"))).toBe(0);
  });

  test("converts specified offsets, DST transitions, and fractional offsets", () => {
    expect(isWorking("Europe/Berlin", instant("2026-03-10", 13), 9, 17)).toBe(true);
    expect(isWorking("America/New_York", instant("2026-03-10", 13), 9, 17)).toBe(true);
    expect(isWorking("Asia/Kolkata", instant("2026-03-10", 3), 9, 17)).toBe(false);
    expect(isWorking("Asia/Kolkata", instant("2026-03-10", 11), 9, 17)).toBe(true);
    expect(isWorking("Asia/Kolkata", instant("2026-03-10", 12), 9, 17)).toBe(false);

    const local = (zone: string, date: string, hour: number) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(instant(date, hour));

    expect(local("Europe/Berlin", "2026-03-10", 13)).toBe("14:00");
    expect(local("America/New_York", "2026-03-10", 13)).toBe("09:00");
    expect(local("America/New_York", "2026-03-08", 6)).toBe("01:00");
    expect(local("America/New_York", "2026-03-08", 7)).toBe("03:00");
    expect(local("Europe/Berlin", "2026-03-29", 0)).toBe("01:00");
    expect(local("Europe/Berlin", "2026-03-29", 1)).toBe("03:00");
    expect(local("Europe/Berlin", "2026-10-25", 0)).toBe("02:00");
    expect(local("Europe/Berlin", "2026-10-25", 1)).toBe("02:00");
    expect(local("Asia/Kolkata", "2026-03-10", 3)).toBe("08:30");
    expect(local("Asia/Kolkata", "2026-03-10", 11)).toBe("16:30");
    expect(local("Asia/Kolkata", "2026-03-10", 12)).toBe("17:30");
    expect(local("Asia/Kathmandu", "2026-03-10", 0)).toBe("05:45");
  });

  test("production rendering and work checks cover DST and fractional-offset cells", () => {
    const newYorkSpring = renderedCells("2026-03-08", "America/New_York", 1, 4);
    expect(newYorkSpring[6]).toMatchObject({ text: "01:00" });
    expect(newYorkSpring[6].attributes).toContain('data-state="work"');
    expect(newYorkSpring[7]).toMatchObject({ text: "03:00" });
    expect(newYorkSpring[7].attributes).toContain('data-state="work"');
    expect(isWorking("America/New_York", instant("2026-03-08", 6), 1, 4)).toBe(true);
    expect(isWorking("America/New_York", instant("2026-03-08", 7), 1, 4)).toBe(true);

    const berlinSpring = renderedCells("2026-03-29", "Europe/Berlin", 0, 24);
    expect(berlinSpring[0].text).toBe("01:00");
    expect(berlinSpring[1].text).toBe("03:00");
    const berlinFall = renderedCells("2026-10-25", "Europe/Berlin", 0, 24);
    expect(berlinFall[0].text).toBe("02:00");
    expect(berlinFall[1].text).toBe("02:00");

    const kolkata = renderedCells("2026-03-10", "Asia/Kolkata", 9, 17);
    expect(kolkata[3]).toMatchObject({ text: "08:30" });
    expect(kolkata[3].attributes).toContain('data-state="off"');
    expect(kolkata[11]).toMatchObject({ text: "16:30" });
    expect(kolkata[11].attributes).toContain('data-state="work"');
    expect(kolkata[12]).toMatchObject({ text: "17:30" });
    expect(kolkata[12].attributes).toContain('data-state="off"');
    expect(findOverlap([{ zone: "Asia/Kolkata", from: 9, to: 17 }], "2026-03-10").hours).toEqual([
      4, 5, 6, 7, 8, 9, 10, 11,
    ]);

    expect(renderedCells("2026-03-10", "Asia/Kathmandu", 0, 24)[0].text).toBe("05:45");
  });

  test("finds overlap ranges, disjoint day-edge ranges, and empty cases", () => {
    expect(findOverlap(berlinNewYork.zones, berlinNewYork.date)).toEqual({
      hours: [13, 14, 15],
      ranges: [[13, 16]],
    });
    expect(
      findOverlap(
        [
          { zone: "Pacific/Kiritimati", from: 12, to: 16 },
          { zone: "Pacific/Honolulu", from: 12, to: 16 },
        ],
        "2026-03-10",
      ),
    ).toEqual({
      hours: [0, 1, 22, 23],
      ranges: [
        [0, 2],
        [22, 24],
      ],
    });
    expect(
      findOverlap(
        [
          { zone: "UTC", from: 9, to: 10 },
          { zone: "UTC", from: 11, to: 12 },
        ],
        "2026-03-10",
      ),
    ).toEqual({ hours: [], ranges: [] });
    expect(
      findOverlap(
        [
          { zone: "UTC", from: 17, to: 9 },
          { zone: "UTC", from: 9, to: 10 },
        ],
        "2026-03-10",
      ),
    ).toEqual({ hours: [9], ranges: [[9, 10]] });
    expect(findOverlap([{ zone: "UTC", from: 17, to: 9 }], "2026-03-10")).toEqual({
      hours: [],
      ranges: [],
    });
    expect(findOverlap([], "2026-03-10")).toEqual({ hours: [], ranges: [] });
  });
});

describe("planner state", () => {
  test("provides UTC defaults and validates immutable updates", () => {
    expect(defaultState(new Date("2026-03-10T00:30:00-05:00"))).toEqual({
      date: "2026-03-10",
      zones: [],
    });

    const empty = defaultState(fixedNow());
    const added = addZone(empty, "europe/berlin");
    expect(added).toEqual({
      state: { date: empty.date, zones: [{ zone: "Europe/Berlin", from: 9, to: 17 }] },
      error: null,
    });
    expect(empty.zones).toEqual([]);
    expect(addZone(added.state, "Europe/Berlin")).toEqual({
      state: added.state,
      error: "Zone already added",
    });
    expect(addZone(empty, "Not/AZone")).toEqual({
      state: empty,
      error: "Unknown time zone: Not/AZone",
    });

    const full: PlannerState = {
      date: empty.date,
      zones: Array.from({ length: 8 }, (_, index) => ({
        zone: `Etc/GMT${index === 0 ? "" : index > 0 ? `+${index}` : ""}`,
        from: 9,
        to: 17,
      })),
    };
    expect(addZone(full, "Europe/Berlin")).toEqual({ state: full, error: "At most 8 zones" });

    const updated = setRange(added.state, "Europe/Berlin", 17, 9);
    expect(updated.zones[0]).toMatchObject({ from: 17, to: 9 });
    expect(setRange(updated, "Europe/Berlin", 17, 9)).toBe(updated);
    expect(setRange(updated, "UTC", 1, 2)).toBe(updated);
    expect(removeZone(updated, "Europe/Berlin")).toEqual({ date: empty.date, zones: [] });
    expect(removeZone(updated, "missing")).toBe(updated);
    expect(setDate(updated, "2026-03-11").date).toBe("2026-03-11");
    expect(setDate(updated, "2026-02-30")).toBe(updated);
    expect(setDate(updated, updated.date)).toBe(updated);
  });
});

describe("shareable URL hashes", () => {
  test("round-trips state and uses defaults for missing parameters", () => {
    expect(parseHash(sampleHash)).toEqual(berlinNewYork);
    expect(parseHash(formatHash(berlinNewYork))).toEqual(berlinNewYork);
    expect(formatHash(berlinNewYork)).toBe(sampleHash);
    expect(parseHash("d=2026-03-10&z=Europe/Berlin@17-9")).toEqual({
      date: "2026-03-10",
      zones: [{ zone: "Europe/Berlin", from: 17, to: 9 }],
    });
    expect(parseHash("#z=Europe/Berlin@9-17")).toEqual({
      zones: [{ zone: "Europe/Berlin", from: 9, to: 17 }],
    });
    expect(parseHash("#d=2026-03-10")).toEqual({ date: "2026-03-10", zones: [] });
    expect(formatHash({ date: "2026-03-10", zones: [] })).toBe("#d=2026-03-10");
  });

  test("rejects every malformed or disallowed hash case", () => {
    const nineZones = Array.from(
      { length: 9 },
      (_, index) => `Etc/GMT${index ? `+${index}` : ""}@9-17`,
    ).join(",");
    for (const invalid of [
      "#d=2026-02-30",
      "#z=Not/AZone@9-17",
      "#z=Europe/Berlin@9-17,Europe/Berlin@10-18",
      `#z=${nineZones}`,
      "#z=Europe/Berlin@24-17",
      "#z=Europe/Berlin@9-0",
      "#garbage",
      "#d=2026-03-10&d=2026-03-11",
      "#d=2026-03-10&x=1",
      "#z=",
      "#z=Europe/Berlin@9-17,",
    ]) {
      expect(parseHash(invalid)).toBeNull();
    }
  });
});

describe("server-rendered components", () => {
  test("renders the expected overlap summary, headers, local times, and cell states", () => {
    const markup = renderToStaticMarkup(
      createElement(App, { now: fixedNow, initialHash: sampleHash }),
    );
    expect(markup).toContain("All 2 zones overlap: 13:00-16:00 UTC");
    const overlapHeaders = markup.match(/<th(?=[^>]*data-overlap="true")[^>]*>[^<]*<\/th>/g) ?? [];
    expect(overlapHeaders).toHaveLength(3);
    expect(overlapHeaders.map((header) => header.match(/>([^<]*)<\/th>/)?.[1])).toEqual([
      "13:00",
      "14:00",
      "15:00",
    ]);
    expect(markup).toMatch(
      /data-state="work" data-overlap="true" class="hours-grid__work">14:00<\/td>/,
    );
    expect(markup).toMatch(
      /data-state="work" data-overlap="true" class="hours-grid__work">09:00<\/td>/,
    );
    expect(markup).toContain('data-state="off"');
  });

  test("marks local dates relative to UTC and conditionally renders the legend", () => {
    const render = (hash: string) =>
      renderToStaticMarkup(createElement(App, { now: fixedNow, initialHash: hash }));
    const count = (markup: string, marker: string) =>
      markup.split(`data-day="${marker}"`).length - 1;

    const berlin = render("#d=2026-03-10&z=Europe/Berlin@9-17");
    expect(count(berlin, "+1")).toBe(1);
    expect(count(berlin, "-1")).toBe(0);
    expect(berlin).toContain('data-day="+1">00:00</td>');

    const newYork = render("#d=2026-03-10&z=America/New_York@9-17");
    expect(count(newYork, "-1")).toBe(4);
    expect(count(newYork, "+1")).toBe(0);
    const kolkata = render("#d=2026-03-10&z=Asia/Kolkata@9-17");
    expect(count(kolkata, "+1")).toBe(5);
    expect(count(kolkata, "-1")).toBe(0);
    const kolkataCells = renderedCells("2026-03-10", "Asia/Kolkata", 9, 17);
    for (const cell of kolkataCells.slice(0, 19)) {
      expect(cell.attributes).not.toContain("data-day");
    }
    expect(kolkataCells[18]).toMatchObject({ text: "23:30" });
    for (const cell of kolkataCells.slice(19)) {
      expect(cell.attributes).toContain('data-day="+1"');
    }
    expect(kolkataCells.slice(19)).toHaveLength(5);
    expect(kolkata).toContain('class="hours-grid__off" data-day="+1">01:30</td>');
    expect(berlin).toContain("grid-legend");
    expect(berlin).toContain("+1d and -1d mark a local date after or before the UTC date.");
    expect(render("#d=2026-03-10")).not.toContain("grid-legend");
  });

  test("falls back on invalid hashes and excludes invalid ranges from overlap", () => {
    const invalidHashMarkup = renderToStaticMarkup(
      createElement(App, { now: fixedNow, initialHash: "#d=2026-02-30" }),
    );
    expect(invalidHashMarkup).toContain("Add a zone to begin");

    const invalidRangeMarkup = renderToStaticMarkup(
      createElement(App, { now: fixedNow, initialHash: "#d=2026-03-10&z=Europe/Berlin@17-9" }),
    );
    expect(invalidRangeMarkup).toContain("Start must be before end");
    expect(invalidRangeMarkup).toContain("No common working hours on 2026-03-10 (UTC)");
  });

  test("renders AddZoneForm errors in an alert", () => {
    const markup = renderToStaticMarkup(
      createElement(AddZoneForm, { error: "Unknown time zone: Nope", onAdd: () => undefined }),
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Unknown time zone: Nope");
  });
});

describe("project documentation and license", () => {
  test("constrains the grid layout and styles date markers", () => {
    const styles = readFileSync("src/styles.css", "utf8");
    const rule = (selector: string) => {
      const expectedSelector = selector.replaceAll("\\n", "\n").replace(/\s+/g, " ").trim();
      const block = styles.split("}").find((candidate) => {
        const [candidateSelector] = candidate.split("{");
        return candidateSelector.replace(/\s+/g, " ").trim() === expectedSelector;
      });
      return block?.slice(block.indexOf("{") + 1) ?? "";
    };

    expect(rule(".hours-grid th,\\n.hours-grid td")).toContain("padding: 12px 3px;");
    const gridMinWidth = Number(rule(".hours-grid").split("min-width:")[1]?.trim().split("px")[0]);
    expect(gridMinWidth).toBeLessThanOrEqual(1100);
    expect(rule(".hours-grid td")).toContain("font-size: 0.7rem;");
    expect(rule(".hours-grid thead th")).toContain("font-size: 0.7rem;");
    const zoneHeader = rule(".hours-grid thead th:first-child,\\n.hours-grid tbody th");
    expect(zoneHeader).toContain("min-width: 150px;");
    expect(zoneHeader).toContain("width: 150px;");
    expect(zoneHeader).toContain("max-width: 150px;");
    expect(zoneHeader).toContain("white-space: normal;");
    expect(zoneHeader).toContain("overflow-wrap: anywhere;");
    expect(zoneHeader).toContain("padding-left: 8px;");
    expect(zoneHeader).toContain("padding-right: 8px;");
    expect(rule(".grid-scroll")).toContain("overflow-x: auto;");
    expect(rule(".hours-grid td[data-day]::after")).toContain('content: attr(data-day) "d";');
    expect(rule(".hours-grid td[data-day]::after")).toContain("display: block;");
    expect(rule(".hours-grid td[data-day]::after")).toContain("font-size: 0.6rem;");
    expect(rule(".hours-grid td[data-day]::after")).toContain("line-height: 1;");
    expect(rule(".grid-legend")).toContain("color: var(--muted);");
    expect(rule(".grid-legend")).toContain("margin: 8px 0 0;");
  });

  test("documents required commands, date markers, and examples", () => {
    const readme = readFileSync("README.md", "utf8");
    for (const required of [
      "bun run dev",
      "bun test",
      "bun run lint",
      "bun run build",
      "#d=2026-03-10&z=Europe/Berlin@9-17,America/New_York@9-17",
      "All 2 zones overlap: 13:00-16:00 UTC",
      "`+1d` or `-1d` marker",
      "The legend below the grid explains the markers.",
      "`Asia/Kolkata` at 20 UTC reads `01:30` with a `+1d` marker.",
      "Asia/Calcutta",
    ]) {
      expect(readme).toContain(required);
    }
  });

  test("includes the MIT license", () => {
    const license = readFileSync("LICENSE", "utf8");
    expect(license).toContain("MIT License");
    expect(license).toContain("Permission is hereby granted, free of charge");
    expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
  });
});
