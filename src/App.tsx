import { useEffect, useRef, useState } from "react";
import { AddZoneForm } from "./AddZoneForm";
import { formatHash, parseHash } from "./hash";
import { dayOffset, findOverlap, isWorking, localRanges } from "./overlap";
import { addZone, defaultState, type PlannerState, removeZone, setDate, setRange } from "./state";
import { ZoneRow } from "./ZoneRow";

export interface AppProps {
  now: () => Date;
  initialHash: string;
  onHashChange?: (hash: string) => void;
}

function initialState(now: () => Date, hash: string): PlannerState {
  const fallback = defaultState(now());
  const parsed = parseHash(hash);
  return parsed ? { date: parsed.date ?? fallback.date, zones: parsed.zones } : fallback;
}

function utcDateAtHour(date: string, hour: number): Date {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00.000Z`);
}

function formatLocalTime(zone: string, instant: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function App({ now, initialHash, onHashChange }: AppProps) {
  const [state, setState] = useState(() => initialState(now, initialHash));
  const [error, setError] = useState<string | null>(null);
  const skipInitialEffect = useRef(true);
  const onHashChangeRef = useRef(onHashChange);
  onHashChangeRef.current = onHashChange;

  useEffect(() => {
    if (skipInitialEffect.current) {
      skipInitialEffect.current = false;
      return;
    }
    onHashChangeRef.current?.(formatHash(state));
  }, [state]);

  const validZones = state.zones.filter(({ from, to }) => from < to);
  const overlap = findOverlap(validZones, state.date);
  const overlappingHours = new Set(overlap.hours);

  let summary = "Add a zone to begin";
  if (state.zones.length > 0) {
    summary =
      overlap.ranges.length > 0
        ? `All ${validZones.length} ${validZones.length === 1 ? "zone" : "zones"} overlap: ${overlap.ranges
            .map(([start, end]) => `${formatHour(start)}-${formatHour(end)}`)
            .join(", ")} UTC`
        : `No common working hours on ${state.date} (UTC)`;
  }

  const handleAdd = (text: string) => {
    const result = addZone(state, text);
    setError(result.error);
    if (!result.error) setState(result.state);
  };

  return (
    <main className="planner">
      <header className="planner__header">
        <div>
          <p className="eyebrow">Time-zone planner</p>
          <h1>Find a time that works for everyone</h1>
          <p className="intro">Compare local working hours across time zones on one UTC day.</p>
        </div>
        <label className="date-control">
          <span>UTC date</span>
          <input
            type="date"
            value={state.date}
            onChange={(event) => setState((current) => setDate(current, event.target.value))}
          />
        </label>
      </header>

      <section className="zones" aria-label="Planning zones">
        <AddZoneForm error={error} onAdd={handleAdd} />
        {state.zones.map((zone) => (
          <ZoneRow
            key={zone.zone}
            zone={zone.zone}
            from={zone.from}
            to={zone.to}
            onRangeChange={(from, to) =>
              setState((current) => setRange(current, zone.zone, from, to))
            }
            onRemove={() => {
              setState((current) => removeZone(current, zone.zone));
              setError(null);
            }}
          />
        ))}
      </section>

      <p className="summary" data-testid="summary" aria-live="polite">
        {summary}
      </p>
      {overlap.ranges.length > 0 && (
        <ul
          className="local-ranges"
          aria-label="Shared hours in local time"
          data-testid="local-ranges"
        >
          {localRanges(state.zones, state.date, overlap.ranges).map(({ zone, text }) => (
            <li key={zone} data-zone={zone}>{`${zone}: ${text}`}</li>
          ))}
        </ul>
      )}

      <div className="grid-scroll">
        <table className="hours-grid">
          <caption>Local time by UTC hour on {state.date}</caption>
          <thead>
            <tr>
              <th scope="col">Time zone</th>
              {Array.from({ length: 24 }, (_, hour) => (
                <th
                  key={formatHour(hour)}
                  scope="col"
                  data-overlap={overlappingHours.has(hour) ? "true" : "false"}
                >
                  {formatHour(hour)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.zones.map(({ zone, from, to }) => (
              <tr key={zone}>
                <th scope="row">{zone}</th>
                {Array.from({ length: 24 }, (_, hour) => {
                  const instant = utcDateAtHour(state.date, hour);
                  const working = isWorking(zone, instant, from, to);
                  const offset = dayOffset(zone, instant);
                  return (
                    <td
                      key={formatHour(hour)}
                      data-state={working ? "work" : "off"}
                      data-overlap={overlappingHours.has(hour) ? "true" : "false"}
                      className={working ? "hours-grid__work" : "hours-grid__off"}
                      data-day={offset === 0 ? undefined : offset > 0 ? "+1" : "-1"}
                    >
                      {formatLocalTime(zone, instant)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.zones.length > 0 && (
        <p className="grid-legend">+1d and -1d mark a local date after or before the UTC date.</p>
      )}
    </main>
  );
}
