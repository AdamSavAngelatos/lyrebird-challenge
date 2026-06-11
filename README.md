# Clinic Appointment System

A RESTful API for a simplified clinic appointment booking system, built with TypeScript and Fastify.

## Quick Start

```bash
npm install
npm run dev     # starts on http://localhost:3000
```

Swagger UI is available at **http://localhost:3000/docs**.

## Tech Stack

- **Runtime**: Node.js 20+, TypeScript 6 (ESM)
- **Framework**: Fastify 5 with `@fastify/swagger` + `@fastify/swagger-ui`
- **Database**: SQLite via `better-sqlite3` (WAL mode)
- **Validation**: Fastify's built-in AJV (structural) + explicit handler checks (business rules)
- **Testing**: Vitest 4 (unit + integration)
- **Dev tooling**: `tsx` (hot reload), ESLint, Prettier

## Requirements

- Node.js 20+ (driven by `better-sqlite3`)

## Running

```bash
npm install          # install dependencies
npm run dev          # development server with hot reload
npm run build        # compile TypeScript → dist/
npm start            # run compiled output
```

## Testing

```bash
npm test             # run all tests (29 unit + integration)
npm run test:watch   # watch mode
```

## Other commands

```bash
npm run lint         # ESLint
npm run format       # Prettier (write)
npm run format:check # Prettier (check only)
```

## Docker

```bash
# Build
docker build -t lyrebird-challenge .

# Run (ephemeral — data is lost when container stops)
docker run -p 3000:3000 lyrebird-challenge

# Run with persistent SQLite volume
docker run -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -e DB_PATH=/app/data/clinic.db \
  lyrebird-challenge
```

## API Reference

All endpoints are prefixed with `/v1`.

### Authentication (simulated)

Pass an `X-Role` header (or `?role=` query param) to identify as a role:

```
X-Role: patient | clinician | admin
```

