import {useEffect,useMemo,useState} from 'react'
import {Link} from 'react-router'
import type {User} from '@supabase/supabase-js'
import {useAuth} from '../hooks/AuthProvider'
import {createClinicalReadPort} from '../clinical/port'
import {assertStaffBranch} from '../lib/staff-branch'
import {PageHeading,LoadingCard} from '../components/ui'
import {OPS_UI_ENABLED} from '../ops/flag'

/**
 * The navigator is not a permissions oracle. Staff links appear only after
 * the current GoTrue-verified user has active, RLS-backed membership.
 * Every destination separately revalidates branch scope and account context.
 * No route, query string or local storage can upgrade a staff entitlement.
 */
const clinicalFlag=import.meta.env.VITE_CLINICAL_WORKSPACE_UI==='true'
const pharmacyFlag=import.meta.env.VITE_PHASE5B_PHARMACY_UI==='true'
const billingFlag=import.meta.env.VITE_PHASE5C_BILLING_UI==='true'
const patientCatalog=import.meta.env.VITE_PHASE4_PATIENT_FORM==='true'
type Access={kind:'checking'}|{kind:'allowed';branches:number}|{kind:'denied'}|{kind:'unavailable'}

export function ClinicJourneyPage(){
  const {user}=useAuth()
  return user?<Journey key={user.id} account={user}/>:<p role="alert">A verified account is required.</p>
}
function Journey({account}:{account:User}){
  const [attempt,setAttempt]=useState(0)
  const [access,setAccess]=useState<Access>({kind:'checking'})
  const flags=[OPS_UI_ENABLED,clinicalFlag,pharmacyFlag,billingFlag]
  const staffPreviewRequested=flags.some(Boolean)
  const port=useMemo(()=>staffPreviewRequested?createClinicalReadPort(account):null,[account.id,staffPreviewRequested])
  useEffect(()=>{
    let current=true
    setAccess(staffPreviewRequested?{kind:'checking'}:{kind:'unavailable'})
    if(port)void port.loadBranches().then(async branches=>{
      // Active membership alone is insufficient for a staff shortcut:
      // also require the existing server-side assert_staff_branch RPC for
      // every offered branch. Revoked/denied responses never expose links.
      const checked=await Promise.allSettled(branches.map(async branch=>{
        const confirmed=await assertStaffBranch(account,branch.id)
        return confirmed===branch.id
      }))
      if(!current)return
      const verified=checked.filter(x=>x.status==='fulfilled'&&x.value===true).length
      setAccess(verified?{kind:'allowed',branches:verified}:{kind:'denied'})
    },()=>{if(current)setAccess({kind:'denied'})})
    return()=>{current=false}
  },[port,attempt,staffPreviewRequested])
  const staffAllowed=staffPreviewRequested&&access.kind==='allowed'
  return <section className="page" aria-labelledby="clinic-journey-heading">
    <PageHeading id="clinic-journey-heading" eyebrow="Verified account · clinic workflow" title="Clinic journeys">
      Follow the real owner and staff routes. This guide does not create a patient,
      confirm a visit, publish clinical records, or grant staff permissions.
    </PageHeading>
    <section className="card" aria-labelledby="owner-journey-heading">
      <h2 id="owner-journey-heading">Owner and patient care</h2>
      <ol className="steps">
        <li><Link to="/app/profile">1. Verify my profile</Link><p className="field-help">Owner identity and profile are checked using your signed-in account.</p></li>
        <li><Link to="/app/pets">2. Manage my patients</Link><p className="field-help">{patientCatalog
          ?'Catalog-based species, breed and private photo, health card and vaccination card are available only with approved Phase 4 Storage/RLS.'
          :'Basic patient records are available. Catalog and private attachments are disabled pending approved secure storage.'}</p></li>
        <li><Link to="/app/appointments">3. Request or review appointments</Link><p className="field-help">A request is not a confirmation. Only server-approved Naga service, time and resources can support an online request.</p></li>
        <li><Link to="/app/communications">4. Communications · unavailable</Link><p className="field-help">No approved consent-bound message transport is connected. No reminders or messages have been sent.</p></li>
      </ol>
    </section>
    <section className="card" aria-labelledby="staff-journey-heading">
      <h2 id="staff-journey-heading">Clinic staff workspaces</h2>
      <p className="field-help">Each workspace needs verified staff identity, current branch membership and its own independently approved backend API.</p>
      {staffPreviewRequested&&access.kind==='checking'&&<LoadingCard label="Checking current staff branch membership…" rows={2}/>}
      {staffPreviewRequested&&access.kind==='denied'&&<div role="status" className="alert alert-info">No active staff branch membership could be verified. Clinic workspaces are not available for this account.
        <button type="button" className="button button-secondary" onClick={()=>setAttempt(n=>n+1)}>Recheck staff access</button></div>}
      {!staffPreviewRequested&&<p role="status" className="alert alert-info">Clinic staff preview routes are not enabled in this build. Staff access has not been verified.</p>}
      {staffAllowed&&<p role="status">Current staff membership was verified for {access.branches} branch{access.branches===1?'':'es'}. Each screen will recheck access.</p>}
      <ul>
        <li>{staffAllowed&&OPS_UI_ENABLED?<Link to="/app/ops">Operations: branch queue, day/week, actual counts</Link>:<span>Operations queue — unavailable</span>}</li>
        <li>{staffAllowed&&clinicalFlag?<Link to="/app/clinical">Clinical: authorized appointment chart, draft-only workspace</Link>:<span>Clinical chart and encounter drafts — unavailable</span>}</li>
        <li>{staffAllowed&&pharmacyFlag?<Link to="/app/pharmacy">Pharmacy: branch read-only FEFO and expiry</Link>:<span>Pharmacy FEFO and stock reports — unavailable</span>}</li>
        <li>{staffAllowed&&billingFlag?<Link to="/app/billing">Billing: branch workspace (financial reads unavailable)</Link>:<span>Billing/invoice records — unavailable</span>}</li>
      </ul>
      <p className="field-help">Even when a preview route is visible, chart filing, stock movement,
        dispensing, invoices, payments and receipts remain disabled until a separately
        authorized server contract and real persistence are verified.</p>
    </section>
  </section>
}
