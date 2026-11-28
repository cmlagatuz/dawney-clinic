import {lookup} from 'node:dns/promises'
import {execFileSync} from 'node:child_process'
import {existsSync,readdirSync,realpathSync,statSync} from 'node:fs'
import {resolve,relative,isAbsolute,sep,dirname,basename} from 'node:path'
import {setTimeout as sleep} from 'node:timers/promises'
export const RC2='8bb23dd31a516c16bc3e6544a25ef0cf9bb7403b'
export const WEB='f5dc0a98bf82fc75db7a5bf144f23236523505b8'
export const BACKEND='https://dawney-rc2-synthetic.supabase.co'
// Fixed local Mailpit read-only API; never a caller-controlled mail destination.
export const MAIL='http://127.0.0.1:54324'
export const SIGNUP_SUBJECT='Dawney synthetic signup confirmation'
export const RECOVERY_SUBJECT='Dawney synthetic password recovery'
export const LINK_PORT=4173
export const flags=Object.freeze([
 'VITE_PHASE4_PATIENT_FORM','VITE_PHASE5A_OPS_UI','VITE_STAFF_APPOINTMENT_WRITES_ENABLED',
 'VITE_CLINICAL_WORKSPACE_UI','VITE_CLINICAL_DRAFT_PERSISTENCE_UI','VITE_PHASE5B_PHARMACY_UI',
 'VITE_PHASE5C_BILLING_UI','VITE_STAFF_APPROVAL_WRITES_ENABLED','VITE_INVENTORY_WRITES_ENABLED'
])
export const roles=['ownerNew','ownerOther','applicant','administrator','veterinarian','receptionist','accountant']
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const day=/^\d{4}-\d{2}-\d{2}$/
// Match the frozen taxonomy adapter's canonical text-ID syntax, not UUIDs.
const catalogId=/^[a-z][a-z0-9-]{1,100}$/
const syntheticEmail=/^[a-z0-9._+-]+@example\.test$/
function requireThat(ok,message){if(!ok)throw Error(message)}
export function validatePacket(p,approval){
 requireThat(p&&p.version===2&&p.sourceSha===RC2&&p.webTree===WEB,'BLOCKED: exact RC2 packet required')
 requireThat(/^[a-z0-9-]{8,32}$/.test(p.runId??'')&&approval===p.runId,'BLOCKED: matching explicit synthetic run approval required')
 requireThat(p.backendOrigin===BACKEND&&p.runtime==='isolated-disposable-full-stack'&&p.networkIsolation===true&&p.syntheticOnly===true&&p.noExternalMail===true&&p.freshSeed===true&&p.migrationCount===23,'BLOCKED: ASTRA isolated runtime and all 23 migrations required')
 requireThat(p.mailOrigin===MAIL,'BLOCKED: exact local mail sink required')
 requireThat(p.authLinks===undefined||typeof p.authLinks==='boolean','BLOCKED: invalid optional link capability')
 requireThat(p.authLinks!==true||p.authLinkPort===LINK_PORT,'BLOCKED: exact link redirect preview port required')
 requireThat(typeof p.runtimeEvidence==='string'&&/^[A-Za-z0-9._:/-]{12,200}$/.test(p.runtimeEvidence),'BLOCKED: sanitized runtime evidence reference required')
 requireThat(typeof p.publishableKey==='string'&&/^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(p.publishableKey),'BLOCKED: compatible local synthetic publishable key required')
 requireThat(p.accounts&&Object.keys(p.accounts).length===roles.length,'BLOCKED: seven distinct synthetic actors required')
 const emails=[]
 for(const role of roles){
  const a=p.accounts[role]
  requireThat(a&&typeof a.email==='string'&&/^[a-z0-9._+-]+@example\.test$/.test(a.email)&&a.email.includes(p.runId)&&typeof a.password==='string'&&a.password.length>=12&&a.password.length<=128,'BLOCKED: run-bound synthetic actor credentials required')
  emails.push(a.email)
 }
 requireThat(new Set(emails).size===emails.length,'BLOCKED: actors must be distinct')
 requireThat([p.branchId,p.otherBranchId,p.serviceId,p.checkedInVisitId,p.checkedInPetId].every(v=>typeof v==='string'&&uuid.test(v))&&p.branchId!==p.otherBranchId,'BLOCKED: exact synthetic branch/service/patient/visit IDs required')
 requireThat(typeof p.speciesId==='string'&&catalogId.test(p.speciesId)&&typeof p.breedId==='string'&&catalogId.test(p.breedId)&&!uuid.test(p.breedId),'BLOCKED: canonical species and breed text IDs required')
 requireThat(typeof p.speciesLabel==='string'&&p.speciesLabel.length>0&&p.speciesLabel.length<=80&&typeof p.branchLabel==='string'&&p.branchLabel.length>0&&p.branchLabel.length<=100&&typeof p.otherBranchLabel==='string'&&p.otherBranchLabel.length>0&&p.otherBranchLabel.length<=100,'BLOCKED: fixture labels required')
 requireThat(day.test(p.checkedInDay??'')&&day.test(p.expiryDay??'')&&p.expiryDay>p.checkedInDay,'BLOCKED: valid isolated calendar dates required')
 requireThat(typeof p.otherOwnerPet==='string'&&p.otherOwnerPet.startsWith('Synthetic ')&&p.otherOwnerPet.includes(p.runId),'BLOCKED: owner B seed marker required')
 if(p.lifecycleVisits!==undefined){
  const actions=['checkIn','noShow','decline','cancel','complete']
  requireThat(p.lifecycleVisits&&Object.keys(p.lifecycleVisits).length===actions.length,'BLOCKED: complete optional lifecycle fixture set required')
  const ids=[p.checkedInVisitId]
  for(const action of actions){const v=p.lifecycleVisits[action];requireThat(v&&uuid.test(v.id??'')&&day.test(v.day??''),'BLOCKED: invalid lifecycle fixture');ids.push(v.id)}
  requireThat(new Set(ids).size===ids.length&&new Set(ids.map(id=>id.replace(/-/g,'').slice(0,6).toUpperCase())).size===ids.length,'BLOCKED: distinct abbreviated visit references required')
 }
 return p
}
export async function verifyLocalBackend(p){
 // No remote fallback. A private DNS/TLS mapping must already be configured by
 // ASTRA in a network-isolated runtime; do not alter DNS, TLS or proxy settings.
 const addresses=await lookup(new URL(p.backendOrigin).hostname,{all:true})
 requireThat(addresses.length&&addresses.every(a=>a.address==='127.0.0.1'||a.address==='::1'),'BLOCKED: backend alias does not resolve exclusively to loopback')
 requireThat(!process.env.NODE_TLS_REJECT_UNAUTHORIZED||process.env.NODE_TLS_REJECT_UNAUTHORIZED==='1','BLOCKED: TLS verification must remain enabled')
 const res=await fetch(p.backendOrigin+'/auth/v1/health',{redirect:'error',headers:{apikey:p.publishableKey},signal:AbortSignal.timeout(10000)})
 requireThat(res.ok,'BLOCKED: local Auth health unavailable')
 // Public catalog response must be genuinely served by the isolated Data API.
 const catalog=await fetch(p.backendOrigin+'/rest/v1/clinic_branches?select=id,slug',{redirect:'error',headers:{apikey:p.publishableKey},signal:AbortSignal.timeout(10000)})
 requireThat(catalog.ok,'BLOCKED: local Data API unavailable')
 const rows=await catalog.json()
 requireThat(Array.isArray(rows)&&rows.some(x=>x.id===p.branchId&&x.slug==='naga')&&rows.some(x=>x.id===p.otherBranchId),'BLOCKED: runtime branch fixture mismatch')
 const readCatalog=async(table,fields,id)=>{
  const query=new URLSearchParams({select:fields,id:'eq.'+id})
  const result=await fetch(BACKEND+'/rest/v1/'+table+'?'+query,{redirect:'error',headers:{apikey:p.publishableKey},signal:AbortSignal.timeout(10000)})
  requireThat(result.ok,'BLOCKED: actual local taxonomy catalog unavailable')
  return result.json()
 }
 const species=await readCatalog('species_catalog','id,label,is_active,clinic_supported',p.speciesId)
 const breeds=await readCatalog('breed_catalog','id,species_id,is_active,review_status',p.breedId)
 validateCatalogRows(p,species,breeds)
 // Validate the actual local mail list and that both signup mailboxes are fresh before browser launch.
 for(const role of ['ownerNew','applicant'])await requireEmptySignupMailbox(p,role)
 if(p.authLinks)await requireEmptyRecoveryMailbox(p)
}
export function validateCatalogRows(p,species,breeds){
 requireThat(Array.isArray(species)&&species.length===1&&species[0]?.id===p.speciesId&&species[0].label===p.speciesLabel&&species[0].is_active===true&&species[0].clinic_supported===true,'BLOCKED: missing, inactive or unsupported synthetic species')
 requireThat(Array.isArray(breeds)&&breeds.length===1&&breeds[0]?.id===p.breedId&&breeds[0].species_id===p.speciesId&&breeds[0].is_active===true&&['curated','staff_reviewed'].includes(breeds[0].review_status),'BLOCKED: missing, inactive, pending or mismatched synthetic breed')
}

