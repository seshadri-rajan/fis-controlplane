# Data Models & Transformations

## Overview
This document maps data models across API schemas, database tables, frontend types, and internal representations.

---

## 1. CALENDAR DATA MODEL

### OpenAPI Schema (CalendarManagementSpec.yml)
```yaml
Calendar:
  type: object
  required: [calendarName, dates, migrated, uploaded, status, createdBy, createdAt, updatedAt]
  properties:
    calendarName:        # string, 1-128 chars, pattern: ^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$
    dates:               # array of DD-MM-YYYY strings
    migrated:            # boolean
    uploaded:            # boolean
    status:              # "ACTIVE" | "INACTIVE"
    createdBy:           # string (read-only, username)
    createdAt:           # ISO 8601 datetime UTC
    updatedAt:           # ISO 8601 datetime UTC
```

### Database Model (calendar table)
```sql
CREATE TABLE calendar (
  calendar_id        BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  calendar_name      VARCHAR(256) NOT NULL UNIQUE,
  is_migrated        CHAR(1) DEFAULT 'N',              -- 'Y' or 'N'
  is_uploaded        CHAR(1) DEFAULT 'N',              -- 'Y' or 'N'
  status             CHAR(1) DEFAULT 'A',              -- 'A' or 'I'
  created_by         VARCHAR(256) NOT NULL,            -- username
  created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### SQLAlchemy ORM Model (ManagedCalendar)
```python
class ManagedCalendar(ManagementBase):
    __tablename__ = "calendar"
    
    calendar_id: Mapped[int]
    calendar_name: Mapped[str]
    is_migrated: Mapped[str]        # 'Y' or 'N'
    is_uploaded: Mapped[str]        # 'Y' or 'N'
    status: Mapped[str]              # 'A' or 'I'
    created_by: Mapped[str]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    dates: Mapped[list[ManagedDate]]  # relationship
```

### Frontend Type (TypeScript)
```typescript
type Calendar = {
  calendarName: string;
  dates: string[];              // DD-MM-YYYY
  migrated: boolean;
  uploaded: boolean;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}
```

### Pydantic Schema (api/schemas/management.py)
```python
class CalendarResponse(BaseModel):
    calendarName: CalendarName       # str, 1-128, pattern
    dates: list[CalendarDate]        # list of DD-MM-YYYY strings
    migrated: bool
    uploaded: bool
    status: Literal["ACTIVE", "INACTIVE"]
    createdBy: str
    createdAt: datetime
    updatedAt: datetime
```

### Model Transformations

#### Database Row → API Response
```python
def calendar_response(row: ManagedCalendar, dates: list[date] | None = None) -> CalendarResponse:
    return CalendarResponse(
        calendarName=row.calendar_name,                                    # direct
        dates=[format_date(day) for day in dates or row.dates],           # DD-MM-YYYY
        migrated=row.is_migrated == "Y",                                   # 'Y' → bool
        uploaded=row.is_uploaded == "Y",                                   # 'Y' → bool
        status="ACTIVE" if row.status == "A" else "INACTIVE",             # 'A'/'I' → enum
        createdBy=row.created_by,                                          # direct
        createdAt=_utc(row.created_at),                                    # ensure UTC
        updatedAt=_utc(row.updated_at),                                    # ensure UTC
    )
```

#### API Request → Database Insert
```python
# From CreateCalendar request
body: CreateCalendar = { calendarName: "business-2027", dates: ["01-01-2027", "25-12-2027"] }

# In create_calendar()
dates = await repository.replace_dates(row, [parse_date(day) for day in body.dates])
# parse_date("01-01-2027") → datetime.date(2027, 1, 1)
```

#### Date Format Conversions
```python
# frontend → backend
"01-01-2027" (DD-MM-YYYY)
  ↓ parse_date()
date(2027, 1, 1)

# backend → frontend
date(2027, 1, 1)
  ↓ format_date()
"01-01-2027" (DD-MM-YYYY)
```

#### Status Conversions
```
API Input          Database          API Output
─────────          ────────          ──────────
"ACTIVE"      →    'A'          →    "ACTIVE"
"INACTIVE"    →    'I'          →    "INACTIVE"
```

#### Boolean Conversions
```
API Input          Database          API Output
─────────          ────────          ──────────
true          →    'Y'          →    true
false         →    'N'          →    false
```

---

## 2. CALENDAR DATE DATA MODEL

### OpenAPI Schema
```yaml
CalendarDate:
  type: string
  pattern: '^[0-9]{2}-[0-9]{2}-[0-9]{4}$'
  example: '25-12-2027'

