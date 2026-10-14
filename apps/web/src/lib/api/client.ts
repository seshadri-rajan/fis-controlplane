import type { components } from "./schema";

export type PreviewRequest = components["schemas"]["PreviewRequest"];
export type PreviewResponse = components["schemas"]["PreviewResponse"];
export type PreviewDate = components["schemas"]["PreviewDate"];
export type RuleSummary = components["schemas"]["RuleSummary"];
export type Weekday = components["schemas"]["Weekday"];
export type HolidayPolicy = components["schemas"]["HolidayPolicy"];
export type CollisionPolicy = components["schemas"]["CollisionPolicy"];
export type BoundaryPolicy = components["schemas"]["BoundaryPolicy"];

export type CurrentUserRead = components["schemas"]["CurrentUserRead"];
export type LoginRequest = components["schemas"]["LoginRequest"];
export type CalendarRead = components["schemas"]["CalendarRead"];
export type CalendarWrite = components["schemas"]["CalendarWrite"];
export type CalendarDateRead = components["schemas"]["CalendarDateRead"];
export type AuditEntryRead = components["schemas"]["AuditEntryRead"];
export type ChangeRequestRead = components["schemas"]["ChangeRequestRead"];
export type MutationResult = components["schemas"]["MutationResult"];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    throw new ApiError(response.status, await describeFailure(response));
  }
  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await (await send(path, init)).json()) as T;
}

async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  await send(path, init);
}

async function describeFailure(response: Response): Promise<string> {
  try {
    const body = await response.json();
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

// --- preview (unauthenticated by design, see RECORD O-32) ---

export function listRules(): Promise<RuleSummary[]> {
  return request<RuleSummary[]>("/api/ui/preview/rules");
}

export function fetchPreview(body: PreviewRequest): Promise<PreviewResponse> {
  return request<PreviewResponse>("/api/ui/preview", json(body));
}

// --- auth ---

export function login(body: LoginRequest): Promise<CurrentUserRead> {
  return request<CurrentUserRead>("/api/ui/auth/login", json(body));
}

export function logout(): Promise<void> {
  return requestVoid("/api/ui/auth/logout", { method: "POST" });
}

/** Resolves to null when not signed in, so callers do not treat 401 as a failure. */
export async function fetchMe(): Promise<CurrentUserRead | null> {
  try {
    return await request<CurrentUserRead>("/api/ui/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

// --- calendars ---

export function listCalendars(includeInactive = false): Promise<CalendarRead[]> {
  return request<CalendarRead[]>(`/api/ui/calendars?include_inactive=${includeInactive}`);
}

/** 201 applies immediately; 202 raises a change request. Tell them apart via `applied`. */
export function createCalendar(body: CalendarWrite): Promise<MutationResult> {
  return request<MutationResult>("/api/ui/calendars", json(body));
}

export function fetchCalendarDates(key: number, year: number): Promise<CalendarDateRead[]> {
  return request<CalendarDateRead[]>(`/api/ui/calendars/${key}/dates?year=${year}`);
}

export function fetchCalendarHistory(key: number): Promise<AuditEntryRead[]> {
  return request<AuditEntryRead[]>(`/api/ui/calendars/${key}/history`);
}

export function listChangeRequests(): Promise<ChangeRequestRead[]> {
  return request<ChangeRequestRead[]>("/api/ui/change-requests");
}
