import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app.js';
import { createDb } from '../../src/db.js';

const FUTURE_HOUR = () => Date.now() + 60 * 60 * 1000;

async function seedAppointment(
  app: FastifyInstance,
  clinicianId: string,
  patientId: string,
  offsetHours: number
) {
  const base = FUTURE_HOUR();
  return app.inject({
    method: 'POST',
    url: '/v1/appointments',
    payload: {
      clinicianId,
      patientId,
      start: new Date(base + offsetHours * 3600000).toISOString(),
      end: new Date(base + (offsetHours + 1) * 3600000).toISOString(),
    },
  });
}

describe('GET /v1/clinicians/:id/appointments', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const db = createDb(':memory:');
    app = await createApp(db);
    await app.ready();
  });

  afterEach(() => app.close());

  it('returns 404 for unknown clinician', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/clinicians/unknown/appointments',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Clinician 'unknown' not found");
  });

  it('returns 400 for invalid from query param', async () => {
    await seedAppointment(app, 'c1', 'p1', 0);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/clinicians/c1/appointments?from=not-a-date',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('querystring/from must match format "date-time"');
  });

  it('returns 400 for invalid to query param', async () => {
    await seedAppointment(app, 'c1', 'p1', 0);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/clinicians/c1/appointments?to=not-a-date',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('querystring/to must match format "date-time"');
  });

  it('returns 400 for non-integer limit', async () => {
    await seedAppointment(app, 'c1', 'p1', 0);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/clinicians/c1/appointments?limit=abc',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('querystring/limit must be integer');
  });

  it('returns 400 for negative offset', async () => {
    await seedAppointment(app, 'c1', 'p1', 0);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/clinicians/c1/appointments?offset=-1',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('querystring/offset must be >= 0');
  });

  it('returns upcoming appointments for a known clinician', async () => {
    await seedAppointment(app, 'c1', 'p1', 0);
    await seedAppointment(app, 'c1', 'p2', 2);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/clinicians/c1/appointments',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.data.every((a: { clinicianId: string }) => a.clinicianId === 'c1')).toBe(true);
  });

  it('does not return appointments for other clinicians', async () => {
    await seedAppointment(app, 'c1', 'p1', 0);
    await seedAppointment(app, 'c2', 'p2', 2);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/clinicians/c1/appointments',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].clinicianId).toBe('c1');
  });

  it('filters by from/to query params', async () => {
    const base = FUTURE_HOUR();
    await seedAppointment(app, 'c1', 'p1', 0); // +1h
    await seedAppointment(app, 'c1', 'p2', 5); // +6h

    const from = new Date(base + 4 * 3600000).toISOString();
    const to = new Date(base + 8 * 3600000).toISOString();

    const res = await app.inject({
      method: 'GET',
      url: `/v1/clinicians/c1/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
  });

  it('respects limit and offset', async () => {
    await seedAppointment(app, 'c1', 'p1', 0);
    await seedAppointment(app, 'c1', 'p2', 2);
    await seedAppointment(app, 'c1', 'p3', 4);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/clinicians/c1/appointments?limit=2&offset=1',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(3);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(1);
  });

  it('returns an empty list when clinician has no upcoming appointments', async () => {
    // Create clinician by booking then querying far in future
    await seedAppointment(app, 'c1', 'p1', 0);

    const farFuture = new Date(Date.now() + 365 * 24 * 3600000).toISOString();

    const res = await app.inject({
      method: 'GET',
      url: `/v1/clinicians/c1/appointments?from=${encodeURIComponent(farFuture)}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });
});
