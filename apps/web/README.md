# Calendar web app

The React app uses the Calendar Management `/v1` API for paginated browsing,
calendar details and dates, exclusions, create/update, and CSV upload.

## Run locally

Start the [calendar service](../calendar_service/README.md) on port 8000, then run
from this directory:
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

Calendars are created by **uploading a file** (a new calendar, or new dates for an existing or
migrated one) and amended from the Calendars list. There is no rule-based creation: the product
team removed it on 2026-11-06, so there is no rule form, preview or holiday-calendar picker.
`features/calendars/README.md` describes the current flow.

**Editing an existing calendar is still blocked on S-13** for the four-eyes (approval) flow. The
amend screen applies changes directly against the mocked API until the client confirms what an
approval actually approves.

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

Vite proxies `/v1` to the backend. In production, serve the SPA and `/v1` under
the same origin.

When auth is enabled, obtain an OAuth access token from the configured provider and
paste it into the header's token field, without the `Bearer` prefix. The app
stores it only in memory; clearing it or reloading the page removes it. No token
is needed when the backend explicitly runs with auth disabled.

## Regenerate API types

Export the backend OpenAPI schema first, then run `npm run generate:api`.
The generated types must reflect the backend contract; do not edit them by hand.
