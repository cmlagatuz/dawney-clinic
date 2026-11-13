/**
 * Read-only Pages fingerprint/canary verification for static rollback.
 * No credentials, cookies, patient data, Cloudflare API token or mutations.
 * The digest covers returned index HTML only, not remote DB state or client execution.
 */
import {createHash} from 'node:crypto';
import {checkPages, validatePagesOrigin} from './check-pages.mjs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

export function validateDigest(value) {
  if(typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw Error('Expected a lowercase SHA-256 digest (64 hex characters)');
  }
  return value;
}

export async function fingerprintPages(origin, fetchImpl = fetch) {
  const safeOrigin = validatePagesOrigin(origin);
  // Exercise all shipped SPA routes and headers before capturing a fingerprint.
  await checkPages(safeOrigin,fetchImpl);
  const response = await fetchImpl(safeOrigin+'/', {
    redirect:'error', headers:{Accept:'text/html'}
  });
  if(response.status !== 200 || !response.headers.get('content-type')?.includes('text/html') ||
     response.headers.get('x-content-type-options')?.toLowerCase() !== 'nosniff' ||
     !response.headers.get('content-security-policy')?.includes("default-src 'self'")) {
    throw Error('Pages root response failed security/HTML validation');
  }
  const body = await response.text();
  if(body.length > 2_000_000 || !body.includes('id="root"') || !body.includes('/assets/')) {
    throw Error('Pages index HTML is oversized or missing React assets');
  }
  return createHash('sha256').update(body,'utf8').digest('hex');
}

export async function verifyRollback(origin, expectedDigest, fetchImpl = fetch) {
  validateDigest(expectedDigest);
  const actual = await fingerprintPages(origin,fetchImpl);
  if(actual !== expectedDigest) throw Error('Static index fingerprint mismatch; rollback not verified');
  return true;
}

if(process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [operation,origin,digest] = process.argv.slice(2);
    if(operation === 'capture' && origin && !digest) {
      const fingerprint = await fingerprintPages(origin);
      console.log('Static index SHA-256: '+fingerprint);
      console.log('Record it privately with the exact successful production deployment ID and commit.');
    } else if(operation === 'verify' && origin && digest) {
      await verifyRollback(origin,digest);
      console.log('PASS: Pages routes, security headers and expected static index match.');
      console.log('This is NOT a database rollback, real-browser security test or clinical release.');
    } else {
      throw Error('Usage: pages-fingerprint.mjs capture <https://project.pages.dev> OR verify <origin> <sha256>');
    }
  } catch(error) {
    console.error('Pages fingerprint check failed: '+(error instanceof Error ? error.message : 'unknown'));
    process.exitCode=1;
  }
}
