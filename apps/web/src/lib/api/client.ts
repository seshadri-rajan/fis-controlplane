import type { operations } from "./schema";

type JsonBody<Operation extends { requestBody: { content: { "application/json": unknown } } }> =
  Operation["requestBody"]["content"]["application/json"];
type JsonResponse<Operation extends { content: { "application/json": unknown } }> =
  Operation["content"]["application/json"];

export type Calendar = JsonResponse<operations["getCalendar"]["responses"][200]>;
export type CalendarPage = JsonResponse<operations["listCalendars"]["responses"][200]>;
type CalendarDates = JsonResponse<operations["getCalendarDates"]["responses"][200]>;
type UploadedCalendars = JsonResponse<operations["getUploadedCalendars"]["responses"][200]>;
type CreateCalendar = JsonBody<operations["createCalendar"]>;
type UpdateCalendar = JsonBody<operations["updateCalendar"]>;
type ListQuery = NonNullable<operations["listCalendars"]["parameters"]["query"]>;
type UploadMetadata =
  operations["uploadCalendarDates"]["requestBody"]["content"]["multipart/form-data"]["data"];
type ErrorBody = JsonResponse<operations["getCalendar"]["responses"][400]>;

const calendarsPath = "/v1/calendars";
const calendarPath = (name: string) => `${calendarsPath}/${encodeURIComponent(name)}`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createCalendarApi(token?: string) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(path, { ...init, headers, credentials: "omit" });
    if (!response.ok) {
      const body: Partial<ErrorBody> | null = await response.json().catch(() => null);
      const message = body?.message ?? `Request failed (${response.status}).`;
      const details = body?.details?.map(({ field, message }) => `${field}: ${message}`);
      throw new ApiError(response.status, details?.length ? `${message} ${details.join("; ")}` : message);
    }
    return response.json();
  }

  function write<T>(path: string, method: "POST" | "PATCH", body: CreateCalendar | UpdateCalendar) {
    return request<T>(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  return {
    list(query: ListQuery = {}) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) params.set(key, String(value));
      }
      return request<CalendarPage>(`${calendarsPath}?${params}`);
    },
    get(name: string) {
      return request<Calendar>(calendarPath(name));
    },
    dates(name: string, excludeCalendar?: string) {
      const query = excludeCalendar ? `?${new URLSearchParams({ excludeCalendar })}` : "";
      return request<CalendarDates>(`${calendarPath(name)}/dates${query}`);
    },
    uploaded() {
      return request<UploadedCalendars>(`${calendarsPath}/uploadedCalendars`);
    },
    create(body: CreateCalendar) {
      return write<JsonResponse<operations["createCalendar"]["responses"][201]>>(
        calendarsPath, "POST", body,
      );
    },
    update(name: string, body: UpdateCalendar) {
      return write<JsonResponse<operations["updateCalendar"]["responses"][200]>>(
        `${calendarPath(name)}/update`, "PATCH", body,
      );
    },
    upload(name: string, metadata: UploadMetadata, file: File) {
      const body = new FormData();
      body.append("data", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "data.json");
      body.append("file", new Blob([file], { type: "text/csv" }), file.name);
      return request<JsonResponse<operations["uploadCalendarDates"]["responses"][201]>>(
        `${calendarPath(name)}/upload`, { method: "POST", body },
      );
    },
  };
}

export type CalendarApi = ReturnType<typeof createCalendarApi>;
