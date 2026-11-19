# Backend Flows & Front-to-Backend API Calls Analysis

## Overview
This document maps the complete data flow from the CalendarManagementSpec.yml API specification through the backend service implementation, database schema, and frontend integration.

---

## 1. API ENDPOINTS (CalendarManagementSpec.yml)

### Core Endpoints
- **POST /v1/calendars** - Create a new calendar
- **GET /v1/calendars** - List calendars (paginated)
- **GET /v1/calendars/{calendar_name}** - Get a specific calendar
- **PATCH /v1/calendars/{calendar_name}/update** - Update calendar
- **POST /v1/calendars/{calendar_name}/upload** - Upload CSV dates
- **GET /v1/calendars/{calendar_name}/dates** - Get calendar dates (Airflow integration)
- **GET /v1/calendars/uploadedCalendars** - Get list of uploaded calendars

### Authentication
- Bearer token (OAuth) in Authorization header
- Required roles: EDITOR or ADMIN for write operations
- READ roles for read operations

---

## 2. DATABASE SCHEMA (CalendarManagementSchema.sql)

### Tables

#### calendar
```
- calendar_id (BIGINT, PK, auto-increment)
- calendar_name (VARCHAR 256, UNIQUE)
- is_migrated (CHAR(1), default 'N')
- is_uploaded (CHAR(1), default 'N')
- status (CHAR(1), default 'A' = ACTIVE, 'I' = INACTIVE)
- created_by (VARCHAR 256)
- created_at (TIMESTAMPTZ, default now)
- updated_at (TIMESTAMPTZ, default now)
```

#### calendar_date
```
- calendar_id (BIGINT, FK to calendar, cascade delete)
- calendar_date (DATE)
- PRIMARY KEY (calendar_id, calendar_date)
```

#### audit_log
```
- audit_log_id (BIGINT, PK, auto-increment)
- resource_type (VARCHAR 256, e.g., 'CALENDAR')
- resource_name (VARCHAR 256, calendar name)
- action (VARCHAR 256, e.g., 'CREATE', 'UPDATE', 'UPLOAD')
- performed_by (VARCHAR 256, username)
- performed_at (TIMESTAMPTZ, default now)
```

---

## 3. BACKEND SERVICE ARCHITECTURE

### Entry Point: main.py
- FastAPI application with lifespan management
- Health check: GET /health
- Includes calendars router at /v1
- Error handlers for validation, HTTP exceptions, and unexpected errors
- OAuth verifier initialization
- Schema auto-creation if enabled

### API Layer: api/v1/calendars.py

#### Key Dependencies
- `get_principal` - Extracts authenticated user (EditorDep for write, read-only for GET)
- `SessionDep` - Database session dependency
- `SettingsDep` - Application settings
- `ManagedCalendarRepository` - Calendar persistence

#### Request/Response Conversion
- `calendar_response()` - Converts DB row to CalendarResponse schema
- Format conversions: dates (YYYY-MM-DD <-> DD-MM-YYYY)

#### Endpoints Implementation

##### 1. POST /v1/calendars - Create Calendar
```
Request: { calendarName, dates[] }
Flow:
  1. Validate calendar name != 'uploadedCalendars'
  2. Begin write transaction (SQLite: IMMEDIATE)
  3. Add calendar row (insert fails on duplicate)
  4. Replace dates for calendar
  5. Write audit log entry (CREATE action)
  6. Commit transaction
Response: 201 with Location header
Return: Calendar schema with dates
```

##### 2. GET /v1/calendars - List Calendars
```
Query Parameters:
  - limit (1-100, default 20)
  - offset (1-2147483647, default 1)
  - calendarName (substring search, case-sensitive)
  - migrated (boolean filter)

Flow:
  1. Build query with optional filters
  2. Count total matching calendars
  3. Fetch page (offset-limit)
  4. Order by calendarName (BINARY/C collation)
Response: 200
Return: CalendarPage { calendars[], page, pageSize, totalItems, totalPages }
```

##### 3. GET /v1/calendars/uploadedCalendars - Get Uploaded Calendars
```
Flow:
  1. Query calendars where is_uploaded = 'Y'
  2. Order by name
Response: 200
Return: Array of { name, migrated boolean }
```

##### 4. GET /v1/calendars/{calendar_name} - Get Calendar
```
Path Parameter: calendar_name (URL-encoded)
Flow:
  1. Query calendar by name
  2. Throw 404 if not found
Response: 200 | 404
Return: Calendar schema
```

