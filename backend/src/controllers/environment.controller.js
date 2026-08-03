import * as environmentService from '../services/environment.service.js';

export const create = async (req, res) => {
  const environment = await environmentService.createEnvironment(req.body);
  res.status(201).json({ success: true, data: environment });
};

export const getAll = async (req, res) => {
  const environments = await environmentService.getAllEnvironments();
  res.status(200).json({ success: true, data: environments });
};

export const getById = async (req, res) => {
  const environment = await environmentService.getEnvironmentById(req.params.id);
  res.status(200).json({ success: true, data: environment });
};

export const update = async (req, res) => {
  const environment = await environmentService.updateEnvironment(req.params.id, req.body);
  res.status(200).json({ success: true, data: environment });
};

export const remove = async (req, res) => {
  const result = await environmentService.deleteEnvironment(req.params.id);
  res.status(200).json({ success: true, data: result });
};
