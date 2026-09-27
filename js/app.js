// A tiny event bus, the sign-in session and navigation memory.
//
// Feature code listens here, for example:
//   app.on('screen:rendered', ({ screen, outletId, root }) => { … fill a [data-slot] … })
// Screens: login, home, outlets, outlet, book, review, saved.

const handlers = new Map();

export const app = {
  on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return () => app.off(event, fn);
  },
  off(event, fn) {
    handlers.get(event)?.delete(fn);
  },
  emit(event, payload) {
    handlers.get(event)?.forEach((fn) => {
      try { fn(payload); } catch (err) { console.error(`[app] "${event}" listener failed`, err); }
    });
  },
};

// Signed-in flag lives in sessionStorage; "Reset demo" clears it.
const SESSION_KEY = 'gtapp.session.v1';
let memory = null;

/** "rohit.jagtap" → "Rohit Jagtap". The signed-in username is the rep's name everywhere. */
export function displayName(raw) {
  return String(raw ?? '').trim().replace(/[._]+/g, ' ').replace(/\s+/g, ' ')
    .replace(/(^|\s)([a-z])/g, (m, space, ch) => space + ch.toUpperCase());
}

export const session = {
  /** The rep's display name, from the username they signed in with. */
  name() {
    return displayName(session.user()?.username);
  },
  user() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : memory;
    } catch {
      return memory;
    }
  },
  signIn(username) {
    memory = { username };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(memory)); } catch { /* memory only */ }
  },
  signOut() {
    memory = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* nothing stored */ }
  },
};

// Which list the rep came from, so Outlet details knows where "Back" goes.
export const nav = { hub: '#/home' };

// Navigation. Routes live in the URL hash (#/outlet/OUT-01) when the page may change its URL.
// Some previews (a file opened as a data: URL, some sandboxes) silently refuse, so the current
// route is also kept in memory and every in-app link goes through router.go().
let currentHash = null;
let onRoute = () => {};

export const router = {
  current: () => currentHash ?? location.hash,

  go(hash, { replace = false } = {}) {
    currentHash = hash;
    try {
      if (location.hash !== hash) history[replace ? 'replaceState' : 'pushState'](null, '', hash);
    } catch { /* URL can't change here; the route lives in memory */ }
    onRoute();
  },

  start(render) {
    onRoute = render;
    currentHash = location.hash || null;
    const sync = () => {
      if (location.hash && location.hash !== currentHash) {
        currentHash = location.hash;
        render();
      }
    };
    window.addEventListener('popstate', sync);      // back / forward
    window.addEventListener('hashchange', sync);    // URL typed by hand
    document.addEventListener('click', (e) => {
      const a = e.target.closest?.('a[href^="#/"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      router.go(a.getAttribute('href'));
    });
  },
};
