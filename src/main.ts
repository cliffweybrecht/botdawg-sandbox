import "./styles/app.css";
import {
  computeOverlap,
  dstNotes,
  formatDurationMs,
  timelineBounds,
  wallClockOnDate,
  type Person,
} from "./lib/overlap";
import {
  decodeHash,
  defaultPerson,
  encodeHash,
  loadLocal,
  saveLocal,
  seedPeople,
  zoneError,
  type AppState,
} from "./lib/state";
import {
  DURATIONS,
  earliestSlot,
  isDuration,
  selectSlot,
  type ProposedMeeting,
} from "./lib/slots";
import { buildMarkdownSummary, buildPlainSummary } from "./lib/summary";
import {
  COMMON_TIMEZONES,
  filterTimeZones,
  formatOffsetLabel,
  isValidTimeZone,
  supportedTimeZones,
  todayISO,
  utcMsToWall,
} from "./lib/timezones";

const ALL_ZONES = supportedTimeZones();
const COLORS = [
  "var(--person-a)",
  "var(--person-b)",
  "var(--person-c)",
  "var(--person-d)",
  "var(--person-e)",
];

const root = document.getElementById("app")!;
let toastTimer = 0;
let toast = "";
let zoneQueryId: string | null = null;
let zoneHighlight = 0;

function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function initialState(): AppState {
  const today = todayISO(browserZone());
  const fromHash = decodeHash(location.hash, today);
  if (fromHash && fromHash.people.length) return fromHash;
  const fromLocal = loadLocal(today);
  if (fromLocal && fromLocal.people.length) {
    if (!fromLocal.dateISO) fromLocal.dateISO = today;
    return fromLocal;
  }
  return {
    dateISO: today,
    durationMin: 30,
    people: seedPeople(),
    selectedStartMs: null,
  };
}

let state: AppState = initialState();

function persist(): void {
  saveLocal(state);
  const next = "#" + encodeHash(state);
  if (location.hash !== next) {
    history.replaceState(null, "", next);
  }
}

function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  persist();
  render();
}

function colorFor(i: number): string {
  return COLORS[i % COLORS.length];
}

function proposed(): ProposedMeeting | null {
  const { overlap } = computeOverlap(validPeople(), state.dateISO);
  if (!overlap) return null;
  if (state.selectedStartMs == null) return null;
  return selectSlot(overlap, state.selectedStartMs, state.durationMin);
}

function validPeople(): Person[] {
  return state.people.filter((p) => !zoneError(p));
}

function copyText(text: string, label: string): void {
  const done = () => {
    toast = `${label} copied`;
    render();
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast = "";
      render();
    }, 1800);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text: string, done: () => void): void {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    /* ignore */
  }
  ta.remove();
  done();
}

function pct(ms: number, start: number, end: number): number {
  return ((ms - start) / (end - start)) * 100;
}

function hourTicks(startMs: number, endMs: number): { ms: number; label: string }[] {
  const ticks: { ms: number; label: string }[] = [];
  const w0 = utcMsToWall(startMs, "UTC");
  let t = startMs - (w0.minute * 60 + w0.second) * 1000;
  if (t < startMs) t += 3600 * 1000;
  for (; t <= endMs; t += 3600 * 1000) {
    const w = utcMsToWall(t, "UTC");
    ticks.push({ ms: t, label: `${String(w.hour).padStart(2, "0")}z` });
  }
  if (ticks.length < 2) {
    ticks.unshift({ ms: startMs, label: "start" });
    ticks.push({ ms: endMs, label: "end" });
  }
  return ticks.slice(0, 16);
}

root.addEventListener("click", (ev) => {
  const t = ev.target as HTMLElement | null;
  if (!t) return;
  const act = t.closest("[data-act]") as HTMLElement | null;
  if (!act) return;
  const action = act.dataset.act;
  const id = act.dataset.id;

  if (action === "add") {
    setState({ people: [...state.people, defaultPerson({ name: "" })] });
    return;
  }
  if (action === "remove" && id) {
    setState({
      people: state.people.filter((p) => p.id !== id),
      selectedStartMs: state.people.length <= 1 ? null : state.selectedStartMs,
    });
    return;
  }
  if (action === "copy-plain") {
    copyText(buildPlainSummary(validPeople(), state.dateISO, proposed()), "Summary");
    return;
  }
  if (action === "copy-md") {
    copyText(buildMarkdownSummary(validPeople(), state.dateISO, proposed()), "Markdown");
    return;
  }
  if (action === "pick-earliest") {
    const { overlap } = computeOverlap(validPeople(), state.dateISO);
    if (!overlap) return;
    const slot = earliestSlot(overlap, state.durationMin);
    if (slot) setState({ selectedStartMs: slot.startMs });
    return;
  }
  if (action === "slot") {
    const ms = Number(act.dataset.ms);
    if (Number.isFinite(ms)) setState({ selectedStartMs: ms });
    return;
  }
  if (action === "zone-pick" && id) {
    const zone = act.dataset.zone ?? "";
    zoneQueryId = null;
    updatePerson(id, { timeZone: zone });
    return;
  }
});

