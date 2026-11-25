# Backend Flows Analysis - Complete Documentation Index

## 📋 Documentation Overview

This analysis provides a comprehensive breakdown of the Calendar Management service, mapping the OpenAPI specification through the backend implementation to database operations and frontend integration.

---

## 📄 Documentation Files

### 1. **BACKEND_FLOWS_ANALYSIS.md** (Main Reference)
Complete end-to-end analysis of all backend flows.

**Sections:**
- API Endpoints (from CalendarManagementSpec.yml)
- Database Schema (from CalendarManagementSchema.sql)
- Backend Service Architecture
  - Entry point and lifespan management
  - API layer with 7 endpoint implementations
  - Detailed flow for each endpoint
  - Database persistence layer (ManagedCalendarRepository)
- Frontend to Backend API Flow (TypeScript client)
- End-to-end flow examples (4 scenarios)
- Transaction & consistency models
- Error handling
- Design patterns summary
- Configuration & settings
- Endpoint mapping table

**Best for:** Understanding the complete architecture and how requests flow through the system.

---

### 2. **API_FLOW_SEQUENCES.md** (Visual Reference)
Sequence diagrams and detailed flows for each operation.

**Sections:**
- Create Calendar Flow (with error cases)
- Update Calendar Flow (with locking)
- Upload CSV Flow (with validation)
- List Calendars Flow (with pagination)
- Get Calendar Dates with Exclusion
- Transaction Isolation (SQLite vs PostgreSQL)
- Audit Log Entry Structure
- Error Response Flows (400, 401, 404)
- Upload File Size Constraint
- Concurrency Scenario (Duplicate Creation)
- API Versioning & Routes
- Authentication Header Flow

**Best for:** Visual learners, understanding flow logic, and error handling paths.

---

### 3. **DATA_MODELS_TRANSFORMATIONS.md** (Reference)
Data model definitions and transformations across all layers.

**Sections:**
- Calendar Data Model (OpenAPI → DB → ORM → TypeScript)
- Calendar Date Model
- Request/Response Models (CreateCalendar, UpdateCalendar, etc.)
- Pagination Model & Calculation
- Upload Metadata Model & CSV Processing
- Audit Log Model
- Field Validation Rules
- Timezone Handling
- Multi-Database Type Conversions
- Identity Field Handling
- Collation & Sorting
- NULL Handling
- Transaction Semantics & ACID Guarantees

**Best for:** Understanding data transformations, validation, and type safety.

---

## 🔄 Core Flows at a Glance

### Quick Reference Table

| Operation | Method | Auth | DB Ops | Audit | Notes |
|-----------|--------|------|--------|-------|-------|
| **Create Calendar** | POST /v1/calendars | EDITOR | INSERT cal + dates | CREATE | Returns 201 |
| **List Calendars** | GET /v1/calendars | READ | SELECT paginated | - | Supports filtering |
| **Get Calendar** | GET /v1/calendars/{name} | READ | SELECT one | - | Returns full calendar |
| **Update Calendar** | PATCH /v1/calendars/{name}/update | EDITOR | UPDATE cal + dates | UPDATE | Replaces all dates |
| **Upload CSV** | POST /v1/calendars/{name}/upload | EDITOR | INSERT/UPDATE + dates | UPLOAD | Creates if not exists |
| **Get Dates** | GET /v1/calendars/{name}/dates | READ | SELECT dates | - | Supports exclusion |
| **List Uploaded** | GET /v1/calendars/uploadedCalendars | READ | SELECT uploaded | - | Returns name + migrated |

---

## 🏗️ Architecture Layers

### Request → Response Journey

```
1. Frontend (React/TypeScript)
   ↓
2. HTTP Request + Bearer Token
   ↓
3. FastAPI Main App (main.py)
   - Lifespan: OAuth verifier, schema creation
   - Error handlers: validation, HTTP, general
   ↓
4. API Layer (api/v1/calendars.py, upload.py)
   - Request validation (Pydantic schemas)
   - Authentication check (get_principal)
   - Business logic
   ↓
5. Repository Layer (infra/database/management.py)
   - Transaction management (BEGIN IMMEDIATE or FOR UPDATE)
   - Database operations
   ↓
6. Database (SQLite/PostgreSQL)
   - calendar table
   - calendar_date table
   - audit_log table
   ↓
7. Response Serialization
   - Convert DB rows to Pydantic models
   - Format dates (YYYY-MM-DD → DD-MM-YYYY)
   - Convert flags (Y/N → boolean, A/I → ACTIVE/INACTIVE)
   ↓
8. HTTP Response (JSON + status code)
   ↓
9. Frontend UI Update
```

---

## 🔐 Security & Authentication

