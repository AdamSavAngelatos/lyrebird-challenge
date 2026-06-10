export type Role = 'patient' | 'clinician' | 'admin';
export const VALID_ROLES: Role[] = ['patient', 'clinician', 'admin'];

declare module 'fastify' {
  interface FastifyRequest {
    role?: Role;
  }
}
