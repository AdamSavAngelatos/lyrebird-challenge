// --- TypeScript interfaces (for Fastify route generics) ---

export interface CreateAppointmentBody {
  clinicianId: string;
  patientId: string;
  start: string;
  end: string;
}

export interface ListQuery {
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

// --- JSON Schema (OpenAPI / Swagger) ---

export const appointmentProperties = {
  id: { type: 'string' },
  clinicianId: { type: 'string' },
  patientId: { type: 'string' },
  start: { type: 'string', format: 'date-time' },
  end: { type: 'string', format: 'date-time' },
  createdAt: { type: 'string', format: 'date-time' },
};

export const createAppointmentBody = {
  type: 'object',
  required: ['clinicianId', 'patientId', 'start', 'end'],
  properties: {
    clinicianId: { type: 'string', minLength: 1 },
    patientId: { type: 'string', minLength: 1 },
    start: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 UTC datetime, must be in the future',
    },
    end: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 UTC datetime, must be after start',
    },
  },
};

export const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
    details: { type: 'object', additionalProperties: true },
  },
};

export const clinicianParams = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', description: 'Clinician ID' },
  },
};

export const paginationQuerystring = {
  type: 'object',
  properties: {
    from: {
      type: 'string',
      format: 'date-time',
      description: 'Filter appointments starting from this datetime',
    },
    to: {
      type: 'string',
      format: 'date-time',
      description: 'Filter appointments up to this datetime',
    },
    limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
    offset: { type: 'integer', minimum: 0, default: 0 },
  },
};

export const paginatedAppointmentsResponse = {
  type: 'object',
  properties: {
    data: { type: 'array', items: { type: 'object', properties: appointmentProperties } },
    total: { type: 'integer' },
    limit: { type: 'integer' },
    offset: { type: 'integer' },
  },
};
