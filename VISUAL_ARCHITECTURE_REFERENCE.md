# Visual Architecture & Quick Reference

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ CalendarsPage.tsx                                          │ │
│  │ - Calendar list with pagination                           │ │
│  │ - Create/Edit forms                                       │ │
│  │ - CSV upload interface                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ API Client (web/src/lib/api/client.ts)                   │ │
│  │ - create(), update(), upload()                           │ │
│  │ - list(), get(), dates()                                 │ │
│  │ - Error handling with ApiError type                      │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP + Bearer Token
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ POST         │  │ GET          │  │ PATCH        │
│ /calendars   │  │ /calendars   │  │ /calendars   │
│ (Create)     │  │ (List)       │  │ (Update)     │
└──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                   FastAPI Application                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ main.py                                                    │ │
│  │ - Lifespan: OAuth verifier, schema creation              │ │
│  │ - Error handlers: validation (400), HTTP, general (500)  │ │
│  │ - Health check: GET /health                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ API Layer (api/v1/calendars.py, upload.py)              │ │
│  │                                                            │ │
│  │ ┌─ POST /calendars ──────────────────────────────────┐  │ │
│  │ │ create_calendar(body, response, user, session)    │  │ │
│  │ │ - Validate calendar name                          │  │ │
│  │ │ - Begin transaction                               │  │ │
│  │ │ - Add calendar + dates                            │  │ │
│  │ │ - Commit with audit                               │  │ │
│  │ └───────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │ ┌─ GET /calendars ───────────────────────────────────┐  │ │
│  │ │ list_calendars(session, limit, offset, name)      │  │ │
│  │ │ - Build paginated query                           │  │ │
│  │ │ - Apply filters (name substring, migrated flag)   │  │ │
│  │ │ - Return CalendarPage with metadata               │  │ │
│  │ └───────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │ ┌─ PATCH /calendars/{name}/update ──────────────────┐  │ │
│  │ │ update_calendar(name, body, user, session)        │  │ │
│  │ │ - Lock row (FOR UPDATE)                           │  │ │
│  │ │ - Update status + timestamp                       │  │ │
│  │ │ - Replace dates                                   │  │ │
│  │ │ - Commit with audit                               │  │ │
│  │ └───────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │ ┌─ POST /calendars/{name}/upload ───────────────────┐  │ │
│  │ │ upload_calendar(name, request, user, session)     │  │ │
│  │ │ - Parse multipart (data + file)                   │  │ │
│  │ │ - Validate CSV structure & dates                  │  │ │
│  │ │ - Create or update calendar                       │  │ │
│  │ │ - Replace dates for year                          │  │ │
│  │ │ - Commit with audit                               │  │ │
│  │ └───────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │ ┌─ GET /calendars/{name}/dates ──────────────────────┐ │ │
│  │ │ get_dates(name, session, excludeCalendar)         │ │ │
│  │ │ - Fetch calendar dates                            │ │ │
│  │ │ - If exclude: set difference                      │ │ │
│  │ │ - Sort and format                                 │ │ │
│  │ └────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↓                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Repository Layer                                       │ │
│  │ (infra/database/management.py)                        │ │
│  │                                                        │ │
│  │ ManagedCalendarRepository                             │ │
│  │  - begin_write() [BEGIN IMMEDIATE or FOR UPDATE]     │ │
│  │  - get(name, lock=False)                             │ │
│  │  - page(name, migrated, limit, page)                 │ │
│  │  - replace_dates(calendar, dates, year=None)        │ │
│  │  - add(name, actor, uploaded=False)                 │ │
│  │  - uploaded()                                        │ │
│  │  - commit(calendar, action, actor)                  │ │
│  │                                                        │ │
│  │ Transaction Management:                              │ │
│  │  - SQLite: BEGIN IMMEDIATE (serialized writes)       │ │
│  │  - PostgreSQL: FOR UPDATE (row locking)              │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Database Layer                   │
        │  ┌───────────────────────────────┤
        │  │ SQLite (Local)                │
        │  │ PostgreSQL (Production)       │
        │  └───────────────────────────────┤
        │                                   │
        │  Tables:                          │
        │  ┌─ calendar                     │
        │  │  calendar_id (PK)             │
        │  │  calendar_name (UNIQUE)       │
        │  │  is_migrated (Y/N)            │
        │  │  is_uploaded (Y/N)            │
        │  │  status (A/I)                 │
        │  │  created_by, created_at       │
        │  │  updated_at                   │
        │  │                               │
        │  ├─ calendar_date                │
        │  │  (calendar_id, calendar_date) │
        │  │  PK: composite                │
        │  │  FK: calendar_id CASCADE      │
        │  │                               │
        │  └─ audit_log                    │
        │     audit_log_id (PK)            │
        │     resource_type               │
        │     resource_name               │
        │     action (CREATE/UPDATE/...)  │
        │     performed_by                │
        │     performed_at                │
        └───────────────────────────────────┘
