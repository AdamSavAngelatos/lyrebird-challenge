import Fastify from 'fastify';
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

  registerRoleMiddleware(app);

  await app.register(appointmentRoutes, { prefix: '/v1', db });
  await app.register(clinicianRoutes, { prefix: '/v1', db });

  return app;
}
