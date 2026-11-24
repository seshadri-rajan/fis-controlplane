import { http, HttpResponse } from "msw";
import { isPastDate, todayIso } from "../../dates";
import {
  calendarWorkbook,
  MAX_UPLOAD_BYTES,
  parseCalendarWorkbook,
  XLSX_MEDIA_TYPE,
} from "../calendarWorkbook";
import type { CalendarStatusFields } from "../proposed";
import type { components } from "../spec";
import { runHistory } from "./runHistory";
import { loadCalendars, saveCalendars } from "./store";

type User = components["schemas"]["User"];
type LoginRequest = components["schemas"]["LoginRequest"];
type ErrorResponse = components["schemas"]["ErrorResponse"];
type Calendar = components["schemas"]["Calendar"] & CalendarStatusFields;
type CalendarCreateRequest = { calendarName: string; dates: string[] };
type CalendarWriteRequest = {
  calendarName: string;
  dates: string[];
  status: "ACTIVE" | "INACTIVE";
};

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
const CALENDAR_NAME = /^[A-Za-z0-9]{1,70}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const API_DATE = /^(\d{2})-(\d{2})-(\d{4})$/;

const INACTIVE_MESSAGE = "This calendar is inactive. Activate it before changing its dates";

/** ADMIN-only lifecycle actions are idempotent and apply only to uploaded or migrated calendars. */
const activation = (action: "activate" | "deactivate", active: boolean) =>
  http.post(`/v1/calendars/:name/${action}`, ({ request, params }) => {
    const session = authenticate(request, ["ADMIN"]);
    if ("failure" in session) return session.failure;

    const calendars = loadCalendars();
    const index = calendars.findIndex((c) => c.calendarName === params.name);
    if (index === -1) return error(404, "NOT_FOUND", `No calendar named "${String(params.name)}"`);
    const current = calendars[index];
    if (!current.uploaded && !current.migrated) {
      return error(409, "CONFLICT", "Only uploaded or migrated calendars can be managed");
    }

    const updated: Calendar = {
      ...current,
      active,
      status: active ? "ACTIVE" : "INACTIVE",
      updatedAt: new Date().toISOString(),
    };
    calendars[index] = updated;
    saveCalendars(calendars);
    return HttpResponse.json(updated);
  });

