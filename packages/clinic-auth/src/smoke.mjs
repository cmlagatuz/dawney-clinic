import { randomUUID } from 'node:crypto';

/** Runtime guard shared by live smoke scripts and offline tests. */
export function validateSmokeInputs(operation, environment) {
  if (!['read-only', 'clinical', 'storage'].includes(operation)) {
    throw new Error('Unsupported clinic smoke operation');
  }
  const required = [
    'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY',
    'DAWNEY_TEST_A_EMAIL', 'DAWNEY_TEST_A_PASSWORD',
    'DAWNEY_TEST_B_EMAIL', 'DAWNEY_TEST_B_PASSWORD'
  ];
  const missing = required.filter(k => typeof environment[k] !== 'string' || !environment[k]);
  if (missing.length) throw new Error('Missing required GitHub Actions secrets: ' + missing.join(', '));
  if (operation !== 'read-only' && environment.DAWNEY_ALLOW_SYNTHETIC_WRITES !== 'YES') {
    throw new Error('Synthetic writes require explicit opt-in; do not use production clinic data');
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(environment.SUPABASE_URL)) {
    throw new Error('Unexpected Supabase URL; refuse to send test credentials');
  }
  return {operation, url: environment.SUPABASE_URL.replace(/\/+$/, ''), publishableKey: environment.SUPABASE_PUBLISHABLE_KEY};
}

export function fixtureName(side, runId = 'local') {
  if (!['A', 'B'].includes(side) || !/^[a-zA-Z0-9_-]{1,32}$/.test(runId)) {
    throw new Error('Invalid synthetic fixture marker');
  }
  return 'DAWNEY_SMOKE_' + side + '_' + runId;
}

export function attachmentObjectKey(petId, accountId) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(petId) || !uuid.test(accountId)) throw new Error('Attachment paths require valid UUIDs');
  return 'pets/' + petId + '/owners/' + accountId + '/' + randomUUID() + '.pdf';
}

export function deniedStatus(status) {
  return [400, 401, 403, 404].includes(status);
}

/** Return minimal results only; never include a JWT, key, address or password in errors. */
export async function apiRequest({ url, publishableKey, token, fetchImpl = fetch }, path,
  { method = 'GET', body, headers = {} } = {}) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path');
  const response = await fetchImpl(url + path, {
    method,
    headers: {
      apikey: publishableKey,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  let data = null;
  if (response.headers.get('content-type')?.includes('application/json')) {
    try { data = await response.json(); } catch { /* malformed errors are not logged */ }
  }
  return { ok: response.ok, status: response.status, data };
}
