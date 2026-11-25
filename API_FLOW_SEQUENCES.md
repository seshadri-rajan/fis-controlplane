# API Flow Sequences

## Core User Journeys & Technical Flows

---

## 1. CREATE CALENDAR FLOW

### Sequence Diagram
```
Frontend                    Backend API              Repository           Database
   │                            │                        │                   │
   ├─ POST /calendars ──────────┤                        │                   │
   │  {name, dates}             │                        │                   │
   │                            ├─ Validate name ────────┤                   │
   │                            │                        │                   │
   │                            ├─ begin_write() ───────┤                   │
   │                            │  (BEGIN IMMEDIATE)     ├─ BEGIN IMMEDIATE ┤
   │                            │                        │                   │
   │                            ├─ add(name) ───────────┤                   │
   │                            │                        ├─ INSERT calendar ─┤
   │                            │                        │  RETURNING row    │
   │                            │                        │◄─────── row ──────┤
   │                            │◄─── calendar obj ──────┤                   │
   │                            │                        │                   │
   │                            ├─ replace_dates() ─────┤                   │
   │                            │                        ├─ DELETE old dates ┤
   │                            │                        │  (year filter)    │
   │                            │                        ├─ INSERT new dates ┤
   │                            │                        │                   │
   │                            ├─ commit() ────────────┤                   │
   │                            │                        ├─ INSERT audit log ┤
   │                            │                        ├─ COMMIT ──────────┤
   │                            │                        │                   │
   │◄─ 201 Created ─────────────┤                        │                   │
   │  {calendar object}         │                        │                   │
   │                            │                        │                   │
```

### Error Cases
- **400**: Duplicate calendar name, invalid dates, invalid name format
- **401**: Missing/invalid OAuth token
- **403**: User role not EDITOR/ADMIN

---

## 2. UPDATE CALENDAR FLOW

### Sequence Diagram
```
Frontend                    Backend API              Repository           Database
   │                            │                        │                   │
   ├─ PATCH /calendars/name ────┤                        │                   │
   │  {name, dates, status}     │  /update               │                   │
   │                            │                        │                   │
   │                            ├─ Validate name ───────┤                   │
   │                            │  match path            │                   │
   │                            │                        │                   │
   │                            ├─ begin_write() ───────┤                   │
   │                            │                        ├─ BEGIN IMMEDIATE ┤
   │                            │                        │                   │
   │                            ├─ get(name, lock=T) ───┤                   │
   │                            │                        ├─ SELECT FOR UPDATE
   │                            │                        │  (wait for lock)  │
   │                            │◄─── row (locked) ──────┤                   │
   │                            │                        │                   │
   │                            ├─ Update status ──────┤                   │
   │                            │  row.status = 'A'     │                   │
   │                            │                        │                   │
   │                            ├─ Update timestamp ───┤                   │
   │                            │  row.updated_at       │                   │
   │                            │                        │                   │
   │                            ├─ replace_dates() ─────┤                   │
   │                            │  (all dates, no year)  ├─ DELETE all dates ┤
   │                            │                        ├─ INSERT new dates ┤
   │                            │                        │                   │
   │                            ├─ commit() ────────────┤                   │
   │                            │                        ├─ INSERT audit log ┤
   │                            │                        │  action: UPDATE   │
   │                            │                        ├─ COMMIT ──────────┤
   │                            │                        │                   │
   │◄─ 200 OK ──────────────────┤                        │                   │
   │  {updated calendar}        │                        │                   │
   │                            │                        │                   │
```

### Note on Status Update
- Status stored as 'A' (ACTIVE) or 'I' (INACTIVE)
- API converts: "ACTIVE" ↔ 'A', "INACTIVE" ↔ 'I'
- Updated calendar returned with all current dates

---

## 3. UPLOAD CSV FLOW

