-- CreateTable
CREATE TABLE "migration_runs" (
    "id" TEXT NOT NULL,
    "source_env_id" TEXT NOT NULL,
    "target_env_id" TEXT NOT NULL,
    "source_tenant_code" TEXT NOT NULL,
    "target_tenant_code" TEXT NOT NULL,
    "tenant_schema" TEXT NOT NULL,
    "overwrite_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'running',
    "dump_file_path" TEXT,
    "row_counts" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "migration_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "migration_runs_source_env_id_idx" ON "migration_runs"("source_env_id");

-- CreateIndex
CREATE INDEX "migration_runs_target_env_id_idx" ON "migration_runs"("target_env_id");

-- CreateIndex
CREATE INDEX "migration_runs_status_idx" ON "migration_runs"("status");

-- AddForeignKey
ALTER TABLE "migration_runs" ADD CONSTRAINT "migration_runs_source_env_id_fkey" FOREIGN KEY ("source_env_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_runs" ADD CONSTRAINT "migration_runs_target_env_id_fkey" FOREIGN KEY ("target_env_id") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
