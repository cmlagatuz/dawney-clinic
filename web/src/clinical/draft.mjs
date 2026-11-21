/**
 * CLOUD clinical note scratchpad validation. Pure logic: no API, storage,
 * clipboard, telemetry or clinical recommendations. Nothing here is a save.
 */
export const CLINICAL_SECTIONS=Object.freeze([
  {id:'overview',label:'Patient overview'},
  {id:'visits',label:'Appointments'},
  {id:'history',label:'Clinical history'},
  {id:'encounter',label:'Encounter'},
  {id:'treatments',label:'Treatments'},
  {id:'vaccinations',label:'Vaccinations'},
  {id:'prescriptions',label:'Prescriptions'}
])
export const DRAFT_FIELDS=Object.freeze({
  encounter:Object.freeze([
    {id:'complaint',label:'Presenting concern',required:true,max:1000},
    {id:'examination',label:'Examination findings',required:true,max:3000},
    {id:'assessment',label:'Clinical assessment',required:true,max:2000},
    {id:'plan',label:'Follow-up plan',required:false,max:2000}
  ]),
  treatments:Object.freeze([
    {id:'procedure',label:'Treatment or procedure',required:true,max:150},
    {id:'details',label:'Treatment details',required:true,max:2000},
    {id:'followUp',label:'Follow-up instructions',required:false,max:1000}
  ]),
  vaccinations:Object.freeze([
    {id:'product',label:'Vaccine or product',required:true,max:150},
    {id:'administeredOn',label:'Administration date (YYYY-MM-DD)',required:true,max:10},
    {id:'lot',label:'Batch or lot identifier',required:true,max:120},
    {id:'notes',label:'Clinical observations',required:false,max:1000}
  ]),
  prescriptions:Object.freeze([
    {id:'medicine',label:'Medication name',required:true,max:180},
    {id:'instructions',label:'Instructions / prescribed dose',required:true,max:1200},
    {id:'duration',label:'Duration or review date',required:true,max:160},
    {id:'notes',label:'Additional precautions',required:false,max:1000}
  ])
})
const VALID_DATE=/^\d{4}-\d{2}-\d{2}$/
const badControls=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
export const newDraft = kind => Object.fromEntries((DRAFT_FIELDS[kind]??[]).map(f=>[f.id,'']))
export function validateClinicalDraft(kind, data){
  const fields=DRAFT_FIELDS[kind]
  if(!fields||!data||typeof data!=='object') return {valid:false,errors:{form:'This draft type is unavailable.'}}
  const errors={}
  for(const f of fields){
    const raw=data[f.id]
    if(typeof raw!=='string'){errors[f.id]='Invalid field value.';continue}
    const text=raw.trim()
    if(f.required&&!text){errors[f.id]='This field is required.';continue}
    if(text.length>f.max){errors[f.id]=`Use ${f.max} characters or fewer.`;continue}
    if(badControls.test(text)){errors[f.id]='Remove unsupported control characters.';continue}
    if(f.id==='administeredOn'&&text){
      if(!VALID_DATE.test(text)||Number.isNaN(Date.parse(text+'T00:00:00Z'))||
         new Date(text+'T00:00:00Z').toISOString().slice(0,10)!==text)
        errors[f.id]='Use a valid calendar date in YYYY-MM-DD format.'
    }
  }
  return {valid:Object.keys(errors).length===0,errors}
}
/** Never infer patient membership from arbitrary URL ids: only verified branch queue rows. */
export function selectPatientVisits(window,petId){
  if(!window||!Array.isArray(window.items)||typeof petId!=='string')return []
  return window.items.filter(row=>row&&row.pet_id===petId)
    .sort((a,b)=>Date.parse(b.starts_at)-Date.parse(a.starts_at))
}