```

---

## Request Processing Pipeline

```
1. INCOMING REQUEST
   │
   ├─ HTTP + Authorization: Bearer <token>
   ├─ Content-Type: application/json (or multipart)
   └─ Body: JSON payload
   
2. AUTHENTICATION
   │
   ├─ Extract token from header
   ├─ Verify signature & expiration
   ├─ Decode JWT claims
   ├─ Extract username & scope
   └─ Check RBAC (READ/EDITOR/ADMIN)
   
3. DEPENDENCY INJECTION
   │
   ├─ Get database session
   ├─ Get settings
   ├─ Inject principal (authenticated user)
   └─ Inject repositories
   
4. REQUEST VALIDATION
   │
   ├─ Parse JSON (Pydantic)
   ├─ Validate field types
   ├─ Check constraints (length, pattern, range)
   └─ Return 400 if invalid
   
5. BUSINESS LOGIC
   │
   ├─ Call repository methods
   ├─ Execute transactions
   ├─ Validate business rules
   └─ Handle errors
   
6. DATABASE OPERATIONS
   │
   ├─ BEGIN TRANSACTION
   ├─ Execute SQL queries
   ├─ Check conflicts/constraints
   ├─ COMMIT on success
   └─ ROLLBACK on error
   
7. RESPONSE FORMATTING
   │
   ├─ Convert DB rows to Pydantic models
   ├─ Format dates (YYYY-MM-DD → DD-MM-YYYY)
   ├─ Convert flags (Y/N → boolean)
   ├─ Serialize to JSON
   └─ Set Content-Type & status code
   
8. HTTP RESPONSE
   │
   ├─ Status code (200, 201, 400, 401, 404, 500)
   ├─ Headers (Content-Type, Location)
   └─ Body (JSON)
```

---

## Data Flow: Create Calendar Example

```
Frontend Input:
  {
    calendarName: "business-2027",
    dates: ["01-01-2027", "25-12-2027"]
  }
  
  │ 1. POST /v1/calendars
  ▼
API Validation:
  ✓ calendarName matches pattern
  ✓ Not "uploadedCalendars"
  ✓ dates valid DD-MM-YYYY
  
  │ 2. Parse dates
  ▼
Date Conversion:
  "01-01-2027" → date(2027, 1, 1)
  "25-12-2027" → date(2027, 12, 25)
  
  │ 3. Begin transaction
  ▼
Database Operations:
  
  INSERT INTO calendar (
    calendar_name, is_migrated, is_uploaded, status,
    created_by, created_at, updated_at
  ) VALUES (
    'business-2027', 'N', 'N', 'A',
    'alice', now, now
  );
  → Returns calendar_id = 42
  
  INSERT INTO calendar_date (calendar_id, calendar_date)
  VALUES (42, '2027-01-01'), (42, '2027-12-25');
  
  INSERT INTO audit_log (
    resource_type, resource_name, action, performed_by, performed_at
  ) VALUES (
    'CALENDAR', 'business-2027', 'CREATE', 'alice', now
  );
  
  │ 4. Commit
  ▼
API Response Formatting:
  
  row = ManagedCalendar(
    calendar_id=42,
    calendar_name="business-2027",
    is_migrated="N",
    is_uploaded="N",
    status="A",
    created_by="alice",
    dates=[
      ManagedDate(calendar_date=date(2027,1,1)),
      ManagedDate(calendar_date=date(2027,12,25))
    ]
  )
  
  │ 5. Convert to response
  ▼
