// --- TypeScript interfaces (for Fastify route generics) ---

export interface ClinicianParams {
  id: string;
}

// --- JSON Schema (OpenAPI / Swagger) ---

export const clinicianParams = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', description: 'Clinician ID' },
  },
};