### OAuth Flow
```
1. User logs in with identity provider (external)
2. Receives OAuth access token (JWT)
3. Includes in Authorization header: "Bearer <token>"
4. Backend verifies token signature & expiration
5. Extracts username from claims
6. Checks RBAC: READ, EDITOR, ADMIN
7. Injects principal into request context
8. Endpoint uses for audit trail
```

### Role-Based Access Control (RBAC)
```
READ:   GET operations (list, get, dates, uploaded calendars)
EDITOR: POST/PATCH/PUT (create, update, upload) 
ADMIN:  POST/PATCH/PUT (all write operations)
```

---

## 💾 Database Schema Summary

### Three Main Tables

**calendar**
- PK: calendar_id (auto-increment)
- Unique: calendar_name
- Flags: is_migrated (Y/N), is_uploaded (Y/N), status (A/I)
- Metadata: created_by, created_at, updated_at

**calendar_date**
- PK: (calendar_id, calendar_date)
- Stores: Date per calendar
- Unique dates per calendar (enforced by PK)
- Cascade delete with calendar

**audit_log**
- PK: audit_log_id (auto-increment)
- Tracks: resource_type, resource_name, action, performed_by, performed_at
- Actions: CREATE, UPDATE, UPLOAD

---

## 🔄 Data Transformations

### Key Conversions

| Layer | Type | Format | Notes |
|-------|------|--------|-------|
| API Input | Date | DD-MM-YYYY | User input format |
| Database | Date | YYYY-MM-DD | Python date object |
| API Output | Date | DD-MM-YYYY | JSON response |
| **Status** | | | |
| API Input | Status | "ACTIVE"/"INACTIVE" | Enum string |
| Database | Status | 'A'/'I' | Single char |
| API Output | Status | "ACTIVE"/"INACTIVE" | Enum string |
| **Flags** | | | |
| API Output | migrated | boolean | 'Y'/'N' → true/false |
| API Output | uploaded | boolean | 'Y'/'N' → true/false |

---

## 🚀 Endpoint Implementation Details

### 1. POST /v1/calendars - Create Calendar
```
Request:  { calendarName, dates[] }
Validation:
  - Name matches pattern and not "uploadedCalendars"
  - Dates valid DD-MM-YYYY
  - No duplicates
Transaction:
  - BEGIN IMMEDIATE (SQLite) or FOR UPDATE (PostgreSQL)
  - INSERT calendar
  - INSERT calendar_dates
  - INSERT audit_log
Response: 201 Created with Location header
```

### 2. GET /v1/calendars - List Calendars
```
Query: limit, offset, calendarName (substring), migrated (flag)
Pagination:
  - SQL: OFFSET ((page-1)*limit) LIMIT limit
  - Case-sensitive substring search
  - Collation: BINARY (SQLite) or C (PostgreSQL)
Response: 200 CalendarPage { calendars[], page, pageSize, totalItems, totalPages }
```

### 3. GET /v1/calendars/{name} - Get Calendar
```
Path: calendar_name (URL-encoded)
Lookup: SELECT * WHERE calendar_name = ?
Response: 200 Calendar or 404 Not Found
```

### 4. PATCH /v1/calendars/{name}/update - Update Calendar
```
Request: { calendarName, dates[], status }
Validation:
  - Path name matches request name
  - Status is ACTIVE or INACTIVE
Transaction:
  - BEGIN IMMEDIATE + FOR UPDATE
  - UPDATE status, updated_at
  - Replace all dates
  - INSERT audit_log
Response: 200 Updated Calendar
```

### 5. POST /v1/calendars/{name}/upload - Upload CSV
```
Multipart Request:
  - data: { year: "YYYY" } (max 4KB)
  - file: CSV (max configured)
CSV Validation:
  - Header: "date"
  - Rows: DD-MM-YYYY
  - All in specified year
  - No duplicates
  - At least 1 date
Transaction:
  - BEGIN IMMEDIATE + FOR UPDATE
  - CREATE calendar if not exists
  - UPDATE is_uploaded, updated_at (if updating existing)
  - Replace dates for year
  - INSERT audit_log
Response: 201 Created with updated Calendar
```

### 6. GET /v1/calendars/{name}/dates - Get Dates
```
Query: excludeCalendar (optional)
Operation:
  - SELECT all dates for calendar
  - If exclude specified: set difference
  - Sort ascending
Response: 200 String[] (DD-MM-YYYY format)
Errors: 404 if main or exclude calendar not found
```

### 7. GET /v1/calendars/uploadedCalendars - List Uploaded
```
Query: (none)
Operation:
  - SELECT calendars WHERE is_uploaded = 'Y'
  - ORDER BY calendar_name
Response: 200 Array<{ name, migrated }>
```