### Sequence Diagram
```
Frontend                    Backend API              Repository           Database
   │                            │                        │                   │
   ├─ POST /calendars/name ────┤                        │                   │
   │  multipart/form-data       │  /upload               │                   │
   │  - data: {year: "2027"}    │                        │                   │
   │  - file: (CSV)             │                        │                   │
   │                            │                        │                   │
   │                            ├─ read_upload() ──────┤                   │
   │                            │  - Parse multipart    │                   │
   │                            │  - Validate CSV       │                   │
   │                            │  - Parse dates        │                   │
   │                            │  - Check duplicates   │                   │
   │                            │  - Verify year match  │                   │
   │◄─ OK if validation fails ──┤                        │                   │
   │                            │                        │                   │
   │                            ├─ begin_write() ───────┤                   │
   │                            │                        ├─ BEGIN IMMEDIATE ┤
   │                            │                        │                   │
   │                            ├─ get(name, lock=T) ───┤                   │
   │                            │                        ├─ SELECT FOR UPDATE
   │                            │                        │                   │
   │                   ┌─ exists? ◄────── row? ◄────────┤                   │
   │                   │          │                        │                   │
   │                   ├─ No: create ──────┤                   │
   │                   │  add(name, uploaded=T) ├─ INSERT new ┤
   │                   │          │                        │  calendar       │
   │                   │          │                        │◄─────────────────┤
   │                   │          │                        │                   │
   │                   └─ Yes: skip timestamp
   │                            │                        │                   │
   │                            ├─ replace_dates(year) ┤                   │
   │                            │  - DELETE year 2027   ├─ DELETE dates  ───┤
   │                            │  - INSERT 3 new       │  WHERE year=2027   │
   │                            │                        ├─ INSERT new dates ┤
   │                            │                        │                   │
   │                            ├─ commit() ────────────┤                   │
   │                            │                        ├─ INSERT audit log ┤
   │                            │                        │  action: UPLOAD   │
   │                            │                        ├─ COMMIT ──────────┤
   │                            │                        │                   │
   │◄─ 201 Created ──────────────┤                        │                   │
   │  {updated calendar}        │                        │                   │
   │                            │                        │                   │
```

### CSV Validation Rules
1. Single column with header "date"
2. All dates in DD-MM-YYYY format
3. All dates in specified year
4. No duplicate dates
5. At least 1 date row
6. UTF-8 encoding

---

## 4. LIST CALENDARS FLOW

### Sequence Diagram
```
Frontend                Backend API              Repository           Database
   │                        │                        │                   │
   ├─ GET /calendars ──────┤                        │                   │
   │  ?limit=20             │  ?offset=1              │                   │
   │  &calendarName=bus     │  &migrated=true         │                   │
   │  &migrated=true        │                        │                   │
   │                        │                        │                   │
   │                        ├─ page() ──────────────┤                   │
   │                        │                        │                   │
   │                        │                        ├─ Build WHERE ─────┤
   │                        │                        │  - instr/strpos    │
   │                        │                        │  - migrated flag   │
   │                        │                        │                   │
   │                        │                        ├─ Count total ─────┤
   │                        │  COUNT(*) result ◄─────┤  SELECT COUNT(*)  │
   │                        │                        │                   │
   │                        │                        ├─ Fetch page ──────┤
   │                        │                        │  ORDER BY name    │
   │                        │                        │  COLLATE BINARY   │
   │                        │                        │  OFFSET 0 LIMIT 20
   │                        │                        │                   │
   │                        │  rows + total ◄────────┤◄──────────────────┤
   │                        │                        │                   │
   │                        ├─ Format response ─────┤                   │
   │                        │  - calendar_response() │                   │
   │                        │  - Convert dates      │                   │
   │                        │                        │                   │
   │◄─ 200 OK ──────────────┤                        │                   │
   │  {CalendarPage}        │                        │                   │
   │  - calendars: [...]    │                        │                   │
   │  - page: 1             │                        │                   │
   │  - pageSize: 20        │                        │                   │
   │  - totalItems: 42      │                        │                   │
   │  - totalPages: 3       │                        │                   │
   │                        │                        │                   │
```

### Pagination Logic
- page = offset (1-based)
- offset = (page - 1) * limit
- totalPages = ceil(totalItems / limit)

---

## 5. GET CALENDAR DATES WITH EXCLUSION FLOW

### Sequence Diagram
```
Frontend                Backend API              Repository           Database
   │                        │                        │                   │
   ├─ GET /calendars/main ─┤                        │                   │
   │  /dates                │                        │                   │
   │  ?excludeCalendar=exc  │                        │                   │
   │                        │                        │                   │
   │                        ├─ get_dates() ────────┤                   │
   │                        │                        │                   │
   │                        ├─ get("main") ────────┤                   │
   │                        │                        ├─ SELECT main ─────┤
   │                        │  calendar row ◄────────┤                   │
   │                        │                        │                   │
   │                        ├─ Extract dates ──────┤                   │
   │                        │  dates_set = {all}    │                   │
   │                        │                        │                   │
   │             ┌─ exclude? ──┐                        │                   │
   │             │ (if yes)    │                        │                   │
   │             │             │                        │                   │
   │             ├─ get("exc") ┤                        │                   │
   │             │             ├─ SELECT exc ──────────┤
   │             │             │  excluded calendar    │
   │             │             │◄──────────────────────┤
   │             │             │                        │                   │
   │             ├─ Set diff ──┤                        │                   │
   │             │ dates - exc │                        │                   │
   │             └─────┬───────┘                        │                   │
   │                   │                        │                   │
   │                   ├─ Sort ascending ─────┤                   │
   │                   │  dates = sorted()     │                   │
   │                   │                        │                   │
   │◄─ 200 OK ─────────┤                        │                   │
   │  [dates as array] │                        │                   │
   │  sorted, formatted │                        │                   │
   │  DD-MM-YYYY       │                        │                   │
   │                   │                        │                   │
```

