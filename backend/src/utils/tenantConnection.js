import { parseJdbcUrl } from './jdbcUrl.js';

// Build a `pg` pool config from a resolved tenant connection object.
// `ssl_mode` values: 'require' -> SSL on, 'disable' -> SSL off.
export const buildPoolConfig = (conn) => ({
  host: conn.host,
  port: conn.port,
  database: conn.db,
  user: conn.user,
  password: conn.password ?? undefined,
  ssl: (conn.ssl_mode ?? 'require') === 'disable' ? false : { rejectUnauthorized: false },
});

// PG client env vars for the pg_dump/pg_restore child processes.
const buildEnv = (conn) => ({
  PGPASSWORD: conn.password ?? '',
  PGHOST: conn.host,
  PGPORT: String(conn.port),
  PGUSER: conn.user,
  PGDATABASE: conn.db,
  PGSSLMODE: conn.ssl_mode ?? 'require',
});

export const buildPgDumpCommand = (conn, dumpPath) => ({
  args: ['-F', 'c', '-f', dumpPath],
  env: buildEnv(conn),
});

export const buildPgRestoreCommand = (conn, dumpPath, opts = {}) => {
  const args = [];
  if (opts.clean) args.push('--clean', '--if-exists');
  args.push('--no-owner', '--no-privileges', '-d', conn.db, dumpPath);
  return { args, env: buildEnv(conn) };
};

export { parseJdbcUrl };
