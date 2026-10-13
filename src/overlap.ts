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

/** Returns the local calendar date's offset from the instant's UTC date. */
export function dayOffset(zone: string, instant: Date): -1 | 0 | 1 {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const partValue = (type: "year" | "month" | "day"): number =>
    Number(parts.find((part) => part.type === type)?.value);
  const localDate = [partValue("year"), partValue("month"), partValue("day")];
  const utcDate = [instant.getUTCFullYear(), instant.getUTCMonth() + 1, instant.getUTCDate()];

  for (let index = 0; index < localDate.length; index += 1) {
    if (localDate[index] < utcDate[index]) return -1;
    if (localDate[index] > utcDate[index]) return 1;
  }
  return 0;
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

/** Formats shared UTC ranges as local clock times for each valid working zone. */
export function localRanges(
  zones: WorkingZone[],
  dateISO: string,
  ranges: [number, number][],
): { zone: string; text: string }[] {
  if (ranges.length === 0) return [];

  const utcDate = Date.parse(`${dateISO}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateISO) ||
    !Number.isFinite(utcDate) ||
    new Date(utcDate).toISOString().slice(0, 10) !== dateISO
  ) {
    throw new RangeError(`Invalid date: ${dateISO}`);
  }

  const formatEndpoint = (zone: string, hour: number): string => {
    const instant = new Date(utcDate + hour * 3600000);
    const minutes = localMinutes(zone, instant);
    const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    const offset = dayOffset(zone, instant);
    return `${time}${offset === 0 ? "" : ` ${offset > 0 ? "+" : "-"}1d`}`;
  };

  return zones
    .filter(({ from, to }) => from < to)
    .map(({ zone }) => ({
      zone,
      text: ranges
        .map(([start, end]) => `${formatEndpoint(zone, start)}-${formatEndpoint(zone, end)}`)
        .join(", "),
    }));
}

/** Returns whether an instant falls within the zone's local working-hour interval. */
export function isWorking(
  zone: string,
  utcDate: Date,
  from: number,
  to: number,
  skipWeekends = false,
): boolean {
  if (from >= to) return false;
  if (skipWeekends) {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "short",
    }).format(utcDate);
    if (weekday === "Sat" || weekday === "Sun") return false;
  }
  const minutes = localMinutes(zone, utcDate);
  return minutes >= from * 60 && minutes < to * 60;
}

/** Finds UTC hours when every row with a valid working interval is working. */
export function findOverlap(
  zones: WorkingZone[],
  dateISO: string,
  skipWeekends = false,
): OverlapResult {
  const validZones = zones.filter(({ from, to }) => from < to);
  if (validZones.length === 0) return { hours: [], ranges: [] };

  const hours: number[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const instant = dateAtUtcHour(dateISO, hour);
    if (
      validZones.every(({ zone, from, to }) => isWorking(zone, instant, from, to, skipWeekends))
    ) {
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
