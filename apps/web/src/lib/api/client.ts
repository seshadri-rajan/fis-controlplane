import { isActive, type CalendarStatusFields, type RunRecord } from "./proposed";
import type { components as specComponents } from "./spec";

type SpecUser = specComponents["schemas"]["User"];
type SpecLoginRequest = specComponents["schemas"]["LoginRequest"];
export type SpecCalendar = CalendarStatusFields & {
  calendarName?: string;
  dates?: string[];
  migrated?: boolean;
  uploaded?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  holidayCalendar?: string;
};
export type SpecCalendarCreate = { calendarName: string; dates: string[] };
export type SpecCalendarWrite = {
  calendarName: string;
  dates: string[];
  status: "ACTIVE" | "INACTIVE";
};
export type UploadVerificationItem = {
  row: number;
  value: string | null;
  date: string | null;
  valid: boolean;
  errors: string[];
};
export type UploadVerification = {
  year: number;
  valid: boolean;
  items: UploadVerificationItem[];
  errors: string[];
};
type ApiCalendar = Omit<SpecCalendar, "dates"> & { dates?: string[] };
type ApiCalendarPage = {
  calendars: ApiCalendar[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

function toUiDate(value: string): string {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function toApiDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function toUiCalendar(calendar: ApiCalendar): SpecCalendar {
  return { ...calendar, dates: calendar.dates?.map(toUiDate) };
}

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
    const result = await request<ApiCalendarPage>(`/v1/calendars?${query}`);
    calendars.push(...result.calendars.map(toUiCalendar));
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
  return request<string[]>(`/v1/calendars/${encodeURIComponent(calendarName)}/dates`).then(
    (dates) => dates.map(toUiDate),
  );
}

export function getCalendar(calendarName: string): Promise<SpecCalendar> {
  return request<ApiCalendar>(`/v1/calendars/${encodeURIComponent(calendarName)}`).then(
    toUiCalendar,
  );
}

/** Builds the backend's required amendment payload from UI dates and the current calendar. */
export function toWriteRequest(calendar: SpecCalendar, dates: string[]): SpecCalendarWrite {
  return {
    calendarName: calendar.calendarName ?? "",
    dates: dates.map(toApiDate),
    status: isActive(calendar) ? "ACTIVE" : "INACTIVE",
  };
}

export function updateCalendar(
  calendarName: string,
  body: SpecCalendarWrite,
): Promise<SpecCalendar> {
  return request<ApiCalendar>(`/v1/calendars/${encodeURIComponent(calendarName)}/update`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }).then(toUiCalendar);
}

/** ADMIN-only lifecycle endpoints. */
export function setCalendarActive(calendarName: string, active: boolean): Promise<SpecCalendar> {
  const action = active ? "activate" : "deactivate";
  return request<ApiCalendar>(
    `/v1/calendars/${encodeURIComponent(calendarName)}/${action}`,
    { method: "POST" },
  ).then(toUiCalendar);
}

export function createSpecCalendar(body: SpecCalendarCreate): Promise<SpecCalendar> {
  return request<ApiCalendar>("/v1/calendars", json(body)).then(toUiCalendar);
}

function calendarUploadForm(file: File, year: number): FormData {
  const form = new FormData();
  form.append("data", new Blob([JSON.stringify({ year: String(year) })], {
    type: "application/json",
  }));
  form.append("file", file);
  return form;
}

export function verifyDates(
  file: File,
  year: number,
  amend: boolean,
): Promise<UploadVerification> {
  const query = amend ? "?amend=true" : "";
  return request<UploadVerification>("/v1/calendars/upload/verify" + query, {
    method: "POST",
    body: calendarUploadForm(file, year),
  });
}

/** Atomically replaces a calendar year from a single-column Excel workbook. */
export function uploadCalendarDates(
  calendarName: string,
  file: File,
  year: number,
  createOnly = false,
): Promise<SpecCalendar> {
  const query = createOnly ? "?createOnly=true" : "";
  return request<ApiCalendar>(`/v1/calendars/${encodeURIComponent(calendarName)}/upload${query}`, {
    method: "POST",
    body: calendarUploadForm(file, year),
  }).then(toUiCalendar);
}

export async function downloadCalendarExcel(calendarName: string): Promise<void> {
  const response = await send(
    `/v1/calendars/${encodeURIComponent(calendarName)}/export`,
  );
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `calendar-${calendarName}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// --- run history: proposed endpoint, not in the spec (API-029) ---

export function listRunHistory(): Promise<RunRecord[]> {
  return request<RunRecord[]>("/v1/run-history");
}
