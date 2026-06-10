import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../../src/db.js';
import { createAppointment } from '../../src/services/appointmentService.js';
import { getClinicianAppointments } from '../../src/services/clinicianService.js';
import type { Database } from 'better-sqlite3';

const FUTURE = () => Date.now() + 60 * 60 * 1000;

function seed(db: Database, clinicianId: string, offsetHours: number) {
  const base = FUTURE();
  createAppointment(db, {
    clinicianId,
    patientId: 'p1',
    start: new Date(base + offsetHours * 3600000).toISOString(),
    end: new Date(base + (offsetHours + 1) * 3600000).toISOString(),
  });
}

describe('getClinicianAppointments', () => {
  let db: Database;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  it('returns not_found for an unknown clinician', () => {
    const result = getClinicianAppointments(db, 'unknown', { limit: 50, offset: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not_found');
  });

  it('returns appointments for a known clinician', () => {
    seed(db, 'c1', 0);
    seed(db, 'c1', 2);

    const result = getClinicianAppointments(db, 'c1', { limit: 50, offset: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appointments.data).toHaveLength(2);
    expect(result.appointments.total).toBe(2);
  });

  it('only returns appointments for the specified clinician', () => {
    seed(db, 'c1', 0);
    seed(db, 'c2', 0);

    const result = getClinicianAppointments(db, 'c1', { limit: 50, offset: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appointments.data).toHaveLength(1);
    expect(result.appointments.data[0].clinicianId).toBe('c1');
  });

  it('filters by from/to date range', () => {
    const base = FUTURE();
    seed(db, 'c1', 0);
    seed(db, 'c1', 5);

    const from = new Date(base + 4 * 3600000).toISOString();
    const to = new Date(base + 8 * 3600000).toISOString();

    const result = getClinicianAppointments(db, 'c1', { from, to, limit: 50, offset: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appointments.data).toHaveLength(1);
  });

  it('respects limit and offset', () => {
    seed(db, 'c1', 0);
    seed(db, 'c1', 2);
    seed(db, 'c1', 4);

    const result = getClinicianAppointments(db, 'c1', { limit: 2, offset: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appointments.data).toHaveLength(2);
    expect(result.appointments.total).toBe(3);
  });

  it('returns results ordered by start time ascending', () => {
    seed(db, 'c1', 4);
    seed(db, 'c1', 0);
    seed(db, 'c1', 2);

    const result = getClinicianAppointments(db, 'c1', { limit: 50, offset: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const starts = result.appointments.data.map((a) => a.start);
    expect(starts).toEqual([...starts].sort());
  });
});
