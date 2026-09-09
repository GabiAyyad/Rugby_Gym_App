/**
 * Client-side fetch helper. Throws ApiError on failure so callers can `try`
 * around a mutation instead of unwrapping the envelope by hand.
 */

/** Thrown by apiFetch (and the `api.*` shortcuts) whenever the server responds with `{ ok: false }`. */
export class ApiError extends Error {
  constructor(message, status, fieldErrors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Fetches `path`, always sending/expecting JSON, and unwraps the server's
 * ApiResult envelope (see lib/http.js): returns `data` on `{ ok: true }`, or
 * throws ApiError on `{ ok: false }` (or on a response that isn't even valid JSON).
 */
export async function apiFetch(path, init) {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('The server returned an unreadable response.', response.status);
  }

  if (!payload.ok) throw new ApiError(payload.error, response.status, payload.fieldErrors);
  return payload.data;
}

/** Small verb-named shortcuts over apiFetch — what every component actually calls. */
export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path, body) => apiFetch(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
};