##### 5. PATCH /v1/calendars/{calendar_name}/update - Update Calendar
```
Request: { calendarName, dates[], status: 'ACTIVE'|'INACTIVE' }
Flow:
  1. Validate calendarName matches path
  2. Validate calendar name != 'uploadedCalendars'
  3. Begin write transaction
  4. Find calendar (with FOR UPDATE lock)
  5. Update status field (A/I)
  6. Update updated_at timestamp
  7. Replace dates
  8. Write audit log entry (UPDATE action)
  9. Commit transaction
Response: 200 | 404
Return: Updated Calendar schema
```

##### 6. POST /v1/calendars/{calendar_name}/upload - Upload CSV
```
Multipart Request:
  - data: { year: 'YYYY' } (application/json)
  - file: CSV file (text/csv)

CSV Format:
  - Header: "date"
  - Rows: DD-MM-YYYY dates
  - Constraints: UTF-8, at least 1 date, all in requested year, no duplicates

Flow:
  1. Parse multipart: data (max 4KB) + file (max configured limit)
  2. Validate CSV structure and dates
  3. Begin write transaction
  4. Find calendar by name (with lock)
  5. If not exists: create calendar with uploaded=Y
  6. If exists and newly created: skip update timestamp
  7. If exists and old: update timestamp
  8. Set is_uploaded = 'Y'
  9. Replace dates for the year
  10. Write audit log entry (UPLOAD action)
  11. Commit transaction
Response: 201 | 400 | 413 | 415
Return: Updated Calendar schema
```

##### 7. GET /v1/calendars/{calendar_name}/dates - Get Dates (Airflow)
```
Query Parameters:
  - excludeCalendar (optional, subtract these dates)

Flow:
  1. Query calendar by name (throw 404 if not found)
  2. Get all dates for calendar
  3. If excludeCalendar specified:
     - Query exclude calendar (throw 404 if not found)
     - Set difference: main_dates - exclude_dates
  4. Sort ascending
Response: 200 | 404
Return: Array of dates as strings (DD-MM-YYYY)
```

---

## 4. DATABASE PERSISTENCE LAYER: infra/database/management.py

### ManagedCalendarRepository
Provides transactional operations with multi-database support (SQLite, PostgreSQL).

#### Key Methods

**begin_write()**
- SQLite: Executes "BEGIN IMMEDIATE" to serialize writes
- PostgreSQL: No-op (uses standard row locking)

**get(name, lock=False)**
- Fetches single calendar by name
- If lock=True: adds FOR UPDATE clause
- Options: selectinload dates if not locked

**page(name, migrated, limit, page)**
- Implements pagination
- Optional substring search on calendar_name
- Collation: BINARY (SQLite) or C (PostgreSQL)
- Returns: (list[ManagedCalendar], total_count)

**uploaded()**
- Lists calendars where is_uploaded = 'Y'
- Sorted by name

**replace_dates(calendar, dates, year=None)**
- Atomic: DELETE + INSERT
- If year specified: only affects dates in that year
- Returns: list of dates after replacement

**add(name, actor, uploaded=False)**
- Idempotent insert (on conflict do nothing)
- Sets created_at/updated_at to current UTC time
- Sets is_uploaded based on uploaded flag
- Returns: ManagedCalendar if inserted, None if duplicate

**commit(calendar, action, actor)**
- Writes audit log entry
- Commits transaction

### Models (SQLAlchemy ORM)
- **ManagedCalendar**: Maps to calendar table, relationships with dates
- **ManagedDate**: Maps to calendar_date table
- **ManagementAudit**: Maps to audit_log table

---

## 5. FRONTEND TO BACKEND API FLOW

### Frontend API Client: web/src/lib/api/client.ts

#### Request Wrapper
```typescript
async function request<T>(path, init?): Promise<T>
  - Adds Authorization: Bearer {token} header if token provided
  - Throws ApiError with status + details if response not ok
  - Returns parsed JSON
```

#### API Methods

**1. list(query?)**
```
GET /v1/calendars?limit=...&offset=...&calendarName=...&migrated=...
Returns: CalendarPage
```

**2. get(name)**
```
GET /v1/calendars/{encodeURIComponent(name)}
Returns: Calendar
```

**3. dates(name, excludeCalendar?)**
```
GET /v1/calendars/{encodeURIComponent(name)}/dates?excludeCalendar=...
Returns: string[] (dates in DD-MM-YYYY)
```

**4. uploaded()**
```
GET /v1/calendars/uploadedCalendars
Returns: Array<{ name, migrated }>
```

**5. create(body)**
```
POST /v1/calendars
Content-Type: application/json
Body: { calendarName, dates[] }
Returns: Calendar
```

