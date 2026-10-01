// api/_helpers.js
// Reusable helpers used by every serverless function.

/** CORS headers — allow your React frontend origin */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  process.env.FRONTEND_URL || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Apply CORS headers and handle pre-flight OPTIONS requests.
 * Call at the very top of every handler.
 * Returns true if the caller should stop (it was a pre-flight).
 */
export function handleCors(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // caller should return immediately
  }
  return false;
}

/** Send a JSON success response */
export function ok(res, data, status = 200) {
  return res.status(status).json(data);
}

/** Send a JSON error response */
export function fail(res, message, status = 500, details = null) {
  const body = { error: message };
  if (details && process.env.NODE_ENV !== 'production') body.details = details;
  return res.status(status).json(body);
}

/** Parse a positive integer from a query param, with a fallback default */
export function intParam(query, key, defaultVal) {
  const v = parseInt(query[key], 10);
  return isNaN(v) || v < 1 ? defaultVal : v;
}
