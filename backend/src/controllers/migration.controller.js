import * as migrationService from '../services/migration.service.js';

export const migrate = async (req, res) => {
  const result = await migrationService.migrateTenant(req.params.id, req.body);
  res.status(200).json({ success: true, data: result });
};

export const migrateCrossEnvironment = async (req, res) => {
  const result = await migrationService.migrateCrossEnvironment(req.body);
  res.status(200).json({ success: true, data: result });
};

export const truncate = async (req, res) => {
  const result = await migrationService.truncateTenant(req.params.id, req.body);
  res.status(200).json({ success: true, data: result });
};