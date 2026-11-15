// Frontend-only auth return helpers (kept out of the shared #43 booking-contract bytes).
import {BOOKING_RETURN_PATH,safeBookingReturnPath} from './booking-contract.mjs'
/**
 * Decide where an auth screen returns to. Only the exact allowlisted hint
 * '/book' (or a still-valid stored intent in THIS tab) selects the booking page;
 * everything else, including malformed/array/forged values, falls back to the
 * owner overview. `needsReselect` is true when the hint arrived without the
 * short-lived intent (e.g. email verification opened in a fresh tab).
 */
export function resolveAfterAuth(nextParam,storedIntent){
 const hint=typeof nextParam==='string'&&safeBookingReturnPath(nextParam)===BOOKING_RETURN_PATH
 const toBook=hint||Boolean(storedIntent)
 return {toBook,needsReselect:toBook&&!storedIntent,
  dest:toBook?BOOKING_RETURN_PATH:'/app/overview',suffix:toBook?'?next=%2Fbook':''}
}
/** Email-verification redirect: fixed path plus, at most, the constant '?next=/book' hint. Never any user data. */
export function authCallbackUrl(origin,toBook){
 if(typeof origin!=='string'||!/^https?:\/\/[^/?#\s]+$/.test(origin))throw Error('Valid origin required')
 return origin+'/auth/callback'+(toBook?'?next=%2Fbook':'')
}
