import { z } from 'zod';

const nameSchema = z.string().min(1, 'Name is required');

export const createEnvironmentSchema = z.object({
  name: nameSchema,
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  db: z.string().min(1, 'Database name is required'),
  user: z.string().min(1, 'User is required'),
  password: z.string().nullable().optional(),
  ssl_mode: z.string().min(1).default('require'),
  is_active: z.boolean().default(true),
  ismultitenant: z.boolean().default(false),
});

export const testEnvironmentConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  db: z.string().min(1, 'Database name is required'),
  user: z.string().min(1, 'User is required'),
  password: z.string().optional(),
  ssl_mode: z.string().min(1).default('require'),
});

export const updateEnvironmentSchema = z.object({
  name: nameSchema.optional(),
  host: z.string().min(1).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  db: z.string().min(1).optional(),
  user: z.string().min(1).optional(),
  password: z.string().nullable().optional(),
  ssl_mode: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  ismultitenant: z.boolean().optional(),
});
