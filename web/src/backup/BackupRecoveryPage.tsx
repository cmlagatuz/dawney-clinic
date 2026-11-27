import {useEffect,useRef,useState} from 'react'
import type {User} from '@supabase/supabase-js'
import {useAuth} from '../hooks/AuthProvider'
import {verifiedStaffNavigationBranches} from '../release/verified-staff-branches'
import {Icon,PageHeading,LoadingCard} from '../components/ui'
import './backup.css'

type Access='loading'|'allowed'|'denied'|'unavailable'
type Phase='idle'|'identity'|'destination'|'running'|'success'|'interrupted'|'failed'
const guide=[
 {title:'Prepare the Windows companion',body:'An independently accepted local companion must be installed and approved for this computer. This web page cannot install software or launch an export.'},
 {title:'Verify administrator identity',body:'The companion must request fresh authentication and obtain narrowly scoped server authorization. Clinic branch administrator access alone does not authorize a database-wide export.'},
 {title:'Choose a local drive',body:'The companion must enumerate actual drives and check free space, writability and the approved destination. It creates a standardized backup folder automatically; no folder entry is needed.'},
 {title:'Encrypt and verify',body:'The companion must encrypt the database-only archive, verify integrity and publish a receipt only after completion. An interrupted or partial file is not a valid backup. Recovery requires a separate authorized restore rehearsal.'}
] as const
// Explicit fictional examples: no browser drive discovery, capacity estimate or file access.
const drives=[
 {id:'example-ready',name:'Example D: — ready',free:40,writable:true},
 {id:'example-small',name:'Example E: — insufficient capacity',free:1,writable:true},
 {id:'example-readonly',name:'Example F: — not writable',free:40,writable:false}
] as const
const exampleRequired=8
const phases=['Preparing encrypted export','Writing encrypted archive','Verifying archive integrity'] as const
type Receipt={label:string;destination:string;outcome:'Simulated success'|'Simulated interruption'|'Simulated failure'}

