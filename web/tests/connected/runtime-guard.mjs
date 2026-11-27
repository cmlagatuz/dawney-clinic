import {lookup} from 'node:dns/promises'
import {execFileSync} from 'node:child_process'
import {existsSync,readdirSync,realpathSync} from 'node:fs'
import {resolve,relative,isAbsolute,sep} from 'node:path'
export const RC2='8bb23dd31a516c16bc3e6544a25ef0cf9bb7403b'
export const WEB='f5dc0a98bf82fc75db7a5bf144f23236523505b8'
export const BACKEND='https://dawney-rc2-synthetic.supabase.co'
export const flags=Object.freeze([
 'VITE_PHASE4_PATIENT_FORM','VITE_PHASE5A_OPS_UI','VITE_STAFF_APPOINTMENT_WRITES_ENABLED',
 'VITE_CLINICAL_WORKSPACE_UI','VITE_CLINICAL_DRAFT_PERSISTENCE_UI','VITE_PHASE5B_PHARMACY_UI',
 'VITE_PHASE5C_BILLING_UI','VITE_STAFF_APPROVAL_WRITES_ENABLED','VITE_INVENTORY_WRITES_ENABLED'
])
export const roles=['ownerNew','ownerOther','applicant','administrator','veterinarian','receptionist','accountant']
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const day=/^\d{4}-\d{2}-\d{2}$/
function requireThat(ok,message){if(!ok)throw Error(message)}
export function validatePacket(p,approval){
 requireThat(p&&p.version===1&&p.sourceSha===RC2&&p.webTree===WEB,'BLOCKED: exact RC2 packet required')
 requireThat(/^[a-z0-9-]{8,32}$/.test(p.runId??'')&&approval===p.runId,'BLOCKED: matching explicit synthetic run approval required')
 requireThat(p.backendOrigin===BACKEND&&p.runtime==='isolated-disposable-full-stack'&&p.networkIsolation===true&&p.syntheticOnly===true&&p.noExternalMail===true&&p.freshSeed===true&&p.migrationCount===23,'BLOCKED: ASTRA isolated runtime and all 23 migrations required')
 requireThat(typeof p.runtimeEvidence==='string'&&p.runtimeEvidence.length>=12&&p.runtimeEvidence.length<=200,'BLOCKED: runtime evidence reference required')
 requireThat(typeof p.publishableKey==='string'&&/^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(p.publishableKey),'BLOCKED: compatible local synthetic publishable key required')
 requireThat(p.accounts&&Object.keys(p.accounts).length===roles.length,'BLOCKED: seven distinct synthetic actors required')
 const emails=[]
 for(const role of roles){
  const a=p.accounts[role]
  requireThat(a&&typeof a.email==='string'&&/^[a-z0-9._+-]+@example\.test$/.test(a.email)&&a.email.includes(p.runId)&&typeof a.password==='string'&&a.password.length>=12&&a.password.length<=128,'BLOCKED: run-bound synthetic actor credentials required')
  emails.push(a.email)
 }
 requireThat(new Set(emails).size===emails.length,'BLOCKED: actors must be distinct')
 requireThat([p.branchId,p.otherBranchId,p.serviceId,p.breedId,p.checkedInVisitId,p.checkedInPetId].every(v=>typeof v==='string'&&uuid.test(v))&&p.branchId!==p.otherBranchId,'BLOCKED: exact synthetic branch/service/patient/visit IDs required')
 requireThat(typeof p.speciesLabel==='string'&&p.speciesLabel.length>0&&p.speciesLabel.length<=80&&typeof p.branchLabel==='string'&&p.branchLabel.length>0&&p.branchLabel.length<=100&&typeof p.otherBranchLabel==='string'&&p.otherBranchLabel.length>0&&p.otherBranchLabel.length<=100,'BLOCKED: fixture labels required')
 requireThat(day.test(p.checkedInDay??'')&&day.test(p.expiryDay??'')&&p.expiryDay>p.checkedInDay,'BLOCKED: valid isolated calendar dates required')
 requireThat(typeof p.otherOwnerPet==='string'&&p.otherOwnerPet.startsWith('Synthetic ')&&p.otherOwnerPet.includes(p.runId),'BLOCKED: owner B seed marker required')
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
}
export function verifySource(root){
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 requireThat(git('rev-parse',RC2+':web')===WEB,'BLOCKED: frozen web object mismatch')
 const changes=git('diff','--name-only',RC2,'--','web').split('\n').filter(Boolean)
 requireThat(changes.every(p=>p.startsWith('web/tests/connected/')),'BLOCKED: non-harness web changes')
 const untracked=git('ls-files','--others','--exclude-standard','--','web').split('\n').filter(Boolean)
 requireThat(untracked.every(p=>p.startsWith('web/tests/connected/')),'BLOCKED: unexpected untracked web input')
 for(const dir of [root,resolve(root,'web')]){
  requireThat(!readdirSync(dir).some(n=>n==='.env'||(n.startsWith('.env.')&&n!=='.env.example')),'BLOCKED: remove runtime-specific environment files from disposable checkout')
 }
 requireThat(!Object.keys(process.env).some(k=>k.startsWith('VITE_')),'BLOCKED: ambient Vite overrides prohibited')
}
export function outsideCheckout(root,path){
 requireThat(isAbsolute(path),'BLOCKED: absolute private evidence path required')
 // Require an existing private parent; do not follow symlinks into checkout.
 const parent=realpathSync(resolve(path,'..')), actual=resolve(parent,path.split(sep).at(-1))
 const rel=relative(realpathSync(root),actual)
 requireThat(rel.startsWith('..'+sep)||isAbsolute(rel),'BLOCKED: evidence must stay outside checkout')
 requireThat(!existsSync(actual),'BLOCKED: output must be a new directory')
 return actual
}