Response Object:
  {
    calendarName: "business-2027",
    dates: ["01-01-2027", "25-12-2027"],
    migrated: false,
    uploaded: false,
    status: "ACTIVE",
    createdBy: "alice",
    createdAt: "2026-11-18T10:00:00Z",
    updatedAt: "2026-11-18T10:00:00Z"
  }
  
  │ 6. HTTP 201 Created
  ▼
Frontend:
  - Display new calendar in list
  - Show success message
  - Clear form
```

---

## Transaction Flow: SQLite vs PostgreSQL

```
SQLite (Local Development):
═════════════════════════════

Request 1 (Thread A)          Request 2 (Thread B)
   │                              │
   ├─ BEGIN IMMEDIATE ────────────┤
   │  (Acquired WRITE lock)       │
   │                              ├─ BEGIN IMMEDIATE...
   ├─ SELECT calendar_exists      │  (WAITING for WRITE lock)
   │  WHERE name = 'cal1'         │
   │  → false                     │
   │                              │
   ├─ INSERT calendar ────────────┤
   │  calendar_id = 1             │
   │                              │
   ├─ INSERT dates ───────────────┤
   │  2027-01-01, 2027-12-25      │
   │                              │
   ├─ INSERT audit_log ───────────┤
   │  action: CREATE              │
   │                              │
   ├─ COMMIT ─────────────────────┤
   │  (Released WRITE lock)       │
   │                              ├─ BEGIN IMMEDIATE
   │                              │  (Acquired WRITE lock)
   │                              ├─ SELECT calendar_exists
   │                              │  WHERE name = 'cal1'
   │                              │  → true (created by A)
   │                              ├─ INSERT calendar
   │                              │  → CONFLICT ON UNIQUE
   │                              │  → ON CONFLICT DO NOTHING
   │                              │  → returns NULL
   │                              ├─ Check if NULL → YES
   │                              ├─ SELECT calendar
   │                              │  WHERE name = 'cal1'
   │                              │  → returns row from A
   │                              ├─ Use existing calendar
   │                              ├─ COMMIT

Result: Both successful, B uses calendar created by A


PostgreSQL (Production):
════════════════════════

Request 1 (Thread A)          Request 2 (Thread B)
   │                              │
   ├─ BEGIN ──────────────────────┤
   │                              ├─ BEGIN
   ├─ SELECT ... FOR UPDATE ──────┤
   │  calendar WHERE name='cal1'  │
   │  → row-level LOCK acquired   │
   │                              ├─ SELECT ... FOR UPDATE
   ├─ INSERT calendar_date        │  calendar WHERE name='cal1'
   │  (2027-01-01, ...)           │  → WAITING for lock
   │                              │
   ├─ INSERT audit_log ───────────┤
   │                              │
   ├─ COMMIT ─────────────────────┤
   │  (Locks released)            │
   │                              ├─ Lock acquired
   │                              ├─ INSERT calendar_date
   │                              ├─ INSERT audit_log
   │                              ├─ COMMIT

Result: Serialized writes, no conflicts
```

---

## Pagination Logic

```
User Request:
  GET /v1/calendars?limit=20&offset=2

Frontend:
  page = 2 (1-based)
  
Backend Processing:
  offset = (page - 1) * limit
         = (2 - 1) * 20
         = 20
  
  SQL Query:
    SELECT * FROM calendar
    ORDER BY calendar_name COLLATE BINARY
    LIMIT 20
    OFFSET 20
    
  Count Query:
    SELECT COUNT(*) FROM calendar
    → totalItems = 42
    
Response:
  {
    calendars: [ ... 20 items ... ],
    page: 2,
    pageSize: 20,
    totalItems: 42,
    totalPages: ceil(42/20) = 3
  }
  
Display Logic:
  Page 1: items 1-20
  Page 2: items 21-40 ← Current
  Page 3: items 41-42
  
  "Showing 21-40 of 42"
