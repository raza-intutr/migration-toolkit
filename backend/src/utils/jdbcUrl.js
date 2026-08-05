import { AppError } from './AppError.js';

export const parseJdbcUrl = (url) => {
  const match = url.match(/^jdbc:postgresql:\/\/([^:/]+)(?::(\d+))?\/([^?]+)(\?.*)?$/);
  if (!match) {
    throw new AppError('Tenant db_details.url must be a valid jdbc:postgresql URL', 400);
  }

  const [, host, port, database, queryString] = match;
  const params = new URLSearchParams(queryString?.slice(1) || '');
  
  let ssl;
  const sslMode = params.get('sslmode') || params.get('ssl');
  if (sslMode !== null) {
    ssl = sslMode !== 'disable' && sslMode !== 'false';
  }

  return {
    host,
    port: port ? Number(port) : 5432,
    database,
    ssl,
  };
};
