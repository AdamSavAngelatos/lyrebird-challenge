import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { Database } from 'better-sqlite3';
import { requireRole } from '../middleware/role.js';
import {
  type CreateAppointmentBody,
  type ListQuery,
  createAppointmentBody,
  appointmentProperties,
  errorSchema,
  paginationQuerystring,
  paginatedAppointmentsResponse,
} from '../schemas/appointment.js';
import { createAppointment, listAppointments } from '../services/appointmentService.js';
import { Roles } from '../types.js';

interface PluginOptions extends FastifyPluginOptions {
  db: Database;
}

export async function appointmentRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const { db } = opts;

  // POST /v1/appointments
  app.post<{ Body: CreateAppointmentBody }>(
    '/appointments',
    {
      schema: {
        tags: ['appointments'],
        body: createAppointmentBody,
        response: {
          201: {
            description: 'Appointment created',
            type: 'object',
            properties: appointmentProperties,
          },
          400: { description: 'Invalid request body', ...errorSchema },
          409: { description: 'Clinician has a conflicting appointment', ...errorSchema },
        },
      },
    },
    async (req, reply) => {
      const result = createAppointment(db, req.body);
      if (!result.ok) {
        switch (result.reason) {
          case 'conflict':
            return reply.status(409).send({
              error:
                'Conflict: the requested time slot overlaps an existing appointment for this clinician',
            });
          case 'start_not_future':
            return reply.status(400).send({ error: 'start must be in the future' });
          case 'end_not_after_start':
            return reply.status(400).send({ error: 'end must be after start' });
        }
      }
      return reply.status(201).send(result.appointment);
    }
  );

  // GET /v1/appointments (admin only)
  app.get<{ Querystring: ListQuery }>(
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
      requireRole(req, Roles.admin);
      return reply.send(listAppointments(db, req.query));
    }
  );
}
