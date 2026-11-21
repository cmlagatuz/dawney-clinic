/**
 * Synthetic in-browser PostgREST overlay for exact ASTRA #126 RPCs.
 * Install AFTER releaseClinicFixture(). No hosted DB, no service keys.
 * sessionStorage represents a disposable mock server across same-tab reloads.
 */
export function operationalHttpFixture(){
 const uuid=n=>'40000000-0000-4000-8000-'+String(n).padStart(12,'0')
 const ids={naga:uuid(1),cavite:uuid(2),owner:uuid(5),staff:uuid(6),applicant:uuid(7),
  existing:uuid(12),existingLot:uuid(13),newItem:uuid(600),newBatch:uuid(601)}
 const qs=new URL(location.href).searchParams
 const actor=qs.get('actor')||'owner',mode=qs.get('case')||'normal',ops=qs.get('ops')||''
 const remote='https://issue51-fixtures.supabase.co'
 const key='cloud.operator.synthetic.v1'
 const seed=()=>({
  staffRequest:{userId:ids.applicant,requestedBranchId:ids.naga,state:'pending',
   revision:1,requestedAt:'2026-11-20T00:00:00Z',reviewedAt:null},
  ownRequest:null,products:[],receipts:{},reviews:{},events:[],calls:[],sentOnce:{}
 })
 if(qs.get('resetOps')==='1')sessionStorage.removeItem(key)
 const load=()=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')||seed()}catch{return seed()}}
 const save=s=>sessionStorage.setItem(key,JSON.stringify(s))
 const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json','access-control-allow-origin':'*'}
 })
 const deny=()=>json({code:'42501',message:'Synthetic role or branch denied'},403)
 const error=(code,message,status=400)=>json({code,message},status)
 const actorId=actor==='staff'?ids.staff:ids.owner
 const writeAllowed=actor==='staff'&&['administrator','receptionist'].includes(mode)
 const admin=actor==='staff'&&mode==='administrator'
 const validBranch=x=>x===ids.naga
 const baseFetch=window.fetch.bind(window)
 window.__operationalMock={calls:[],blocked:[],receipts:[],getDb:load}
 window.fetch=async(input,init)=>{
  const req=new Request(input,init),url=new URL(req.url)
  if(url.origin!==remote)return baseFetch(input,init)
  const path=url.pathname,which=path.split('/').at(-1)
  const rpcs=new Set(['request_staff_access','get_my_staff_access','list_staff_access_requests',
   'review_staff_access','create_branch_inventory_item','receive_branch_inventory_stock',
   'edit_branch_inventory_item','get_branch_inventory_balance'])
  const s=load()
  const query=name=>url.searchParams.get(name)?.replace(/^eq\./,'')
  if(path==='/rest/v1/staff_memberships'&&mode==='accountant')
   return json([{user_id:ids.staff,role:'accountant',is_active:true}])
  if(path==='/rest/v1/staff_branch_memberships'&&mode==='accountant')
   return json([{user_id:ids.staff,branch_id:ids.naga,role:'accountant',is_active:true}])
  if(path==='/rest/v1/medicine_catalog'){
   const existing={id:ids.existing,product_code:'QA-INTEGRATION',generic_name:'Synthetic medicine',
    formulation:'vial',strength:'1 unit',stock_unit:'vial',
    minimum_shelf_life_days:0,requires_refrigeration:false,is_controlled:false,is_active:true}
   return json([existing,...s.products.map(p=>p.catalog)])
  }
  if(path==='/rest/v1/branch_medicine_rules'){
   const rows=[{branch_id:ids.naga,medicine_id:ids.existing,reorder_point_units:2,expiry_warning_days:30,
     branch_display_name:'Synthetic medicine',branch_description:'',profile_revision:1},
    ...s.products.map(p=>p.rule)].filter(x=>x.branch_id===(query('branch_id')||ids.naga))
   const row=rows.find(x=>x.medicine_id===query('medicine_id'))
   const singular=req.headers.get('accept')?.includes('vnd.pgrst.object')
   if(query('medicine_id'))return json(singular?row??null:row?[row]:[])
   return json(rows)
  }
  if(path==='/rest/v1/stock_movements'){
   const rows=s.events.filter(x=>x.branch_id===query('branch_id')&&
    x.medicine_id===query('medicine_id')&&(!query('event_id')||x.event_id===query('event_id')))
   return json(rows)
  }
  if(path.startsWith('/rest/v1/rpc/')&&req.method==='POST'&&which==='list_branch_medicine_alerts'){
   const existing={medicine_id:ids.existing,product_code:'QA-INTEGRATION',
    available_units:5,reorder_point_units:2,out_of_stock:false,low_stock:false,
    expiry_warning_days:30,near_expiry_batches:1,expired_batches:0,quarantined_batches:0}
   const productRows=s.products.map(p=>{
    const available=p.stock
    return {medicine_id:p.catalog.id,product_code:p.catalog.product_code,
      available_units:available,reorder_point_units:p.rule.reorder_point_units,
      out_of_stock:available===0,low_stock:available<=p.rule.reorder_point_units,
      expiry_warning_days:p.rule.expiry_warning_days,near_expiry_batches:0,expired_batches:0,quarantined_batches:0}
   })
   return json([existing,...productRows])
  }
  if(!path.startsWith('/rest/v1/rpc/')||!rpcs.has(which))return baseFetch(input,init)
  const body=req.method==='POST'?await req.json():{}
  window.__operationalMock.calls.push({rpc:which,args:body})
  s.calls.push({rpc:which,args:body,actor:actorId})
  save(s)
  if(ops==='unavailable')return error('PGRST202','RPC not installed',404)
  if(ops==='network')throw TypeError('Synthetic network timeout')
  if(which==='get_my_staff_access'){
   const request=actor==='owner'?s.ownRequest:null
   const state=actor==='owner'?(request?.state??'none'):mode==='revoked'?'revoked':'approved'
   const role=actor==='owner'||mode==='revoked'?null:mode==='administrator'?'administrator':
    mode==='receptionist'?'receptionist':mode==='accountant'?'accountant':'veterinarian'
   return json({kind:'my_staff_access',state,role,
    branches:actor==='owner'||mode==='revoked'||mode==='accountant'?[]:[ids.naga]})
  }
  if(which==='request_staff_access'){
   if(actor!=='owner'||!validBranch(body.p_branch))return deny()
   if(s.ownRequest?.state==='pending'&&s.ownRequest.requestedBranchId===body.p_branch)
    return json({kind:'staff_request',state:'pending',revision:s.ownRequest.revision,branchId:body.p_branch})
   const revision=(s.ownRequest?.revision??0)+1
   s.ownRequest={userId:ids.owner,requestedBranchId:body.p_branch,state:'pending',
    revision,requestedAt:'2026-11-20T03:00:00Z',reviewedAt:null}
   save(s)
   return json({kind:'staff_request',state:'pending',revision,branchId:body.p_branch})
  }
  if(which==='list_staff_access_requests'){
   if(!admin||!validBranch(body.p_branch))return deny()
   return json({kind:'staff_requests',branchId:body.p_branch,
    items:[s.staffRequest,...(s.ownRequest?[s.ownRequest]:[])]})
  }
  if(which==='review_staff_access'){
   if(!admin||body.p_target===actorId||!validBranch(body.p_branches?.[0]??ids.naga))
    return deny()
   if(s.reviews[body.p_request_id])return json(s.reviews[body.p_request_id])
   const subject=body.p_target===ids.applicant?s.staffRequest:body.p_target===ids.owner?s.ownRequest:null
   if(!subject||subject.revision!==body.p_expected_revision)
    return error('40001','Synthetic stale revision',409)
   const actions=['approve','reject','inactivate','revoke','role_change']
   if(!actions.includes(body.p_action))return error('22023','Wrong decision')
   const state=['approve','role_change'].includes(body.p_action)?'approved':
    body.p_action==='inactivate'?'inactive':body.p_action==='revoke'?'revoked':'rejected'
   subject.state=state;subject.revision++;subject.reviewedAt='2026-11-20T05:00:00Z'
   const reply={kind:'staff_review',userId:subject.userId,state,
    role:['approve','role_change'].includes(body.p_action)?body.p_role:null,
    branches:['approve','role_change'].includes(body.p_action)?body.p_branches:[],revision:subject.revision}
   s.reviews[body.p_request_id]=reply
   save(s)
   if(ops==='review-timeout'&&!s.sentOnce[body.p_request_id]){
    s.sentOnce[body.p_request_id]=true;save(s);throw TypeError('Synthetic lost review acknowledgement')
   }
   return json(reply)
  }
  if(which==='get_branch_inventory_balance'){
   if(!validBranch(body.p_branch)||actor!=='staff'||mode==='revoked'||mode==='accountant')return deny()
   const p=s.products.find(x=>x.catalog.id===body.p_medicine)
   if(!p)return error('42501','Item unavailable',403)
   return json({kind:'inventory_balance',branchId:ids.naga,itemId:p.catalog.id,
    productCode:p.catalog.product_code,revision:p.rule.profile_revision,
    onHandUnits:p.stock,availableUnits:p.stock,reservedUnits:0,quarantinedUnits:0})
  }
  if(!writeAllowed||!validBranch(body.p_branch))return deny()
  if(which==='create_branch_inventory_item'){
   if(s.receipts[body.p_request_id])return json(s.receipts[body.p_request_id])
   if(s.products.some(x=>x.catalog.product_code===body.p_product_code))
    return error('23505','Duplicate product code',409)
   const p={catalog:{id:ids.newItem,product_code:body.p_product_code,generic_name:body.p_name,
     formulation:body.p_formulation??'Not applicable',strength:body.p_strength??'N/A',
     stock_unit:body.p_unit,minimum_shelf_life_days:0,requires_refrigeration:false,
     is_controlled:false,is_active:true},
    rule:{branch_id:ids.naga,medicine_id:ids.newItem,reorder_point_units:body.p_reorder_point,
     expiry_warning_days:30,branch_display_name:body.p_name,
     branch_description:body.p_description,profile_revision:1},stock:0}
   s.products.push(p)
   const reply={kind:'inventory_item',itemId:ids.newItem,branchId:ids.naga,
    productCode:body.p_product_code,category:body.p_category,
    unit:body.p_unit,revision:1,onHandUnits:0,batchId:null}
   s.receipts[body.p_request_id]=reply
   save(s)
   return json(reply)
  }
  if(which==='receive_branch_inventory_stock'){
   if(s.receipts[body.p_request_id])return json(s.receipts[body.p_request_id])
   const product=s.products.find(p=>p.catalog.id===body.p_medicine)
   if(!product||!Number.isInteger(body.p_quantity)||body.p_quantity<1||
    body.p_expiry<='2026-11-20')return error('23514','Synthetic lot invalid',400)
   product.stock+=body.p_quantity
   const eventId=body.p_request_id
   const reply={kind:'stock_received',branchId:ids.naga,itemId:product.catalog.id,
    batchId:ids.newBatch,receivedUnits:body.p_quantity,
    lotOnHandUnits:product.stock,actorId:actorId,eventId}
   s.receipts[body.p_request_id]=reply
   s.events.push({id:uuid(700),branch_id:ids.naga,medicine_id:product.catalog.id,
     batch_id:ids.newBatch,event_id:eventId,event_type:'receipt',
     delta_on_hand:body.p_quantity,after_on_hand:product.stock})
   save(s)
   if(ops==='timeout-once'&&!s.sentOnce[eventId]){
    s.sentOnce[eventId]=true;save(s);throw TypeError('Synthetic lost stock acknowledgement')
   }
   return json(reply)
  }
  if(which==='edit_branch_inventory_item'){
   const p=s.products.find(x=>x.catalog.id===body.p_medicine)
   if(!p||p.rule.profile_revision!==body.p_expected_revision)return error('40001','Stale profile revision',409)
   p.rule.branch_display_name=body.p_name;p.rule.branch_description=body.p_description
   p.rule.reorder_point_units=body.p_reorder_point
   p.rule.expiry_warning_days=body.p_expiry_warning_days
   p.rule.profile_revision++
   save(s)
   return json({kind:'inventory_item_updated',branchId:ids.naga,itemId:p.catalog.id,
    revision:p.rule.profile_revision,name:body.p_name,description:body.p_description,
    reorderPointUnits:body.p_reorder_point,expiryWarningDays:body.p_expiry_warning_days})
  }
  return error('PGRST202','Unexpected synthetic RPC',404)
 }
}
