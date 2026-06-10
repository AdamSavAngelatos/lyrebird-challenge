import Fastify, { type FastifyError } from 'fastify';
import type { Database } from 'better-sqlite3';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { registerRoleMiddleware } from './middleware/role.js';
import { appointmentRoutes } from './routes/appointments.js';
import { clinicianRoutes } from './routes/clinicians.js';

export async function createApp(db: Database) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Clinic Appointment API',
        description: 'RESTful API for a simplified clinic appointment system',
        version: '1.0.0',
      },
      tags: [
        { name: 'appointments', description: 'Appointment management' },
        { name: 'clinicians', description: 'Clinician schedule' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list' },
  });

  app.setErrorHandler((error: FastifyError, _req, reply) => {
    if (error.validation) {
      const fieldErrors: Record<string, string[]> = {};
      for (const v of error.validation) {
        const field =
          v.instancePath.replace(/^\//, '') ||
          (v.params as Record<string, string>)?.missingProperty ||
          'unknown';
        fieldErrors[field] = [...(fieldErrors[field] ?? []), v.message ?? 'Invalid value'];
      }
      return reply.status(400).send({ error: 'Validation error', details: { fieldErrors } });
    }
    reply.status(error.statusCode ?? 500).send({ error: error.message });
  });

  registerRoleMiddleware(app);

  await app.register(appointmentRoutes, { prefix: '/v1', db });
  await app.register(clinicianRoutes, { prefix: '/v1', db });

  return app;
}