**6. update(name, body)**
```
PATCH /v1/calendars/{encodeURIComponent(name)}/update
Content-Type: application/json
Body: { calendarName, dates[], status }
Returns: Calendar
```

**7. upload(name, metadata, file)**
```
POST /v1/calendars/{encodeURIComponent(name)}/upload
Content-Type: multipart/form-data
Parts:
  - data: { year: 'YYYY' }
  - file: CSV Blob
Returns: Calendar
```

### Frontend UI: web/src/features/calendars/CalendarsPage.tsx

#### React Query Integration
- Uses @tanstack/react-query for mutations and queries
- Error handling with ApiError type checking (401 for auth)

#### User Flows

**Create Calendar Flow**
1. User inputs calendar name + dates (DD-MM-YYYY format)
2. Click "Create calendar" button
3. Calls `api.create({ calendarName, dates })`
4. Backend creates row + audit log
5. UI updates with created calendar

**Update Calendar Flow**
1. User modifies calendar dates/status
2. Click "Save changes" button
3. Calls `api.update(name, { calendarName, dates, status })`
4. Backend updates row + dates + audit log
5. UI reflects changes

**Upload CSV Flow**
1. User provides calendar name + CSV file + year
2. Click "Upload" button
3. Frontend validates file is selected
4. Calls `api.upload(name, { year }, file)`
5. Backend parses CSV, validates dates, replaces year's dates
6. Returns updated calendar
7. Form resets

---

## 6. END-TO-END FLOW EXAMPLES

### Example 1: Create Calendar with Dates
```
Frontend:
  POST /v1/calendars
  { calendarName: "business-2027", dates: ["01-01-2027", "25-12-2027"] }

Backend Processing:
  1. calendars.py: create_calendar()
  2. Validate name != "uploadedCalendars"
  3. ManagedCalendarRepository.begin_write() -> BEGIN IMMEDIATE
  4. ManagedCalendarRepository.add(name, user) -> INSERT into calendar
  5. ManagedCalendarRepository.replace_dates() -> INSERT into calendar_date
  6. ManagedCalendarRepository.commit() -> INSERT audit_log, COMMIT
  7. Response: 201 Created with calendar object

Database State:
  - calendar row: id=1, name="business-2027", created_by="alex", is_uploaded='N'
  - calendar_date rows: (1, 2027-01-01), (1, 2027-12-25)
  - audit_log row: action="CREATE", calendar name="business-2027"
```

### Example 2: List Calendars with Pagination
```
Frontend:
  GET /v1/calendars?limit=20&offset=1&calendarName=business

Backend Processing:
  1. calendars.py: list_calendars()
  2. ManagedCalendarRepository.page(calendarName="business", migrated=None, limit=20, offset=1)
  3. Build query: WHERE calendar_name contains "business" (instr/strpos)
  4. Count total: SELECT COUNT(*) -> 15 results
  5. Fetch page: OFFSET 0 LIMIT 20 ORDER BY calendar_name COLLATE BINARY
  6. Convert each row: calendar_response(row) -> format dates
  7. Response: 200 OK with CalendarPage

Frontend Response:
{
  calendars: [ { calendarName, dates[], migrated, uploaded, ... }, ... ],
  page: 1,
  pageSize: 20,
  totalItems: 15,
  totalPages: 1
}
```

### Example 3: Get Calendar Dates for Airflow
```
Frontend:
  GET /v1/calendars/business-2027/dates

Backend Processing:
  1. calendars.py: get_dates()
  2. ManagedCalendarRepository.get("business-2027")
  3. If not found: raise HTTPException 404
  4. Extract all calendar_date rows, convert to set
  5. If excludeCalendar specified: query that calendar, subtract dates
  6. Sort ascending
  7. Format as DD-MM-YYYY strings
  8. Response: 200 OK with date array

Frontend Response:
[ "01-01-2027", "25-12-2027" ]
```

### Example 4: Upload CSV File
```
Frontend:
  POST /v1/calendars/holidays-2027/upload
  Multipart:
    - data: { "year": "2027" }
    - file: (CSV with dates)

CSV Content:
  date
  01-01-2027
  25-12-2027
  31-12-2027

Backend Processing:
  1. calendars.py: upload_calendar()
  2. read_upload() -> parse multipart, validate CSV
  3. ManagedCalendarRepository.begin_write()
  4. ManagedCalendarRepository.get("holidays-2027", lock=True)
  5. If exists: set updated_at = now, row.is_uploaded = 'Y'
  6. If not exists: create with is_uploaded = 'Y'
  7. ManagedCalendarRepository.replace_dates(calendar, [2027-01-01, ...], year=2027)
     - DELETE from calendar_date WHERE calendar_id=X AND date IN 2027
     - INSERT 3 new dates
  8. ManagedCalendarRepository.commit("UPLOAD", user)
  9. Response: 201 Created with updated calendar

Database State:
  - calendar row: is_uploaded='Y', updated_at=now
  - calendar_date rows: 3 entries for 2027
  - audit_log row: action="UPLOAD"
```

