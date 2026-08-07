// When the backend runs inside a Docker container, hostname 'localhost' points
// at the container itself, not the host machine. Environments configured with
// host 'localhost' (e.g. a local Postgres on the host) become unreachable.
// Set DOCKER_HOST_REMAP=true in the container (docker-compose) so that
// localhost/127.0.0.1 resolve to host.docker.internal, which reaches the host.
const DOCKER_HOST_REMAP = process.env.DOCKER_HOST_REMAP === 'true';

export const resolveDbHost = (host) => {
  if (!DOCKER_HOST_REMAP) return host;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return 'host.docker.internal';
  }
  return host;
};
