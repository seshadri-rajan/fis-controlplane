import { http, HttpResponse } from "msw";
import { MAX_UPLOAD_BYTES, parseDatesCsv } from "../parseDatesCsv";
import type { CalendarPreviewRequest } from "../proposed";
import type { components } from "../spec";
import { generatePreview, HOLIDAY_CALENDARS, RULES, validatePreview } from "./ruleEngine";
import { loadCalendars, saveCalendars } from "./store";

type User = components["schemas"]["User"];
type LoginRequest = components["schemas"]["LoginRequest"];
type ErrorResponse = components["schemas"]["ErrorResponse"];
type Calendar = components["schemas"]["Calendar"];
type CalendarCreateRequest = components["schemas"]["CalendarCreateRequest"];

/** All mock accounts accept this password. */
export const MOCK_PASSWORD = "password123";

export const MOCK_USERS: User[] = [
  { id: "6b0bd8e8-55f3-4f20-a199-25a5808a7cce", username: "admin", firstName: "Ada", lastName: "Admin", email: "admin@example.com", role: ["ADMIN"], active: true },
  { id: "0f1b6a52-2d0e-4c53-9a5f-0e7a1d6f8b11", username: "editor1", firstName: "Eli", lastName: "Editor", email: "editor1@example.com", role: ["EDITOR"], active: true },
  { id: "b2c1d7a4-5c43-4b8e-8f0a-3d9e2f6a7c22", username: "approver1", firstName: "Avery", lastName: "Approver", email: "approver1@example.com", role: ["APPROVER"], active: true },
  { id: "c3d2e8b5-6d54-4c9f-9a1b-4eaf3a7b8d33", username: "viewer1", firstName: "Vic", lastName: "Viewer", email: "viewer1@example.com", role: ["VIEWER"], active: true },
  { id: "d4e3f9c6-7e65-4dab-8b2c-5fb04b8c9e44", username: "uploader1", firstName: "Uma", lastName: "Uploader", email: "uploader1@example.com", role: ["UPLOADER"], active: true },
  { id: "e5f40ad7-8f76-4ebc-9c3d-60c15c9daf55", username: "disabled1", firstName: "Dana", lastName: "Disabled", role: ["VIEWER"], active: false },
];

function error(status: number, code: ErrorResponse["code"], message: string) {
  const body: ErrorResponse = { code, message, requestId: crypto.randomUUID() };
  return HttpResponse.json(body, { status });
}

type Session = { user: User } | { failure: Response };

/** Resolves the bearer token (`mock-token-<user id>`) and checks the caller holds one of `roles`. */
function authenticate(request: Request, roles?: string[]): Session {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const user = MOCK_USERS.find((u) => token === `mock-token-${u.id}`);
  if (!user || !user.active) {
    return { failure: error(401, "UNAUTHORIZED", "Missing, invalid, or expired token") };
  }
  if (roles && !user.role.some((r) => roles.includes(r))) {
    return { failure: error(403, "FORBIDDEN", "Your role does not permit this operation") };
  }
  return { user };
}

