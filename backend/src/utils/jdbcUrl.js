import { AppError } from './AppError.js';

export const parseJdbcUrl = (url) => {
  const match = url.match(/^jdbc:postgresql:\/\/([^:/]+)(?::(\d+))?\/([^?]+)/);
  if (!match) {
    throw new AppError('Tenant db_details.url must be a valid jdbc:postgresql URL', 400);
  }
  return {
    host: match[1],
    port: match[2] ? Number(match[2]) : 5432,
    database: match[3],
  };
};
