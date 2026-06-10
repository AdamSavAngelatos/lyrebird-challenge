import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { requireRole } from '../middleware/role.js';
import {
  createAppointmentSchema,
  createAppointmentBody,
  listQuerySchema,
  appointmentProperties,
  errorSchema,
  paginationQuerystring,
  paginatedAppointmentsResponse,
} from '../schemas/appointment.js';

interface AppointmentRow {
  id: string;
  clinician_id: string;
  patient_id: string;
  start: string;
  end: string;
  created_at: string;
}

function formatRow(row: AppointmentRow) {
  return {
    id: row.id,
    clinicianId: row.clinician_id,
    patientId: row.patient_id,
    start: row.start,
    end: row.end,
    createdAt: row.created_at,
  };
}

interface PluginOptions extends FastifyPluginOptions {
  db: Database;
}

export async function appointmentRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const { db } = opts;

  // POST /v1/appointments
  app.post(
    '/appointments',
    {
      schema: {
        tags: ['appointments'],
        body: createAppointmentBody,
        response: {
          201: { description: 'Appointment created', type: 'object', properties: appointmentProperties },
          400: { description: 'Invalid request body', ...errorSchema },
          409: { description: 'Clinician has a conflicting appointment', ...errorSchema },
        },
      },
    },
    async (req, reply) => {
      const parsed = createAppointmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Invalid request', details: parsed.error.flatten((i) => i.message) });
      }

      const { clinicianId, patientId, start, end } = parsed.data;
      const startIso = new Date(start).toISOString();
      const endIso = new Date(end).toISOString();
      const now = new Date().toISOString();

      const insertAppointment = db.transaction(() => {
        db.prepare('INSERT OR IGNORE INTO clinicians (id, name, created_at) VALUES (?, ?, ?)').run(
          clinicianId,
          clinicianId,
          now
        );
        db.prepare('INSERT OR IGNORE INTO patients (id, name, created_at) VALUES (?, ?, ?)').run(
          patientId,
          patientId,
          now
        );

        // Overlap check: existing.start < newEnd AND existing.end > newStart
        const conflict = db
          .prepare(
            `SELECT 1 FROM appointments
             WHERE clinician_id = ? AND start < ? AND end > ?
             LIMIT 1`
          )
          .get(clinicianId, endIso, startIso);

        if (conflict) return null;

        const id = uuid();
        db.prepare(
          `INSERT INTO appointments (id, clinician_id, patient_id, start, end, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(id, clinicianId, patientId, startIso, endIso, now);

        return { id, clinicianId, patientId, start: startIso, end: endIso, createdAt: now };
      });

      // BEGIN IMMEDIATE acquires the write lock before the overlap SELECT,
      // preventing a TOCTOU race condition under concurrent requests.
      const result = insertAppointment.immediate();

      if (!result) {
        return reply.status(409).send({
          error:
            'Conflict: the requested time slot overlaps an existing appointment for this clinician',
        });
      }

      return reply.status(201).send(result);
    }
  );

  // GET /v1/appointments (admin only)
  app.get(
    '/appointments',
    {
      schema: {
        tags: ['appointments'],
        description: 'Requires X-Role: admin',
        querystring: paginationQuerystring,
        response: {
          200: { description: 'List of appointments', ...paginatedAppointmentsResponse },
          400: { description: 'Invalid query parameters', ...errorSchema },
        },
      },
    },
    async (req, reply) => {
      requireRole(req, 'admin');

      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({
            error: 'Invalid query parameters',
            details: parsed.error.flatten((i) => i.message),
          });
      }

      const { from, to, limit, offset } = parsed.data;
      const fromIso = from ? new Date(from).toISOString() : new Date().toISOString();

      const conditions = ['start >= ?'];
      const params: unknown[] = [fromIso];

      if (to) {
        conditions.push('start <= ?');
        params.push(new Date(to).toISOString());
      }

      const where = `WHERE ${conditions.join(' AND ')}`;

      const { count } = db
        .prepare(`SELECT COUNT(*) as count FROM appointments ${where}`)
        .get(...(params as [])) as { count: number };

      const rows = db
        .prepare(`SELECT * FROM appointments ${where} ORDER BY start ASC LIMIT ? OFFSET ?`)
        .all(...(params as []), limit, offset) as AppointmentRow[];

      return reply.send({ data: rows.map(formatRow), total: count, limit, offset });
    }
  );
}
