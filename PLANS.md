# Plan: Control Plane navbar (Home / Metadata / Calendar) with Calendar sub-tabs

Status: **DONE — implemented and verified in the browser** (`npx tsc -b` clean, 2026-11-10). See
"Progress" for the checklist and "Implementation notes" for what differed from the plan.

## Progress

| # | Item | State |
|---|---|---|
| 1 | Investigate screenshot (sampled colours/geometry) and current navbar | ✅ done |
| 2 | Plan written, product answers (6) folded in | ✅ done |
| 3 | `paths.ts` — `BASE_PATH = "/controlPlane"` + derived paths | ✅ done |
| 4 | `Navbar.tsx` — dark gradient, brand, Home / Metadata / Calendar, user badge | ✅ done |
| 5 | `CalendarSection.tsx` — sub-tabs + nested routes, only under Calendar | ✅ done |
| 6 | `HomePage.tsx` / `MetadataPage.tsx` — big centred page-name placeholders | ✅ done |
| 7 | `TabsProvider.tsx` — uses the prefixed path constants | ✅ done |
| 8 | `App.tsx` — navbar, auth gate, prefixed routes, legacy redirects | ✅ done |
| 9 | Sign-in and sign-out land on Home (`LoginPage.tsx`, navbar user badge) | ✅ done |
| 10 | `index.html` title → "Control Plane" | ✅ done |
| 11 | Docs — `apps/web/README.md` navigation and routes section | ✅ done |
| 12 | Type-check (`npx tsc -b`) | ✅ clean |
| 13 | Visual match to reference (62px bar, 30px pill, sampled colours) | ✅ done |
| 14 | Browser e2e: navigation, redirects, auth, calendars, create/upload, roles, 390px | ✅ passed (2 bugs found and fixed, see notes) |
| 15 | Real Home / Metadata content, embedding mechanics, restyling calendar pages | ⏸ out of scope |

**Known gaps / caveats**
- The "Upload a file" empty-calendar link was skipped in the first re-run (no 0-date calendar was
  left in the mock store after earlier test uploads); it passed in the second run.
