import { z } from 'zod';

// --- Zod (runtime validation) ---

export const isoDatetime = z
  .string()
  .refine((s) => !isNaN(new Date(s).getTime()), { message: 'Must be a valid ISO datetime' });

export const createAppointmentSchema = z
  .object({
    clinicianId: z.string().min(1, 'clinicianId is required'),
    patientId: z.string().min(1, 'patientId is required'),
    start: isoDatetime,
    end: isoDatetime,
  })
  .superRefine((data, ctx) => {
    const s = new Date(data.start);
    const e = new Date(data.end);
    if (s >= e) {
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'end must be after start' });
    }
    if (s <= new Date()) {
      ctx.addIssue({ code: 'custom', path: ['start'], message: 'start must be in the future' });
    }
  });

export const listQuerySchema = z.object({
  from: isoDatetime.optional(),
  to: isoDatetime.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// --- JSON Schema (OpenAPI / Swagger) ---

export const appointmentProperties = {
  id: { type: 'string' },
  clinicianId: { type: 'string' },
  patientId: { type: 'string' },
  start: { type: 'string', format: 'date-time' },
  end: { type: 'string', format: 'date-time' },
  createdAt: { type: 'string', format: 'date-time' },
};

export const errorSchema = { type: 'object', properties: { error: { type: 'string' } } };

export const paginationQuerystring = {
  type: 'object',
  properties: {
    from: { type: 'string', format: 'date-time', description: 'Filter appointments starting from this datetime' },
    to: { type: 'string', format: 'date-time', description: 'Filter appointments up to this datetime' },
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
