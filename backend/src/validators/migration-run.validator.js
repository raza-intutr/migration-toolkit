import { z } from 'zod';

export const triggerMigrationSchema = z.object({
  source_env_id: z.string().min(1),
  source_tenant_code: z.string().min(1),
  target_env_id: z.string().min(1),
  target_tenant_code: z.string().min(1),
  confirm_overwrite: z.boolean().default(false),
});