export function BackupRecoveryPage(){
 const {user}=useAuth()
 return user?<BackupAccess key={user.id} user={user}/>:<p role="alert">A verified account is required.</p>
}
function BackupAccess({user}:{user:User}){
 const [access,setAccess]=useState<Access>('loading')
 const [attempt,setAttempt]=useState(0)
 useEffect(()=>{
  let active=true
  void verifiedStaffNavigationBranches(user).then(branches=>{
   if(active)setAccess(branches.some(b=>b.role==='administrator')?'allowed':'denied')
  },()=>{if(active)setAccess('unavailable')})
  return()=>{active=false}
 },[user.id,attempt])
 const recheck=()=>{setAccess('loading');setAttempt(n=>n+1)}
 if(access==='loading')return <LoadingCard label="Verifying current administrator access…"/>
 if(access!=='allowed')return <section className="card" role="alert">
  <h1>Backup &amp; recovery access unavailable</h1>
  <p>{access==='denied'?'Administrator access is required.':'Administrator access could not be verified. No backup information is shown.'}</p>
  <button type="button" className="button button-secondary" onClick={recheck}>Recheck access</button>
 </section>
 return <BackupCenter key={attempt} recheck={recheck}/>
}
function BackupCenter({recheck}:{recheck:()=>void}){
 const [phase,setPhase]=useState<Phase>('idle')
 const [guideStep,setGuideStep]=useState<number|null>(null)
 const [driveId,setDriveId]=useState('')
 const [stage,setStage]=useState(0)
 const [receipt,setReceipt]=useState<Receipt|null>(null)
 const heading=useRef<HTMLHeadingElement>(null)
 const startRef=useRef<HTMLButtonElement>(null)
 const shouldFocus=useRef(false)
 const drive=drives.find(d=>d.id===driveId)
 const ready=!!drive&&drive.writable&&drive.free>=exampleRequired
 const move=(next:Phase)=>{shouldFocus.current=true;setPhase(next)}
 useEffect(()=>{
  if(!shouldFocus.current)return
  shouldFocus.current=false
  if(phase==='idle'&&guideStep===null)startRef.current?.focus()
  else heading.current?.focus()
 },[phase,guideStep])
 function reset(){
  setDriveId('');setStage(0);setGuideStep(null);setReceipt(null);move('idle')
 }
 function beginGuide(){
  setDriveId('');setStage(0);setReceipt(null);shouldFocus.current=true;setGuideStep(0);setPhase('idle')
 }
 function changeGuide(next:number){shouldFocus.current=true;setGuideStep(next)}
 function finish(outcome:'success'|'failed'|'interrupted'){
  setReceipt({label:'Rehearsal only — no archive created',destination:drive?.name??'No example drive selected',
   outcome:outcome==='success'?'Simulated success':outcome==='failed'?'Simulated failure':'Simulated interruption'})
  move(outcome)
 }
 const working=phase==='running'
 const active=guideStep!==null||phase!=='idle'
 const result=phase==='success'||phase==='failed'||phase==='interrupted'
 return <div className="backup-center" aria-labelledby="backup-title">
  <PageHeading id="backup-title" eyebrow="Administration / Backup & recovery" title="Backup & recovery"
   actions={<button type="button" className="button button-secondary" onClick={recheck}>Recheck access</button>}>
   Manage backup readiness and learn the guided local workflow.
  </PageHeading>
  <div className="backup-notice" role="status"><Icon name="shield" width={22} height={22}/>
   <div><strong>Rehearsal only · real export disabled</strong><p>Verified clinic administrator preview. System-wide backup authority and fresh authentication are not established. No database connection, archive or local drive access is initiated here.</p></div>
  </div>
  <section className="backup-stats" aria-label="Backup readiness">
   <article className="card"><h2>Last verified backup</h2><strong>Unavailable</strong><p>No authoritative receipt reader connected.</p></article>
   <article className="card"><h2>Local companion</h2><strong>Not connected</strong><p>Native Windows companion approval required.</p></article>
   <article className="card"><h2>Destination</h2><strong>Not verified</strong><p>Actual capacity and writability unknown.</p></article>
  </section>
  <section className="card backup-actions" aria-labelledby="backup-create">
   <div><h2 id="backup-create">Create a database backup</h2><p>Database-only export. Auth provider configuration, Storage object bytes and independent restoration are separate recovery requirements.</p></div>
   <button className="button button-primary" type="button" disabled aria-describedby="backup-disabled">Create Database Backup</button>
   <p id="backup-disabled" className="backup-muted">Unavailable until the native companion and administrator authorization contract are independently accepted and owner-enabled. Never enter provider tokens, encryption passphrases or database passwords here.</p>
   <button ref={startRef} className="button button-secondary" type="button" disabled={active} onClick={beginGuide}>Start guided rehearsal</button>
  </section>
  {active&&<section className="card backup-wizard" aria-labelledby="backup-step-title"
   onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();if(working)finish('interrupted');else reset()}}}>
   <div className="backup-step-bar"><span className="eyebrow">SIMULATED WORKFLOW</span>
    <button type="button" className="button button-quiet" onClick={()=>working?finish('interrupted'):reset()}>{working?'Cancel rehearsal':'Close rehearsal'}</button></div>
   {guideStep!==null&&phase==='idle'&&<div role="region" aria-roledescription="carousel" aria-label="First-time backup setup">
    <p className="backup-muted" role="status">Setup step {guideStep+1} of {guide.length}</p>
    <ol className="backup-guide-steps" aria-label="Setup steps">{guide.map((g,i)=><li key={g.title} aria-current={i===guideStep?'step':undefined}>{i+1}. {g.title}</li>)}</ol>
    <h2 ref={heading} tabIndex={-1} id="backup-step-title">{guide[guideStep]?.title}</h2>
    <p>{guide[guideStep]?.body}</p>
    <div className="backup-controls"><button type="button" className="button button-secondary" disabled={guideStep===0} onClick={()=>changeGuide(guideStep-1)}>Previous</button>
     {guideStep<guide.length-1?<button type="button" className="button button-primary" onClick={()=>changeGuide(guideStep+1)}>Next</button>:
      <button type="button" className="button button-primary" onClick={()=>{setGuideStep(null);move('identity')}}>Continue to verification preview</button>}</div>
   </div>}
   {phase==='identity'&&<>
    <h2 ref={heading} tabIndex={-1} id="backup-step-title">Additional identity verification</h2>
    <p>Real verification is unavailable. In an approved implementation, the native companion must obtain a fresh, bound, short-lived authorization. This rehearsal does not authenticate or grant permission.</p>
    <div className="backup-controls"><button className="button button-secondary" type="button" disabled>Verify identity · unavailable</button>
     <button className="button button-primary" type="button" onClick={()=>move('destination')}>Continue rehearsal without verification</button></div>
   </>}
   {phase==='destination'&&<>
    <h2 ref={heading} tabIndex={-1} id="backup-step-title">Select an example storage drive</h2>
    <p className="backup-muted">Fictional drives and an illustrative 8 GB requirement. No actual local disk has been scanned.</p>
    <label>Example storage drive<select value={driveId} onChange={e=>setDriveId(e.target.value)}><option value="">Choose an example drive</option>{drives.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    {drive&&<div className="backup-destination" role="status">
     <dl><div><dt>Example free capacity</dt><dd>{drive.free} GB</dd></div><div><dt>Illustrative requirement</dt><dd>{exampleRequired} GB</dd></div><div><dt>Example writability</dt><dd>{drive.writable?'Writable':'Not writable'}</dd></div></dl>
     <p><strong>{ready?'Example destination ready':!drive.writable?'Example destination not writable':'Example capacity insufficient'}</strong></p>
     <p>The real companion would create a standardized Dawney backup folder on the selected drive. No folder is created in this rehearsal.</p>
    </div>}
    <div className="backup-controls"><button type="button" className="button button-secondary" onClick={()=>move('identity')}>Back</button>
     <button type="button" className="button button-primary" disabled={!ready} onClick={()=>{setStage(0);move('running')}}>Start simulated backup</button></div>
   </>}
   {working&&<>
    <h2 ref={heading} tabIndex={-1} id="backup-step-title">Simulated backup in progress</h2>
    <p role="status">Example stage {stage+1} of {phases.length}: {phases[stage]}</p>
    <label htmlFor="backup-example-progress">Rehearsal stages completed (not real export progress)</label>
    <progress id="backup-example-progress" value={stage} max={phases.length}/>
    <p className="backup-muted">Actual progress must come from authenticated companion events. Unknown byte totals must remain indeterminate; the interface must never estimate completion or declare success from elapsed time.</p>
    <div className="backup-controls"><button className="button button-primary" type="button" onClick={()=>stage===phases.length-1?finish('success'):setStage(n=>n+1)}>{stage===phases.length-1?'Finish simulated verification':'Advance example stage'}</button>
     <button className="button button-danger" type="button" onClick={()=>finish('failed')}>Simulate integrity failure</button></div>
   </>}
   {result&&<>
    <h2 ref={heading} tabIndex={-1} id="backup-step-title">{phase==='success'?'Simulated backup success':phase==='interrupted'?'Simulated backup interrupted':'Simulated backup failed'}</h2>
    <p role={phase==='success'?'status':'alert'}>{phase==='success'?'Example integrity check passed. No real archive, checksum or integrity receipt exists.':phase==='interrupted'?'Example operation cancelled. In a real interrupted operation, partial output is not a valid backup.':'Example integrity verification failed. No valid backup may be recorded. Check destination and companion diagnostics before a new authorized attempt.'}</p>
    <button className="button button-secondary" type="button" onClick={reset}>Return to dashboard</button>
   </>}
  </section>}
  <section className="card backup-history" aria-labelledby="backup-history-title">
   <h2 id="backup-history-title">Backup history &amp; integrity receipts</h2>
   <p role="status">Actual history unavailable — no trusted local receipt source connected. This is not a verified empty history.</p>
   {receipt&&<article className="backup-example-receipt"><h3>{receipt.outcome}</h3><p>{receipt.label}</p><dl><div><dt>Destination</dt><dd>{receipt.destination}</dd></div><div><dt>Integrity receipt</dt><dd>Not issued — rehearsal only</dd></div><div><dt>Restore validation</dt><dd>Not performed</dd></div></dl></article>}
   <p className="backup-muted">A real receipt must bind the authorized operation, archive identity, completion time, size, encryption and verified integrity. Successful backup does not prove restore readiness.</p>
   <button type="button" className="button button-secondary" disabled>Restore database · unavailable</button>
  </section>
 </div>
}
