# web

React SPA. One application serving both the Calendar Service UI and the Control Plane view.

## Why one app, not two

Beyond the obvious (one build, one component library), it means the Control Plane view inherits
the Calendar Service login. That turns **R-04** — "the control plane UI has no defined
authentication" — from an accepted risk into a non-issue, for roughly zero extra effort.

## Layout

```
src/
├── features/              Vertical slices. Most work happens here.
│   ├── navigation/        Main navbar, route paths (BASE_PATH), calendar sub-tab context
│   ├── home/              Home page (placeholder)
│   ├── metadata/          Metadata page (placeholder)
│   ├── calendars/         Create, list, detail, month grid, Calendar section (sub-tabs)
│   ├── dag-runs/          Control plane view
│   └── auth/              Login, password change
├── components/ui/         shadcn/ui primitives. Generated, rarely hand-edited.
├── lib/
│   ├── api/               Client generated from the backend OpenAPI schema
│   └── hooks/
└── routes/                Route definitions only; no business logic
```

Organised by **feature**, not by file type. A change to the calendar editor should touch one
directory, not five.

## Navigation and routes

The UI is meant to be embedded in the Control Plane dashboard, so the navbar mirrors theirs: a dark
gradient bar titled **Control Plane** with three menu items — **Home**, **Metadata**, **Calendar**.
The Calendars / Create sub-tabs exist only inside **Calendar**.

All routes live under one prefix, `BASE_PATH` (`/controlPlane`), defined once in
`src/features/navigation/paths.ts`:

| URL | Page |
|---|---|
| `/controlPlane` | Home |
| `/controlPlane/metadata` | Metadata |
| `/controlPlane/calendar` | redirects to `/controlPlane/calendar/calendars` |
| `/controlPlane/calendar/calendars` | Calendar → Calendars tab |
| `/controlPlane/calendar/create` | Calendar → Create tab |

Older URLs (`/`, `/calendars`, `/create`, `/preview`) and unknown paths redirect to the matching new
URL or to Home. Signing in or out lands on Home. Home and Metadata are placeholders until the host
apps provide their content.

## Generate the API client, do not hand-write it

Types come from the FastAPI OpenAPI schema. The calendar payloads are nested enough that
hand-maintained types will drift, and drift here means a UI that silently sends the wrong shape.

## Build order

The create screen is a **preview that can be saved**, which is why it was built before any
editing flow. You define a calendar, watch the generated dates appear on a month grid, and only
then choose to create it. The same screen that settles how a rule should behave is the one that
commits it.

Previewing stays available without an account (O-32); only saving requires the Create role.

**Editing an existing calendar is still blocked on S-13.** Creating is safe because the outcome
is unambiguous either way: the API returns `201` when the change applies immediately, or `202`
with a pending change request when the four-eyes gate is on (D-10), and the screen reports both.
Editing needs a diff view, a pending queue and a reviewer screen, none of which can be designed
until the client confirms what an approval actually approves.

## Stack

Vite, TypeScript, TanStack Query, shadcn/ui (Radix + Tailwind).

## Deployment

Served by FastAPI via `app.frontend("/", directory="dist")`. One container, no CORS configuration,
no split-origin cookie problems with the session auth from D-01. Split it out later only if
independent frontend releases are needed.

## Running

```powershell
npm install
npm run dev
npm run build
```
