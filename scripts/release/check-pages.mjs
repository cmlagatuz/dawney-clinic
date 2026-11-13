/**
 * Non-authenticated live Cloudflare Pages deep-link and header probe.
 * Does NOT log in, verify patient data, or replace a browser end-to-end test.
 */
export function validatePagesOrigin(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)?\.pages\.dev$/.test(u.hostname) || u.pathname !== '/') {
    throw Error('Use an HTTPS *.pages.dev origin only, without credentials, path or query');
  }
  return u.origin;
}
export async function checkPages(origin, fetchImpl=fetch) {
  const base=validatePagesOrigin(origin);
  const paths=['/','/auth/signin','/auth/callback','/auth/recovery','/app/profile','/app/pets'];
  for(const path of paths) {
    const res=await fetchImpl(base+path,{redirect:'error',headers:{Accept:'text/html'}});
    if(res.status!==200) throw Error('Unexpected HTTP status on app route '+path);
    if(!res.headers.get('content-type')?.includes('text/html')) {
      throw Error('Missing HTML SPA response on '+path);
    }
    if(res.headers.get('x-content-type-options')?.toLowerCase()!=='nosniff' ||
       !res.headers.get('content-security-policy')?.includes("default-src 'self'")) {
      throw Error('Missing expected browser security headers on '+path);
    }
    const html=await res.text();
    if(!html.includes('id="root"') || !html.includes('/assets/')) {
      throw Error('Missing React application mount on '+path);
    }
  }
  return paths.length;
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href) {
  try {
    const n=await checkPages(process.argv[2]);
    console.log('Pages HTTPS SPA fallback/header check passed on '+n+' paths.');
  } catch(e) {
    console.error('Pages HTTP probe failed: '+(e instanceof Error ? e.message : 'Unknown error'));
    process.exitCode=1;
  }
}