- Navbar brand/menu sit at the far edges (like the host's UI) while page content stays centred, so
  they don't line up; moving the navbar inside the content column is a one-class change.
- Test calendars (`Nav_*`, `Mrg_*`, `Run_*`) live in the mock store (`sessionStorage`) and vanish
  when the tab closes.

## Request

Product already has two apps, **"Control Plane"** and **"Metadata"**, and will integrate this UI into
theirs. Our navbar must match theirs. The main navbar has **3 items — `Home`, `Metadata`,
`Calendar`** — under the app name **"Control Plane"** (written "Contol Plane" in the request; the
screenshot spells it "Control Plane", so that is used). Our calendar pages and sub-tab system
(`Calendars` / `Create`) must appear **only after the user clicks the main `Calendar` menu item**.

## What the screenshot shows (their UI, `localhost:5174/controlPlane`)

Colours were sampled from the pixels and match the Tailwind palette exactly (we already use
Tailwind v4 + slate, so no new tooling is needed):

| Element | Observed | Tailwind equivalent |
|---|---|---|
| Navbar background | left-to-right gradient `#0f172b` → `#314158` | `bg-linear-to-r from-slate-900 to-slate-700` |
| Navbar size / shadow | ~62px tall, full width, soft shadow below | `shadow-md`, `px-8`, `py-4` |
| Brand | "Control" white bold, "Plane" indigo accent, at far left | `text-xl font-bold text-white` + `text-indigo-400` |
| Nav items | far right, ~15px semibold | `text-sm font-semibold` |
| Active item | solid `#625fff` pill, white text, ~90×30px, rounded | `bg-indigo-500 text-white rounded-lg px-3.5 py-1.5` |
| Inactive item | light text (≈`#dce8ff`) on the gradient | `text-slate-200 hover:bg-white/10` |
| Page background | `#f7f9fb` | `bg-slate-50` (**same as ours**) |
| Cards | white, very light border + soft shadow, large radius | (ours: `rounded-lg border-slate-200`) |
| Primary button | `#4f39f7` | `indigo-600` (ours today: `slate-900`) |
| Content width | full width; card left edge lines up with the brand | ours is centred `max-w-6xl` |

**Two differences from the request to confirm:** the screenshot's items are `MetaData`, `Calendars`,
`Create` (Calendars/Create are *separate top-level items* there), while the request says
`Home`, `Metadata`, `Calendar`. The plan follows the **request text**; the screenshot is used for
style only. Also their page is `/controlPlane` on port 5174; we keep our own paths.

## Our current navbar (for comparison)

`App.tsx`: a white header (`border-b border-slate-200 bg-white`) with the title "Calendar Platform"
and the user badge / Sign out; the `Calendars`/`Create` tab strip sits *below* it (added in the
previous task). `RequireAuth` wraps all content. Routes today: `/`→`/calendars`, `/calendars`,
`/create`, `/preview`→`/create`, `*`→`/calendars`. `TabsProvider` derives the sub-tab from the URL.

## Design

1. **New dark-gradient `Navbar`** (`features/navigation/Navbar.tsx`), styled per the table above:
   brand "Control **Plane**" on the left; on the right `Home`, `Metadata`, `Calendar`, then the user
   badge + Sign out restyled for the dark bar (`text-slate-300`, `border-white/25`,
   `hover:bg-white/10`). Items are real links (`NavLink`, inside `<nav aria-label="Main">`), the
   active one gets `aria-current="page"` and the indigo pill.
2. **Routes, all under the `/controlPlane` prefix** (react-router stays, URL stays in sync). The
   prefix lives in **one constant** (`BASE_PATH = "/controlPlane"`, e.g. in
   `features/navigation/paths.ts`) and every route, link, redirect and `navigate()` call is built
   from it, so changing the prefix later is a one-line edit. Absolute-prefixed routes are used
   rather than `BrowserRouter basename`, so URLs outside the prefix can be redirected in:
   - `/controlPlane` → **Home**; `/controlPlane/metadata` → **Metadata**;
     `/controlPlane/calendar` → redirect to `/controlPlane/calendar/calendars`;
     `/controlPlane/calendar/calendars` → Calendars; `/controlPlane/calendar/create` → Create.
   - Old URLs keep working via redirects: `/` → `/controlPlane`; `/calendars` →
     `/controlPlane/calendar/calendars`; `/create` and `/preview` →
     `/controlPlane/calendar/create`; any unknown path → `/controlPlane`.
   - The `Calendar` nav item is active for anything under `/controlPlane/calendar`; `Home` is
     active only on exactly `/controlPlane` (`end`).
   - Vite's dev server already serves `index.html` for any path, and the MSW mocks (`/v1/*`) and
     `mockServiceWorker.js` are unaffected by the prefix. `vite.config.ts` / `base` stay unchanged.
3. **Sub-tabs only inside Calendar.** The current `TabbedPages` moves out of `App.tsx` into
   `features/calendars/CalendarSection.tsx` (tablist + panel + nested routes). Home and Metadata show
   no tab strip. `TabsProvider` reads `…/calendar/create` vs `…/calendar/calendars` (via the path
   constants), and `setTab` navigates there; `CalendarsPage` and `UploadCalendarPanel` are
   **unchanged** (they already call `useTabs().setTab(...)`).
4. **Clicking `Calendar` always lands on the `Calendars` sub-tab** (first tab), never "last used".
5. **Auth:** `RequireAuth` still wraps all routes (Home/Metadata too, until the host owns auth).
   Signed out: the bar shows only the brand (no menu items, no user badge) above the login form.
   **Sign-out and sign-in both land on Home (`/controlPlane`)**, as decided: sign-out navigates to
   Home, and a successful sign-in navigates to Home even when the login form was shown on a deep
   link such as `/controlPlane/calendar/create`. (A page reload while already signed in keeps the
   current URL — that is not a sign-in.)
6. **Home and Metadata are placeholders** (`features/home/HomePage.tsx`,
   `features/metadata/MetadataPage.tsx`): **just a large heading centred in the middle of the page**
   with the page's name ("Home" / "Metadata") — nothing else. Centred horizontally and vertically in
   the space under the navbar (`min-h` of the viewport minus the bar, `text-5xl font-bold
   text-slate-300`-style muted tone to fit our theme). No DAG-run filter form, no cards.
7. **Layout: content stays centred** in `max-w-6xl` as today (user decision). Only the navbar is
   restyled to match theirs. The navbar's gradient spans the full width; its inner row is
   full-width (`px-8`, brand at the far left and menu at the far right) as in their screenshot,
   while page content below stays centred. (If the brand/menu should instead sit inside the same
   `max-w-6xl` column as the content, that is a one-class change — flag it when reviewing.)
8. **Calendar pages and the Calendars/Create sub-tabs keep their existing slate theme and styling**
   (user decision) — nothing inside the calendar pages changes. Only the main menu (navbar) takes the
   host's dark gradient, indigo active pill and typography.

## Implementation steps (all done ✅)

1. `features/navigation/paths.ts` (new): `BASE_PATH = "/controlPlane"` plus the derived paths
   (`HOME`, `METADATA`, `CALENDAR`, `CALENDARS`, `CREATE`) used everywhere below.
2. `features/navigation/Navbar.tsx` (new): brand, `NavLink` items (`Home`, `Metadata`, `Calendar`),
   user badge / Sign out; signed-out shows the brand only.
3. `features/calendars/CalendarSection.tsx` (new): move the sub-tab strip + nested `Routes` here.
4. `features/home/HomePage.tsx`, `features/metadata/MetadataPage.tsx` (new): big centred page-name
   placeholders.
5. `features/navigation/TabsProvider.tsx`: use the path constants for the two sub-tabs.
6. `App.tsx`: render `Navbar`, `RequireAuth`, the prefixed top-level routes and the legacy
   redirects; drop the old header and `TabbedPages`; sign-out → Home.
7. `features/auth/LoginPage.tsx` (or `AuthProvider`): after a successful sign-in, navigate to Home.
8. `index.html`: page `<title>` → "Control Plane".
9. Docs: `apps/web/README.md` / feature READMEs where they describe the nav or routes.

## Verification plan — results ✅

Result: all items below were run in the live browser and passed. The two bugs found (390px navbar
overflow, duplicate "Calendar" accessible name) were fixed and re-tested; details are in
"Implementation notes".

- `npx tsc -b` clean. ✅
- Visual: screenshot against the reference — gradient, height, shadow, brand colours, indigo active
  pill and spacing; sample the rendered colours back (`#0f172b`→`#314158`, `#625fff`). Confirm the
  Calendars/Create tabs and calendar pages look exactly as before (slate theme, centred column) and
  that Home/Metadata show only the big centred page name. ✅ (rendered bar 62px, pill 30px; computed
  colours are the sampled Tailwind tokens)
- Browser: each menu item changes content and URL under `/controlPlane`; sub-tabs appear only under
  `Calendar`; clicking `Calendar` from Home/Metadata lands on `Calendars`; sub-tab switching still
  works; legacy URLs (`/`, `/calendars`, `/create`, `/preview`, unknown) redirect to the prefixed
  ones; back/forward; reload on every route; signed-out bar shows brand only; sign-in and sign-out
  both land on Home. ✅ (27 checks in the navigation suite, all passing)
- Re-run the full e2e suite (auth, calendars, create/upload, roles) against the new routes, plus a
  narrow-viewport check that the navbar doesn't overflow at 390px. ✅ (calendars, create, merge and
  roles pass; the 390px overflow it found was fixed and re-tested on all four routes)