root.addEventListener("input", (ev) => {
  const el = ev.target as HTMLInputElement | HTMLSelectElement | null;
  if (!el) return;
  if (el.id === "date") {
    setState({ dateISO: el.value, selectedStartMs: null });
    return;
  }
  if (el.id === "duration") {
    const n = Number(el.value);
    if (isDuration(n)) setState({ durationMin: n });
    return;
  }
  const id = el.dataset.id;
  if (!id) return;
  const field = el.dataset.field;
  if (field === "name") updatePerson(id, { name: el.value });
  if (field === "start") updatePerson(id, { workStart: el.value });
  if (field === "end") updatePerson(id, { workEnd: el.value });
  if (field === "zone") {
    zoneQueryId = id;
    zoneHighlight = 0;
    updatePerson(id, { timeZone: el.value }, { keepZoneList: true });
  }
});

root.addEventListener("focusin", (ev) => {
  const el = ev.target as HTMLElement | null;
  if (el?.dataset.field === "zone" && el.dataset.id) {
    zoneQueryId = el.dataset.id;
    render();
  }
});

root.addEventListener("keydown", (ev) => {
  const el = ev.target as HTMLElement | null;
  if (el?.dataset.field === "zone" && zoneQueryId) {
    const matches = filterTimeZones((el as HTMLInputElement).value, ALL_ZONES);
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      zoneHighlight = Math.min(zoneHighlight + 1, matches.length - 1);
      render();
      (root.querySelector(`[data-field="zone"][data-id="${zoneQueryId}"]`) as HTMLInputElement)?.focus();
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      zoneHighlight = Math.max(zoneHighlight - 1, 0);
      render();
      (root.querySelector(`[data-field="zone"][data-id="${zoneQueryId}"]`) as HTMLInputElement)?.focus();
    } else if (ev.key === "Enter" && matches[zoneHighlight]) {
      ev.preventDefault();
      const z = matches[zoneHighlight];
      const id = zoneQueryId;
      zoneQueryId = null;
      updatePerson(id, { timeZone: z });
    } else if (ev.key === "Escape") {
      zoneQueryId = null;
      render();
    }
  }
});

document.addEventListener("click", (ev) => {
  const t = ev.target as HTMLElement;
  if (!t.closest(".zone-wrap")) {
    if (zoneQueryId) {
      zoneQueryId = null;
      render();
    }
  }
});

window.addEventListener("hashchange", () => {
  const next = decodeHash(location.hash, todayISO());
  if (next) {
    state = next;
    saveLocal(state);
    render();
  }
});

