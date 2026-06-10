import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { Database } from 'better-sqlite3';
import {
  type ListQuery,
  clinicianParams,
  paginationQuerystring,
  paginatedAppointmentsResponse,
  errorSchema,
} from '../schemas/appointment.js';
import { getClinicianAppointments } from '../services/clinicianService.js';

interface PluginOptions extends FastifyPluginOptions {
  db: Database;
}

export async function clinicianRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const { db } = opts;

  // GET /v1/clinicians/:id/appointments
  app.get<{ Params: { id: string }; Querystring: ListQuery }>(
    '/clinicians/:id/appointments',
    {
      schema: {
        tags: ['clinicians'],
        params: clinicianParams,
        querystring: paginationQuerystring,
        response: {
          200: { description: 'List of clinician appointments', ...paginatedAppointmentsResponse },
          400: { description: 'Invalid query parameters', ...errorSchema },
          404: { description: 'Clinician not found', ...errorSchema },
        },
      },
    },
    async (req, reply) => {
      const result = getClinicianAppointments(db, req.params.id, req.query);
      if (!result.ok) {
        return reply.status(404).send({ error: `Clinician '${req.params.id}' not found` });
      }
      return reply.send(result.appointments);
    }
  );
}
