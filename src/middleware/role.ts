import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { VALID_ROLES, type Role } from '../types.js';

export function registerRoleMiddleware(app: FastifyInstance): void {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const rawRole =
      (req.headers['x-role'] as string | undefined) ??
      (req.query as Record<string, string>).role;

    if (!rawRole) return;

    if (!VALID_ROLES.includes(rawRole as Role)) {
      return reply
        .status(400)
        .send({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    req.role = rawRole as Role;
  });
}

export function requireRole(req: FastifyRequest, role: Role): void {
  if (req.role !== role) {
    const err = Object.assign(new Error(`Forbidden: requires role '${role}'`), { statusCode: 403 });
    throw err;
  }
}
