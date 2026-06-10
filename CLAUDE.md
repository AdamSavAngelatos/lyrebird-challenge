# Clinic Appointment System

A RESTful API built with TypeScript + Fastify for a simplified clinic appointment booking system.

## Tech Stack

- **Runtime**: Node.js 24, TypeScript 5 (ESM)
- **Framework**: Fastify 5
- **Database**: SQLite via `better-sqlite3` (WAL mode)
- **Validation**: Zod
- **Testing**: Vitest (unit + integration via `app.inject()`)
- **Docs**: Auto-generated OpenAPI at `/docs`

## Commands

```bash
npm run dev          # Start dev server with hot reload (tsx)
npm run build        # Compile TypeScript → dist/
npm start            # Run compiled output
npm test             # Run all tests (unit + integration)
npm run test:watch   # Watch mode
npm run lint         # ESLint
npm run format       # Prettier
```

## Project Structure

```
src/
  index.ts            Entry point — starts server on :3000
  app.ts              Fastify app factory (accepts db, exported for tests)
  db.ts               SQLite setup, schema, indexes, WAL mode
  types.ts            Role type + Fastify request augmentation
  utils/overlap.ts    Overlap detection logic (pure function)
  middleware/role.ts  X-Role header extraction + requireRole guard
  routes/
    appointments.ts   POST /v1/appointments, GET /v1/appointments
    clinicians.ts     GET /v1/clinicians/:id/appointments
tests/
  unit/overlap.test.ts         Pure overlap logic
  integration/appointments.test.ts
  integration/clinicians.test.ts
```

## API Base URL

All endpoints are prefixed with `/v1`. Swagger UI is available at `http://localhost:3000/docs`.

## Key Design Decisions

- SQLite is used for simplicity (challenge recommendation). Not suitable for production — see README for alternatives.
- Role auth is a simulation: pass `X-Role: admin|clinician|patient` header. No real credential verification.
- Overlap check + insert run inside a `BEGIN IMMEDIATE` transaction to prevent race conditions.
- Dates are stored as ISO 8601 UTC strings, normalized via `new Date(x).toISOString()` on input.
