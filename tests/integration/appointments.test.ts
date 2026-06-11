import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app.js';
import { createDb } from '../../src/db.js';

const FUTURE_HOUR = () => Date.now() + 60 * 60 * 1000;

function makeSlot(offsetMs: number, durationMs = 60 * 60 * 1000) {
  return {
    start: new Date(FUTURE_HOUR() + offsetMs).toISOString(),
    end: new Date(FUTURE_HOUR() + offsetMs + durationMs).toISOString(),
  };
}

describe('POST /v1/appointments', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const db = createDb(':memory:');
    app = await createApp(db);
    await app.ready();
  });

  afterEach(() => app.close());

  it('creates a valid appointment and returns 201', async () => {
    const slot = makeSlot(0);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c1', patientId: 'p1', ...slot },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.clinicianId).toBe('c1');
    expect(body.patientId).toBe('p1');
    expect(body.start).toBe(new Date(slot.start).toISOString());
    expect(body.end).toBe(new Date(slot.end).toISOString());
  });

  it('returns 409 for a partially overlapping appointment', async () => {
    const slot = makeSlot(0);
    await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c1', patientId: 'p1', ...slot },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c1', patientId: 'p2', ...makeSlot(30 * 60 * 1000) }, // 30 min into first slot
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/conflict/i);
  });

  it('returns 409 for a fully contained appointment', async () => {
    const slot = makeSlot(0); // 1 hour
    await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c1', patientId: 'p1', ...slot },
    });

    // 15-min slot entirely inside the existing 1-hour slot
    const inner = {
      start: new Date(FUTURE_HOUR() + 15 * 60 * 1000).toISOString(),
      end: new Date(FUTURE_HOUR() + 45 * 60 * 1000).toISOString(),
    };
    const res = await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c1', patientId: 'p2', ...inner },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/conflict/i);
  });

  it('returns 409 for an exact duplicate slot', async () => {
    const slot = makeSlot(0);
    await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c1', patientId: 'p1', ...slot },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c1', patientId: 'p2', ...slot },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/conflict/i);
  });

  it('allows touching appointments (end == next start)', async () => {
    const slot1 = makeSlot(0);
    const slot2 = {
      start: slot1.end,
      end: new Date(new Date(slot1.end).getTime() + 3600000).toISOString(),
    };

    await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c1', patientId: 'p1', ...slot1 },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c1', patientId: 'p2', ...slot2 },
    });

    expect(res.statusCode).toBe(201);
  });

  it('allows different clinicians to have overlapping times', async () => {
    const slot = makeSlot(0);

    await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c1', patientId: 'p1', ...slot },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c2', patientId: 'p2', ...slot },
    });

    expect(res.statusCode).toBe(201);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c1' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe("body must have required property 'patientId'");
  });

  it('returns 400 when start is in the past', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: {
        clinicianId: 'c1',
        patientId: 'p1',
        start: new Date(Date.now() - 3600000).toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('start must be in the future');
  });

  it('returns 400 when start > end', async () => {
    const now = FUTURE_HOUR();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: {
        clinicianId: 'c1',
        patientId: 'p1',
        start: new Date(now + 3600000).toISOString(),
        end: new Date(now).toISOString(),
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('end must be after start');
  });

  it('returns 400 when start == end', async () => {
    const now = FUTURE_HOUR();
    const ts = new Date(now).toISOString();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: { clinicianId: 'c1', patientId: 'p1', start: ts, end: ts },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('end must be after start');
  });

  it('returns 400 for an unrecognised X-Role value', async () => {
    const slot = makeSlot(0);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      headers: { 'x-role': 'hacker' },
      payload: { clinicianId: 'c1', patientId: 'p1', ...slot },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/invalid role/i);
  });

  it('returns 400 for an invalid ISO datetime string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: {
        clinicianId: 'c1',
        patientId: 'p1',
        start: 'not-a-date',
        end: new Date(FUTURE_HOUR() + 3600000).toISOString(),
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('body/start must match format "date-time"');
  });
});

describe('GET /v1/appointments (admin)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const db = createDb(':memory:');
    app = await createApp(db);
    await app.ready();
  });

  afterEach(() => app.close());

  async function seed(clinicianId: string, offsetHours: number) {
    const base = FUTURE_HOUR();
    await app.inject({
      method: 'POST',
      url: '/v1/appointments',
      payload: {
        clinicianId,
        patientId: 'p1',
        start: new Date(base + offsetHours * 3600000).toISOString(),
        end: new Date(base + (offsetHours + 1) * 3600000).toISOString(),
      },
    });
  }

  it('returns 400 with a descriptive message for an invalid query param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/appointments?from=not-a-date',
      headers: { 'x-role': 'admin' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.message).toBe('querystring/from must match format "date-time"');
  });

  it('returns 403 without admin role', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/appointments' });
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 with wrong role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/appointments',
      headers: { 'x-role': 'patient' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns all upcoming appointments with admin role', async () => {
    await seed('c1', 0);
    await seed('c2', 2);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/appointments',
      headers: { 'x-role': 'admin' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('filters by from/to date range', async () => {
    const base = FUTURE_HOUR();
    await seed('c1', 0); // +1h
    await seed('c1', 5); // +6h

    const from = new Date(base + 4 * 3600000).toISOString();
    const to = new Date(base + 8 * 3600000).toISOString();

    const res = await app.inject({
      method: 'GET',
      url: `/v1/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      headers: { 'x-role': 'admin' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
  });

  it('respects limit and offset', async () => {
    await seed('c1', 0);
    await seed('c2', 2);
    await seed('c3', 4);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/appointments?limit=2&offset=1',
      headers: { 'x-role': 'admin' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(3);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(1);
  });
});
