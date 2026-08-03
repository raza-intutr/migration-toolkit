import * as tenantService from '../services/tenant.service.js';

export const getTenants = async (req, res) => {
  const tenants = await tenantService.getTenantsByEnvironmentId(req.params.id);
  res.status(200).json({ success: true, data: tenants });
};

export const getTenantByCode = async (req, res) => {
  const tenant = await tenantService.getTenantByTenantCode(req.params.id, req.params.tenantCode);
  res.status(200).json({ success: true, data: tenant });
};

export const testConnection = async (req, res) => {
  const result = await tenantService.testEnvironmentConnection(req.params.id);
  res.status(200).json({ success: true, data: result });
};

export const testTenantConnection = async (req, res) => {
  const result = await tenantService.testTenantConnection(req.params.id, req.params.tenantCode);
  res.status(200).json({ success: true, data: result });
};
