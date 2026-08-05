import { z } from 'zod';

export const migrateTenantSchema = z.object({
  sourceTenantCode: z.string().min(1, 'sourceTenantCode is required'),
  destinationTenantCode: z.string().min(1, 'destinationTenantCode is required'),
  // Optional — when omitted, all user tables in the source are migrated.
  tables: z.array(z.string().min(1)).optional(),
  // TRUNCATE destination before copy (default true). Set false to merge.
  truncateFirst: z.boolean().default(true),
  // Skip rows that violate FK / unique constraints on the destination.
  onConflictSkip: z.boolean().default(true),
});