### Edge Cases
- If main calendar not found: 404
- If excludeCalendar not found: 404
- If excludeCalendar == calendar_name: return []
- Empty calendar: return []

---

## 6. TRANSACTION ISOLATION: SQLite vs PostgreSQL

### SQLite Behavior (Local Dev)
```
Write Request 1                Write Request 2
     │                             │
     ├─ BEGIN IMMEDIATE ───────────┤
     │  (serializes all writes)    │
     │                             ├─ Wait for IMMEDIATE...
     ├─ Read                       │
     ├─ Modify                     │
     ├─ Write                      │
     ├─ COMMIT                     │
     │                             ├─ BEGIN IMMEDIATE
     │                             ├─ Read
     │                             ├─ Modify
     │                             ├─ Write
     │                             ├─ COMMIT
```

### PostgreSQL Behavior (Production)
```
Write Request 1                Write Request 2
     │                             │
     ├─ BEGIN TRANSACTION ─────────┤
     │  SELECT FOR UPDATE          │
     ├─ Lock row ───────────────────┤
     │                             ├─ Wait for lock release
     ├─ Read                       │
     ├─ Modify                     │
     ├─ Write                      │
     ├─ COMMIT (releases lock) ────┤
     │                             ├─ Acquire lock
     │                             ├─ Read
     │                             ├─ Modify
     │                             ├─ Write
     │                             ├─ COMMIT
```

### Key Difference
- **SQLite**: All writes in queue (single writer)
- **PostgreSQL**: Row-level locks (multiple readers, serialized writes)

---

## 7. AUDIT LOG ENTRY

Every write operation creates an audit_log entry:

### Entry Structure
```sql
INSERT INTO audit_log (
  resource_type,    -- "CALENDAR"
  resource_name,    -- calendar name
  action,           -- "CREATE" | "UPDATE" | "UPLOAD"
  performed_by,     -- username from OAuth token
  performed_at      -- CURRENT_TIMESTAMP
) VALUES (...)
```

### Actions
- **CREATE**: New calendar created
- **UPDATE**: Calendar dates or status changed
- **UPLOAD**: CSV dates uploaded for a year

### Use Cases
- Compliance auditing
- Change history
- Debugging failed operations
- User attribution

---

## 8. ERROR RESPONSE FLOW

### Validation Error (400)
```
Request                     Backend                Response
   │                            │                      │
   ├─ POST /calendars ─────────┤                      │
   │  {invalid dates}           │                      │
   │                            ├─ Parse dates ──┐    │
   │                            │  "32-13-2027"  │    │
   │                            │                 ├─ FAIL
   │                            │◄────────────────┘    │
   │                            │                      │
   │◄─ 400 Bad Request ─────────┤                      │
   │  {                          │                      │
   │    "status": "400",         │                      │
   │    "error": "Bad Request",  │                      │
   │    "message": "...",        │                      │
   │    "details": [{            │                      │
   │      "field": "dates[0]",   │                      │
   │      "message": "Must be    │                      │
   │       valid DD-MM-YYYY"     │                      │
   │    }]                       │                      │
   │  }                          │                      │
```

### Authentication Error (401)
```
Request                     Backend                Response
   │                            │                      │
   ├─ GET /calendars ──────────┤                      │
   │  (no auth header)          │                      │
   │                            ├─ Check token ──┐    │
   │                            │  (missing)      │    │
   │                            │                 ├─ FAIL
   │                            │◄────────────────┘    │
   │                            │                      │
   │◄─ 401 Unauthorized ────────┤                      │
   │  WWW-Authenticate: Bearer  │                      │
   │  {                          │                      │
   │    "status": "401",         │                      │
   │    "message": "..."         │                      │
   │  }                          │                      │
```

