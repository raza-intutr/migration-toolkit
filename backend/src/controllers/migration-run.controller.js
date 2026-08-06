import * as migrationRunService from '../services/migration-run.service.js';

export const trigger = async (req, res) => {
  const run = await migrationRunService.triggerMigration(req.body);
  res.status(201).json({ success: true, data: migrationRunService.sanitizeMigrationRun(run) });
};

export const list = async (req, res) => {
  const runs = await migrationRunService.listMigrations();
  res.json({ success: true, data: runs.map(migrationRunService.sanitizeMigrationRun) });
};

export const getOne = async (req, res) => {
  const run = await migrationRunService.getMigration(req.params.id);
  res.json({ success: true, data: migrationRunService.sanitizeMigrationRun(run) });
};
