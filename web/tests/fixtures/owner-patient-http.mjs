// CLOUD isolated localhost test enhancement for PR116 owner/patient lifecycle.
// Install AFTER releaseClinicFixture() so verified owner and booking contracts are
// unchanged. Everything else is intercepted by the inherited synthetic fetch.
export function ownerPatientHttpFixture() {
  const upstream=window.fetch.bind(window)
  const qs=new URL(location.href).searchParams
  const mode=qs.get('case')||'normal'
  const actor=qs.get('actor')||'owner'
  const uuid=n=>'70000000-0000-4000-8000-'+String(n).padStart(12,'0')
  const remote='https://issue51-fixtures.supabase.co'
  const owner=actor==='other'?'40000000-0000-4000-8000-000000000014':'40000000-0000-4000-8000-000000000008'
  const user=actor==='other'?'40000000-0000-4000-8000-000000000007':'40000000-0000-4000-8000-000000000005'
  const petId=actor==='other'?'40000000-0000-4000-8000-000000000015':'40000000-0000-4000-8000-000000000009'
  const seed={id:petId,owner_id:owner,name:actor==='other'?'Synthetic B Patient':'Synthetic Patient',
    species:'Dog',breed:'Chow Chow',species_id:'dog',breed_id:'dog-chow-chow',
    taxonomy_review_needed:false,sex:'unknown',color:null,birth_date:null}
  const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{
    'content-type':'application/json','access-control-allow-origin':'*'}})
  const read=(name,fallback=[])=>{try{return JSON.parse(localStorage.getItem('cloud.qaOwner.'+name)||'null')??fallback}catch{return fallback}}
  const write=(name,data)=>localStorage.setItem('cloud.qaOwner.'+name,JSON.stringify(data))
  const filter=(url,name)=>url.searchParams.get(name)?.replace(/^eq\./,'')
  const species=[
    {id:'dog',label:'Dog',group_name:'companion',scientific_name:'Canis lupus familiaris',
      is_active:true,clinic_supported:true,review_status:'curated',source_name:'Fixture',source_url:null},
    {id:'cat',label:'Cat',group_name:'companion',scientific_name:'Felis catus',
      is_active:true,clinic_supported:true,review_status:'curated',source_name:'Fixture',source_url:null},
    {id:'cattle',label:'Cattle',group_name:'livestock',scientific_name:null,
      is_active:true,clinic_supported:false,review_status:'curated',source_name:'Fixture',source_url:null}
  ]
  const breeds=[
    {id:'dog-chow-chow',species_id:'dog',label:'Chow Chow',kind:'recognized'},
    {id:'dog-mixed',species_id:'dog',label:'Mixed',kind:'mixed'},
    {id:'dog-unknown',species_id:'dog',label:'Unknown',kind:'unknown'},
    {id:'dog-na',species_id:'dog',label:'Not applicable',kind:'not_applicable'},
    {id:'cat-mixed',species_id:'cat',label:'Mixed',kind:'mixed'}
  ].map(x=>({...x,is_active:true,review_status:'curated',source_name:'Fixture',source_url:null}))
  window.__qaPatient={unexpected:[],writes:[],photoReads:0,storageDownloads:0}
  window.fetch=async(input,init)=>{
    const req=new Request(input,init),url=new URL(req.url)
    if(url.origin!==remote)return upstream(input,init)
    const path=url.pathname,method=req.method
    const single=(req.headers.get('accept')||'').includes('application/vnd.pgrst.object+json')
    if(path==='/rest/v1/owners'&&mode==='owner-denied')
      return reply({code:'42501',message:'Owner metadata denied'},403)
    if(path==='/rest/v1/pets'){
      if(mode==='patient-denied'&&method==='GET')return reply({code:'42501',message:'Patient read denied'},403)
      const all=[seed,...read('pets').filter(row=>row.owner_id===owner)]
      if(method==='GET'){
        const exact=filter(url,'id')||null
        const rows=all.filter(row=>(!exact||row.id===exact)&&(!filter(url,'owner_id')||row.owner_id===filter(url,'owner_id')))
        return reply(single?(rows[0]??null):rows)
      }
      if(actor!=='owner'&&actor!=='other')return reply({code:'42501',message:'Not an owner'},403)
      const body=await req.json()
      if(method==='POST'){
        if(body.owner_id!==owner)return reply({code:'42501',message:'Owner ID mismatch'},403)
        const saved={...body,id:uuid(100+read('pets').length),
          taxonomy_review_needed:false,sex:body.sex||'unknown',
          species:species.find(x=>x.id===body.species_id)?.label||'Unknown',
          breed:breeds.find(x=>x.id===body.breed_id)?.label||null}
        write('pets',[...read('pets'),saved])
        window.__qaPatient.writes.push('synthetic-pet-create')
        return reply(single?saved:[saved],201)
      }
      if(method==='PATCH'){
        const exact=filter(url,'id')
        if(!exact||!all.some(row=>row.id===exact))return reply({code:'42501',message:'Foreign patient'},403)
        const updated={...all.find(row=>row.id===exact),...body}
        write('pets',[...read('pets').filter(row=>row.id!==exact),updated])
        window.__qaPatient.writes.push('synthetic-pet-edit')
        return reply(single?updated:[updated])
      }
    }
    if(path==='/rest/v1/species_catalog' || path==='/rest/v1/breed_catalog'){
      const rows=(path.endsWith('species_catalog')?species:breeds)
        .filter(row=>!filter(url,'id')||row.id===filter(url,'id'))
        .filter(row=>!filter(url,'species_id')||row.species_id===filter(url,'species_id'))
      return reply(single?rows[0]??null:rows)
    }
    if(path==='/rest/v1/pet_attachments'){
      if(mode==='attachments-denied'&&method==='GET')return reply({code:'42501',message:'Private metadata denied'},403)
      const payload=method==='POST'?await req.clone().json():null
      const exact=filter(url,'pet_id')||payload?.pet_id||petId
      if(![petId,...read('pets').filter(p=>p.owner_id===owner).map(p=>p.id)].includes(exact))
        return reply({code:'42501',message:'Foreign patient'},403)
      if(method==='GET'){
        const all=read('attachments')
          .filter(row=>row.pet_id===exact)
          .filter(row=>!filter(url,'id')||row.id===filter(url,'id'))
        if(mode==='malformed-attachment'&&all.length)all[0]={...all[0],object_path:'pets/'+uuid(800)+'/owners/'+user+'/'+uuid(801)+'.pdf'}
        return reply(single?all[0]??null:all)
      }
      if(method==='POST'){
        const body=payload
        if(mode==='metadata-fail'&&body.category==='health_card'&&!window.__qaPatient.failedMetadataOnce){
          window.__qaPatient.failedMetadataOnce=true
          return reply({code:'08006',message:'Synthetic metadata finalization failed'},503)
        }
        if(body.pet_id!==exact||!String(body.object_path).startsWith('pets/'+exact+'/owners/'+user+'/'))
          return reply({code:'42501',message:'Invalid Storage owner prefix'},403)
        const all=read('attachments'),saved={...body,id:uuid(300+all.length),version_no:1,uploaded_by:user,
          created_at:'2026-11-21T01:00:00Z'}
        write('attachments',[...all,saved])
        window.__qaPatient.writes.push('synthetic-metadata-create')
        return reply(single?saved:[saved],201)
      }
    }
    if(path.startsWith('/storage/v1/object/')){
      const objectPath=decodeURIComponent(path.slice('/storage/v1/object/'.length))
      if(method==='POST'){
        if(!objectPath.startsWith('clinical-attachments/pets/')||!objectPath.includes('/owners/'+user+'/'))
          return reply({message:'Storage scope denied'},403)
        const all=read('objects');write('objects',[...all,objectPath])
        window.__qaPatient.writes.push('synthetic-storage-upload')
        return reply({Key:objectPath,Id:uuid(400+all.length)})
      }
      if(method==='GET'){
        window.__qaPatient.storageDownloads++
        if(!read('objects').some(p=>p===objectPath.replace(/^authenticated\//,'')))
          return reply({message:'Private object missing'},404)
        if(mode==='download-denied')return reply({message:'Download denied'},403)
        return new Response(Uint8Array.from([37,80,68,70,45,49,46,55]),{status:200,headers:{'content-type':'application/pdf'}})
      }
    }
    return upstream(input,init)
  }
}