---

## 7. TRANSACTION & CONSISTENCY MODEL

### SQLite (Local Development)
- Uses "BEGIN IMMEDIATE" to serialize writes
- Prevents concurrent modifications during read-modify-write
- Single write at a time

### PostgreSQL (Production)
- Uses row-level locks (FOR UPDATE)
- Multiple readers, serialized writers
- Higher concurrency

### Audit Trail
- Every CREATE/UPDATE/UPLOAD triggers audit_log entry
- Captures: action, calendar_name, performed_by, timestamp
- Enables compliance and debugging

---

## 8. ERROR HANDLING

### Client Errors (4xx)
- **400**: Validation failure, duplicate names, malformed dates/CSV, missing fields
- **401**: Invalid/expired OAuth token
- **403**: Insufficient permissions (not EDITOR/ADMIN for writes)
- **404**: Calendar not found
- **413**: Uploaded file exceeds size limit
- **415**: Unsupported media type (not multipart or text/csv)

### Server Errors (5xx)
- **500**: Unexpected error, logged with full traceback

### Error Response Format
```json
{
  "status": "400",
  "error": "Bad Request",
  "message": "Human-readable explanation",
  "details": [
    { "field": "dates[0]", "message": "Must be valid DD-MM-YYYY" }
  ]
}
```

---

## 9. KEY DESIGN PATTERNS

| Pattern | Implementation |
|---------|---|
| **Dependency Injection** | FastAPI Depends for auth, session, settings |
| **Repository Pattern** | ManagedCalendarRepository abstracts DB |
| **Idempotent Operations** | Calendar creation uses ON CONFLICT DO NOTHING |
| **Multi-DB Support** | SQLAlchemy dialects for SQLite/PostgreSQL |
| **Request-Response Schemas** | Pydantic models with OpenAPI generation |
| **Transactional Consistency** | Write-lock + audit trail |
| **Type-Safe APIs** | OpenAPI schema + TypeScript client types |

---

## 10. DATA FLOW DIAGRAM

```
┌─────────────────┐
│  Frontend UI    │
│ (React/vite)    │
└────────┬────────┘
         │ HTTP + Bearer Token
         │
    ┌────▼──────────────────────┐
    │  FastAPI Application      │
    │  - main.py                │
    │  - Error handlers         │
    │  - OAuth verifier         │
    └────┬───────────────────────┘
         │
    ┌────▼──────────────────────┐
    │  API Layer                │
    │  - GET/POST/PATCH routes  │
    │  - calendars.py           │
    │  - upload.py              │
    │  - schemas/management.py  │
    └────┬───────────────────────┘
         │
    ┌────▼──────────────────────┐
    │  Repository Layer         │
    │  - ManagedCalendarRepo    │
    │  - Transactions           │
    │  - Row-level locking      │
    └────┬───────────────────────┘
         │
    ┌────▼──────────────────────┐
    │  Database                 │
    │  - calendar               │
    │  - calendar_date          │
    │  - audit_log              │
    └───────────────────────────┘
```

---

## 11. CONFIGURATION & SETTINGS

### Key Settings (config/settings.py)
- `auth_enabled`: Enable/disable OAuth
- `auto_create_schema`: Auto-create tables on startup
- `upload_max_bytes`: File upload size limit

### Dependencies (config/dependency.py)
- Database session management
- Settings singleton
- Authentication principal extraction

---

## 12. SUMMARY TABLE: Endpoint Mapping

| Endpoint | Method | Auth | DB Ops | Audit | Returns |
|----------|--------|------|--------|-------|---------|
| /calendars | POST | EDITOR | INSERT cal + dates | CREATE | 201 + Calendar |
| /calendars | GET | READ | SELECT paginated | - | 200 + CalendarPage |
| /calendars/{name} | GET | READ | SELECT one | - | 200 + Calendar |
| /calendars/{name}/update | PATCH | EDITOR | UPDATE cal + dates | UPDATE | 200 + Calendar |
| /calendars/{name}/upload | POST | EDITOR | INSERT/UPDATE cal + dates | UPLOAD | 201 + Calendar |
| /calendars/{name}/dates | GET | READ | SELECT dates | - | 200 + DateArray |
| /calendars/uploadedCalendars | GET | READ | SELECT uploaded | - | 200 + UploadedList |

