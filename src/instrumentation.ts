/**
 * Runs once when the server starts, and on every uncaught request error.
 *  - Start-up: validate the environment so a bad deploy fails at boot, not on the first patient.
 *  - Errors: log the route and Next's digest with the same redaction as everything else.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { env } = await import('./server/env');
    env();
  }
}

export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routeType: string; routePath: string }) {
  const { log } = await import('./server/log');
  log.error('request error', { err, path: request.path.split('?')[0], method: request.method, routeType: context.routeType, routePath: context.routePath, digest: (err as { digest?: string })?.digest });
}