## Decisions made (product answers)

1. **Home / Metadata** — placeholders only: a big page name in the middle of the page.
2. **Labels** — follow the request: `Home`, `Metadata`, `Calendar` (not the screenshot's labels).
3. **Accent colour** — calendar pages and their tabs keep our existing slate theme; only the main
   menu takes the host's style and colour scheme.
4. **Content width** — stays centred (`max-w-6xl`).
5. **After sign-in / sign-out** — land on Home.
6. **URL prefix** — yes, all our routes live under `/controlPlane`.

## Implementation notes (what differed from the plan)

- Navbar is **62px tall with a 30px pill**, matching the reference after tightening the item
  line-height (`leading-[18px]`); colours are the exact Tailwind tokens sampled from the screenshot.
- **Mobile fix found in testing:** at 390px the brand + 3 items + user badge overflowed (scroll width
  544px). The bar now wraps (`flex-wrap`, `px-4 sm:px-8`, divider only from `sm`); no overflow on any
  route.
- **Accessible name fix found in testing:** the sub-tab `tablist` is labelled "Calendar sections"
  (not "Calendar"), so it no longer collides with the "Calendar" label on the upload-target select.
- Sign-in navigates to Home from `LoginPage` after a successful `signIn`; sign-out navigates from
  the navbar's user badge.

## Out of scope

Real Home/Metadata features, embedding mechanics beyond the route prefix (iframe / module
federation / Vite `base`), the host's auth, restyling calendar-page content, and refreshing the old
screenshots in `docs/`.

---

# Previous task (DONE): replace the nav bar with in-page tabs (URL kept in sync with the active tab)

Status: **Implemented and verified in the browser** (`npx tsc -b` clean).

## Plan change (latest — supersedes anything below that says otherwise)

Product asked to **keep `react-router` and the browser routes**. So:

- `react-router` **stays** in `package.json` (it will be used later); `src/routes/README.md`
  **stays**. Nothing is uninstalled or deleted.
- The `/calendars` and `/create` routes **stay**, and `/` → `/calendars` and `/preview` → `/create`
  redirects stay. The tabs and the URL are **kept in sync**: clicking a tab navigates to that
  route, and loading/reloading a route selects the matching tab (a reload on `/create` stays on
  Create).
- The tab is therefore **derived from the URL**, not held in local state. `TabsProvider`
  (`features/navigation/TabsProvider.tsx`) reads `useLocation()` for `tab` and implements
  `setTab` with `useNavigate()`. `CalendarsPage` / `UploadCalendarPanel` keep using
  `useTabs().setTab(...)`, so the cross-tab buttons now also change the URL.
- `BrowserRouter` stays in `main.tsx`; `Routes`/`Route`/`Navigate` stay in `App.tsx`; only the
  `NavLink` nav bar is replaced by the tab strip.
- **Sign-out resets to Calendars** (user decision): sign-out navigates to `/calendars`.
- Auth gate stays hoisted: `RequireAuth` wraps the tab strip + routes once, so the login form
  replaces the tabs entirely when signed out, and the dead `!user` branch in
  `UploadCalendarPanel` is removed.

### Decisions made
- Active tab colour: **slate-900** (current theme).
- Content wrapper: **no bordered box**.
- Sign-out: **reset to Calendars**.
- Header: slim bar with the title + user badge/Sign out stays (not answered; default taken).

The sections below are the original investigation; where they say "no router", "no URL change",
"remove `react-router`", "delete `src/routes/`" or "tab is local state", the Plan change above wins.

> The date-toggle feature (upload-preview include/exclude, provenance colours, "Define by rules"
> removal) that previously occupied this file is **done and shipped** — see
> [docs/testing/](docs/testing/README.md) for the regression reports. This file now tracks the
> next task.

## Request

Product wants to embed this app inside another control-plane dashboard application. Today
`Calendars` and `Create` are two routes (`/calendars`, `/create`) linked from a top nav bar, driven
by `react-router`. Product no longer wants a nav bar or browser-side routing at all — `Calendars`
and `Create` should become two **tabs within a single page**, switching which panel's content
(forms, calendar list, etc.) is shown, with no URL change.

## Codebase findings

### Everything that currently depends on `react-router`

```
main.tsx          — wraps <App/> in <BrowserRouter>
App.tsx           — <Routes>/<Route>, <NavLink> nav bar, "/" and "/preview" redirects
CalendarsPage.tsx — <Link to="/create"> (×2: empty-calendars state, no-dates-yet state)
UploadCalendarPanel.tsx — <Link to="/calendars"> (×2: signed-out message, post-save success)
```

That's the full surface — `react-router` (`^7.0.0`, a direct dependency in `apps/web/package.json`)
isn't used anywhere else (checked via workspace-wide search for `react-router`, `BrowserRouter`,
`Routes`, `Route `, `NavLink`, `useNavigate`, `<Link`, `to="/`, `Navigate`). `src/routes/README.md`
is a placeholder ("Route definitions only") with no actual route files in that folder — effectively
unused already.

