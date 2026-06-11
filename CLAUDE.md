# Clinic Appointment System

A RESTful API built with TypeScript + Fastify for a simplified clinic appointment booking system.

## Tech Stack

- **Runtime**: Node.js 20+, TypeScript 6 (ESM)
- **Framework**: Fastify 5 (`fastify`, `@fastify/swagger`, `@fastify/swagger-ui`)
- **Database**: SQLite via `better-sqlite3` (WAL mode)
- **Validation**: Fastify's built-in AJV (structural) + explicit handler checks (business rules)
- **Testing**: Vitest 4 (unit + integration via `app.inject()`)
- **Docs**: Auto-generated OpenAPI 3 at `/docs`
- **Dev tooling**: `tsx` (hot reload), ESLint, Prettier

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
  schemas/
    appointment.ts    TypeScript interfaces + JSON Schema objects for OpenAPI
  services/
    appointmentService.ts  createAppointment, listAppointments business logic
    clinicianService.ts    getClinicianAppointments business logic
  routes/
    appointments.ts   HTTP layer — POST /v1/appointments, GET /v1/appointments
    clinicians.ts     HTTP layer — GET /v1/clinicians/:id/appointments
tests/
  unit/overlap.test.ts                Pure overlap logic
  unit/appointmentService.test.ts     createAppointment + listAppointments
  unit/clinicianService.test.ts       getClinicianAppointments
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
- npm packages use `~` (tilde) versioning to allow patch updates only (e.g. `~1.2.3`), keeping minor and major versions locked.
