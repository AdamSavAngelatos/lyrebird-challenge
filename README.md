# Clinic Appointment System

A RESTful API for a simplified clinic appointment booking system, built with TypeScript and Fastify.

## Quick Start

```bash
npm install
npm run dev     # starts on http://localhost:3000
```

Swagger UI is available at **http://localhost:3000/docs**.

## Requirements

- Node.js 24+

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
  "patientId":   "john-doe",
  "start":       "2026-07-01T09:00:00Z",
  "end":         "2026-07-01T10:00:00Z"
}
```

**Responses:**

| Status | Meaning |
|---|---|
| 201 | Appointment created |
| 400 | Invalid input (bad datetime, start ≥ end, start in past) |
| 409 | Time slot overlaps an existing appointment for this clinician |

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

| Param | Type | Default | Description |
|---|---|---|---|
| `from` | ISO datetime | now | Filter: start ≥ from |
| `to` | ISO datetime | — | Filter: start ≤ to |
| `limit` | integer (1–200) | 50 | Page size |
| `offset` | integer | 0 | Page offset |

**Response:**

```json
{
  "data": [{ "id": "...", "clinicianId": "...", "patientId": "...", "start": "...", "end": "...", "createdAt": "..." }],
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

### GET /v1/appointments *(admin only)*

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

| Limitation | Detail | Production recommendation |
|---|---|---|
| No horizontal scaling | SQLite is a single file on one machine — multiple app instances cannot share it | PostgreSQL (client-server, network-accessible) |
| Serialized writes | Only one write transaction at a time, even with WAL mode | PostgreSQL MVCC handles concurrent writes without a global lock |
| No replication | No read replicas, no standby/failover | PostgreSQL streaming replication or managed DBs (AWS RDS, Supabase) |
| No enforced types | `DATETIME` in SQLite is cosmetic — no constraint enforcement | PostgreSQL `TIMESTAMPTZ`, `UUID`, check constraints |

**Recommended production stack:** PostgreSQL + [Prisma](https://www.prisma.io/) or [Drizzle ORM](https://orm.drizzle.team/).

### Role-based access is a simulation

Roles are extracted from the `X-Role` header with no verification. Any caller can claim any role. In production, roles would be derived from a verified JWT (`Authorization: Bearer <token>`), never from a caller-supplied header.

### TLS

The server listens on plain HTTP. Clinic appointment data is sensitive — HIPAA (US) and GDPR (EU) both require encryption in transit. In production, TLS termination should be handled by a reverse proxy (nginx, Caddy) or load balancer (AWS ALB) sitting in front of the app.

### Concurrency

Overlap checking and insertion run inside a `BEGIN IMMEDIATE` SQLite transaction (`db.transaction(...).immediate()`). This acquires a write lock before the overlap `SELECT`, ensuring two concurrent requests for the same clinician cannot both pass the conflict check before either inserts. SQLite serializes all writers, so there is no TOCTOU race condition.

### Patient and clinician records

Clinician and patient records are auto-created on first use (just `id` + `name`). A real EMR/EHR would have rich patient demographics (DOB, contact info, insurance, etc.) typically managed by a dedicated service.

### Pagination

Offset-based pagination (`limit`/`offset`) is used. It is simple and correct for bounded appointment datasets. Cursor-based pagination would be more robust for very large or rapidly-changing datasets but adds complexity beyond this challenge's scope.

### API versioning

All routes are prefixed with `/v1`. This allows future breaking changes to be released under `/v2` without affecting existing clients.