### A pre-existing wrinkle this change naturally resolves

Both `/calendars` and `/create` are independently wrapped in `RequireAuth` in `App.tsx`, **but**
`UploadCalendarPanel.tsx` *also* has its own `!user` check that renders a "Sign in" link — in the
current routed app this branch is unreachable (you can't get to `UploadCalendarPanel` unsigned-in;
`RequireAuth` shows `LoginPage` first). Moving to a single page is a natural point to hoist
`RequireAuth` to wrap the **whole tab area once**, which is both the correct shape for "one page,
sign in once" and removes that now-provably-dead branch (the `!canWrite` role-check branch right
below it stays — that's a real, reachable case for a signed-in Viewer/Approver/Uploader).

## Design decisions

1. **Tabs are local React state in `App.tsx`**, not a route: `const [tab, setTab] =
   useState<"calendars" | "create">("calendars")`. No URL involvement at all — reloading the page
   always returns to the `Calendars` tab. This is an inherent, intended consequence of removing
   routing (flagging it explicitly since it's a visible behaviour change from today, where
   `/create` survives a reload) — not something to work around, since the whole point is that the
   host app now owns navigation/URL state, not this one.
2. **Cross-tab links become tab switches, via a small shared context**, not prop drilling. Two
   leaf components (`CalendarsPage`, nested two levels under `App` via `CreateCalendarPage` →
   `UploadCalendarPanel`) need to switch tabs — a tiny context (same pattern already used for
   `AuthProvider`) avoids threading a callback prop through `CreateCalendarPage`, which otherwise
   has no reason to know about tabs at all.
