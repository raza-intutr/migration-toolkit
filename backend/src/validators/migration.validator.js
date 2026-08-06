import { z } from 'zod';

const baseTenantFields = {
  sourceTenantCode: z.string().min(1, 'sourceTenantCode is required'),
  destinationTenantCode: z.string().min(1, 'destinationTenantCode is required'),
  // Optional — when omitted, all user tables in the source are migrated.
  tables: z.array(z.string().min(1)).optional(),
  // TRUNCATE destination before copy (default true). Set false to merge.
  truncateFirst: z.boolean().default(true),
  // Skip rows that violate FK / unique constraints on the destination.
  onConflictSkip: z.boolean().default(true),
  // Default true — report row counts + per-table plan, but never write.
  // Set false to actually TRUNCATE/INSERT into the destination.
  dryRun: z.boolean().default(true),
};

// Same-environment migration: source + destination tenants live under
// the environment identified by the :id path param.
export const migrateTenantSchema = z.object(baseTenantFields);

// Cross-environment migration: each tenant can live in a different
// environment. destinationEnvironmentId defaults to sourceEnvironmentId
// when omitted (same as same-env mode).
export const crossEnvironmentMigrateSchema = z.object({
  ...baseTenantFields,
  sourceEnvironmentId: z.string().min(1, 'sourceEnvironmentId is required'),
  destinationEnvironmentId: z.string().min(1).optional(),
});

// Truncate every user table in a tenant. Schema is preserved — only rows
// are removed. `tables` scopes which tables to truncate (matched on
// unqualified name); omitted = every user table.
export const truncateTenantSchema = z.object({
  tenantCode: z.string().min(1, 'tenantCode is required'),
  tables: z.array(z.string().min(1)).optional(),
});
