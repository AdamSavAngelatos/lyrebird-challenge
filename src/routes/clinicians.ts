import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { Database } from 'better-sqlite3';
import { z } from 'zod';

const isoDatetime = z
  .string()
  .refine((s) => !isNaN(new Date(s).getTime()), { message: 'Must be a valid ISO datetime' });

const listQuerySchema = z.object({
  from: isoDatetime.optional(),
  to: isoDatetime.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

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

export async function clinicianRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const { db } = opts;

  // GET /v1/clinicians/:id/appointments
  app.get<{ Params: { id: string } }>('/clinicians/:id/appointments', async (req, reply) => {
    const { id } = req.params;

    const clinician = db.prepare('SELECT id FROM clinicians WHERE id = ?').get(id);
    if (!clinician) {
      return reply.status(404).send({ error: `Clinician '${id}' not found` });
    }

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: 'Invalid query parameters', details: parsed.error.flatten() });
    }

    const { from, to, limit, offset } = parsed.data;
    const fromIso = from ? new Date(from).toISOString() : new Date().toISOString();

    const conditions = ['clinician_id = ?', 'start >= ?'];
    const params: unknown[] = [id, fromIso];

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
  });
}