CalendarDates:
  type: array
  uniqueItems: true
  items:
    $ref: '#/components/schemas/CalendarDate'
  example: ['01-01-2027', '25-12-2027']
```

### Database Model (calendar_date table)
```sql
CREATE TABLE calendar_date (
  calendar_id  BIGINT NOT NULL REFERENCES calendar (calendar_id) ON DELETE CASCADE,
  calendar_date DATE NOT NULL,
  PRIMARY KEY (calendar_id, calendar_date)
);
```

### SQLAlchemy ORM Model
```python
class ManagedDate(ManagementBase):
    __tablename__ = "calendar_date"
    
    calendar_id: Mapped[int]       # FK
    calendar_date: Mapped[date]    # Python date object
```

### Frontend Type
```typescript
type CalendarDates = string[];  // DD-MM-YYYY format
```

### Transformations

#### API Response (array)
```python
# From database
calendar.dates  # list[ManagedDate]
↓
[format_date(entry.calendar_date) for entry in calendar.dates]
↓
["01-01-2027", "25-12-2027"]
```

#### CSV Upload Parse
```
CSV File          Parser           Database Insert
──────────────────────────────────────────────────
date              Header check     ✓
01-01-2027    →   parse_date()  →  date(2027, 1, 1)
25-12-2027    →   parse_date()  →  date(2027, 12, 25)
31-12-2027    →   parse_date()  →  date(2027, 12, 31)
```

---

## 3. REQUEST/RESPONSE MODELS

### CreateCalendar Request
```python
class CreateCalendar(BaseModel):
    calendarName: CalendarName                      # required
    dates: list[CalendarDate] = []                  # optional, default []

# Example
{
  "calendarName": "business-2027",
  "dates": ["01-01-2027", "25-12-2027"]
}
```

### UpdateCalendar Request
```python
class UpdateCalendar(BaseModel):
    calendarName: CalendarName                      # required, must match path
    dates: list[CalendarDate] = []                  # optional, default []
    status: CalendarStatus                          # required

# Example
{
  "calendarName": "business-2027",
  "dates": ["01-01-2027", "25-12-2027"],
  "status": "ACTIVE"
}
```

### CalendarPage Response
```python
class CalendarPage(BaseModel):
    calendars: list[CalendarResponse]
    page: int                                       # 1-based
    pageSize: int
    totalItems: int
    totalPages: int

