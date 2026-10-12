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
│   ├── calendars/         List, detail, editor, approval queue
│   ├── preview/           Calendar date preview on a month grid
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

## Generate the API client, do not hand-write it

Types come from the FastAPI OpenAPI schema. The calendar payloads are nested enough that
hand-maintained types will drift, and drift here means a UI that silently sends the wrong shape.

## Build order

The first screen worth building is **preview**, not CRUD.

Pick a calendar or rule, see the generated dates rendered on a month grid with holidays and shifts
highlighted. It demos well, it is the feature users will rely on daily, and it makes the
undecided rule semantics (O-06, O-07) visible — a stakeholder looks at August, sees the 15th
shifted to the 16th, and rules on it in seconds.

**Do not build mutation screens until the approval model is settled** (RECORD.md section 11).
Four-eyes reshapes every editing flow: "Submit" becomes "Submit for approval", plus a diff view, a
pending queue and a reviewer screen. Read-only screens — preview, list, detail — are safe to build
now.

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
