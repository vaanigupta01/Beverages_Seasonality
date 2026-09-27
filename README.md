# GT App · prototype (base)

A mobile-first prototype of a field-sales app for a soft-drinks bottler's pre-seller in
Pune West. It covers the basic GT App flow: **Login → Landing → Outlet list → Outlet details →
Order booking → Order review → submit**. Everything on screen is computed from the persona
data and the live cart. It is a static page with no backend and no install.

- Demo date ("today"): **Tuesday 28 April 2026**. The app reads it from the data, never from the device clock.
- Designed for a **390 px** wide phone. On a laptop it shows as a phone-width column.
- **Reset demo** (top right, on every screen) deletes the orders saved during the demo and signs you out.
- **English, मराठी and हिंदी**: switch with the language button in the top bar, or on the Login screen.
- The **username you sign in with is the rep's name** shown in the app.
- **Talking points** on each outlet give the rep data-backed things to raise with the owner. Payment points stay in a separate "For you only" section.

## Open it

- **Hosted:** the GitHub Pages link. The site's home page, `index.html`, is the app.
- **Offline:** double-click **`gt-app.html`**. It works with no internet and no server, because it carries a copy of the data inside.

Any username and password works; the username becomes the rep's name.

## Where the data comes from

The persona data lives in **`data/*.json`**, one file per part of the data contract: `config`, `outlets`, `products`, `schemes`, `orders`, `history`, `visits`, `distributor_stock`, `calendar` and `peers`. All ten are required.

- **Hosted**, the page reads `data/*.json` sitting next to it. To check, change a number in `data/outlets.json` (for example an outlet's credit limit), commit, reload the page, and the screen changes. No rebuild is needed.
- **Offline**, `gt-app.html` uses the copy of the data embedded at the bottom of the file. The copy is refreshed whenever the file is rebuilt.

The current data comes from the personas chat (`scripts/generate_data.py`, fixed seed): 8 outlets, 13 SKUs, and 343 past orders from 31 Dec 2024 to 21 Apr 2026. If a file breaks the contract, the app names the file and the field.

## Host it on GitHub Pages

1. Push this folder to a GitHub repository. Keep `index.html`, `data/` and the empty `.nojekyll` file at the root.
2. In the repository, open **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, then `main` and `/ (root)`.
3. After about a minute the app is live at `https://<user>.github.io/<repo>/`. Open it on a phone in a private window.

All paths are relative, so the app also works in the `/<repo>/` subfolder. The browser's Network tab shows the `data/*.json` files loading.

## Changing the app

`gt-app.html` and `index.html` are the same file, **generated** from the source:

- `js/`: the app code, one module per concern and per screen;
- `css/styles.css`: the design tokens (at the top), then the components;
- `scripts/shell.html`: the page template;
- `data/`: the data.

Don't edit the two generated files by hand. Change the source and rebuild them with `scripts/build_single.py` (instructions at the top of that file). Data-only changes show on the hosted site straight away; the offline copy updates on the next rebuild.

## Structure

```
index.html              the app (generated) — the hosted home page
gt-app.html             the same app (generated) — double-click to use offline
data/*.json             persona data, read by the hosted page (10 files)
js/main.js              boot, hash router, demo bar, Reset demo
js/app.js               event bus (app.on / app.emit), session, router.go
js/data.js              loads the data (files when hosted, embedded copy offline), selectors
js/cart.js              the cart state + cart.subscribe()
js/orders.js            demo orders in the browser, merged with past orders
js/schemes.js           scheme rules: eligibility, caps, free cases, discounts, price()
js/format.js            ₹ with Indian grouping, dates from the demo date, in the current language
js/i18n.js              language switch, t() for interface text, label() for data values
js/strings.js           every interface string in English, Marathi and Hindi
js/feature/talking-points.js   the talking-points card and the booking-screen button
js/ui.js                safe HTML templates, icons, components, sheet, toast, feature slots
js/screens/*.js         login, home, outlets, outlet, book, review, saved, scheme
css/styles.css          design tokens and components
scripts/                shell.html (page template), build_single.py, generate_data.py (personas chat), make_stub.py (old stub)
docs/                   personas and data validation (personas chat)
```

Routes: `#/login`, `#/home`, `#/outlets`, `#/outlet/OUT-01`, `#/book/OUT-01`, `#/review/OUT-01`, `#/saved/DEMO-01-1`, `#/scheme/SCH-SS26/OUT-01`.

## Building the feature on top

The base leaves six empty, hidden slots (`landing-top`, `route-badge`, `outlet-brief`, `booking-live`, `sku-hint`, `review-check`). It also exposes `app.on('screen:rendered', …)`, `cart.subscribe(…)`, `router.go(…)` and the data, orders and schemes selectors on `window.gtApp`. See PROGRESS.md → "Feature hooks".
