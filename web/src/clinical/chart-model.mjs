/**
 * CLOUD's source-only clinical boundary. PR109's SQL and TS adapter are NOT
 * imported or activated. Always validate the full response before rendering.
 * Unrecognized patient, cursor, role or pagination metadata fails closed.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/
const DATE=/^\d{4}-\d\d-\d\d$/
const CONTROL=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
const str=x=>typeof x==='string'
const id=x=>str(x)&&UUID.test(x)
const time=x=>str(x)&&ISO.test(x)&&Number.isFinite(Date.parse(x))
const date=x=>x===null||(str(x)&&DATE.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x)
const value=(x,max,empty=true)=>str(x)&&x.length<=max&&(empty||!!x.trim())&&!CONTROL.test(x)
const number=(x,min,max)=>x===null||(typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max)
const fail=()=>{throw Error('Malformed clinical chart contract')}
const stamp=(section,item)=>section==='appointments'?item.startsAt:section==='records'?item.performedAt:item.createdAt
const cursorPair=x=>obj(x)&&time(x.at)&&id(x.id)
export const CLINICAL_PAGE_LIMIT=50
export const CHART_SECTIONS=Object.freeze(['appointments','records','drafts'])
export const isClinicalId=id
export function validateEncounter(data){
  const errors={}
  for(const field of ['complaint','examination','assessment','plan']){
    if(!value(data?.[field],4000,field!=='complaint'))errors[field]=
      field==='complaint'?'Enter a presenting complaint (1–4000 characters).':'Use 0–4000 characters without control characters.'
  }
  return {valid:Object.keys(errors).length===0,errors}
}
export function classifyChartError(error){
  const code=String(error?.code??error?.status??'')
  if(['42501','401','403','PGRST301'].includes(code))return 'denied'
  if(['PGRST116'].includes(code))return 'not_found'
  if(['PGRST202','42883','42P01','unavailable'].includes(code))return 'unavailable'
  if(['network','AbortError','TypeError'].includes(code)||error?.name==='TypeError'||/network|fetch failed/i.test(String(error?.message??'')))return 'network'
  return 'error'
}
export function validateChartPage(raw,request){
  const {accountId,branchId,petId,section,cursor=null,limit=50}=request
  if(!id(accountId)||!id(branchId)||!id(petId)||!CHART_SECTIONS.includes(section)||
     !Number.isInteger(limit)||limit<1||limit>50||(cursor!==null&&!cursorPair(cursor)))fail()
  if(obj(raw)&&['not_found','denied','unavailable'].includes(raw.kind))return {kind:raw.kind}
  if(!obj(raw)||raw.kind!=='ok'||raw.accountId!==accountId||raw.branchId!==branchId||
    raw.section!==section||!obj(raw.patient)||!Array.isArray(raw.items)||
    raw.items.length>limit||typeof raw.hasMore!=='boolean'||
    !(raw.nextCursor===null||cursorPair(raw.nextCursor))||
    (raw.hasMore&&(!raw.items.length||raw.nextCursor===null))||
    (!raw.hasMore&&raw.nextCursor!==null))fail()
  const p=raw.patient
  if(p.id!==petId||!id(p.id)||!id(p.ownerId)||!value(p.name,500,false)||
     !value(p.species,200,false)||!(p.breed===null||value(p.breed,200))||
     !['male','female','unknown'].includes(p.sex)||!date(p.birthDate)||
     typeof p.taxonomyReviewNeeded!=='boolean')fail()
  const patient={id:p.id,ownerId:p.ownerId,name:p.name,species:p.species,
    breed:p.breed,sex:p.sex,birthDate:p.birthDate,taxonomyReviewNeeded:p.taxonomyReviewNeeded}
  const items=[],seen=new Set()
  let prior=cursor
  for(const x of raw.items){
    if(!obj(x)||!id(x.id)||seen.has(x.id)||x.branchId!==branchId||x.petId!==petId)fail()
    seen.add(x.id)
    const at=stamp(section,x)
    if(!time(at))fail()
    if(prior&&(Date.parse(at)>Date.parse(prior.at)||
       (Date.parse(at)===Date.parse(prior.at)&&x.id.toLowerCase()>=prior.id.toLowerCase())))fail()
    prior={at,id:x.id}
    if(section==='appointments'){
      if(!time(x.endsAt)||Date.parse(x.endsAt)<=Date.parse(x.startsAt)||
        !['requested','confirmed','checked_in','completed','cancelled','no_show'].includes(x.status)||
        !value(x.concern,4000))fail()
      items.push({id:x.id,branchId,petId,startsAt:x.startsAt,endsAt:x.endsAt,status:x.status,concern:x.concern})
    }else if(section==='records'){
      if(!value(x.procedure,500,false)||!number(x.temperatureC,0,60)||!number(x.weightKg,0,100000)||
        !(x.comments===null||value(x.comments,8000))||
        !(x.authoredBy===null||id(x.authoredBy)))fail()
      items.push({id:x.id,branchId,petId,performedAt:x.performedAt,procedure:x.procedure,
        temperatureC:x.temperatureC,weightKg:x.weightKg,comments:x.comments,authoredBy:x.authoredBy})
    }else{
      if(!id(x.appointmentId)||!id(x.authorId)||!id(x.editorId)||x.status!=='draft'||
        !Number.isSafeInteger(x.revision)||x.revision<1||x.revision>2147483647||
        !time(x.updatedAt)||Date.parse(x.updatedAt)<Date.parse(x.createdAt)||
        !validateEncounter(x).valid)fail()
      items.push({id:x.id,appointmentId:x.appointmentId,branchId,petId,authorId:x.authorId,
        editorId:x.editorId,revision:x.revision,status:'draft',complaint:x.complaint,
        examination:x.examination,assessment:x.assessment,plan:x.plan,
        createdAt:x.createdAt,updatedAt:x.updatedAt})
    }
  }
  if(raw.hasMore&&(!prior||raw.nextCursor.at!==prior.at||
      raw.nextCursor.id.toLowerCase()!==prior.id.toLowerCase()))fail()
  return {kind:'ok',accountId,branchId,patient,section,items,
    hasMore:raw.hasMore,nextCursor:raw.hasMore?raw.nextCursor:null}
}
/** Verifies the response belongs to the exact version, actor, appointment, branch and patient. */
export function validateDraftAcknowledgement(raw,request,actorId){
  if(!obj(raw)||raw.kind!=='saved'||raw.status!=='draft'||!id(raw.id)||
    raw.appointmentId!==request.appointmentId||raw.branchId!==request.branchId||
    raw.petId!==request.petId||!id(raw.authorId)||raw.editorId!==actorId||
    !Number.isSafeInteger(raw.revision)||raw.revision!==request.expectedRevision+1||
    !time(raw.updatedAt))fail()
  return {kind:'saved',id:raw.id,appointmentId:raw.appointmentId,branchId:raw.branchId,
    petId:raw.petId,authorId:raw.authorId,editorId:raw.editorId,status:'draft',
    revision:raw.revision,updatedAt:raw.updatedAt}
}
export const draftSnapshot=data=>JSON.stringify(['complaint','examination','assessment','plan'].map(k=>data[k]))
/** Same revision and EXACT text reuses the request UUID after an uncertain network outcome. */
export function prepareSaveTicket(previous,input,uuidFactory){
  const snapshot=draftSnapshot(input)
  if(previous&&previous.snapshot===snapshot&&previous.expectedRevision===input.expectedRevision)return previous
  const requestId=uuidFactory()
  if(!id(requestId))fail()
  return {requestId,snapshot,expectedRevision:input.expectedRevision}
}