export function verifySource(root){
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 requireThat(git('rev-parse',RC2+':web')===WEB,'BLOCKED: frozen web object mismatch')
 const changes=git('diff','--name-only',RC2,'--','web').split('\n').filter(Boolean)
 requireThat(changes.every(p=>p.startsWith('web/tests/connected/')),'BLOCKED: non-harness web changes')
 requireThat(!git('diff','--name-only',RC2,'--','scripts/browser'),'BLOCKED: accepted Chromium driver changed')
 const untracked=git('ls-files','--others','--exclude-standard','--','web','scripts/browser').split('\n').filter(Boolean)
 requireThat(untracked.every(p=>p.startsWith('web/tests/connected/')),'BLOCKED: unexpected untracked web input')
 for(const dir of [root,resolve(root,'web')]){
  requireThat(!readdirSync(dir).some(n=>n==='.env'||(n.startsWith('.env.')&&n!=='.env.example')),'BLOCKED: remove runtime-specific environment files from disposable checkout')
 }
 requireThat(!Object.keys(process.env).some(k=>k.startsWith('VITE_')),'BLOCKED: ambient Vite overrides prohibited')
}
export function outsideCheckout(root,path){
 requireThat(isAbsolute(path),'BLOCKED: absolute private evidence path required')
 // Require an existing private parent; do not follow symlinks into checkout.
 const parent=realpathSync(dirname(path)), actual=resolve(parent,basename(path))
 requirePrivateParent(parent)
 const rel=relative(realpathSync(root),actual)
 requireThat(rel.startsWith('..'+sep)||isAbsolute(rel),'BLOCKED: evidence must stay outside checkout')
 requireThat(!existsSync(actual),'BLOCKED: output must be a new directory')
 return actual
}