---

## 🔒 Transaction & Locking Strategy

### SQLite (Local Development)
```
BEGIN IMMEDIATE
  - Serializes all write transactions
  - Single writer at a time
  - Readers don't block
  - Prevents race conditions on duplicate insert
```

### PostgreSQL (Production)
```
BEGIN TRANSACTION + FOR UPDATE
  - Row-level locks (SELECT ... FOR UPDATE)
  - Multiple readers
  - Writers wait for lock
  - Better concurrency
```

### Concurrency Safety
- **Duplicate creation**: ON CONFLICT DO NOTHING + re-query
- **Race conditions**: Transaction boundaries + locking
- **Consistency**: Atomic operations (all-or-nothing)

---

## ⚠️ Error Handling

### HTTP Status Codes

| Code | Reason | Example |
|------|--------|---------|
| 201 | Created successfully | Calendar created |
| 200 | Success | Calendar retrieved |
| 400 | Validation error | Invalid date format |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient role |
| 404 | Not found | Calendar doesn't exist |
| 413 | Payload too large | CSV exceeds limit |
| 415 | Unsupported type | Wrong media type |
| 500 | Server error | Unexpected exception |

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

## 📋 Audit Trail

### Logged Actions
- **CREATE**: New calendar created
- **UPDATE**: Calendar dates or status changed
- **UPLOAD**: CSV dates uploaded (year-specific)

### Audit Entry Contains
- resource_type: "CALENDAR"
- resource_name: calendar name
- action: CREATE/UPDATE/UPLOAD
- performed_by: username
- performed_at: timestamp

### Use Cases
- Compliance: Who changed what when
- Debugging: Event history for troubleshooting
- Accountability: User attribution for changes

---

## 🛠️ Configuration

### Key Settings (config/settings.py)
```
auth_enabled: bool              # Enable/disable OAuth
auto_create_schema: bool        # Create tables on startup
upload_max_bytes: int           # File upload limit
database_url: str               # Connection string
```

### Database Support
```
SQLite:      Local development, testing
PostgreSQL:  Production deployment
```

---

## 📝 Field Validation Rules

### Calendar Name
```
Pattern:    ^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$
Length:     1-128 characters
Unique:     Yes (enforced by DB)
Reserved:   "uploadedCalendars" (rejected in API)
Case:       Sensitive
```

### Calendar Date
```
Format:     DD-MM-YYYY
Examples:   01-01-2027, 31-12-2027
Validation: Must be valid calendar date
```

### Upload Year
```
Pattern:    ^\d{4}$
Example:    2027
CSV dates must be in this year
```

---

## 🔗 Integration Points

### Frontend (React/TypeScript)
```
- Uses @tanstack/react-query for mutations
- API client: web/src/lib/api/client.ts
- Features: web/src/features/calendars/
- UI: CalendarsPage.tsx component
```

### Backend Service
```
- FastAPI application: apps/calendar_service/
- Routes: api/v1/calendars.py, upload.py
- Persistence: infra/database/management.py
- Database: SQLAlchemy ORM models
```

### Airflow Integration
```
- Endpoint: GET /v1/calendars/{name}/dates
- Returns: Array of business dates
- Use case: Airflow scheduling decisions
```

---

## 🎯 Key Takeaways

1. **OpenAPI First**: Spec drives implementation
2. **Multi-Database**: SQLite (dev) + PostgreSQL (prod)
3. **Transaction-Safe**: All writes are atomic
4. **Audit Trail**: Every change logged
5. **Type-Safe**: Pydantic + TypeScript schemas
6. **Role-Based**: OAuth + RBAC for authorization
7. **Date Format**: DD-MM-YYYY in API, YYYY-MM-DD in DB
8. **Pagination**: 1-based page numbers with totals
9. **CSV Upload**: Atomic year-based replacement
10. **Error Details**: Validation errors include field paths

---

## 📚 Related Documents

- **CalendarManagementSpec.yml**: OpenAPI 3.0 specification
- **CalendarManagementSchema.sql**: SQL DDL statements
- **apps/calendar_service/**: Backend source code
- **apps/web/src/lib/api/**: Frontend API client
- **req-details/api-spec/**: API specification details

---

## ✅ Quick Start for New Developers

1. Read: **BACKEND_FLOWS_ANALYSIS.md** - Understand overall architecture
2. Reference: **API_FLOW_SEQUENCES.md** - For specific flow details
3. Check: **DATA_MODELS_TRANSFORMATIONS.md** - For type conversions
4. Implement: Use examples as templates for new features
5. Verify: Run tests to ensure consistency

---

**Last Updated:** 2026-11-18
**Version:** 1.0
**Scope:** Calendar Management API (v1)