// The spec's server root is /v1. Login is stateless: the spec has no /me or /logout.
export const handlers = [
  // Not in the spec: proposed run history for the home dashboard (API-029).
  http.get("/v1/run-history", ({ request }) => {
    const session = authenticate(request);
    if ("failure" in session) return session.failure;
    return HttpResponse.json(runHistory());
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

  http.get("/v1/calendars/:name/export", async ({ request, params }) => {
    const session = authenticate(request);
    if ("failure" in session) return session.failure;

    const calendar = loadCalendars().find((c) => c.calendarName === params.name);
    if (!calendar) return error(404, "NOT_FOUND", `No calendar named "${String(params.name)}"`);
    const workbook = await calendarWorkbook(calendar.dates ?? []);
    return new HttpResponse(workbook, {
      headers: {
        "Content-Type": XLSX_MEDIA_TYPE,
        "Content-Disposition": `attachment; filename="calendar-${String(params.name)}.xlsx"`,
      },
    });
  }),

  http.post("/v1/calendars/upload/verify", async ({ request }) => {
    const session = authenticate(request, WRITE_ROLES);
    if ("failure" in session) return session.failure;

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const metadata = form?.get("data");
    if (!(file instanceof File) || !(metadata instanceof Blob)) {
      return error(400, "BAD_REQUEST", "JSON metadata and an Excel file are required");
    }
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.type !== XLSX_MEDIA_TYPE) {
      return error(415, "UNSUPPORTED_MEDIA_TYPE", "The file must be an .xlsx workbook");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return error(413, "PAYLOAD_TOO_LARGE", "The file exceeds the 5 MiB limit");
    }

    let year: string | undefined;
    try {
      year = (JSON.parse(await metadata.text()) as { year?: string }).year;
    } catch {
      return error(400, "BAD_REQUEST", "Upload metadata must contain a valid year");
    }
    if (!year || !/^\d{4}$/.test(year)) {
      return error(400, "BAD_REQUEST", "Upload metadata must contain a valid year");
    }

    const amend = new URL(request.url).searchParams.get("amend") === "true";
    if (amend && !session.user.role.includes("ADMIN")) {
      return error(403, "FORBIDDEN", "Verifying amendment files requires ADMIN");
    }
    const result = await parseCalendarWorkbook(await file.arrayBuffer(), Number(year), amend);
    return HttpResponse.json(result);
  }),

  http.get("/v1/calendars/:name", ({ request, params }) => {
    const session = authenticate(request);
    if ("failure" in session) return session.failure;

    const calendar = loadCalendars().find((c) => c.calendarName === params.name);
    if (!calendar) return error(404, "NOT_FOUND", `No calendar named "${String(params.name)}"`);
    return HttpResponse.json(calendar);
  }),

  http.patch("/v1/calendars/:name/update", async ({ request, params }) => {
    const session = authenticate(request, ["ADMIN"]);
    if ("failure" in session) return session.failure;

    const calendars = loadCalendars();
    const index = calendars.findIndex((c) => c.calendarName === params.name);
    if (index === -1) return error(404, "NOT_FOUND", `No calendar named "${String(params.name)}"`);
    const current = calendars[index];
    if (!current.uploaded && !current.migrated) {
      return error(409, "CONFLICT", "Only uploaded or migrated calendars can be amended");
    }
    if (current.active === false) return error(409, "CONFLICT", INACTIVE_MESSAGE);

    const body = (await request.json().catch(() => null)) as Partial<CalendarWriteRequest> | null;
    if (
      !body ||
      body.calendarName !== params.name ||
      !Array.isArray(body.dates) ||
      (body.status !== "ACTIVE" && body.status !== "INACTIVE")
    ) {
      return error(400, "BAD_REQUEST", "calendarName, dates, and status are required");
    }
    if (body.status !== "ACTIVE") {
      return error(400, "BAD_REQUEST", "Use the deactivate endpoint to change calendar status");
    }
    const dates = body.dates.map((date) => {
      const match = API_DATE.exec(date);
      return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
    });
    if (dates.some((date) => !ISO_DATE.test(date)) || new Set(dates).size !== dates.length) {
      return error(400, "BAD_REQUEST", "dates must be unique DD-MM-YYYY values");
    }

    // Proposed rule (API-027): history is read-only, so no date before today may be added or removed.
    const before = new Set(current.dates ?? []);
    const after = new Set(dates);
    const today = todayIso();
    const changedPast = [
      ...[...before].filter((d) => !after.has(d)),
      ...dates.filter((d) => !before.has(d)),
    ]
      .filter((d) => isPastDate(d, today))
      .sort();
    if (changedPast.length > 0) {
      const more = changedPast.length > 1 ? ` and ${changedPast.length - 1} more` : "";
      return error(400, "BAD_REQUEST", `Dates before ${today} cannot be changed (${changedPast[0]}${more})`);
    }

    // Keep the mock's UI-facing dates in ISO form after validating the API's wire format.
    const { calendarName, migrated, uploaded, active, createdBy, createdAt } = current;
    const updated: Calendar = {
      calendarName,
      migrated,
      uploaded,
      active,
      status: "ACTIVE",
      createdBy,
      createdAt,
      dates: [...dates].sort(),
      updatedAt: new Date().toISOString(),
    };
    calendars[index] = updated;
    saveCalendars(calendars);
    return HttpResponse.json(updated);
  }),

  activation("activate", true),
  activation("deactivate", false),

  http.post("/v1/calendars", async ({ request }) => {
    const session = authenticate(request, WRITE_ROLES);
    if ("failure" in session) return session.failure;

    const body = (await request.json().catch(() => null)) as Partial<CalendarCreateRequest> | null;
    if (!body?.calendarName || !CALENDAR_NAME.test(body.calendarName)) {
      return error(400, "BAD_REQUEST", "calendarName is missing or invalid");
    }
    if (!Array.isArray(body.dates)) {
      return error(400, "BAD_REQUEST", "dates are required");
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
      status: "ACTIVE",
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
    const calendarName = String(params.name);
    const index = calendars.findIndex((c) => c.calendarName === calendarName);
    const createOnly = new URL(request.url).searchParams.get("createOnly") === "true";
    if (index !== -1 && calendars[index].active === false) {
      return error(409, "CONFLICT", INACTIVE_MESSAGE);
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return error(400, "BAD_REQUEST", "A file part named file is required");
    }
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.type !== XLSX_MEDIA_TYPE) {
      return error(415, "UNSUPPORTED_MEDIA_TYPE", "The file must be an .xlsx workbook");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return error(413, "PAYLOAD_TOO_LARGE", "The file exceeds the 5 MiB limit");
    }

    const metadata = form?.get("data");
    if (!(metadata instanceof Blob)) {
      return error(400, "BAD_REQUEST", "JSON upload metadata is required");
    }
    let year: string | undefined;
    try {
      year = (JSON.parse(await metadata.text()) as { year?: string }).year;
    } catch {
      return error(400, "BAD_REQUEST", "Upload metadata must contain a valid year");
    }
    if (!year || !/^\d{4}$/.test(year)) {
      return error(400, "BAD_REQUEST", "Upload metadata must contain a valid year");
    }
    const currentYear = new Date().getFullYear();
    if (
      ![String(currentYear), String(currentYear + 1)].includes(year)
    ) {
      return error(400, "BAD_REQUEST", "Dates and upload metadata must use the current or next year");
    }
    const verification = await parseCalendarWorkbook(await file.arrayBuffer(), Number(year), false);
    if (
      !verification.valid ||
      verification.items.some((item) => item.date && !item.date.startsWith(`${year}-`))
    ) {
      return error(
        400,
        "BAD_REQUEST",
        verification.items.flatMap((item) => item.errors)[0] ??
          "Dates and upload metadata must use the same year",
      );
    }

    if (index !== -1 && createOnly) {
      return error(409, "CONFLICT", `A calendar named "${calendarName}" already exists`);
    }
    if (index === -1 && !/^[A-Za-z0-9]{1,70}$/.test(calendarName)) {
      return error(400, "BAD_REQUEST", "New calendar names must contain 1 to 70 letters or digits");
    }

    const now = new Date().toISOString();
    const existing = index === -1 ? undefined : calendars[index];
    const keptDates = (existing?.dates ?? []).filter((date) => !date.startsWith(`${year}-`));
    const updated: Calendar = {
      ...(existing ?? {
        calendarName,
        dates: [],
        holidayCalendar: "",
        migrated: false,
        createdBy: session.user.username,
        createdAt: now,
      }),
      dates: [
        ...keptDates,
        ...verification.items.map((item) => item.date).filter((date): date is string => !!date),
      ].sort(),
      uploaded: true,
      status: existing?.status ?? "ACTIVE",
      updatedAt: now,
    };
    if (index === -1) calendars.push(updated);
    else calendars[index] = updated;
    saveCalendars(calendars);
    return HttpResponse.json(updated, { status: 201 });
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