export function privatePacket(root,path){
 requireThat(isAbsolute(path),'BLOCKED: absolute private packet required')
 const actual=realpathSync(path),rel=relative(realpathSync(root),actual),st=statSync(actual)
 requirePrivateParent(dirname(actual))
 requireThat((rel.startsWith('..'+sep)||isAbsolute(rel))&&st.isFile()&&st.uid===process.getuid()&&(st.mode&0o777)===0o600,'BLOCKED: packet must be owner-controlled mode 0600 and outside checkout')
 return actual
}

function requirePrivateParent(path){
 const st=statSync(path)
 requireThat(typeof process.getuid==='function'&&st.isDirectory()&&st.uid===process.getuid()&&(st.mode&0o077)===0,'BLOCKED: private directory must belong to current isolated runner user')
}

// These helpers inspect only a fresh disposable Mailpit mailbox. Never print
// the response, token, recipient address or raw exceptions. The surrounding
// runtime's actual isolation/SMTP routing must be independently verified.
function signupEmail(p,role){
 requireThat(['ownerNew','applicant'].includes(role),'BLOCKED: only new synthetic signup recipients allowed')
 const email=p.accounts[role].email
 requireThat(syntheticEmail.test(email)&&email.includes(p.runId),'BLOCKED: invalid synthetic recipient')
 return email
}
const mailId=/^[A-Za-z0-9_-]{1,128}$/
export function matchingSignupMessages(payload,email,subject=SIGNUP_SUBJECT){
 requireThat([SIGNUP_SUBJECT,RECOVERY_SUBJECT].includes(subject),'BLOCKED: unknown local mail purpose')
 requireThat(syntheticEmail.test(email),'BLOCKED: invalid synthetic mail recipient')
 requireThat(payload&&Array.isArray(payload.messages)&&Number.isSafeInteger(payload.total)&&payload.total===payload.messages.length&&payload.total<=100,'BLOCKED: local mail list incomplete or invalid')
 const matches=[]
 const ids=new Set()
 for(const message of payload.messages){
  requireThat(message&&typeof message.ID==='string'&&mailId.test(message.ID)&&!ids.has(message.ID)&&Array.isArray(message.To)&&message.To.every(t=>t&&typeof t.Address==='string'&&syntheticEmail.test(t.Address)),'BLOCKED: invalid local mail metadata')
  ids.add(message.ID)
  if(message.To.some(t=>t.Address===email)){
   requireThat(message.To.length===1&&message.Subject===subject,'BLOCKED: unexpected or ambiguous signup mail')
   matches.push(message.ID)
  }
 }
 requireThat(matches.length<=1,'BLOCKED: duplicate signup mail')
 return matches
}
function exactMail(message,id,email,subject){
 requireThat(syntheticEmail.test(email)&&typeof id==='string'&&mailId.test(id)&&message?.ID===id&&message.Subject===subject&&Array.isArray(message.To)&&message.To.length===1&&message.To[0]?.Address===email&&(!message.Cc||Array.isArray(message.Cc)&&message.Cc.length===0)&&(!message.Bcc||Array.isArray(message.Bcc)&&message.Bcc.length===0),'BLOCKED: signup mail recipient or identity mismatch')
}
export function extractSignupOtp(message,id,email,origin){
 exactMail(message,id,email,SIGNUP_SUBJECT)
 const match=typeof message.Text==='string'&&message.Text.length<=2048&&/^Dawney synthetic confirmation code: ([0-9]{6,8})(?:\r?\nDawney synthetic confirmation link: (\S+))?\r?\n?$/.exec(message.Text)
 requireThat(match,'BLOCKED: local signup code template mismatch')
 if(origin){requireThat(match[2],'BLOCKED: signup link required by approved capability');validateAuthLink(match[2],origin,'signup')}
 else requireThat(!match[2],'BLOCKED: unexpected link in OTP-only runtime')
 return match[1]
}
export function validateAuthLink(raw,origin,type){
 requireThat(origin==='http://127.0.0.1:'+LINK_PORT&&['signup','recovery'].includes(type)&&typeof raw==='string'&&raw.length<=1500,'BLOCKED: approved link target required')
 let url;try{url=new URL(raw)}catch{throw Error('BLOCKED: invalid local email link')}
 const keys=[...url.searchParams.keys()].sort().join(',')
 requireThat(url.origin===BACKEND&&url.pathname==='/auth/v1/verify'&&!url.username&&!url.password&&!url.hash&&keys==='redirect_to,token,type'&&url.searchParams.get('type')===type&&/^[A-Za-z0-9_-]{16,256}$/.test(url.searchParams.get('token')??'')&&url.searchParams.get('redirect_to')===origin+(type==='signup'?'/auth/callback':'/auth/recovery'),'BLOCKED: unapproved email link target or parameters')
 return url.href
}
export function extractAuthLink(message,id,email,origin,type){
 const subject=type==='signup'?SIGNUP_SUBJECT:RECOVERY_SUBJECT
 exactMail(message,id,email,subject)
 if(type==='signup'){
  extractSignupOtp(message,id,email,origin)
  const match=/\r?\nDawney synthetic confirmation link: (\S+)\r?\n?$/.exec(message.Text)
  requireThat(match,'BLOCKED: missing actual signup link')
  return validateAuthLink(match[1],origin,type)
 }
 const match=typeof message.Text==='string'&&message.Text.length<=2048&&/^Dawney synthetic recovery link: (\S+)\r?\n?$/.exec(message.Text)
 requireThat(match,'BLOCKED: local recovery template mismatch')
 return validateAuthLink(match[1],origin,type)
}
async function mailJson(path){
 // No redirect, external URL, arbitrary hostname, API credential or SMTP send.
 const res=await fetch(MAIL+path,{redirect:'error',signal:AbortSignal.timeout(5000)})
 requireThat(res.ok,'BLOCKED: isolated local mail read unavailable')
 return res.json()
}
async function signupMessages(email,subject=SIGNUP_SUBJECT){
 return matchingSignupMessages(await mailJson('/api/v1/messages?limit=100'),email,subject)
}
export async function requireEmptySignupMailbox(p,role){
 const email=signupEmail(p,role)
 requireThat((await signupMessages(email)).length===0,'BLOCKED: stale signup mail; fresh seed required')
}
async function waitForMail(email,subject){
 const deadline=Date.now()+45000
 while(Date.now()<deadline){
  const ids=await signupMessages(email,subject)
  if(ids.length===1)return {id:ids[0],message:await mailJson('/api/v1/message/'+encodeURIComponent(ids[0]))}
  await sleep(500)
 }
 throw Error('BLOCKED: real isolated mail not delivered within 45 seconds')
}
export async function waitForSignupOtp(p,role,origin){
 const email=signupEmail(p,role),{id,message}=await waitForMail(email,SIGNUP_SUBJECT)
 return extractSignupOtp(message,id,email,p.authLinks?origin:undefined)
}
export async function waitForSignupLink(p,role,origin){
 requireThat(p.authLinks===true&&role==='applicant','BLOCKED: callback capability or recipient missing')
 const email=signupEmail(p,role),{id,message}=await waitForMail(email,SIGNUP_SUBJECT)
 return extractAuthLink(message,id,email,origin,'signup')
}
function recoveryEmail(p){
 requireThat(p.authLinks===true,'BLOCKED: recovery capability absent')
 const email=p.accounts.ownerOther.email
 requireThat(syntheticEmail.test(email)&&email.includes(p.runId),'BLOCKED: invalid recovery recipient')
 return email
}
export async function requireEmptyRecoveryMailbox(p){
 requireThat((await signupMessages(recoveryEmail(p),RECOVERY_SUBJECT)).length===0,'BLOCKED: stale recovery message')
}
export async function waitForRecoveryLink(p,origin){
 const email=recoveryEmail(p),{id,message}=await waitForMail(email,RECOVERY_SUBJECT)
 return extractAuthLink(message,id,email,origin,'recovery')
}
