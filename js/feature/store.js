// What the rep records during the demo, kept in this browser only: clock-in sessions,
// outlet notes, retailer issues and which Landing alerts were already opened.
// One localStorage key; "Reset demo" clears it (with the demo orders).
//
// Times of day (clock in/out, when a note was written) use the device clock. The date
// always comes from config.demoDate, so the demo stays on Tue 28 Apr 2026.

const KEY = 'gtapp.field.v1';
const EMPTY = () => ({ clock: { sessions: [] }, notes: {}, issues: {}, seenAlerts: [] });
let memory = EMPTY();
let useMemory = false;

export function read() {
  if (useMemory) return memory;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return parsed ? { ...EMPTY(), ...parsed } : EMPTY();
  } catch {
    return memory;
  }
}

/** update((state) => { …mutate… }) → the saved state. */
export function update(fn) {
  const state = read();
  fn(state);
  memory = state;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { useMemory = true; }
  return state;
}

export function reset() {
  memory = EMPTY();
  useMemory = false;
  try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
}

/** "09:12" from the device clock. */
export const timeNow = () => new Date().toTimeString().slice(0, 5);
export const nowMs = () => Date.now();

// ---- clock in / out ----------------------------------------------------------

/** → { state: 'out'|'in'|'closed', since, sessions } for today. */
export function clockState() {
  const { clock } = read();
  const open = clock.sessions.find((s) => !s.outAt);
  if (open) return { state: 'in', open, sessions: clock.sessions };
  return { state: clock.sessions.length ? 'closed' : 'out', sessions: clock.sessions };
}

export const clockIn = () => update((s) => { s.clock.sessions.push({ inAt: nowMs(), inTime: timeNow(), outAt: null, outTime: null }); });
export const clockOut = () => update((s) => {
  const open = s.clock.sessions.find((x) => !x.outAt);
  if (open) { open.outAt = nowMs(); open.outTime = timeNow(); }
});

/** Minutes on duty today, counting an open session up to now. */
export const dutyMinutes = () => clockState().sessions
  .reduce((n, x) => n + Math.max(0, Math.round(((x.outAt ?? nowMs()) - x.inAt) / 60000)), 0);

// ---- notes and issues ------------------------------------------------------------

export const notesFor = (outletId) => read().notes[outletId] ?? [];
export const addNote = (outletId, text, via) => update((s) => {
  (s.notes[outletId] ??= []).unshift({ at: nowMs(), time: timeNow(), text, via });
});

export const issuesFor = (outletId) => read().issues[outletId] ?? [];
export const openIssues = (outletId) => issuesFor(outletId).filter((i) => i.status === 'open');
export const addIssue = (outletId, issue) => update((s) => {
  (s.issues[outletId] ??= []).unshift({ id: `ISS-${nowMs().toString(36)}`, at: nowMs(), time: timeNow(), status: 'open', ...issue });
});
export const resolveIssue = (outletId, id) => update((s) => {
  const it = (s.issues[outletId] ?? []).find((x) => x.id === id);
  if (it) { it.status = 'resolved'; it.resolvedTime = timeNow(); }
});

// ---- alerts ----------------------------------------------------------------------

export const seen = (id) => read().seenAlerts.includes(id);
export const markSeen = (id) => update((s) => { if (!s.seenAlerts.includes(id)) s.seenAlerts.push(id); });
