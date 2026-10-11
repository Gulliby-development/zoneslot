<p align="center"><img src="docs/logo.svg" width="96" alt="" /></p>

# zoneslot

A single-page tool that shows the working hours of several time zones side by side and highlights when everyone overlaps, for people planning calls across regions.

[![CI](https://github.com/Gulliby-development/zoneslot/actions/workflows/ci.yml/badge.svg)](https://github.com/Gulliby-development/zoneslot/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![zoneslot screenshot](docs/screenshot.png)

## Why

You are scheduling a call across, for example, Berlin, New York and Kolkata, and daylight saving starts on different dates in each of them. zoneslot converts every UTC hour of a chosen day to local time with the correct offset for that day and marks the hours at which all zones are inside their working hours. It runs entirely in the browser, uses only the built-in `Intl` API and has no date-library dependency.

## Install

Install [Bun](https://bun.sh/), then:

```sh
bun install
bun run dev
```

Open the address that Vite prints. To serve a production build, run `bun run build` and then `bun run preview`.

## Usage

The grid shows one UTC day: 24 columns, `00` to `23` UTC, with one row per zone. Each cell shows the local time of that UTC hour in that zone (`HH:MM`, so Kolkata at 13 UTC shows `18:30`). Cells inside the zone's working hours are marked as working; columns where every valid zone is working are highlighted, and a summary line states the shared hours.

The state lives in the URL hash, so a plan can be shared as a link. For example, Berlin and New York, both working 09:00-17:00, on 2026-03-10:

```text
#d=2026-03-10&z=Europe/Berlin@9-17,America/New_York@9-17
```

The summary for that hash is:

```text
All 2 zones overlap: 13:00-16:00 UTC
```

Hash format: `#d=<YYYY-MM-DD>&z=<zone>@<from>-<to>,<zone>@<from>-<to>`. `from` is 0-23 and `to` is 1-24 (exclusive end). A missing `d` uses the current UTC date and a missing `z` means no zones. An invalid hash (unknown or duplicate zone, more than 8 zones, a bad date or hours out of range) is ignored and the default state is shown.

Stored time zone names are the browser's canonical names, as reported by `Intl`. A zone you type as `europe/berlin` is stored as `Europe/Berlin`, and depending on the browser's ICU data a name such as `Asia/Kolkata` may appear as `Asia/Calcutta`.

### Options

| Option | Description |
|---|---|
| Date | The UTC day shown in the grid. Defaults to today (UTC). |
| Add a time zone | An IANA zone name accepted by `Intl`, for example `Europe/Berlin`. Errors: `Unknown time zone: <text>`, `Zone already added`, `At most 8 zones`. |
| From | Start of working hours in the zone's local time, 0-23 (default 9). |
| To | End of working hours, 1-24, exclusive (default 17). If From is not before To the row shows `Start must be before end` and is ignored in the overlap. |
| Remove | Removes the zone from the list. |

The summary reads `All N zones overlap: HH:00-HH:00 UTC` (several ranges are joined with `, `), `No common working hours on <date> (UTC)`, or `Add a zone to begin`.

## Development

```sh
bun install
bun test
bun run typecheck
bun run lint
bun run build
```

The logic lives in pure modules (`src/overlap.ts`, `src/hash.ts`, `src/state.ts`); components take everything as props and are tested by rendering to a string. The overlap and cell tests depend on the ICU time zone data of the runtime.

## License

MIT, see [LICENSE](LICENSE).

---

Built with BAKED, an open-source coding agent (bench loop round 03, BAKED 5f13062).