const WRITE_ROLES = ["EDITOR", "ADMIN"];
const CALENDAR_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// The spec's server root is /v1. Login is stateless: the spec has no /me or /logout.
export const handlers = [
  // Not in the spec: proposed reference-data and preview endpoints (API-005, API-010, API-020).
  http.get("/v1/holiday-calendars", ({ request }) => {
    const session = authenticate(request);
    if ("failure" in session) return session.failure;
    return HttpResponse.json(HOLIDAY_CALENDARS);
  }),

  http.get("/v1/rules", ({ request }) => {
    const session = authenticate(request);
    if ("failure" in session) return session.failure;
    return HttpResponse.json(RULES);
  }),

  http.post("/v1/calendars/preview", async ({ request }) => {
    const session = authenticate(request);
    if ("failure" in session) return session.failure;

    const body = (await request.json().catch(() => null)) as Partial<CalendarPreviewRequest> | null;
    const problem = validatePreview(body);
    if (problem) return error(400, "BAD_REQUEST", problem);
    return HttpResponse.json(generatePreview(body as CalendarPreviewRequest));
  }),

  http.get("/v1/calendars", ({ request }) => {
    const session = authenticate(request);
    if ("failure" in session) return session.failure;

    const params = new URL(request.url).searchParams;
    const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 100);
    const page = Math.max(Number(params.get("offset") ?? 1) || 1, 1);
    const name = params.get("calendarName");
    const migrated = params.get("migrated");

    const matching = loadCalendars()
      .filter((c) => !name || c.calendarName?.includes(name))
      .filter((c) => migrated === null || String(c.migrated) === migrated)
      .sort((a, b) => (a.calendarName ?? "").localeCompare(b.calendarName ?? ""));

    return HttpResponse.json({
      calendars: matching.slice((page - 1) * limit, page * limit),
      page,
      pageSize: limit,
      totalItems: matching.length,
      totalPages: Math.max(Math.ceil(matching.length / limit), 1),
    });
  }),

  http.get("/v1/calendars/:name/dates", ({ request, params }) => {
    const session = authenticate(request);
    if ("failure" in session) return session.failure;

    const calendar = loadCalendars().find((c) => c.calendarName === params.name);
    if (!calendar) return error(404, "NOT_FOUND", `No calendar named "${String(params.name)}"`);
    return HttpResponse.json([...(calendar.dates ?? [])].sort());
  }),

  http.post("/v1/calendars", async ({ request }) => {
    const session = authenticate(request, WRITE_ROLES);
    if ("failure" in session) return session.failure;

    const body = (await request.json().catch(() => null)) as Partial<CalendarCreateRequest> | null;
    if (!body?.calendarName || !CALENDAR_NAME.test(body.calendarName)) {
      return error(400, "BAD_REQUEST", "calendarName is missing or invalid");
    }
    if (typeof body.holidayCalendar !== "string" || !Array.isArray(body.dates)) {
      return error(400, "BAD_REQUEST", "dates and holidayCalendar are required");
    }
    // Empty means "none": uploaded calendars carry no holiday calendar (API-005).
    if (body.holidayCalendar !== "" && !HOLIDAY_CALENDARS.some((h) => h.name === body.holidayCalendar)) {
      return error(400, "BAD_REQUEST", `Unknown holidayCalendar "${body.holidayCalendar}"`);
    }
    if (body.dates.some((d) => !ISO_DATE.test(d)) || new Set(body.dates).size !== body.dates.length) {
      return error(400, "BAD_REQUEST", "dates must be unique YYYY-MM-DD values");
    }

    const calendars = loadCalendars();
    if (calendars.some((c) => c.calendarName === body.calendarName)) {
      return error(409, "CONFLICT", `A calendar named "${body.calendarName}" already exists`);
    }

    const now = new Date().toISOString();
    const created: Calendar = {
      ...body,
      dates: [...body.dates].sort(),
      migrated: false,
      uploaded: false,
      createdBy: session.user.username,
      createdAt: now,
      updatedAt: now,
    };
    saveCalendars([...calendars, created]);

    return HttpResponse.json(created, {
      status: 201,
      headers: { Location: `/v1/calendars/${created.calendarName}` },
    });
  }),

  http.post("/v1/calendars/:name/upload", async ({ request, params }) => {
    const session = authenticate(request, WRITE_ROLES);
    if ("failure" in session) return session.failure;

    const calendars = loadCalendars();
    const index = calendars.findIndex((c) => c.calendarName === params.name);
    if (index === -1) {
      return error(404, "NOT_FOUND", `No calendar named "${String(params.name)}"`);
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return error(400, "BAD_REQUEST", "A file part named file is required");
    }
    if (file.type !== "text/csv") {
      return error(415, "UNSUPPORTED_MEDIA_TYPE", "The file must be text/csv");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return error(413, "PAYLOAD_TOO_LARGE", "The file exceeds the 5 MiB limit");
    }

    const parsed = parseDatesCsv(await file.text());
    if (parsed.errors.length > 0) {
      return error(400, "BAD_REQUEST", parsed.errors[0]);
    }

    const updated: Calendar = {
      ...calendars[index],
      dates: parsed.dates,
      uploaded: true,
      updatedAt: new Date().toISOString(),
    };
    calendars[index] = updated;
    saveCalendars(calendars);
    return HttpResponse.json(updated);
  }),

  http.post("/v1/login", async ({ request }) => {
    const body = (await request.json().catch(() => null)) as Partial<LoginRequest> | null;
    if (!body?.username || !body.password) {
      return error(400, "BAD_REQUEST", "username and password are required");
    }

    // Same response for unknown user and wrong password: the spec forbids revealing which.
    const user = MOCK_USERS.find((u) => u.username === body.username);
    if (!user || body.password !== MOCK_PASSWORD) {
      return error(401, "UNAUTHORIZED", "Invalid username or password");
    }
    if (!user.active) {
      return error(403, "FORBIDDEN", "This account is disabled");
    }

    return HttpResponse.json(user, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        // Token delivery is unspecified in the spec; assumed to be this header.
        Authorization: `Bearer mock-token-${user.id}`,
      },
    });
  }),
];
