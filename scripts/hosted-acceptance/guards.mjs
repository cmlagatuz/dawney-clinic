/**
 * Source-only hosted acceptance guards. Nothing here opens a network connection.
 * A future transport must be separately reviewed and owner-authorized.
 */
import {createHash, createPublicKey, verify as verifySignature} from 'node:crypto';

export const REVIEWED_SOURCE_SHA='2bbcbde08f3a73aa222bec2c8f3332f23b09eba2';
export const PROTECTED_PROJECT_REF='lgimhirgvresvbsdugac';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid=value=>typeof value==='string'&&uuid.test(value);
export function ensure(condition,code){if(!condition)throw new Error('HOSTED_ACCEPTANCE_BLOCKED:'+code);}
const decodeBase64Url=s=>{
 ensure(typeof s==='string'&&/^[A-Za-z0-9_-]+$/.test(s)&&s.length<16384,'invalid_encoding');
 return Buffer.from(s,'base64url');
};
const object=(v)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const parse=(s,code)=>{try{const v=JSON.parse(s);ensure(object(v),code);return v;}catch{throw new Error('HOSTED_ACCEPTANCE_BLOCKED:'+code);}};
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

/** A separately pinned SHA-256 public-key fingerprint, not a key from the approval itself. */
export function verifyOwnerGate({approval,trust,staging,now=Date.now()}={}){
 ensure(object(approval)&&object(approval.claims)&&typeof approval.signature==='string','approval_required');
 ensure(object(trust)&&typeof trust.publicKey==='string'&&/^[0-9a-f]{64}$/i.test(trust.pinnedSha256??''),'trusted_owner_key_required');
 let key;
 try{key=createPublicKey(trust.publicKey);}catch{throw new Error('HOSTED_ACCEPTANCE_BLOCKED:owner_public_key_invalid');}
 ensure(key.asymmetricKeyType==='rsa','owner_key_algorithm');
 const fingerprint=sha256(key.export({type:'spki',format:'der'}));
 ensure(fingerprint===trust.pinnedSha256.toLowerCase(),'untrusted_approval_key');
 const claims=approval.claims;
 const signed=Buffer.from(JSON.stringify(claims),'utf8');
 let good=false;
 try{good=verifySignature('RSA-SHA256',signed,key,decodeBase64Url(approval.signature));}catch{}
 ensure(good,'owner_signature_invalid');
 ensure(claims.kind==='dawney-hosted-security-acceptance-v1'&&claims.ownerApproved===true&&
   claims.allowSyntheticWrites===true&&claims.environment==='disposable-staging' &&
   claims.verifiedSeparateProject===true,'owner_approval_scope');
 ensure(claims.sourceSha===REVIEWED_SOURCE_SHA,'source_sha_not_approved');
 ensure(typeof claims.runId==='string'&&/^[A-Z0-9_-]{8,32}$/.test(claims.runId),'run_marker_invalid');
 ensure(Number.isSafeInteger(claims.notBefore)&&Number.isSafeInteger(claims.expiresAt)&&
   claims.expiresAt-claims.notBefore>0&&claims.expiresAt-claims.notBefore<=3600000&&
   now>=claims.notBefore&&now<claims.expiresAt,'approval_expired');
 ensure(object(staging)&&typeof staging.ref==='string'&&/^[a-z0-9]{20}$/.test(staging.ref) &&
   staging.ref!==PROTECTED_PROJECT_REF&&staging.ref!==staging.productionRef &&
   staging.productionRef===PROTECTED_PROJECT_REF,'staging_not_separate');
 ensure(staging.origin===`https://${staging.ref}.supabase.co` &&
   claims.projectRef===staging.ref&&claims.origin===staging.origin,'staging_origin_mismatch');
 return {runId:claims.runId,origin:staging.origin};
}

