// CLOUD test fixture only — copied from existing approved staff-ops journey then extended
// for release UAT. No changes to original Qwen/PR89 tests, production source, or flags.
// Every remote request is intercepted. The only mutation allowed is a SYNTHETIC
// owner booking RPC with intentionally failed-first idempotent retry.
export function releaseClinicFixture(){
  const uuid=n=>'40000000-0000-4000-8000-'+String(n).padStart(12,'0')
  const ids={naga:uuid(1),cavite:uuid(2),service:uuid(3),resource:uuid(4),
    ownerUser:uuid(5),staffUser:uuid(6),otherUser:uuid(7),
    owner:uuid(8),pet:uuid(9),otherPet:uuid(10),booking:uuid(11),
    ownerB:uuid(14),petB:uuid(15),
    med:uuid(12),lot:uuid(13)}
  const remote='https://issue51-fixtures.supabase.co'
  const fakeNow=Date.parse('2026-11-20T01:00:00Z')
  const RealDate=Date
  class FixedDate extends RealDate{
    constructor(...args){super(...(args.length?args:[fakeNow]))}
    static now(){return fakeNow}
  }
  window.Date=FixedDate
  const qs=new URL(location.href).searchParams
  const actor=qs.get('actor')||'visitor'
  let currentActor=actor
  const mode=qs.get('case')||'normal'
  const theme=qs.get('theme')==='dark'?'dark':'light'
  localStorage.setItem('dawney-theme',theme)
  const bookingKey='cloud.integrated.syntheticBooking'
  const auditKey='cloud.integrated.syntheticAudit'
  if(qs.get('reset')==='1'){
    localStorage.removeItem(bookingKey)
    localStorage.removeItem('cloud.integrated.day')
    localStorage.setItem(auditKey,'[]')
  }
  const id=currentActor==='staff'?ids.staffUser:currentActor==='other'?ids.otherUser:ids.ownerUser
  const user={id,aud:'authenticated',role:'authenticated',email:'fixture-'+actor+'@example.test',
    created_at:'2025-01-01T00:00:00Z',email_confirmed_at:'2025-01-01T00:00:00Z',
    user_metadata:{},app_metadata:{}}
  const expires_at=Math.floor(RealDate.now()/1000)+86400*365
  const access_token=['{"alg":"HS256","typ":"JWT"}',JSON.stringify({sub:id,exp:expires_at}),'synthetic']
    .map(x=>btoa(x).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')).join('.')
  if(actor==='visitor')localStorage.removeItem('dawney.auth.v1')
  else localStorage.setItem('dawney.auth.v1',JSON.stringify({
    user,access_token,refresh_token:'integration-test',expires_at
  }))
  window.__cloudIntegrated={rpcs:[],unexpected:[],directWrites:[],denied:false,recovered:false,
    clinicalReads:[],clinicalWrites:[],authSubmits:0}
  const weekly=Object.fromEntries(['sun','mon','tue','wed','thu','fri','sat']
    .map(x=>[x,[{open:'12:30',close:'14:00'}]]))
  const owner={id:ids.owner,user_id:ids.ownerUser,first_name:'Fixture',last_name:'Owner',
    phone:null,address:null}
  const ownerB={id:ids.ownerB,user_id:ids.otherUser,first_name:'Fixture',last_name:'B',
    phone:null,address:null}
  const petB={id:ids.petB,owner_id:ids.ownerB,name:'Synthetic B Patient',
    species:'Dog',breed:'Mixed',sex:'unknown',color:null,birth_date:null,
    species_id:'dog',breed_id:null,taxonomy_review_needed:false}
  const pet={id:ids.pet,owner_id:ids.owner,name:'Synthetic Patient',
    species:'Dog',breed:'Mixed',sex:'unknown',color:null,birth_date:null,
    species_id:'dog',breed_id:null,taxonomy_review_needed:false}
  const service={id:ids.service,branch_id:ids.naga,slug:'fixture-care',
    display_name:'Fixture care',summary:null,duration_minutes:30,
    published_at:'2026-01-01T00:00:00Z'}
  const medicine={id:ids.med,product_code:'QA-INTEGRATION',generic_name:'Synthetic medicine',
    formulation:'vial',strength:'1 unit',stock_unit:'vial',
    minimum_shelf_life_days:0,requires_refrigeration:false,is_controlled:false,is_active:true}
  const rule={branch_id:ids.naga,medicine_id:ids.med,
    reorder_point_units:2,expiry_warning_days:30}
  const alert={medicine_id:ids.med,product_code:medicine.product_code,
    available_units:5,reorder_point_units:2,out_of_stock:false,low_stock:false,
    expiry_warning_days:30,near_expiry_batches:1,expired_batches:0,quarantined_batches:0}
  const batch={id:ids.lot,branch_id:ids.naga,medicine_id:ids.med,lot_number:'QA-LOT-1',
    received_on:'2026-11-01',expiry_date:'2026-12-10',
    disposition:'released',on_hand_units:5,reserved_units:0,quarantined_units:0}
  const fefo={batch_id:batch.id,lot_number:batch.lot_number,
    expiry_date:batch.expiry_date,available_units:5,received_on:batch.received_on}
  const originalFetch=window.fetch.bind(window)
  const response=(data,status=200)=>new Response(JSON.stringify(data),{
    status,headers:{'content-type':'application/json','access-control-allow-origin':'*'}
  })
  const filter=(url,name)=>url.searchParams.get(name)?.replace(/^eq\./,'')
  const saved=()=>{try{return JSON.parse(localStorage.getItem(bookingKey)||'null')}catch{return null}}
  const audit=(method,url)=>{
    const rows=JSON.parse(localStorage.getItem(auditKey)||'[]')
    rows.push({actor:currentActor,method,path:url.pathname,branch:filter(url,'branch_id')??null,bounds:url.searchParams.getAll('starts_at')})
    localStorage.setItem(auditKey,JSON.stringify(rows))
  }
  window.fetch=async(input,init)=>{
    const req=new Request(input,init),url=new URL(req.url)
    if(url.origin===location.origin&&url.pathname.startsWith('/__qa_clinical/')){
      // Isolated localhost-only chart fixture. No actual clinical provider RPC.
      if(url.pathname==='/__qa_clinical/save'){
        // ONLY localhost test fixture. Never forward to Supabase or a provider.
        const input=await req.json()
        window.__cloudIntegrated.clinicalWrites.push({
          localOnly:true,requestId:input.requestId,revision:input.expectedRevision})
        if(!['write','conflict','uncertain'].includes(mode))
          return response({code:'42501',message:'Clinical persistence disabled'},403)
        if(mode==='conflict')return response({code:'40001',message:'Synthetic version conflict'},409)
        if(mode==='uncertain'&&window.__cloudIntegrated.clinicalWrites.length===1)
          return response({code:'08006',message:'Synthetic uncertain acknowledgement'},503)
        return response({kind:'saved',id:'20000000-0000-4000-8000-000000000100',
          appointmentId:input.appointmentId,branchId:input.branchId,
          petId:input.petId,authorId:'20000000-0000-4000-8000-000000000005',
          editorId:'20000000-0000-4000-8000-000000000001',
          status:'draft',revision:input.expectedRevision+1,updatedAt:'2026-11-21T12:00:00Z'})
      }
      if(url.pathname!=='/__qa_clinical/read')return response({code:'404'},404)
      const field=name=>req.headers.get('x-qa-'+name)
      const id=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0')
      const section=field('section'),cursor=field('cursor'),branch=field('branch')
      const scope={accountId:field('account'),branchId:branch,petId:field('pet'),ownerId:field('owner')}
      if(mode==='late'&&branch===id(2))await new Promise(resolve=>setTimeout(resolve,250))
      if(mode==='missing')return response({code:'PGRST202',message:'Migration missing'},404)
      if(mode==='denied'||mode==='revoked')return response({code:'42501',message:'Permission revoked'},403)
      if(mode==='network')throw new TypeError('Synthetic chart network disconnected')
      if(mode==='not-found')return response({kind:'not_found'})
      window.__cloudIntegrated.clinicalReads.push({section,cursor,scope})
      if(scope.accountId!==id(1)||scope.ownerId!==id(4)||scope.petId!==id(3))
        return response({code:'42501',message:'Wrong chart scope'},403)
      const stamp=n=>new RealDate(RealDate.parse('2026-11-20T12:00:00Z')-n*60000).toISOString()
      const count=mode==='pages'?51:1
      const all=Array.from({length:count},(_,i)=>{
        const common={id:id(100+i),branchId:branch,petId:scope.petId}
        if(section==='appointments')return {...common,startsAt:stamp(i),
          endsAt:new RealDate(RealDate.parse(stamp(i))+1800000).toISOString(),
          status:'requested',concern:'Synthetic booking chart history'}
        if(section==='records')return {...common,performedAt:stamp(i),
          procedure:'Synthetic record '+i,temperatureC:38.4,weightKg:12,
          comments:'Synthetic only',authoredBy:id(1)}
        return {...common,appointmentId:mode==='pages'&&i<50?id(500+i):id(5),
          authorId:id(5),editorId:id(6),revision:1,status:'draft',
          complaint:'Synthetic draft '+i,examination:'Existing exam',assessment:'Existing assessment',
          plan:'Existing plan',createdAt:stamp(i),
          updatedAt:new RealDate(RealDate.parse(stamp(i))+1000).toISOString()}
      })
      const items=cursor?all.slice(50):all.slice(0,50)
      const more=count>50&&!cursor,last=items.at(-1)
      const at=section==='appointments'?last?.startsAt:section==='records'?last?.performedAt:last?.createdAt
      const packet={kind:'ok',accountId:scope.accountId,branchId:branch,section,
        patient:{id:id(3),ownerId:id(4),name:branch===id(7)?'Synthetic Other Branch Patient':'Synthetic Chart Patient',
          species:'Dog',breed:'Chow Chow',sex:'unknown',birthDate:'2021-11-01',taxonomyReviewNeeded:false},
        items,hasMore:more,nextCursor:more?{at,id:last.id}:null}
      if(mode==='wrong-owner')packet.patient.ownerId=id(99)
      if(mode==='wrong-branch')packet.branchId=id(99)
      if(mode==='wrong-patient'&&packet.items[0])packet.items[0].petId=id(99)
      if(mode==='malformed'&&packet.items[0])packet.items[0].id='bad-id'
      if(mode==='bad-date'&&packet.items[0])packet.items[0].performedAt='not-a-timestamp'
      if(mode==='empty'){packet.items=[];packet.hasMore=false;packet.nextCursor=null}
      return response(packet)
    }
    if(url.origin===location.origin)return originalFetch(input,init)
    if(url.origin!==remote){
      window.__cloudIntegrated.unexpected.push('non-fixture origin')
      throw Error('Network not authorized')
    }
    if(req.method==='OPTIONS')return response({})
    audit(req.method,url)
    const path=url.pathname
    const singular=(req.headers.get('accept')||'').includes('application/vnd.pgrst.object+json')
    if(path==='/auth/v1/token'&&req.method==='POST'){
      window.__cloudIntegrated.authSubmits++
      currentActor='owner'
      return response({access_token,refresh_token:'release-synthetic-refresh',
        token_type:'bearer',expires_in:3600,expires_at, user})
    }
    if(path==='/auth/v1/user')
      return mode==='expired'||currentActor==='visitor'
        ?response({message:'No verified synthetic session'},401):response(user)
    if(path==='/rest/v1/rpc/request_service_appointment'){
      if(currentActor!=='owner')return response({code:'42501',message:'Unauthorized request'},403)
      const body=await req.json()
      window.__cloudIntegrated.rpcs.push(body)
      const consistent=body.p_pet_id===ids.pet&&body.p_service_id===ids.service&&
        body.p_resource_id===ids.resource&&
        /^[0-9a-f-]{36}$/i.test(body.p_request_nonce)&&
        body.p_concern==='Synthetic cross-module appointment'
      if(!consistent)return response({code:'42501',message:'Wrong patient or service'},403)
      if(window.__cloudIntegrated.rpcs.length===1)
        return response({code:'08006',message:'Synthetic network failure'},503)
      const first=window.__cloudIntegrated.rpcs[0]
      if(JSON.stringify(first)!==JSON.stringify(body))
        return response({code:'23505',message:'Retry nonce changed'},409)
      const previous=saved()
      if(previous)return response(previous.id)
      const created={id:ids.booking,branch_id:ids.naga,status:'requested',
        owner_id:ids.owner,pet_id:ids.pet,resource_id:ids.resource,
        service_id:ids.service,starts_at:body.p_starts_at,
        ends_at:new RealDate(RealDate.parse(body.p_starts_at)+1800000).toISOString(),
        concern:body.p_concern,details:null}
      localStorage.setItem(bookingKey,JSON.stringify(created))
      return response(created.id)
    }
    const rpc=path==='/rest/v1/rpc/get_branch_dashboard_counts'||
      path==='/rest/v1/rpc/assert_staff_branch'||
      path==='/rest/v1/rpc/list_branch_medicine_alerts'||
      path==='/rest/v1/rpc/list_branch_medicine_fefo'
    if(rpc&&req.method==='POST'){
      const body=await req.json()
      const multi=mode==='multi'||mode==='multi-stale'
      const allowed=body.p_branch===ids.naga||(multi&&body.p_branch===ids.cavite)
      if(currentActor!=='staff'||!allowed||mode==='revoked'||window.__cloudIntegrated.denied)
        return response({code:'42501',message:'Branch access not authorized'},403)
      if(path.endsWith('/assert_staff_branch'))return response(body.p_branch)
      if(path.endsWith('/get_branch_dashboard_counts')){
        if(mode==='counts-missing')return response({code:'PGRST202',message:'Missing invoker counts function'},404)
        const present=Boolean(saved())&&body.p_branch===ids.naga&&mode!=='empty'
        return response([{patients:present?1:0,requested_appointments:present?1:0,confirmed_appointments:0}])
      }
      if(mode==='inventory-missing')return response({code:'PGRST202',message:'Inventory RPC unavailable'},404)
      if(path.endsWith('/list_branch_medicine_alerts'))return response([alert])
      if(body.p_medicine!==ids.med)return response([])
      return response([fefo])
    }
    if(req.method!=='GET'){
      window.__cloudIntegrated.directWrites.push(req.method+' '+path)
      return response({code:'42501',message:'Direct writes forbidden'},403)
    }
    if((url.searchParams.get('select')||'').includes('unit_cost_minor')||
       (url.searchParams.get('select')||'').includes('currency_code')){
      window.__cloudIntegrated.unexpected.push('restricted-cost-query')
      return response({code:'42501',message:'Cost columns restricted'},403)
    }
    if(path==='/rest/v1/clinic_branches'){
      const branch=filter(url,'id')
      if(branch){
        const value={id:branch,slug:branch===ids.naga?'naga':'cavite',
          display_name:branch===ids.naga?'Synthetic Naga':'Synthetic Cavite',
          booking_enabled:branch===ids.naga,timezone:'Asia/Manila'}
        return response(singular?value:[value])
      }
      return response([
        {id:ids.naga,slug:'naga',display_name:'Synthetic Naga'},
        {id:ids.cavite,slug:'cavite',display_name:'Synthetic Cavite'}
      ])
    }
    if(path==='/rest/v1/branch_booking_policies'){
      return response({branch_id:ids.naga,is_approved:true,timezone:'Asia/Manila',
        weekly_hours:weekly,holidays:[],lead_minutes:1440,max_advance_days:4,
        slot_step_minutes:15,revision:1})
    }
    if(path==='/rest/v1/clinic_services')return response([service])
    if(path==='/rest/v1/clinic_service_resources')return response([
      {service_id:ids.service,resource_id:ids.resource,capacity:1,public_label:'Fixture room'}
    ])
    if(path==='/rest/v1/appointment_resources')return response([
      {id:ids.resource,branch_id:ids.naga,is_active:true}
    ])
    if(path==='/rest/v1/owners'){
      const own=currentActor==='owner'?owner:currentActor==='other'?ownerB:null
      return response(own?(singular?own:[own]):singular?null:[])
    }
    if(path==='/rest/v1/pets'){
      if(currentActor!=='owner'&&currentActor!=='other'){
        window.__cloudIntegrated.unexpected.push('staff-wide-patient-query')
        return response({code:'42501',message:'Staff patient query denied'},403)
      }
      const ownPet=currentActor==='owner'?pet:petB
      const selected=filter(url,'id')
      if(selected)return response(singular?(selected===ownPet.id?ownPet:null):selected===ownPet.id?[ownPet]:[])
      return response([ownPet])
    }
    if(path==='/rest/v1/species_catalog')return response([
      {id:'dog',clinic_supported:true,is_active:true,review_status:'curated'}
    ])
    if(path==='/rest/v1/clinic_service_species')
      return response([{species_id:'dog'}])
    if(path==='/rest/v1/appointments'){
      const booking=saved()
      if(currentActor==='owner'||currentActor==='other'){
        const own=booking?.owner_id===(currentActor==='owner'?ids.owner:ids.ownerB)?[booking]:[]
        return response(singular?(own[0]??null):own)
      }
      const branch=filter(url,'branch_id')
      const multi=mode==='multi'||mode==='multi-stale'
      if(currentActor!=='staff'||(branch!==ids.naga&&!(multi&&branch===ids.cavite))){
        window.__cloudIntegrated.unexpected.push('unscoped-or-foreign-staff-appointments')
        return response({code:'42501',message:'Branch filter required'},403)
      }
      if(mode==='network'&&!window.__cloudIntegrated.recovered)
        throw Error('Failed to fetch staff queue')
      if(mode==='multi-stale'&&branch===ids.naga&&!window.__cloudIntegrated.recovered)
        await new Promise(resolve=>{window.__cloudIntegrated.releaseQueue=resolve})
      const bounds=url.searchParams.getAll('starts_at')
      const lower=bounds.find(x=>x.startsWith('gte.'))?.slice(4)??''
      const higher=bounds.find(x=>x.startsWith('lt.'))?.slice(3)??''
      const rows=booking&&branch===ids.naga&&mode!=='empty'?[booking]:[]
      if(booking&&(mode==='exact250'||mode==='over250')){
        const extra=mode==='over250'?250:249
        for(let i=0;i<extra;i++){
          const starts_at=new RealDate(RealDate.parse(booking.starts_at)+(i+1)*60000).toISOString()
          rows.push({...booking,id:uuid(500+i),pet_id:uuid(900+i),resource_id:uuid(1300+i),
            starts_at,ends_at:new RealDate(RealDate.parse(starts_at)+30000).toISOString()})
        }
      }
      return response(rows.filter(x=>(!lower||x.starts_at>=lower)&&(!higher||x.starts_at<higher)))
    }
    if(path==='/rest/v1/staff_memberships'){
      const role=currentActor==='staff'&&mode!=='denied'?(mode==='receptionist'||mode==='role-mismatch'?'receptionist':'veterinarian'):null
      // PostgREST maybeSingle GET in this client version normalizes a JSON array.
      // The browser's existing staff fixture likewise supplies [row] or [].
      return response(role?[{user_id:ids.staffUser,role,is_active:true}]:[])
    }
    if(path==='/rest/v1/staff_branch_memberships'){
      const multi=mode==='multi'||mode==='multi-stale'
      return response(currentActor==='staff'&&mode!=='denied'
        ?[...[ids.naga,...(multi?[ids.cavite]:[])].map(branch_id=>({
          user_id:ids.staffUser,branch_id,role:mode==='receptionist'?'receptionist':'veterinarian',is_active:true}))]:[])
    }
    if(path==='/rest/v1/medicine_catalog'){
      if(mode==='network'&&!window.__cloudIntegrated.recovered)
        throw Error('Failed to fetch medicine catalog')
      return response([medicine])
    }
    if(path==='/rest/v1/branch_medicine_rules')
      return response(filter(url,'branch_id')===ids.naga?[rule]:[])
    if(path==='/rest/v1/branch_stock_batches')
      return response(filter(url,'branch_id')===ids.naga?[batch]:[])
    if(path==='/rest/v1/stock_movements')
      return response([])
    window.__cloudIntegrated.unexpected.push(path)
    return response({code:'PGRST202',message:'Unexpected synthetic endpoint'},404)
  }
}