# Example
{
  "calendars": [
    { calendarName: "...", dates: [...], ... }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 42,
  "totalPages": 3
}
```

### UploadedCalendars Response
```python
class UploadedCalendar(BaseModel):
    name: CalendarName
    migrated: bool

# Example
[
  { "name": "business-calendar", "migrated": false },
  { "name": "nyse-calendar", "migrated": true }
]
```

### ErrorResponse
```python
class ErrorResponse(BaseModel):
    status: Literal['400', '401', '403', '404', '413', '415', '500']
    error: str                                      # HTTP status phrase
    message: str                                    # Human-readable error
    details: list[ValidationError] | None           # optional field errors

class ValidationError(BaseModel):
    field: str                                      # JSON path or form field
    message: str                                    # Error detail

# Example
{
  "status": "400",
  "error": "Bad Request",
  "message": "Request validation failed.",
  "details": [
    {
      "field": "dates[0]",
      "message": "Must be a valid date in DD-MM-YYYY format."
    }
  ]
}
```

---

## 4. PAGINATION MODEL

### Query Parameters
```python
class PaginationQuery(BaseModel):
    limit: int = 20                     # 1-100
    offset: int = 1                     # 1-2147483647
```

### Pagination Calculation
```python
# Input: page number (1-based), limit
# SQL calculation:
offset_rows = (page - 1) * limit
OFFSET offset_rows LIMIT limit

# Response:
page = offset                           # 1-based page number
pageSize = limit                        # items per page
totalItems = count(*)                   # total rows
totalPages = ceil(totalItems / limit)   # max pages

# Example
totalItems = 42, limit = 20
totalPages = ceil(42 / 20) = 3
pages: 1 (20 items), 2 (20 items), 3 (2 items)
```

---

## 5. UPLOAD METADATA MODEL

### Request Format (multipart/form-data)
```python
class UploadMetadata(BaseModel):
    year: str                           # Pattern: ^\d{4}$

# multipart fields
data: UploadMetadata                   # JSON blob, max 4096 bytes
file: UploadFile                       # CSV file
```

### CSV Format
```
CSV Structure:
  Row 1 (header):  date
  Row 2+:          DD-MM-YYYY date values

Validation:
  - Exactly 1 column
  - Column header must be "date"
  - Each row has exactly 1 field
  - All dates valid DD-MM-YYYY
  - All dates in specified year
  - No duplicates
  - At least 1 date row
  - UTF-8 encoding

Constraints:
  - File size: <= upload_max_bytes (config)
  - File type: text/csv
  - Multipart size: file + 64KB buffer
```

### Processing Pipeline
```
CSV File
   ↓
read_upload()
   ├─ Parse multipart container
   ├─ Extract data: { year: "2027" }
   ├─ Extract file: CSV bytes
   ├─ Validate media types
   ├─ Check file size
   ↓
_read_csv(raw_bytes, year)
   ├─ Decode UTF-8
   ├─ Parse CSV rows
   ├─ Validate header
   ├─ For each data row:
   │  ├─ Parse DD-MM-YYYY
   │  ├─ Check in year
   │  ├─ Check no duplicates
   │  ├─ Collect dates
   ├─ Sort dates
   ↓
list[date]  → Backend service
   ↓
Database: INSERT into calendar_date
```

---

## 6. AUDIT LOG DATA MODEL

### Database Model (audit_log table)
```sql
CREATE TABLE audit_log (
  audit_log_id  BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  resource_type VARCHAR(256),                -- "CALENDAR"
  resource_name VARCHAR(256),                -- calendar name
  action        VARCHAR(256) NOT NULL,       -- "CREATE", "UPDATE", "UPLOAD"
  performed_by  VARCHAR(256) NOT NULL,       -- username
  performed_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### SQLAlchemy Model
```python
class ManagementAudit(ManagementBase):
    __tablename__ = "audit_log"
    
    audit_log_id: Mapped[int]
    resource_type: Mapped[str | None]       # "CALENDAR"
    resource_name: Mapped[str | None]       # calendar name
    action: Mapped[str]                      # CREATE, UPDATE, UPLOAD
    performed_by: Mapped[str]                # username
    performed_at: Mapped[datetime]
```

### Audit Entry Creation
```python
await repository.commit(calendar, action, user.username)
# → Inserts:
# ManagementAudit(
#   resource_type="CALENDAR",
#   resource_name=calendar.calendar_name,
#   action="CREATE" | "UPDATE" | "UPLOAD",
#   performed_by=user.username,
#   performed_at=func.now()
# )
# → Commits transaction
```

### Audit Log Queries
```sql
-- Find all actions by user
SELECT * FROM audit_log WHERE performed_by = 'alice' ORDER BY performed_at DESC;

-- Find calendar change history
SELECT * FROM audit_log WHERE resource_name = 'business-2027' ORDER BY performed_at;

-- Find all UPLOAD events
SELECT * FROM audit_log WHERE action = 'UPLOAD' ORDER BY performed_at DESC;

-- Count actions by user (last 7 days)
SELECT performed_by, COUNT(*) as count
FROM audit_log
WHERE performed_at >= NOW() - INTERVAL '7 days'
GROUP BY performed_by;
```

---

## 7. FIELD VALIDATION RULES

### CalendarName Validation
```
Pattern:    ^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$
Length:     1-128 characters
Start:      Letter or digit
Contains:   Letters, digits, underscore, hyphen
Reserved:   "uploadedCalendars" (not allowed)
Case:       Sensitive (business-2027 ≠ BUSINESS-2027)
Spaces:     Not allowed
Unique:     Yes (UNIQUE constraint)

Valid:   "business-calendar", "calendar_2027", "cal-1"
Invalid: "CALENDAR*", "calendar name", "uploadedCalendars", "-calendar"
```

### CalendarDate Validation
```
Pattern:   ^[0-9]{2}-[0-9]{2}-[0-9]{4}$
Format:    DD-MM-YYYY
Examples:  "01-01-2027", "31-12-2027"

Parsing:
  - Split by '-'
  - Parse day (01-31), month (01-12), year (0000-9999)
  - Validate using datetime.date()
  - Throw ValueError if invalid

Invalid:  "2027-01-01", "1-1-2027", "32-13-2027"
```

### Status Validation
```
Allowed values:
  - "ACTIVE"    → stored as 'A'
  - "INACTIVE"  → stored as 'I'

Validation: enum check in Pydantic model
```

### Year Validation (CSV Upload)
```
Pattern:   ^\d{4}$
Range:     0000-9999
Example:   "2027"

Rule:      All CSV dates must be in this year
           Jan 1 to Dec 31 of specified year
```

---

## 8. TIMEZONE HANDLING

### Database Storage
```
Column Type:    TIMESTAMPTZ (timestamp with timezone)
Storage:        Always UTC internally
Server Default: CURRENT_TIMESTAMP (database server time, UTC)
```

### Python Conversion
```python
def _utc(value: datetime | None) -> datetime | None:
    """SQLite returns naive datetimes where PostgreSQL returns aware ones."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)
```

### API Response
```
JSON Serialization: ISO 8601 format with 'Z' (UTC marker)
Example: "2026-11-03T10:00:00Z"
```

### Frontend Handling
```typescript
// ISO 8601 string
createdAt: "2026-11-03T10:00:00Z"

// JavaScript Date object
new Date("2026-11-03T10:00:00Z")
// → Automatically converts to local timezone for display
```

---

## 9. MULTI-DATABASE TYPE CONVERSIONS

### SQLAlchemy Type Configuration
```python
# PkType: Identity handling
PkType = BigInteger().with_variant(Integer, "sqlite")
# SQLite: INTEGER PRIMARY KEY (auto-increment)
# PostgreSQL: BIGINT (needs IDENTITY)

# Timestamp: Timezone awareness
Timestamp = DateTime(timezone=True)
# SQLite: DATETIME (naive, Python handles UTC)
# PostgreSQL: TIMESTAMPTZ (aware)

# JSON: JSONB variant
JsonType = JSON(none_as_null=True).with_variant(JSONB(none_as_null=True), "postgresql")
# SQLite: JSON text
# PostgreSQL: JSONB binary (faster)
```

### Date Handling
```python
# Backend representation: Python date object
date(2027, 1, 1)

# Database storage
SQLite:      "2027-01-01"
PostgreSQL:  2027-01-01

# API representation
"01-01-2027"  (DD-MM-YYYY)
```

---

## 10. IDENTITY FIELD HANDLING

### Primary Key Generation

#### SQLite
```sql
CREATE TABLE calendar (
  calendar_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ...
)
-- SQLite auto-increments INTEGER PRIMARY KEY automatically
-- BigInteger → Integer variant for SQLite
```

#### PostgreSQL
```sql
CREATE TABLE calendar (
  calendar_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ...
)
-- PostgreSQL: GENERATED ALWAYS AS IDENTITY (explicit sequence)
-- BIGINT maintains 64-bit precision
```

### ORM Configuration
```python
calendar_id: Mapped[int] = mapped_column(PkType, Identity(always=True), primary_key=True)
# PkType handles dialect-specific types
# Identity(always=True) → GENERATED ALWAYS AS IDENTITY
```

---

## 11. COLLATION & SORTING

### Calendar Name Ordering

#### SQLite
```sql
ORDER BY calendar_name COLLATE BINARY
-- Binary comparison: exact byte order
-- A-Z < a-z (uppercase first)
```

#### PostgreSQL
```sql
ORDER BY calendar_name COLLATE "C"
-- C locale: C language collation
-- Similar to binary: exact order
```

### Sort Stability
```python
# Consistent ordering across databases
query.order_by(ManagedCalendar.calendar_name.collate(collation))
# where: collation = "BINARY" (SQLite) or "C" (PostgreSQL)

# Result: Same sort order on both databases
```

---

## 12. NULL HANDLING

### JSON NULL vs SQL NULL
```python
JsonType = JSON(none_as_null=True).with_variant(JSONB(...), "postgresql")
# none_as_null=True → Python None becomes SQL NULL (not JSON 'null')

# Example:
{ "rule_params": None }  → rule_params IS NULL (not stored as 'null' string)
```

### Optional Fields
```python
class Calendar(BaseModel):
    dates: list[CalendarDate] = []      # defaults to empty array
    status: str                          # required

# NULL handling in queries:
dates: Mapped[list] | None = mapped_column(...)
# If NULL in DB → empty list in Python
```

---

## 13. TRANSACTION SEMANTICS & ISOLATION

### ACID Guarantees

**Atomicity**
```python
# All-or-nothing: insert + date replacement + audit in one transaction
async with session.begin():  # FastAPI session scope
    await repository.add(name, actor)
    await repository.replace_dates(...)
    await repository.commit(calendar, action, actor)
# Either all 3 succeed or all 3 rollback
```

**Consistency**
```
Before: calendar_id exists
After:  calendar_id + N date rows + audit row all written
Violation: Would leave calendar without dates if insert fails
Solution: Transaction boundary prevents partial state
```

**Isolation**
```
SQLite:      SERIALIZABLE (all writes queued)
PostgreSQL:  REPEATABLE READ (row locks prevent dirty reads)
Result:      No dirty reads, phantom reads, or non-repeatable reads
```

**Durability**
```
After COMMIT returns, data is durable
Database fsync ensures disk write (unless disabled)
```

