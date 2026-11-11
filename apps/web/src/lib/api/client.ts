import type {
  CalendarPreviewRequest,
  CalendarPreviewResponse,
  CalendarStatusFields,
  HolidayCalendarOption,
  RuleDefinition,
} from "./proposed";
import type { components as specComponents } from "./spec";

type SpecUser = specComponents["schemas"]["User"];
type SpecLoginRequest = specComponents["schemas"]["LoginRequest"];
export type SpecCalendar = specComponents["schemas"]["Calendar"] & CalendarStatusFields;
export type SpecCalendarCreate = specComponents["schemas"]["CalendarCreateRequest"];
export type SpecCalendarWrite = specComponents["schemas"]["CalendarWriteRequest"];

/**
 * UI-owned session user. Adapted from the new backend's `User` so components do not
 * depend on wire field names; only this adapter changes if the contract does.
 */
export type AuthUser = { id: string; user_name: string; roles: string[] };

function toAuthUser(user: SpecUser): AuthUser {
  return { id: user.id, user_name: user.username, roles: user.role };
}

// The spec has no /me or /logout, so the session lives client-side.
const SESSION_KEY = "calendar-session";
type StoredSession = { token: string | null; user: AuthUser };

function readSession(): StoredSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as StoredSession) : null;
}

function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const token = readSession()?.token;
  const response = await fetch(path, {
    ...init,
    headers: {
      // For FormData the browser must set the multipart boundary itself.
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new ApiError(response.status, await describeFailure(response));
  }
  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await (await send(path, init)).json()) as T;
}

async function describeFailure(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.message === "string") return body.message;
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail.map((d: { msg?: string }) => d.msg ?? "invalid input").join("; ");
    }
  } catch {
    // Fall through to the generic message below.
  }
  return `Request failed (${response.status})`;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
});

// --- auth (new backend: POST /v1/login only; no /me or /logout) ---

export async function login(userName: string, password: string): Promise<AuthUser> {
  const body: SpecLoginRequest = { username: userName, password };
  const response = await send("/v1/login", json(body));
  const user = toAuthUser((await response.json()) as SpecUser);
  // Token delivery is not defined in the spec yet; assumed to be an Authorization response header.
  const token = response.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, user } satisfies StoredSession));
  return user;
}

export async function logout(): Promise<void> {
  clearSession();
}

/** Resolves to null when not signed in. */
export async function restoreSession(): Promise<AuthUser | null> {
  return readSession()?.user ?? null;
}

// --- calendars (new backend, /v1) ---

async function listAllCalendars(filters: Record<string, string> = {}): Promise<SpecCalendar[]> {
  const calendars: SpecCalendar[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    // `offset` is the page number in this spec (API-015).
    const query = new URLSearchParams({ ...filters, limit: "100", offset: String(page) });
    const result = await request<specComponents["schemas"]["CalendarPage"]>(
      `/v1/calendars?${query}`,
    );
    calendars.push(...result.calendars);
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);
  return calendars;
}

export function listCalendars(): Promise<SpecCalendar[]> {
  return listAllCalendars();
}

/** Migrated (Autosys) calendars. The spec has no dedicated endpoint, so filter the list. */
export function listMigratedCalendars(): Promise<SpecCalendar[]> {
  return listAllCalendars({ migrated: "true" });
}

/**
 * Calendars created by uploading a file. The spec's list has a `migrated` filter but none for
 * `uploaded`, so the non-migrated calendars are fetched and narrowed here (API-024).
 */
export async function listUploadedCalendars(): Promise<SpecCalendar[]> {
  return (await listAllCalendars({ migrated: "false" })).filter((c) => c.uploaded === true);
}

export function getCalendarDates(calendarName: string): Promise<string[]> {
  return request<string[]>(`/v1/calendars/${encodeURIComponent(calendarName)}/dates`);
}

export function getCalendar(calendarName: string): Promise<SpecCalendar> {
  return request<SpecCalendar>(`/v1/calendars/${encodeURIComponent(calendarName)}`);
}

/**
 * The spec's update replaces every writable field (API-028), so an edit of the dates alone must
 * send the calendar's other fields back unchanged or they are wiped.
 */
export function toWriteRequest(calendar: SpecCalendar, dates: string[]): SpecCalendarWrite {
  return {
    dates,
    holidayCalendar: calendar.holidayCalendar ?? "",
    ...(calendar.dateRuleType !== undefined && { dateRuleType: calendar.dateRuleType }),
    ...(calendar.dayOfWeek !== undefined && { dayOfWeek: calendar.dayOfWeek }),
    ...(calendar.runDate !== undefined && { runDate: calendar.runDate }),
    ...(calendar.runDay !== undefined && { runDay: calendar.runDay }),
    ...(calendar.holidayRun !== undefined && { holidayRun: calendar.holidayRun }),
    ...(calendar.holidayOffset !== undefined && { holidayOffset: calendar.holidayOffset }),
  };
}

export function updateCalendar(
  calendarName: string,
  body: SpecCalendarWrite,
): Promise<SpecCalendar> {
  return request<SpecCalendar>(`/v1/calendars/${encodeURIComponent(calendarName)}/update`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Proposed endpoints, ADMIN only (API-026). */
export function setCalendarActive(calendarName: string, active: boolean): Promise<SpecCalendar> {
  const action = active ? "activate" : "deactivate";
  return request<SpecCalendar>(`/v1/calendars/${encodeURIComponent(calendarName)}/${action}`, {
    method: "POST",
  });
}

export function createSpecCalendar(body: SpecCalendarCreate): Promise<SpecCalendar> {
  return request<SpecCalendar>("/v1/calendars", json(body));
}

/** Atomically replaces the calendar's dates from a UTF-8 CSV with a single `date` column. */
export function uploadCalendarDates(calendarName: string, file: File): Promise<SpecCalendar> {
  const form = new FormData();
  // Some OSes label .csv files as application/vnd.ms-excel; the spec requires text/csv.
  form.append("file", new File([file], file.name, { type: "text/csv" }));
  return request<SpecCalendar>(`/v1/calendars/${encodeURIComponent(calendarName)}/upload`, {
    method: "POST",
    body: form,
  });
}

// --- reference data and preview: proposed endpoints, not in the spec (see proposed.ts) ---

export function listHolidayCalendars(): Promise<HolidayCalendarOption[]> {
  return request<HolidayCalendarOption[]>("/v1/holiday-calendars");
}

export function listRuleCatalog(): Promise<RuleDefinition[]> {
  return request<RuleDefinition[]>("/v1/rules");
}

export function previewCalendar(body: CalendarPreviewRequest): Promise<CalendarPreviewResponse> {
  return request<CalendarPreviewResponse>("/v1/calendars/preview", json(body));
}