### Not Found Error (404)
```
Request                     Backend                Response
   │                            │                      │
   ├─ GET /calendars/nonexist ─┤                      │
   │                            ├─ Query calendar ──┐ │
   │                            │  WHERE name=...  │ │
   │                            │  (no row)         │ │
   │                            │                 ├─ FAIL
   │                            │◄────────────────┘    │
   │                            │                      │
   │◄─ 404 Not Found ───────────┤                      │
   │  {                          │                      │
   │    "status": "404",         │                      │
   │    "message": "No calendar  │                      │
   │     exists with..."         │                      │
   │  }                          │                      │
```

---

## 9. UPLOAD FILE SIZE CONSTRAINT FLOW

```
Client                                    Server
  │                                          │
  ├─ POST multipart ──────────────────────┤
  │  chunk 1 (data: 100 bytes)             │ ├─ Accumulate in parser
  │                                        │ ├─ received = 100
  │  chunk 2 (file: 1MB)                  │ ├─ received = 1MB + 100
  │                                        │ ├─ Check: 1MB + 100 <= limit?
  │  chunk 3 (file continued)              │ │
  │  ...                                   │ ├─ File total exceeds limit?
  │  (total: 11MB)                         │ ├─ received > limit + 64KB?
  │                                        │ ├─ YES: raise UploadTooLarge
  │◄─ 413 Payload Too Large ──────────────┤
  │  "Uploaded file exceeds the limit."   │
  │                                        │
```

### Limits
- Part size: 4KB (data) or configured (file)
- File upload: Configurable via `upload_max_bytes`
- Tolerance: file + 64KB buffer before 413

---

## 10. CONCURRENCY SCENARIO: Duplicate Creation

### Race Condition Handling
```
Request A (Thread 1)         Request B (Thread 2)
     │                             │
     ├─ BEGIN IMMEDIATE ──────────┤
     │  (got lock)                │
     │                            ├─ BEGIN IMMEDIATE...
     │                            │ (waiting for lock)
     ├─ SELECT calendar ─┐        │
     │  (doesn't exist)  │        │
     │                   ├─ INSERT│
     │  calendar added   │        │
     │                   ├─ FLUSH │
     ├─ COMMIT ──────────────────┤
     │  (releases lock)           │
     │                            ├─ Got lock!
     │                            ├─ BEGIN IMMEDIATE
     │                            ├─ SELECT calendar
     │                            │  (now exists!)
     │                            ├─ INSERT calendar
     │                            │  ON CONFLICT DO NOTHING
     │                            │  → returns None
     │                            ├─ Check: row is None?
     │                            │  YES: re-query
     │                            ├─ SELECT calendar (locked)
     │                            │  (returns created row)
     │                            ├─ Use existing
     │                            ├─ COMMIT
     │                            │
```

**Result**: Second request succeeds by detecting and using the row created by first request.

---

## 11. API VERSIONING & ROUTES

### Current Version
- Base path: `/v1` (OpenAPI spec requirement)
- All endpoints prefixed with `/v1`

### Future Versions
If `/v2` needed:
1. Create new router module: `api/v2/calendars.py`
2. Include in main.py: `app.include_router(v2_router)`
3. Maintain both `/v1` and `/v2` simultaneously
4. Deprecation timeline: 1-2 versions

---

## 12. AUTHENTICATION HEADER FLOW

### Bearer Token Processing
```
Frontend                                Backend
  │                                      │
  ├─ Authorization: Bearer <token> ─────┤
  │                                      ├─ Extract token from header
  │                                      ├─ Call token_verifier.verify(token)
  │                                      ├─ Decode JWT
  │                                      ├─ Validate signature
  │                                      ├─ Check expiration
  │                                      │
  │                            ┌─ Valid? ─┐
  │                            │ (yes)    │
  │                            ├─ Extract claims
  │                            ├─ username = claims.sub
  │                            ├─ scope = claims.scope
  │                            │
  │                            ├─ Check scope ──┐
  │                            │ for operation: ├─ READ/EDITOR/ADMIN
  │                            │                │
  │                            └─ Inject into │
  │                              request ctx │
  │                                         │
  │◄─ Allowed or 403 ───────────────────┤
  │  (or 401 if invalid)                 │
```

### Role-Based Access Control
```
Operation          Required Role(s)
─────────────────  ─────────────────
GET                READ
POST /calendars    EDITOR, ADMIN
PATCH /calendars   EDITOR, ADMIN
POST /upload       EDITOR, ADMIN
```

