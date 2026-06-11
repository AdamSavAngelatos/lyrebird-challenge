export const Roles = {
  patient: 'patient',
  clinician: 'clinician',
  admin: 'admin',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];
export const VALID_ROLES = Object.values(Roles) as Role[];

declare module 'fastify' {
  interface FastifyRequest {
    role?: Role;
  }
}