function updatePerson(
  id: string,
  patch: Partial<Person>,
  opts?: { keepZoneList?: boolean },
): void {
  if (!opts?.keepZoneList) zoneQueryId = null;
  setState({
    people: state.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
}

function render(): void {
  const people = state.people;
  const usable = validPeople();
  const { intervals, overlap } = computeOverlap(usable, state.dateISO);
  const notes = dstNotes(usable, state.dateISO);
  const meeting = proposed();
  const bounds = timelineBounds(intervals, overlap);
  const ticks = hourTicks(bounds.startMs, bounds.endMs);
  const errors = people.map(zoneError);
  const overlapTooShort =
    overlap != null && overlap.endMs - overlap.startMs < state.durationMin * 60 * 1000;

  root.innerHTML = `
    <div class="app">
      <header class="masthead">
        <div class="brand">
          <h1>Over<span>lap</span></h1>
          <p>Find a civil hour when everyone is actually at work — across time zones, including DST.</p>
        </div>
        <div class="toolbar">
          <label class="field" for="date">Meeting date
            <input id="date" type="date" value="${esc(state.dateISO)}" />
          </label>
          <label class="field" for="duration">Duration
            <select id="duration">
              ${DURATIONS.map(
                (d) =>
                  `<option value="${d}" ${d === state.durationMin ? "selected" : ""}>${d} min</option>`,
              ).join("")}
            </select>
          </label>
        </div>
      </header>
      <main id="main" class="layout">
        <section class="panel" aria-labelledby="people-h">
          <h2 id="people-h">People</h2>
          <div class="people">
            ${people
              .map((p, i) => personCard(p, i, errors[i], zoneQueryId === p.id))
              .join("")}
          </div>
          <p style="margin:0.85rem 0 0">
            <button type="button" class="primary" data-act="add">Add person</button>
          </p>
        </section>
        <section class="panel" aria-labelledby="grid-h">
          <h2 id="grid-h">Day grid</h2>
          ${statusBlock(usable, overlap, overlapTooShort, meeting)}
          ${notes.map((n) => `<div class="banner" role="status">${esc(n)}</div>`).join("")}
          ${
            usable.length === 0
              ? `<div class="empty">Add at least one person with a valid IANA timezone to plot the day.</div>`
              : dayGrid(people, intervals, overlap, bounds, ticks, meeting, overlapTooShort)
          }
          <div class="share">
            <button type="button" data-act="copy-plain" ${meeting ? "" : "disabled"}>Copy summary</button>
            <button type="button" data-act="copy-md" ${meeting ? "" : "disabled"}>Copy GitHub markdown</button>
            <button type="button" class="ghost" data-act="pick-earliest" ${overlap && !overlapTooShort ? "" : "disabled"}>Select earliest slot</button>
            ${toast ? `<span class="toast" role="status">${esc(toast)}</span>` : ""}
          </div>
        </section>
      </main>
      <datalist id="common-zones">${COMMON_TIMEZONES.map((z) => `<option value="${esc(z)}"></option>`).join("")}</datalist>
      <footer class="note">Local demo. State lives in this browser (localStorage + URL hash). No server, no accounts.</footer>
    </div>
  `;
}

function statusBlock(
  usable: Person[],
  overlap: { startMs: number; endMs: number } | null,
  overlapTooShort: boolean,
  meeting: ProposedMeeting | null,
): string {
  if (usable.length === 0) {
    return `<p class="status" role="status">No valid people yet.</p>`;
  }
  if (!overlap) {
    return `<div class="banner error-banner" role="status">No overlap that day. Nobody shares a working window on ${esc(state.dateISO)}.</div>`;
  }
  if (overlapTooShort) {
    return `<div class="banner error-banner" role="status">There is a ${esc(formatDurationMs(overlap.endMs - overlap.startMs))} overlap, shorter than the ${state.durationMin}-minute meeting.</div>`;
  }
  const range = `${formatUtc(overlap.startMs)} – ${formatUtc(overlap.endMs)} UTC (${formatDurationMs(overlap.endMs - overlap.startMs)})`;
  if (meeting) {
    return `<p class="status" role="status">Overlap <strong>${esc(range)}</strong>. Proposed <strong>${esc(formatUtc(meeting.startMs))}–${esc(formatUtc(meeting.endMs))} UTC</strong>.</p>`;
  }
  return `<p class="status" role="status">Overlap <strong>${esc(range)}</strong>. Click a slot in the overlap row, or select the earliest slot.</p>`;
}

function formatUtc(ms: number): string {
  const w = utcMsToWall(ms, "UTC");
  return `${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")}`;
}

function personCard(p: Person, i: number, err: string | null, showList: boolean): string {
  const matches = showList ? filterTimeZones(p.timeZone, ALL_ZONES) : [];
  const validHint =
    p.timeZone && isValidTimeZone(p.timeZone)
      ? formatOffsetLabel(state.dateISO, p.timeZone)
      : "";
  return `
    <article class="person-card" style="border-left: 3px solid ${colorFor(i)}">
      <header>
        <span><i class="swatch" style="background:${colorFor(i)}"></i>Person ${i + 1}</span>
        <button type="button" class="danger ghost" data-act="remove" data-id="${p.id}" aria-label="Remove person ${i + 1}">Remove</button>
      </header>
      <label class="field">Name
        <input type="text" data-id="${p.id}" data-field="name" value="${esc(p.name)}" placeholder="Name" autocomplete="name" />
      </label>
      <div class="zone-wrap">
        <label class="field">IANA timezone
          <input type="text" data-id="${p.id}" data-field="zone" value="${esc(p.timeZone)}" placeholder="e.g. America/Denver" aria-autocomplete="list" aria-expanded="${showList}" list="common-zones" />
        </label>
        ${
          showList && matches.length
            ? `<ul class="zone-list" role="listbox">${matches
                .map(
                  (z, idx) =>
                    `<li><button type="button" role="option" data-act="zone-pick" data-id="${p.id}" data-zone="${esc(z)}" aria-selected="${idx === zoneHighlight}">${esc(z)}</button></li>`,
                )
                .join("")}</ul>`
            : ""
        }
      </div>
      ${err ? `<div class="error" role="alert">${esc(err)}</div>` : `<div class="row-label"><span class="meta">${esc(validHint)}</span></div>`}
      <div class="hours">
        <label class="field">Work start
          <input type="time" data-id="${p.id}" data-field="start" value="${esc(p.workStart)}" />
        </label>
        <label class="field">Work end
          <input type="time" data-id="${p.id}" data-field="end" value="${esc(p.workEnd)}" />
        </label>
      </div>
    </article>
  `;
}

function dayGrid(
  people: Person[],
  intervals: ReturnType<typeof computeOverlap>["intervals"],
  overlap: { startMs: number; endMs: number } | null,
  bounds: { startMs: number; endMs: number },
  ticks: { ms: number; label: string }[],
  meeting: ProposedMeeting | null,
  overlapTooShort: boolean,
): string {
  const byId = new Map(intervals.map((iv) => [iv.personId, iv]));
  const slotButtons = overlap && !overlapTooShort ? overlapSlots(overlap, bounds, meeting) : "";
  return `
    <div class="grid-wrap">
      <div class="day-grid">
        <div class="ticks" aria-hidden="true">
          ${ticks
            .map((t) => `<span>${esc(t.label)}</span>`)
            .join("")}
        </div>
        ${people
          .map((p, i) => {
            const iv = byId.get(p.id);
            const err = zoneError(p);
            const bar = iv
              ? `<div class="bar" style="left:${pct(iv.startMs, bounds.startMs, bounds.endMs)}%;width:${pct(iv.endMs, bounds.startMs, bounds.endMs) - pct(iv.startMs, bounds.startMs, bounds.endMs)}%;background:${colorFor(i)}" title="${esc(p.name || "Person")} ${esc(p.workStart)}–${esc(p.workEnd)}"></div>`
              : "";
            const meta = err
              ? esc(err)
              : iv
                ? `${wallClockOnDate(iv.startMs, p.timeZone, state.dateISO)}–${wallClockOnDate(iv.endMs, p.timeZone, state.dateISO)} ${p.timeZone}`
                : "";
            return `<div class="row">
              <div class="row-label"><span class="name">${esc(p.name || "Unnamed")}</span><span class="meta">${meta}</span></div>
              <div class="track">${bar}</div>
            </div>`;
          })
          .join("")}
        <div class="row overlap-track">
          <div class="row-label"><span class="name">Overlap</span><span class="meta">click to propose</span></div>
          <div class="track" role="group" aria-label="Overlap slots">
            ${
              overlap
                ? `<div class="bar overlap" style="left:${pct(overlap.startMs, bounds.startMs, bounds.endMs)}%;width:${pct(overlap.endMs, bounds.startMs, bounds.endMs) - pct(overlap.startMs, bounds.startMs, bounds.endMs)}%"></div>`
                : ""
            }
            ${slotButtons}
          </div>
        </div>
      </div>
    </div>
    <div class="legend">
      <span><i style="background:var(--gold)"></i>Overlap / proposed slot</span>
      <span>Axis labels are UTC hours. Bars are each person's local working window converted to the same timeline.</span>
    </div>
  `;
}

function overlapSlots(
  overlap: { startMs: number; endMs: number },
  bounds: { startMs: number; endMs: number },
  meeting: ProposedMeeting | null,
): string {
  const step = 15 * 60 * 1000;
  const need = state.durationMin * 60 * 1000;
  const starts: number[] = [];
  let t = overlap.startMs;
  const aligned = Math.ceil(t / step) * step;
  if (overlap.startMs + need <= overlap.endMs) starts.push(overlap.startMs);
  for (let s = aligned; s + need <= overlap.endMs; s += step) {
    if (starts[starts.length - 1] !== s) starts.push(s);
  }
  if (!starts.length) return "";
  const left = pct(overlap.startMs, bounds.startMs, bounds.endMs);
  const width = pct(overlap.endMs, bounds.startMs, bounds.endMs) - left;
  return `<div class="slots" style="left:${left}%;width:${width}%;">
    ${starts
      .map((s) => {
        const pressed = meeting != null && meeting.startMs === s;
        const w = utcMsToWall(s, "UTC");
        const label = `Propose ${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")} UTC for ${state.durationMin} minutes`;
        return `<button type="button" class="slot" data-act="slot" data-ms="${s}" aria-label="${esc(label)}" aria-pressed="${pressed}"></button>`;
      })
      .join("")}
  </div>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}




render();
persist();
