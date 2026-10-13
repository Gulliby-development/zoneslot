import type { WorkingZone } from "./overlap";
import type { PlannerState } from "./state";
import { canonicalZone, isValidDate } from "./state";

export interface ParsedHash {
  date?: string;
  zones: WorkingZone[];
  skipWeekends?: boolean;
}

export function parseHash(hash: string): ParsedHash | null {
  const source = hash.startsWith("#") ? hash.slice(1) : hash;
  if (source === "") return { zones: [] };

  const params = new Map<string, string>();
  for (const part of source.split("&")) {
    const separator = part.indexOf("=");
    if (separator <= 0) return null;
    const key = part.slice(0, separator);
    if ((key !== "d" && key !== "w" && key !== "z") || params.has(key)) return null;
    params.set(key, part.slice(separator + 1));
  }

  const date = params.get("d");
  if (date !== undefined && !isValidDate(date)) return null;
  const weekendValue = params.get("w");
  if (weekendValue !== undefined && weekendValue !== "0" && weekendValue !== "1") return null;

  const zonesText = params.get("z");
  const zones: WorkingZone[] = [];
  if (zonesText !== undefined) {
    if (zonesText === "") return null;
    for (const entry of zonesText.split(",")) {
      const match = /^(.+)@(\d+)-(\d+)$/.exec(entry);
      if (!match) return null;
      const [, typedZone, fromText, toText] = match;
      const zone = canonicalZone(typedZone);
      const from = Number(fromText);
      const to = Number(toText);
      if (
        !zone ||
        zones.some((item) => item.zone === zone) ||
        !Number.isInteger(from) ||
        from < 0 ||
        from > 23 ||
        !Number.isInteger(to) ||
        to < 1 ||
        to > 24
      )
        return null;
      zones.push({ zone, from, to });
      if (zones.length > 8) return null;
    }
  }

  return {
    ...(date === undefined ? {} : { date }),
    ...(weekendValue === "1" ? { skipWeekends: true } : {}),
    zones,
  };
}

export function formatHash(state: PlannerState): string {
  const zones = state.zones.map(({ zone, from, to }) => `${zone}@${from}-${to}`).join(",");
  const weekend = state.skipWeekends === true ? "&w=1" : "";
  return `#d=${state.date}${weekend}${zones ? `&z=${zones}` : ""}`;
}