3. **Proper ARIA tab semantics**, since this is now literally a tab control, not navigation:
   `role="tablist"` on the switcher, `role="tab"` + `aria-selected` on each button, `role="tabpanel"`
   on the content area. This is an upgrade over the current `NavLink`s (which were links to
   distinct pages) and over the ad-hoc `aria-pressed` button-group pattern used elsewhere in this
   codebase for non-navigational toggles (e.g. the old rule/upload mode switch) — tabs get the
   semantics built for them.
4. **Auth gating moves from per-route to once, around the whole tab area** (see "pre-existing
   wrinkle" above): `RequireAuth` wraps the tab strip + panel together; `LoginPage` renders instead
   of the tabs entirely when signed out, exactly like today's per-route behaviour but now a single
   gate. `UploadCalendarPanel`'s dead `!user` branch is removed as part of this; its `!canWrite`
   branch (a role check, not an auth check) stays.
5. **`react-router` is removed from `package.json`**, not just unused — nothing else in the app
   touches it, and keeping an unused routing library around is exactly the kind of thing that
   confuses the next person wiring this into a host shell.
6. **Tab visual design — folder-style tabs, per product's reference screenshot, in this app's
   existing theme.** The reference shows tabs as rounded-top "folder" tabs that sit directly on
   the content area, the active one filled with a solid colour. We keep that *shape and behaviour*
   but use our own palette (slate + Tailwind, no new colours):
   - **Tab strip** sits *below* the header bar, at the top of `<main>`, left-aligned, with a
     `border-b border-slate-200` baseline running the full width of the content column.
   - **Each tab**: `rounded-t-lg px-4 py-2 text-sm font-medium`, small gap between tabs
     (`gap-1`), and `-mb-px` so the active tab overlaps the baseline and reads as joined to the
     content below it.
   - **Active tab**: `bg-slate-900 text-white` (the app's existing active colour, same as today's
     active nav link and the active filter pill — instead of the reference's blue).
   - **Inactive tab**: `bg-slate-100 text-slate-600 hover:bg-slate-200` (the existing inactive
     hover tone), plus the app's existing `focus-visible` ring so keyboard focus is visible.
   - **Content panel**: the existing page content renders directly under the strip. The reference
     wraps content in a bordered card; our pages already render their own white cards/forms on the
     `slate-50` background, so wrapping them in a second card would give card-in-card. The
     baseline + joined active tab gives the same "tab belongs to this content" effect without it.
     (Easy to change to a bordered, rounded wrapper if product prefers the reference literally.)
   - Each page keeps its own `h1` ("Calendars" / "Create a calendar") — unchanged.
   - Header bar stays only for the app title and user badge / Sign out (needed for auth); the
     tabs move out of it. This is an assumption — see open questions.

## Implementation steps (as revised)

1. **`features/navigation/TabsProvider.tsx`** (new) — `tab` derived from `useLocation()`
   (`/create` → `create`, otherwise `calendars`); `setTab` navigates to `/create` / `/calendars`.
2. **`App.tsx`** — remove the `<nav>`; add a `role="tablist"` strip at the top of `<main>` with two
   `role="tab"` buttons (`aria-selected`, `aria-controls`/`id`) styled per Design decision 6;
   `RequireAuth` wraps `TabsProvider` + tab strip + `Routes` once; keep `/`, `/preview`
   redirects and `/calendars`, `/create` routes (rendering inside a `role="tabpanel"`); sign-out
   navigates to `/calendars`.
3. **`main.tsx`** — unchanged (`BrowserRouter` stays).
4. **`CalendarsPage.tsx`** — both `<Link to="/create">` become `<button>`s calling
   `setTab("create")` (same `font-medium underline` look).
5. **`UploadCalendarPanel.tsx`** — remove the dead `!user` branch; "View calendars" becomes a
   `<button>` calling `setTab("calendars")`.
6. **`package.json` / `src/routes/`** — untouched.

## Verification plan (as revised)

- `npx tsc -b` in `apps/web`.
- Browser: tabs switch content **and** the URL (`/calendars` ↔ `/create`); reload on `/create`
  stays on Create; `/` and `/preview` redirect; browser back/forward move between tabs; "Create
  one" / "Upload a file" / "View calendars" switch tab + URL; sign-out shows the login form with
  no tabs and, after signing back in, lands on `/calendars`.
- Visual check against the reference: rounded-top tabs, active slate-900 joined to the baseline,
  inactive light grey with hover, no bordered box.
- Tabs are focusable buttons with correct ARIA roles (no arrow-key roving tabindex).

## Original implementation steps (superseded where they conflict)

1. **`App.tsx`** — rewrite:
   - Remove the `react-router` import entirely.
   - Add a small `TabsContext`/`useTabs()` (owns `tab` state + a `setTab` setter), defined in this
     file and exported for the two consumers.
   - Remove the `<nav>` from the header and add a `role="tablist"` strip at the top of `<main>`
     (inside `RequireAuth`) with two `role="tab"` buttons (`aria-selected`, `aria-controls`/`id`
     wired to the panel), styled as folder-style tabs per Design decision 6 (`linkClass` replaced
     by an `aria-selected`-driven class).
   - Wrap the tab strip + panel in `RequireAuth` (moved from per-route to here); render
     `CalendarsPage` or `CreateCalendarPage` based on `tab` inside a `role="tabpanel"` container.
   - Drop the `"/"`-redirect and `"/preview"`-redirect logic entirely — nothing to redirect once
     there's no router.
2. **`main.tsx`** — remove the `BrowserRouter` import and unwrap `<App />` from it.
3. **`CalendarsPage.tsx`** — replace both `<Link to="/create">...</Link>` with a button calling
   `useTabs().setTab("create")`, styled to match today's inline-link look (`font-medium underline`
   kept, just a `<button type="button">` instead of an anchor).
4. **`UploadCalendarPanel.tsx`**:
   - Remove the `!user` branch and its "Sign in" link (dead once auth gating is hoisted).
   - Replace the post-save `<Link to="/calendars">View calendars</Link>` with a button calling
     `useTabs().setTab("calendars")`.
5. **`package.json`** — remove the `react-router` dependency line; run `npm install` in `apps/web`
   to update the lockfile.
6. **`src/routes/README.md`** — delete the file (and the now-empty `routes/` folder) since there
   are no routes left to document.

## Verification plan

- `tsc -b` in `apps/web` (confirms no stray `react-router` imports remain anywhere).
- Browser walkthrough: load the app fresh — lands on `Calendars` tab, no URL ever changes between
  tabs (confirm via the page URL staying constant while switching). Click the `Create` tab, create
  a calendar, click "View calendars" and confirm it switches tabs (not a navigation/reload) and
  shows the new calendar. From an empty/no-dates calendar state on `Calendars`, click "Create
  one"/"Upload a file" and confirm it switches to the `Create` tab.
- Sign out and confirm the login screen replaces the entire tab area (not just one panel), and
  signing back in restores the tab strip, landing on whichever tab was last selected before
  sign-out (state isn't cleared by `RequireAuth` re-rendering, since `tab` state lives in `App`,
  above `RequireAuth`) — flagging this as the natural behaviour of the chosen structure, confirm
  it's acceptable (alternative: reset to `Calendars` on sign-out, a one-line change if preferred).
- Visual check (screenshot) against the reference: rounded-top tabs, active tab solid slate-900
  joined to the baseline, inactive tabs light grey with hover; looks consistent with the header,
  filter pills and cards on both tabs and on the login screen (no tabs shown).
- Confirm keyboard/screen-reader semantics: tabs are reachable and operate correctly as ARIA tabs
  (not required to implement full roving-tabindex arrow-key navigation unless asked — plain
  clickable/focusable buttons with correct roles is the baseline here, flagging the richer
  keyboard pattern as an optional follow-up, not assumed).

## Open questions (need a decision before/while implementing)

1. **Header bar** — keep a slim bar with the "Calendar Platform" title + user badge/Sign out
   (current plan), or remove the title too since the host dashboard will provide its own chrome?
   Sign out must live somewhere while the app owns its own login.
2. **Active tab colour** — slate-900 to match the current theme (plan), or the blue from the
   reference?
3. **Content wrapper** — no extra card (plan), or a bordered rounded container like the reference?
4. **Sign-out** — keep the last-selected tab on re-login (plan) or reset to `Calendars`?

## Out of scope (unless requested)

- Any actual embedding/mounting mechanics for the host control-plane dashboard (iframe, module
  federation, exposing a mountable component, postMessage bridge, base-path/`vite.config.ts`
  changes). Today's ask is specifically "remove routing, use in-page tabs" — the embedding
  mechanism itself isn't specified yet and would be its own task once the host side is known.
- Full roving-tabindex keyboard navigation between tabs (arrow keys) — basic focusable/clickable
  ARIA tabs only, per Design decision 3.
- Resetting the selected tab on sign-out — see verification note above; easy to add if wanted.
