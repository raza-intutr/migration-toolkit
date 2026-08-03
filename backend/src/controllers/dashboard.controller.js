import * as dashboardService from '../services/dashboard.service.js';

export const getDashboard = async (req, res) => {
  const data = await dashboardService.getDashboard();
  res.status(200).json({ success: true, data });
};
