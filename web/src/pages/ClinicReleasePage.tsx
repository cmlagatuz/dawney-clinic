import {useEffect,useMemo,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {Link} from 'react-router'
import {useAuth} from '../hooks/AuthProvider'
import {EmptyState,LoadingCard,PageHeading} from '../components/ui'
import {createClinicalReadPort} from '../clinical/port'
import {classifyOpsError} from '../ops/ops-model.mjs'
import {OPS_UI_ENABLED} from '../ops/flag'
import type {OpsBranch} from '../ops/branch-model.mjs'
import {STAFF_RELEASE_MODULES,clinicModuleView} from '../release/clinic-contracts.mjs'
import '../release/clinic-release.css'

type Access = {kind:'loading'}|{kind:'ready';branches:OpsBranch[]}|
  {kind:'failed';reason:'denied'|'unavailable'|'network'|'error'}
type Mode='journey'|'communications'
const flags={
  ops:OPS_UI_ENABLED,
  clinical:import.meta.env.VITE_CLINICAL_WORKSPACE_UI === 'true',
  pharmacy:import.meta.env.VITE_PHASE5B_PHARMACY_UI === 'true',
  billing:import.meta.env.VITE_PHASE5C_BILLING_UI === 'true'
} as const

/** A verified owner can view the route map, but only independently authorized
 * staff can see scoped staff links. This is NEVER a branch permission source. */
export function ClinicReleasePage(){
  const {user}=useAuth()
  if(!user)return <p role="alert">A verified account is required to inspect clinic journeys.</p>
  return <ClinicAccount key={user.id} user={user} mode="journey"/>
}

/** A direct URL does not bypass staff entitlement. There is no messaging SDK,
 * contact lookup, inbox data, composer, send, subscription or HTTP transport. */
export function CommunicationsUnavailablePage(){
  const {user}=useAuth()
  if(!user)return <p role="alert">A verified clinic staff account is required.</p>
  return <ClinicAccount key={user.id} user={user} mode="communications"/>
}

function ClinicAccount({user,mode}:{user:User;mode:Mode}){
  const port=useMemo(()=>createClinicalReadPort(user),[user.id])
  const [attempt,setAttempt]=useState(0)
  const key=user.id+':'+attempt
  const [raw,setRaw]=useState<{key:string;access:Access}>({key,access:{kind:'loading'}})
  const state:Access=raw.key===key?raw.access:{kind:'loading'}
  const retry=()=>{setRaw({key:user.id+':'+(attempt+1),access:{kind:'loading'}});setAttempt(n=>n+1)}
  useEffect(()=>{
    let active=true
    setRaw({key,access:{kind:'loading'}})
    void port.loadBranches().then(branches=>{
      if(!active)return
      if(!branches.length){setRaw({key,access:{kind:'failed',reason:'denied'}});return}
      setRaw({key,access:{kind:'ready',branches}})
    },error=>{
      if(active)setRaw({key,access:{kind:'failed',reason:classifyOpsError(error)}})
    })
    return()=>{active=false}
  },[port,key])

  const authorized=state.kind==='ready'
  return <section className="page clinic-release" aria-labelledby="clinic-release-heading">
    <PageHeading id="clinic-release-heading" eyebrow="Dawney clinic · protected frontend"
      title={mode==='journey'?'Clinic workflow':'Communications & consent'}>
      {mode==='journey'
        ?'From public discovery and verified owner records to independently authorized staff workspaces. Each module rechecks its own backend rules.'
        :'Messaging is not connected. There is no approved consent-aware inbox, recipient directory or delivery contract.'}
    </PageHeading>

    {mode==='journey'&&<section className="clinic-release-section" aria-labelledby="owner-steps-heading">
      <h2 id="owner-steps-heading">Public and pet owner journey</h2>
      <nav aria-label="Public and pet owner workflow">
        <ol className="clinic-release-steps">
          <li><Link to="/">Clinic information</Link><p>Visit the public home, service categories, branches and contact links.</p></li>
          <li><Link to="/app/profile">My profile</Link><p>Read or update only your verified owner identity.</p></li>
          <li><Link to="/app/pets">My patients</Link><p>Species, breed and private documents are available only when their approved contracts are enabled.</p></li>
          <li><Link to="/book">Online booking status</Link><p>Current server-approved Naga service/resource/time only; Cavite contact-only.</p></li>
          <li><Link to="/app/appointments">My appointment history</Link><p>Requested is not confirmed. Failed history reads never mean no visits.</p></li>
        </ol>
      </nav>
      <p className="clinic-release-notice" role="status">
        Patient document catalog, clinical writes, staff scheduling operations and finance are not activated merely by this navigation.
      </p>
    </section>}

    <section className="clinic-release-section" aria-labelledby="clinic-staff-heading">
      <h2 id="clinic-staff-heading">{mode==='journey'?'Verified staff workspaces':'Clinic messaging access'}</h2>
      {state.kind==='loading'&&<LoadingCard label="Checking your active staff identity and allowed clinic branches…" rows={3}/>}
      {state.kind==='failed'&&<div className="card" role="alert">
        <h3>{state.reason==='denied'?'No verified clinic staff access':'Staff authorization unavailable'}</h3>
        <p>{state.reason==='denied'
          ?'This account has no currently verified staff branch permission. No staff data or messages are displayed.'
          :state.reason==='network'?'The clinic connection failed. No branch access or private records can be assumed.'
          :'The secure branch permission reader could not be verified; no clinic data is shown.'}</p>
        <button type="button" className="button button-secondary" onClick={retry}>Recheck staff access</button>
      </div>}
      {state.kind==='ready'&&<>
        <p className="clinic-release-notice" role="status">
          Authorized branch membership was returned for this account. This does not authorize patient chart publication,
          stock adjustments, financial transactions or messages.
        </p>
        <ul className="clinic-release-branches" aria-label="Verified clinic branch memberships">
          {state.branches.map(branch=><li key={branch.id}><strong>{branch.name}</strong>
            <span>{branch.role==='administrator'?'Administrator':branch.role==='veterinarian'?'Veterinarian':'Receptionist'} · access verified for navigation only</span></li>)}
        </ul>
      </>}
      {mode==='journey'&&authorized&&<div className="clinic-release-modules" aria-label="Staff module status">
        {STAFF_RELEASE_MODULES.map(module=>{
          const gate=clinicModuleView(module,flags,true)
          return <article className="card clinic-release-module" key={module.id}>
            <h3>{module.label}</h3>
            <p>{module.state}</p>
            {gate.kind==='off'
              ?<p className="clinic-release-disabled" role="status">Not enabled in this build. No staff route or action is offered.</p>
              :gate.kind==='unavailable'
                ?<Link to={module.path} className="button button-secondary">View unavailable communications status</Link>
                :<Link to={module.path} className="button button-secondary">Open controlled preview</Link>}
          </article>
        })}
      </div>}
      {mode==='communications'&&authorized&&<div className="card clinic-communications-blocked" role="status">
        <h3>Messaging unavailable — no communications loaded</h3>
        <p>No recipient consent, verified conversation reader, delivery provider or authenticated server send operation has been approved. No appointment reminder, email, SMS, WhatsApp, Facebook or Telegram message will be sent from this screen.</p>
        <div className="clinic-release-locked-actions">
          <button type="button" className="button button-secondary" disabled>Open inbox · unavailable</button>
          <button type="button" className="button button-secondary" disabled>Send message · unavailable</button>
          <button type="button" className="button button-secondary" disabled>Schedule reminder · unavailable</button>
        </div>
        <p><Link to="/app/clinic">Back to clinic workflow</Link></p>
      </div>}
      {mode==='journey'&&!authorized&&state.kind==='failed'&&<EmptyState title="Clinic workspaces are private" icon="shield">
        Owner profile, patients and appointments remain separate from staff credentials. A signed-in owner is not automatically clinic staff.
      </EmptyState>}
    </section>
    {mode==='journey'&&<p className="small-help">
      Access shown here is navigation-only. The Operations, Clinical, Pharmacy and Billing pages independently verify active staff membership and branch authorization. Clinical chart Save, stock movements, financial actions and all communications remain disabled until approved server contracts exist.
    </p>}
  </section>
}