```

---

## Error Response Tree

```
Request
  │
  ├─ Bad Authorization Header
  │  └─ 401 Unauthorized
  │     "Invalid or expired access token"
  │
  ├─ Insufficient Permissions
  │  └─ 403 Forbidden
  │     "You lack required role"
  │
  ├─ Invalid Request Body
  │  ├─ 400 Bad Request
  │  │  "dates[0]: Must be valid DD-MM-YYYY"
  │  │  "calendarName: Too long (>128 chars)"
  │  │  "status: Must be ACTIVE or INACTIVE"
  │  │  etc.
  │  └─ Or 415 Unsupported Media Type
  │     "Must use application/json"
  │
  ├─ Duplicate Calendar Name
  │  └─ 400 Bad Request
  │     "Calendar with this name already exists"
  │
  ├─ Calendar Not Found
  │  └─ 404 Not Found
  │     "No calendar exists with the specified name"
  │
  ├─ Upload File Too Large
  │  └─ 413 Payload Too Large
  │     "Uploaded file exceeds the limit"
  │
  ├─ Upload Invalid CSV
  │  └─ 400 Bad Request or 415 Unsupported Media Type
  │     "CSV must have 'date' header"
  │     "CSV line 5 contains a duplicate date"
  │     "The file must be text/csv"
  │
  └─ Unexpected Server Error
     └─ 500 Internal Server Error
        "An unexpected server error occurred"
        (Error logged server-side)
```

---

## Audit Trail Example

```
Action: Create calendar 'business-2027'
  │
  └─ audit_log entry
     audit_log_id:  1
     resource_type: "CALENDAR"
     resource_name: "business-2027"
     action:        "CREATE"
     performed_by:  "alice"
     performed_at:  2026-11-18 10:00:00 UTC
     
Action: Upload dates for 'business-2027' (year 2027)
  │
  └─ audit_log entry
     audit_log_id:  2
     resource_type: "CALENDAR"
     resource_name: "business-2027"
     action:        "UPLOAD"
     performed_by:  "bob"
     performed_at:  2026-11-18 11:30:00 UTC
     
Action: Update status to INACTIVE
  │
  └─ audit_log entry
     audit_log_id:  3
     resource_type: "CALENDAR"
     resource_name: "business-2027"
     action:        "UPDATE"
     performed_by:  "alice"
     performed_at:  2026-11-18 14:15:00 UTC
     
Compliance Query:
  SELECT * FROM audit_log
  WHERE resource_name = 'business-2027'
  ORDER BY performed_at;
  
  → Timeline of all changes with who made them
```

---

## Field Validation Cheat Sheet

```
Calendar Name:
  Regex:  ^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$
  Valid:  business-calendar, cal_2027, abc123
  Invalid: CALENDAR*, -start, uploadedCalendars

Calendar Date:
  Format: DD-MM-YYYY
  Valid:   01-01-2027, 31-12-2027
  Invalid: 2027-01-01, 1-1-2027, 32-13-2027

Upload Year:
  Format:  ^\d{4}$
  Valid:   2027, 2026, 1900
  Invalid: 27, 20277, 202a

CSV Header:
  Must be: date
  Invalid: Date, DATE, dates, dt

Status:
  Valid:   ACTIVE, INACTIVE
  Invalid: active, Active, ENABLED

Migrated/Uploaded Flags:
  API:      boolean (true/false)
  Database: Y/N
```

---

## Comparison: Create vs Update vs Upload

```
Operation     CREATE         UPDATE         UPLOAD
─────────────────────────────────────────────────────
Endpoint      POST           PATCH          POST
Path          /calendars     /{name}/update /{name}/upload
Input         JSON           JSON           Multipart
Dates         All at once    Replace all    Replace by year
Calendar      Always new     Must exist     Create or update
Status        Default ACTIVE User provided  Unchanged
Audit         CREATE         UPDATE         UPLOAD
Idempotent    No             Yes            No (overwrites)
Success       201 Created    200 OK         201 Created
Location      Header         -              -

Example Flow:
CREATE:  POST /v1/calendars
         {"calendarName":"cal1","dates":["01-01-2027"]}
         → 201, calendar created

UPDATE:  PATCH /v1/calendars/cal1/update
         {"calendarName":"cal1","dates":["01-01-2027","02-01-2027"],"status":"ACTIVE"}
         → 200, all dates replaced

UPLOAD:  POST /v1/calendars/cal1/upload
         Form: year=2027, file=data.csv (dates for 2027 only)
         → 201, year 2027 dates replaced
```

