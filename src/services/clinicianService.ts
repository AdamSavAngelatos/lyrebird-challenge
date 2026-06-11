import type { Database } from 'better-sqlite3';
import type {
  AppointmentRecord,
  ListAppointmentsInput,
  PaginatedAppointments,
} from './appointmentService.js';

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

export type GetClinicianAppointmentsResult =
  | { ok: true; appointments: PaginatedAppointments }
  | { ok: false; reason: 'not_found' };

export function getClinicianAppointments(
  db: Database,
  id: string,
  input: ListAppointmentsInput
): GetClinicianAppointmentsResult {
  const clinician = db.prepare('SELECT id FROM clinicians WHERE id = ?').get(id);
  if (!clinician) return { ok: false, reason: 'not_found' };

  const fromIso = input.from ? new Date(input.from).toISOString() : new Date().toISOString();
  const conditions = ['clinician_id = ?', 'start >= ?'];
  const params: unknown[] = [id, fromIso];

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

  return {
    ok: true,
    appointments: {
      data: rows.map(formatRow),
      total: count,
      limit: input.limit,
      offset: input.offset,
    },
  };
}
