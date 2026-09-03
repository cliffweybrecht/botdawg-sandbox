import { isValidTimeZone } from "./timezones";
import { isDuration, type DurationMin } from "./slots";
import type { Person } from "./overlap";

export const STORAGE_KEY = "overlap.v1";

export interface AppState {
  dateISO: string;
  durationMin: DurationMin;
  people: Person[];
  selectedStartMs: number | null;
}

export interface HashPayload {
  v: 1;
  date: string;
  duration: number;
  selectedStart: number | null;
  people: Array<{ n: string; z: string; s: string; e: string }>;
}

export function newId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function defaultPerson(partial?: Partial<Person>): Person {
  return {
    id: newId(),
    name: "",
    timeZone: "America/New_York",
    workStart: "09:00",
    workEnd: "17:00",
    ...partial,
  };
}

export function seedPeople(): Person[] {
  return [
    defaultPerson({ name: "Alex", timeZone: "America/New_York" }),
    defaultPerson({ name: "Blair", timeZone: "Europe/London" }),
    defaultPerson({ name: "Chi", timeZone: "America/Denver" }),
  ];
}

function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function sanitizeState(raw: unknown, fallbackDate: string): AppState {
  const base: AppState = {
    dateISO: fallbackDate,
    durationMin: 30,
    people: [],
    selectedStartMs: null,
  };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;

  if (typeof o.dateISO === "string" && isISODate(o.dateISO)) base.dateISO = o.dateISO;
  if (typeof o.durationMin === "number" && isDuration(o.durationMin)) {
    base.durationMin = o.durationMin;
  }
  if (typeof o.selectedStartMs === "number" && Number.isFinite(o.selectedStartMs)) {
    base.selectedStartMs = o.selectedStartMs;
  }
  if (Array.isArray(o.people)) {
    base.people = o.people
      .map((p): Person | null => {
        if (!p || typeof p !== "object") return null;
        const x = p as Record<string, unknown>;
        const timeZone = typeof x.timeZone === "string" ? x.timeZone : "";
        const workStart = typeof x.workStart === "string" ? x.workStart : "09:00";
        const workEnd = typeof x.workEnd === "string" ? x.workEnd : "17:00";
        const name = typeof x.name === "string" ? x.name.slice(0, 80) : "";
        const id = typeof x.id === "string" && x.id ? x.id : newId();
        return { id, name, timeZone, workStart, workEnd };
      })
      .filter((p): p is Person => p !== null)
      .slice(0, 24);
  }
  return base;
}

export function encodeHash(state: AppState): string {
  const payload: HashPayload = {
    v: 1,
    date: state.dateISO,
    duration: state.durationMin,
    selectedStart: state.selectedStartMs,
    people: state.people.map((p) => ({
      n: p.name,
      z: p.timeZone,
      s: p.workStart,
      e: p.workEnd,
    })),
  };
  return encodeURIComponent(JSON.stringify(payload));
}

export function decodeHash(hash: string, fallbackDate: string): AppState | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  try {
    const text = decodeURIComponent(raw);
    const parsed = JSON.parse(text) as HashPayload;
    if (!parsed || parsed.v !== 1) return null;
    return sanitizeState(
      {
        dateISO: parsed.date,
        durationMin: parsed.duration,
        selectedStartMs: parsed.selectedStart,
        people: (parsed.people ?? []).map((p) => ({
          name: p.n,
          timeZone: p.z,
          workStart: p.s,
          workEnd: p.e,
        })),
      },
      fallbackDate,
    );
  } catch {
    return null;
  }
}

export function loadLocal(fallbackDate: string): AppState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    return sanitizeState(JSON.parse(text), fallbackDate);
  } catch {
    return null;
  }
}

export function saveLocal(state: AppState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dateISO: state.dateISO,
        durationMin: state.durationMin,
        people: state.people,
        selectedStartMs: state.selectedStartMs,
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function zoneError(person: Person): string | null {
  if (!person.timeZone.trim()) return "Timezone is required.";
  if (!isValidTimeZone(person.timeZone.trim())) {
    return `Invalid IANA timezone: ${person.timeZone}`;
  }
  return null;
}
