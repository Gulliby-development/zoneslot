export interface WorkingZone {
  zone: string;
  from: number;
  to: number;
}

export interface OverlapResult {
  hours: number[];
  ranges: [number, number][];
}

function dateAtUtcHour(dateISO: string, hour: number): Date {
  return new Date(`${dateISO}T${String(hour).padStart(2, "0")}:00:00.000Z`);
}

function localMinutes(zone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
}

/** Returns whether an instant falls within the zone's local working-hour interval. */
export function isWorking(zone: string, utcDate: Date, from: number, to: number): boolean {
  if (from >= to) return false;
  const minutes = localMinutes(zone, utcDate);
  return minutes >= from * 60 && minutes < to * 60;
}

/** Finds UTC hours when every row with a valid working interval is working. */
export function findOverlap(zones: WorkingZone[], dateISO: string): OverlapResult {
  const validZones = zones.filter(({ from, to }) => from < to);
  if (validZones.length === 0) return { hours: [], ranges: [] };

  const hours: number[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const instant = dateAtUtcHour(dateISO, hour);
    if (validZones.every(({ zone, from, to }) => isWorking(zone, instant, from, to))) {
      hours.push(hour);
    }
  }

  const ranges: [number, number][] = [];
  for (const hour of hours) {
    const previous = ranges[ranges.length - 1];
    if (previous && previous[1] === hour) previous[1] = hour + 1;
    else ranges.push([hour, hour + 1]);
  }
  return { hours, ranges };
}
