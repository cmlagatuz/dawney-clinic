/** CLOUD: addon to the existing releaseClinicFixture; intercepted HTTP only.
 * Models PR130 nonce/CAS/encounter, not real RLS, signed JWT or hosted persistence.
 * Synthetic booking exists only in browser localStorage; never uses private clinic data. */
export function staffLifecycleHttpFixture(){
 const uuid=n=>'40000000-0000-4000-8000-'+String(n).padStart(12,'0')
 const ids={naga:uuid(1),cavite:uuid(2),resource:uuid(4),owner:uuid(8),pet:uuid(9),booking:uuid(11),encounter:uuid(30)}
 const remote='https://issue51-fixtures.supabase.co'
 const qs=new URL(location.href).searchParams, mode=qs.get('case')||'normal', actor=qs.get('actor')||'owner'
 const serverKey='cloud.staff.lifecycle.2026',bookingKey='cloud.integrated.syntheticBooking'
 if(qs.get('reset')==='1'){sessionStorage.removeItem(serverKey)}
 function seed(){
  const booking={id:ids.booking,branch_id:ids.naga,status:'requested',owner_id:ids.owner,pet_id:ids.pet,
   resource_id:ids.resource,service_id:uuid(3),
   starts_at:mode==='no-show'?'2026-11-20T00:30:00Z':'2026-11-20T01:15:00Z',
   ends_at:mode==='no-show'?'2026-11-20T01:00:00Z':'2026-11-20T01:45:00Z',
   concern:'Synthetic staff lifecycle only',details:null,lifecycle_revision:1}
  return {booking,receipts:{},calls:[],once:false,denied:false}
 }
 const get=()=>{try{return JSON.parse(sessionStorage.getItem(serverKey)||'null')||seed()}catch{return seed()}}
 const set=s=>{sessionStorage.setItem(serverKey,JSON.stringify(s));localStorage.setItem(bookingKey,JSON.stringify(s.booking))}
 if(!sessionStorage.getItem(serverKey))set(seed())
 else localStorage.setItem(bookingKey,JSON.stringify(get().booking))
 const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','access-control-allow-origin':'*'}})
 const error=(code,message,status=400)=>response({code,message},status)
 const base=window.fetch.bind(window)
 // Explicitly controlled post-confirmation queue delay for the regression.
 // This is an intercepted synthetic GET, not a delay in production source.
 let queueReleased=false
 let releaseQueue
 const queueGate=new Promise(resolve=>{releaseQueue=()=>{queueReleased=true;resolve()}})
 window.__staffLifecycle={get,calls:[],readonly:[],queueHeld:false,confirmedQueueReads:[],releaseQueue,forceStatus:(status)=>{const s=get();s.booking.status=status;s.booking.lifecycle_revision++;set(s)}}
 window.fetch=async(input,init)=>{
  const req=new Request(input,init),url=new URL(req.url)
  if(url.origin!==remote)return base(input,init)
  const path=url.pathname,branch=(url.searchParams.get('branch_id')||'').replace(/^eq\./,'')
  if(path==='/rest/v1/staff_memberships'&&mode==='accountant')
   return response([{user_id:uuid(6),role:'accountant',is_active:true}])
  if(path==='/rest/v1/staff_branch_memberships'&&mode==='accountant')
   return response([{user_id:uuid(6),branch_id:ids.naga,role:'accountant',is_active:true}])
  if(path==='/rest/v1/appointments'&&req.method==='GET'&&
     (url.searchParams.get('select')||'').includes('lifecycle_revision')){
   const s=get(),id=(url.searchParams.get('id')||'').replace(/^eq\./,'')
   window.__staffLifecycle.readonly.push({branch,id})
   if(mode==='detail-network'&&!s.once){s.once=true;set(s);throw Error('Failed to fetch appointment detail')}
   if(actor!=='staff'||branch!==ids.naga||id!==ids.booking)return response(null)
   const row={...s.booking}
   if(mode==='missing-revision')delete row.lifecycle_revision
   if(mode==='wrong-detail-branch')row.branch_id=ids.cavite
   return response(row)
  }
  if(path==='/rest/v1/appointments'&&req.method==='GET'&&branch===ids.naga&&
     url.searchParams.has('starts_at')&&qs.get('hold-confirmed-queue')==='1'&&
     get().booking.status==='confirmed'){
   // Hold every matching request until explicit release, including any
   // superseded duplicate. Never let a second read bypass the barrier.
   window.__staffLifecycle.confirmedQueueReads.push({branch,bounds:url.searchParams.getAll('starts_at')})
   if(!queueReleased){
    window.__staffLifecycle.queueHeld=true
    await queueGate
    window.__staffLifecycle.queueHeld=false
   }
  }
  if(path==='/rest/v1/branch_encounters'&&req.method==='GET'){
   const s=get(),id=(url.searchParams.get('appointment_id')||'').replace(/^eq\./,'')
   const matched=actor==='staff'&&id===ids.booking&&branch===ids.naga
   if(mode==='encounter-unavailable')return error('PGRST202','Encounter read not installed',404)
   return response(matched&&mode==='encounter'?[{id:ids.encounter}]:[])
  }
  if(path==='/rest/v1/rpc/transition_staff_appointment'&&req.method==='POST'){
   const body=await req.json(),s=get()
   s.calls.push({actor,body});window.__staffLifecycle.calls.push({actor,body})
   set(s)
   if(actor!=='staff'||body.p_branch!==ids.naga||s.denied||mode==='accountant'||mode==='wrong-branch'||mode==='denied-transition'){
    s.denied=true;set(s);window.__cloudIntegrated.denied=true
    return error('42501','Current role/branch/session denied',403)
   }
   if(mode==='missing-rpc')return error('PGRST202','transition_staff_appointment not installed',404)
   const old=s.receipts[body.p_request_id]
   if(old)return JSON.stringify(old.body)===JSON.stringify(body)?response(old.result):error('23505','Changed nonce payload',409)
   if(mode==='conflict')return error('40001','Concurrent appointment revision',409)
   if(body.p_appointment!==ids.booking||!['confirm','decline','check_in','complete','no_show','cancel'].includes(body.p_action)||
     !Number.isSafeInteger(body.p_expected_revision)||body.p_expected_revision!==s.booking.lifecycle_revision)
     return error('40001','Revision mismatch',409)
   const target={confirm:'confirmed',decline:'cancelled',check_in:'checked_in',complete:'completed',no_show:'no_show',cancel:'cancelled'}[body.p_action]
   if(body.p_action==='confirm'||body.p_action==='decline'||body.p_action==='cancel'){
    if(!['requested','confirmed'].includes(s.booking.status)||body.p_action==='confirm'&&s.booking.status!=='requested'||body.p_action==='decline'&&s.booking.status!=='requested')
     return error('23514','Transition unavailable')
   }else if(body.p_action==='check_in'||body.p_action==='no_show'){
    if(s.booking.status!=='confirmed')return error('23514','Expected confirmed')
   }else if(body.p_action==='complete'){
    if(s.booking.status!=='checked_in'||mode!=='encounter')return error('23514','Encounter missing')
   }
   if(mode==='policy')return error('23514','Scheduling policy denied',409)
   const result={kind:'staff_appointment_transition',appointmentId:ids.booking,branchId:ids.naga,
     action:body.p_action,status:target,revision:s.booking.lifecycle_revision+1}
   s.booking.status=target;s.booking.lifecycle_revision++
   s.receipts[body.p_request_id]={body,result}
   set(s)
   if(mode==='bad-reply')return response({...result,status:'requested'})
   if(mode==='timeout-once'&&!s.once){s.once=true;set(s);throw Error('Failed to fetch: synthetic lost acknowledgement')}
   return response(result)
  }
  return base(input,init)
 }
}
