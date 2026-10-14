import type { WorkingZone } from "./overlap";

export interface PlannerState {
  date: string;
  zones: WorkingZone[];
  skipWeekends?: boolean;
}

export interface AddZoneResult {
  state: PlannerState;
  error: string | null;
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function canonicalZone(text: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: text }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function defaultState(now: Date): PlannerState {
  return { date: now.toISOString().slice(0, 10), zones: [] };
}

export function addZone(state: PlannerState, text: string): AddZoneResult {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return { state, error: "Enter a time zone name, for example Europe/Berlin" };
  }
  const zone = canonicalZone(trimmedText);
  if (!zone) {
    return {
      state,
      error: `Unknown time zone: ${trimmedText} (try a name like Europe/Berlin)`,
    };
  }
  if (state.zones.some((item) => item.zone === zone)) {
    return { state, error: "Zone already added" };
  }
  if (state.zones.length >= 8) return { state, error: "At most 8 zones" };
  return {
    state: { ...state, zones: [...state.zones, { zone, from: 9, to: 17 }] },
    error: null,
  };
}

export function removeZone(state: PlannerState, zone: string): PlannerState {
  const zones = state.zones.filter((item) => item.zone !== zone);
  return zones.length === state.zones.length ? state : { ...state, zones };
}

export function setRange(
  state: PlannerState,
  zone: string,
  from: number,
  to: number,
): PlannerState {
  let changed = false;
  const zones = state.zones.map((item) => {
    if (item.zone !== zone || (item.from === from && item.to === to)) return item;
    changed = true;
    return { ...item, from, to };
  });
  return changed ? { ...state, zones } : state;
}

export function setDate(state: PlannerState, date: string): PlannerState {
  return isValidDate(date) && state.date !== date ? { ...state, date } : state;
}

export function setSkipWeekends(state: PlannerState, value: boolean): PlannerState {
  if ((state.skipWeekends === true) === value) return state;
  if (value) return { ...state, skipWeekends: true };
  return { date: state.date, zones: state.zones };
}