/** Public asymmetric JWKS cryptography; HS256, none, invalid kid/audience/issuer fail. */
export function verifySignedJwt(token,jwks,{origin,expectedSub,now=Date.now(),anonymous=false}){
 ensure(typeof token==='string'&&token.length<32768,'jwt_required');
 const parts=token.split('.');
 ensure(parts.length===3,'jwt_segments');
 const header=parse(decodeBase64Url(parts[0]).toString('utf8'),'jwt_header');
 const claims=parse(decodeBase64Url(parts[1]).toString('utf8'),'jwt_claims');
 ensure(header.alg==='RS256'&&typeof header.kid==='string'&&header.kid.length>0,'jwt_algorithm');
 ensure(object(jwks)&&Array.isArray(jwks.keys),'jwks_missing');
 const keys=jwks.keys.filter(k=>k.kid===header.kid);
 ensure(keys.length===1&&keys[0].kty==='RSA'&&keys[0].alg!=='HS256'&&
   keys[0].use!=='enc'&&!('d' in keys[0]),'jwks_key_invalid');
 let valid=false;
 try{
  const key=createPublicKey({key:keys[0],format:'jwk'});
  valid=verifySignature('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,decodeBase64Url(parts[2]));
 }catch{}
 ensure(valid,'jwt_signature_invalid');
 const seconds=Math.floor(now/1000);
 ensure(claims.iss===origin+'/auth/v1'&&
   (claims.aud==='authenticated'||Array.isArray(claims.aud)&&claims.aud.includes('authenticated'))&&
   claims.role==='authenticated'&&isUuid(claims.sub)&&claims.sub===expectedSub,'jwt_identity_invalid');
 ensure(Number.isInteger(claims.exp)&&claims.exp>seconds&&claims.exp<=seconds+86400&&
  Number.isInteger(claims.iat)&&claims.iat<=seconds+60&&
  (!claims.nbf||claims.nbf<=seconds),'jwt_expired_or_not_yet_valid');
 ensure((claims.is_anonymous===true)===anonymous,'jwt_anonymity_mismatch');
 return {sub:claims.sub,anonymous};
}

export function assertFixtures(fixtures){
 ensure(object(fixtures)&&object(fixtures.ownerA)&&object(fixtures.ownerB)&&
  object(fixtures.staff)&&object(fixtures.revoked)&&object(fixtures.anonymousAuth),'synthetic_fixture_required');
 const f=fixtures;
 for(const obj of [f.ownerA,f.ownerB])for(const key of ['userId','ownerId','petId'])
  ensure(isUuid(obj[key]),'owner_fixture_uuid');
 for(const obj of [f.staff,f.revoked,f.anonymousAuth])ensure(isUuid(obj.userId),'actor_fixture_uuid');
 const ids=[f.ownerA.userId,f.ownerB.userId,f.staff.userId,f.revoked.userId,f.anonymousAuth.userId];
 ensure(new Set(ids).size===ids.length&&f.ownerA.ownerId!==f.ownerB.ownerId&&
  f.ownerA.petId!==f.ownerB.petId,'fixture_identity_collision');
 ensure(isUuid(f.serviceId)&&isUuid(f.resourceId)&&typeof f.slotA==='string'&&
  typeof f.slotB==='string'&&Number.isFinite(Date.parse(f.slotA))&&
  Number.isFinite(Date.parse(f.slotB))&&f.slotA!==f.slotB,'approved_slot_fixture_missing');
 ensure(f.staff.expectedRole==='veterinarian'&&f.revoked.expectedRole==='veterinarian',
  'staff_role_fixture');
}

/** Safe path builder; no names, emails or medical record text in object keys. */
export function storageKey(petId,userId,objectId,{clinic=false}={}){
 ensure(isUuid(petId)&&isUuid(objectId)&&(!userId||isUuid(userId)),'storage_path_uuid');
 return clinic?`pets/${petId}/clinic/${objectId}.pdf`
   :`pets/${petId}/owners/${userId}/${objectId}.pdf`;
}
