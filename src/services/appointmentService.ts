import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';

export interface AppointmentRecord {
  id: string;
  clinicianId: string;
  patientId: string;
  start: string;
  end: string;
  createdAt: string;
}

export interface ListAppointmentsInput {
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

export interface PaginatedAppointments {
  data: AppointmentRecord[];
  total: number;
  limit: number;
  offset: number;
}

interface AppointmentRow {
  id: string;
  clinician_id: string;
  patient_id: string;
  start: string;
  end: string;
  created_at: string;
}

function formatRow(row: AppointmentRow): AppointmentRecord {
  return {
    id: row.id,
    clinicianId: row.clinician_id,
    patientId: row.patient_id,
    start: row.start,
    end: row.end,
    createdAt: row.created_at,
  };
}

export type CreateAppointmentResult =
  | { ok: true; appointment: AppointmentRecord }
  | { ok: false; reason: 'start_not_future' | 'end_not_after_start' | 'conflict' };

export function createAppointment(
  db: Database,
  input: { clinicianId: string; patientId: string; start: string; end: string }
): CreateAppointmentResult {
  const startDate = new Date(input.start);
  const endDate = new Date(input.end);

  if (startDate <= new Date()) {
    return { ok: false, reason: 'start_not_future' };
  }
  if (endDate <= startDate) {
    return { ok: false, reason: 'end_not_after_start' };
  }

  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();
  const now = new Date().toISOString();

  // BEGIN IMMEDIATE acquires the write lock before the overlap SELECT,
  // preventing a TOCTOU race condition under concurrent requests.
  const result = db
    .transaction(() => {
      db.prepare('INSERT OR IGNORE INTO clinicians (id, name, created_at) VALUES (?, ?, ?)').run(
        input.clinicianId,
        input.clinicianId,
        now
      );
      db.prepare('INSERT OR IGNORE INTO patients (id, name, created_at) VALUES (?, ?, ?)').run(
        input.patientId,
        input.patientId,
        now
      );

      // Overlap check: existing.start < newEnd AND existing.end > newStart
      const conflict = db
        .prepare(
          `SELECT 1 FROM appointments
         WHERE clinician_id = ? AND start < ? AND end > ?
         LIMIT 1`
        )
        .get(input.clinicianId, endIso, startIso);

      if (conflict) return null;

      const id = uuid();
      db.prepare(
        `INSERT INTO appointments (id, clinician_id, patient_id, start, end, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, input.clinicianId, input.patientId, startIso, endIso, now);

      return {
        id,
        clinicianId: input.clinicianId,
        patientId: input.patientId,
        start: startIso,
        end: endIso,
        createdAt: now,
      };
    })
    .immediate();

  if (!result) return { ok: false, reason: 'conflict' };
  return { ok: true, appointment: result };
}

export function listAppointments(
  db: Database,
  input: ListAppointmentsInput
): PaginatedAppointments {
  const fromIso = input.from ? new Date(input.from).toISOString() : new Date().toISOString();
  const conditions = ['start >= ?'];
  const params: unknown[] = [fromIso];

  if (input.to) {
    conditions.push('start <= ?');
    params.push(new Date(input.to).toISOString());
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const { count } = db
    .prepare(`SELECT COUNT(*) as count FROM appointments ${where}`)
    .get(...(params as [])) as { count: number };

  const rows = db
    .prepare(`SELECT * FROM appointments ${where} ORDER BY start ASC LIMIT ? OFFSET ?`)
    .all(...(params as []), input.limit, input.offset) as AppointmentRow[];

  return { data: rows.map(formatRow), total: count, limit: input.limit, offset: input.offset };
}
