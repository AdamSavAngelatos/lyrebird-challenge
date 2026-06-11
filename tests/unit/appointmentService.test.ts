import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../../src/db.js';
import { createAppointment, listAppointments } from '../../src/services/appointmentService.js';
import type { Database } from 'better-sqlite3';

const FUTURE = () => Date.now() + 60 * 60 * 1000;

function makeSlot(offsetMs: number, durationMs = 60 * 60 * 1000) {
  return {
    start: new Date(FUTURE() + offsetMs).toISOString(),
    end: new Date(FUTURE() + offsetMs + durationMs).toISOString(),
  };
}

describe('createAppointment', () => {
  let db: Database;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  it('creates an appointment and returns it', () => {
    const slot = makeSlot(0);
    const result = createAppointment(db, { clinicianId: 'c1', patientId: 'p1', ...slot });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appointment.id).toBeDefined();
    expect(result.appointment.clinicianId).toBe('c1');
    expect(result.appointment.patientId).toBe('p1');
    expect(result.appointment.start).toBe(new Date(slot.start).toISOString());
    expect(result.appointment.end).toBe(new Date(slot.end).toISOString());
  });

  it('returns start_not_future when start is in the past', () => {
    const result = createAppointment(db, {
      clinicianId: 'c1',
      patientId: 'p1',
      start: new Date(Date.now() - 3600000).toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('start_not_future');
  });

  it('returns end_not_after_start when end is before start', () => {
    const base = FUTURE();
    const result = createAppointment(db, {
      clinicianId: 'c1',
      patientId: 'p1',
      start: new Date(base + 3600000).toISOString(),
      end: new Date(base).toISOString(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('end_not_after_start');
  });

  it('returns end_not_after_start when end equals start', () => {
    const start = new Date(FUTURE()).toISOString();
    const result = createAppointment(db, { clinicianId: 'c1', patientId: 'p1', start, end: start });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('end_not_after_start');
  });

  it('returns conflict when slots overlap for the same clinician', () => {
    const slot = makeSlot(0);
    createAppointment(db, { clinicianId: 'c1', patientId: 'p1', ...slot });

    const result = createAppointment(db, {
      clinicianId: 'c1',
      patientId: 'p2',
      ...makeSlot(30 * 60 * 1000),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('conflict');
  });

  it('allows touching appointments (end of one equals start of next)', () => {
    const slot1 = makeSlot(0);
    const slot2 = {
      start: slot1.end,
      end: new Date(new Date(slot1.end).getTime() + 3600000).toISOString(),
    };
    createAppointment(db, { clinicianId: 'c1', patientId: 'p1', ...slot1 });

    const result = createAppointment(db, { clinicianId: 'c1', patientId: 'p2', ...slot2 });

    expect(result.ok).toBe(true);
  });

  it('allows overlapping slots for different clinicians', () => {
    const slot = makeSlot(0);
    createAppointment(db, { clinicianId: 'c1', patientId: 'p1', ...slot });

    const result = createAppointment(db, { clinicianId: 'c2', patientId: 'p2', ...slot });

    expect(result.ok).toBe(true);
  });
});

describe('listAppointments', () => {
  let db: Database;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  function seed(clinicianId: string, offsetHours: number) {
    const base = FUTURE();
    createAppointment(db, {
      clinicianId,
      patientId: 'p1',
      start: new Date(base + offsetHours * 3600000).toISOString(),
      end: new Date(base + (offsetHours + 1) * 3600000).toISOString(),
    });
  }

  it('returns all upcoming appointments', () => {
    seed('c1', 0);
    seed('c2', 2);

    const result = listAppointments(db, { limit: 50, offset: 0 });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('excludes past appointments by default', () => {
    seed('c1', 0);
    db.prepare(
      `INSERT INTO appointments (id, clinician_id, patient_id, start, end, created_at)
       VALUES ('past-1', 'c1', 'p1', '2000-01-01T00:00:00.000Z', '2000-01-01T01:00:00.000Z', '2000-01-01T00:00:00.000Z')`
    ).run();

    const result = listAppointments(db, { limit: 50, offset: 0 });

    expect(result.data).toHaveLength(1);
  });

  it('filters by from/to date range', () => {
    const base = FUTURE();
    seed('c1', 0);
    seed('c1', 5);

    const from = new Date(base + 4 * 3600000).toISOString();
    const to = new Date(base + 8 * 3600000).toISOString();

    const result = listAppointments(db, { from, to, limit: 50, offset: 0 });

    expect(result.data).toHaveLength(1);
  });

  it('respects limit and offset', () => {
    seed('c1', 0);
    seed('c2', 2);
    seed('c3', 4);

    const result = listAppointments(db, { limit: 2, offset: 1 });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(3);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(1);
  });

  it('returns results ordered by start time ascending', () => {
    seed('c1', 4);
    seed('c2', 0);
    seed('c3', 2);

    const result = listAppointments(db, { limit: 50, offset: 0 });

    const starts = result.data.map((a) => a.start);
    expect(starts).toEqual([...starts].sort());
  });
});