> **Note:** This is a simulation — there is no credential verification. In production, roles would be derived from a verified JWT. See [Trade-offs & Limitations](#trade-offs--limitations).

---

### POST /v1/appointments

Create a new appointment. Auto-creates clinician and patient records if they don't exist.

**Request body:**

```json
{
  "clinicianId": "dr-smith",
  "patientId": "john-doe",
  "start": "2026-07-01T09:00:00Z",
  "end": "2026-07-01T10:00:00Z"
}
```

**Responses:**

| Status | Meaning                                                       |
| ------ | ------------------------------------------------------------- |
| 201    | Appointment created                                           |
| 400    | Invalid input (bad datetime, start ≥ end, start in past)      |
| 409    | Time slot overlaps an existing appointment for this clinician |

**Example:**

```bash
curl -s -X POST http://localhost:3000/v1/appointments \
  -H 'Content-Type: application/json' \
  -d '{
    "clinicianId": "dr-smith",
    "patientId":   "alice",
    "start":       "2026-07-01T09:00:00Z",
    "end":         "2026-07-01T10:00:00Z"
  }' | jq
```

---

### GET /v1/clinicians/:id/appointments

List upcoming appointments for a clinician.

**Query params (all optional):**

| Param    | Type            | Default | Description          |
| -------- | --------------- | ------- | -------------------- |
| `from`   | ISO datetime    | now     | Filter: start ≥ from |
| `to`     | ISO datetime    | —       | Filter: start ≤ to   |
| `limit`  | integer (1–200) | 50      | Page size            |
| `offset` | integer         | 0       | Page offset          |

**Response:**

```json
{
  "data": [
    {
      "id": "...",
      "clinicianId": "...",
      "patientId": "...",
      "start": "...",
      "end": "...",
      "createdAt": "..."
    }
  ],
  "total": 5,
  "limit": 50,
  "offset": 0
}
```

**Example:**

```bash
# All upcoming
curl -s http://localhost:3000/v1/clinicians/dr-smith/appointments | jq

# Filtered by date range
curl -s "http://localhost:3000/v1/clinicians/dr-smith/appointments?from=2026-07-01T00:00:00Z&to=2026-07-31T23:59:59Z" | jq
```

---

### GET /v1/appointments _(admin only)_

List all upcoming appointments across all clinicians. Requires `X-Role: admin`.

**Query params:** same as above (`from`, `to`, `limit`, `offset`)

**Example:**

```bash
curl -s http://localhost:3000/v1/appointments \
  -H 'X-Role: admin' | jq

# With date range
curl -s "http://localhost:3000/v1/appointments?from=2026-07-01T00:00:00Z" \
  -H 'X-Role: admin' | jq
```

---

### Overlap rejection example

```bash
# First appointment: 9–10am
curl -s -X POST http://localhost:3000/v1/appointments \
  -H 'Content-Type: application/json' \
  -d '{"clinicianId":"dr-smith","patientId":"alice","start":"2026-07-01T09:00:00Z","end":"2026-07-01T10:00:00Z"}' | jq

# Overlapping appointment: 9:30–10:30am → returns 409
curl -s -X POST http://localhost:3000/v1/appointments \
  -H 'Content-Type: application/json' \
  -d '{"clinicianId":"dr-smith","patientId":"bob","start":"2026-07-01T09:30:00Z","end":"2026-07-01T10:30:00Z"}' | jq

# Touching appointment: 10–11am → returns 201 (touching is allowed)
curl -s -X POST http://localhost:3000/v1/appointments \
  -H 'Content-Type: application/json' \
  -d '{"clinicianId":"dr-smith","patientId":"carol","start":"2026-07-01T10:00:00Z","end":"2026-07-01T11:00:00Z"}' | jq
```

---

## Trade-offs & Limitations

### SQLite vs. production database

SQLite is used as recommended by the challenge spec and is suitable for development and testing. It has significant limitations for a production clinic system:

| Limitation            | Detail                                                                          | Production recommendation                                           |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| No horizontal scaling | SQLite is a single file on one machine — multiple app instances cannot share it | PostgreSQL (client-server, network-accessible)                      |
| Serialized writes     | Only one write transaction at a time, even with WAL mode                        | PostgreSQL MVCC handles concurrent writes without a global lock     |
| No replication        | No read replicas, no standby/failover                                           | PostgreSQL streaming replication or managed DBs (AWS RDS, Supabase) |
| No enforced types     | `DATETIME` in SQLite is cosmetic — no constraint enforcement                    | PostgreSQL `TIMESTAMPTZ`, `UUID`, check constraints                 |

**Recommended production stack:** PostgreSQL + [Prisma](https://www.prisma.io/) or [Drizzle ORM](https://orm.drizzle.team/).

### Role-based access is a simulation

Roles are extracted from the `X-Role` header with no verification. Any caller can claim any role. In production, roles would be derived from a verified JWT (`Authorization: Bearer <token>`), never from a caller-supplied header.

### TLS

The server listens on plain HTTP. Clinic appointment data is sensitive — HIPAA (US) and GDPR (EU) both require encryption in transit. In production, TLS termination should be handled by a reverse proxy (nginx, Caddy) or load balancer (AWS ALB) sitting in front of the app.

### Concurrency

Overlap checking and insertion run inside a `BEGIN IMMEDIATE` SQLite transaction (`db.transaction(...).immediate()`). This acquires a write lock before the overlap `SELECT`, ensuring two concurrent requests for the same clinician cannot both pass the conflict check before either inserts. SQLite serializes all writers, so there is no TOCTOU race condition.

`busy_timeout` is not configured, so SQLite's default of 0ms applies — if a second request tries to acquire the write lock while one is already held, it fails immediately with `SQLITE_BUSY` rather than waiting. Under real concurrent load this would surface as an unhandled 500. A production setup should set `db.pragma('busy_timeout = 5000')` to allow queued writers to wait a short period before failing.

### Patient and clinician records

Clinician and patient records are auto-created on first use using the caller-supplied `clinicianId` and `patientId` strings (e.g. `"dr-smith"`, `"alice"`). There is no registration flow — any string is accepted as a valid ID.

In production, clinicians and patients would be registered through dedicated endpoints (or sourced from an HR/identity system), generating system-assigned UUIDs or integer PKs. `POST /v1/appointments` would then reference those pre-existing IDs, with the database enforcing them as `NOT NULL` foreign keys with referential integrity constraints. Patient records in a real EMR/EHR would also carry rich demographics (DOB, contact info, insurance) managed by a dedicated service.

### Health checks and observability

There is no health check endpoint (e.g. `GET /health`), metrics endpoint, or structured logging beyond Fastify's default request logs. A production deployment would typically expose a health check for load balancer probes, emit metrics (e.g. request latency, error rates) to a monitoring system such as Prometheus or Datadog, and use structured, correlated logs for distributed tracing.

### Caching

No caching layer is implemented. All requests query SQLite directly. For a production system serving repeated read requests (e.g. clinician schedule views), an in-process cache (e.g. TTL-based map) or external cache (e.g. Redis) in front of the database would reduce latency and load. Cache invalidation would need to account for new appointments being booked.

### Pagination

Offset-based pagination (`limit`/`offset`) is used. It is simple and correct for bounded appointment datasets. Cursor-based pagination would be more robust for very large or rapidly-changing datasets but adds complexity beyond this challenge's scope.

### API versioning

All routes are prefixed with `/v1`. This allows future breaking changes to be released under `/v2` without affecting existing clients.

### Validation

Input validation is handled in two layers. Fastify's built-in AJV validator enforces structural rules defined in the JSON Schema on each route (required fields, types, datetime format, integer ranges) before the handler runs. Business rules that JSON Schema cannot express — _start must be in the future_, _end must be after start_ — are enforced with explicit checks inside the handler.

There is no dedicated validation library (e.g. Zod, Joi). For the current rule set this is sufficient, but as business rules grow in number or complexity (conditional constraints, cross-entity rules, reusable validation logic), hand-rolled checks become harder to maintain and a schema validation library would be worth reintroducing.

Zod was considered and prototyped. It was ultimately rejected for two reasons:

1. **Duplicate schema definitions.** Fastify's AJV validator requires JSON Schema objects on each route for OpenAPI generation and structural validation. Zod would have introduced a parallel set of schemas for the same fields, with no way to derive one from the other without a third-party adapter (e.g. `fastify-type-provider-zod`, which is not an officially verified package).

2. **Custom error handling required.** AJV runs before the handler and produces structured error messages automatically. Zod's `safeParse` runs inside the handler — any Zod validation failure required a custom Fastify error handler to intercept, reformat, and re-throw errors in a consistent shape. This added coupling between the validation library and the framework's error pipeline that outweighed the benefits at this scale.
