import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Terminal handler for the decommissioned Render API surface.
 *
 * Vercel serverless functions under `api/*.ts` are the primary backend. The
 * `/v1/*`, `/api/v1/*`, and telemetry routes that previously proxied to Render
 * are intentionally retired. Returning 410 makes that state explicit instead of
 * letting the SPA fallback answer API calls with HTML or a misleading 404.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex');

  return res.status(410).json({
    error: {
      code: 'route_decommissioned',
      message:
        'This API route has been decommissioned. Vercel serverless routes under /api/* are the supported backend.',
    },
    method: req.method ?? 'UNKNOWN',
    timestamp: new Date().toISOString(),
  });
}
