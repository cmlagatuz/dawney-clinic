/**
 * Backend-only advisory preflight for a future owner-approved staff service.
 * Never trust request-provided actor/MFA claims; populate context from verified
 * Auth + privileged DB session only. NOT a substitute for RLS/DB transactions.
 * Intentionally NO Supabase SDK/DB writes and NO public browser endpoint.
 */
const roles = new Set(['administrator','veterinarian','staff']);
const operations = new Set(['grant','role_change','revoke','reactivate']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reasons=new Set(['onboarding','role-change','offboarding','emergency-recovery','correction']);

function verified(person,label) {
  if(!person || typeof person.userId!=='string' || !uuid.test(person.userId) ||
     person.emailConfirmed!==true || person.anonymous!==false ||
     person.deleted!==false || person.banned!==false) {
    throw Error('Unverified or ineligible '+label);
  }
}
function trustedAdmin(admin,label) {
  verified(admin,label);
  if(admin.active!==true || admin.role!=='administrator' || admin.aal!=='aal2') {
    throw Error('Privileged '+label+' requires active admin and MFA assurance level two');
  }
}
export function reviewStaffIntent(input,context) {
  if(!input || !operations.has(input.operation)) throw Error('Unsupported staff operation');
  if(!context || context.trustedServerContext!==true) {
    throw Error('Staff intent requires trusted server context');
  }
  // This marker must be set ONLY by the server after verifying Supabase Auth.
  // A browser-supplied marker is meaningless and must never be forwarded.
  trustedAdmin(context.actor,'actor');
  verified(context.target,'target');
  if(!Number.isSafeInteger(context.activeAdminCount)||context.activeAdminCount<1) {
    throw Error('Active administrator count unavailable');
  }
  const reason=typeof input.reasonCode==='string'?input.reasonCode:'';
  if(!reasons.has(reason) || typeof input.ticketId!=='string' ||
     !/^[A-Z][A-Z0-9-]{5,63}$/.test(input.ticketId)) {
    throw Error('Staff operation needs approved reason and audit ticket');
  }
  if(context.actor.userId===context.target.userId) {
    throw Error('Privileged staff actor cannot change own membership');
  }
  if(['grant','role_change','reactivate'].includes(input.operation)) {
    if(!context.target.emailConfirmed || !roles.has(input.role))throw Error('Unknown staff role');
  }
  if(['revoke','role_change'].includes(input.operation) &&
     context.currentTargetRole==='administrator' && context.currentTargetActive===true &&
     (input.operation==='revoke'||input.role!=='administrator') &&
     context.activeAdminCount<=1) {
    throw Error('Cannot remove last active administrator');
  }
  const privileged=input.role==='administrator' || context.currentTargetRole==='administrator' ||
    input.operation==='revoke' || reason==='emergency-recovery';
  let reviewerId=null;
  if(privileged) {
    trustedAdmin(context.reviewer,'independent reviewer');
    if(context.reviewer.userId===context.actor.userId ||
       context.reviewer.userId===context.target.userId) {
      throw Error('Privileged staff change needs separate reviewer');
    }
    reviewerId=context.reviewer.userId;
  }
  // Immutable-ish intended audit payload, not a persisted audit event.
  return Object.freeze({
    operation:input.operation,subjectUserId:context.target.userId,
    actorUserId:context.actor.userId,reviewerUserId:reviewerId,
    requestedRole:input.operation==='revoke'?null:input.role,
    reasonCode:reason,ticketId:input.ticketId,
    requiresTrustedTransaction:true
  });
}
