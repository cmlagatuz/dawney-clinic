// CLOUD: test-only browser mount. No production import, provider Auth or real patient data.
import {StrictMode,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router'
import {ChartIntegration} from '../../src/clinical/ChartIntegration'
import type {ClinicalChartPort} from '../../src/clinical/chart-port'
import type {ChartRequest,DraftSaveRequest} from '../../src/clinical/chart-model.mjs'
import '../../src/styles.css'
import '../../src/clinical/workspace.css'
const id=(n:number)=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0')
const read=async(request:ChartRequest)=>{
  const response=await fetch('/__qa_clinical/read',{headers:{
    'x-qa-account':request.accountId,'x-qa-branch':request.branchId,
    'x-qa-pet':request.petId,'x-qa-section':request.section,
    'x-qa-cursor':request.cursor?.id??'','x-qa-limit':String(request.limit)}})
  const body:unknown=await response.json()
  if(!response.ok)throw Object.assign(new Error('Synthetic clinical denied'),
    {code:response.status===403?'42501':response.status===404?'PGRST202':String(response.status)})
  return body
}
const saveDraft=async(input:DraftSaveRequest)=>{
  const response=await fetch('/__qa_clinical/save',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(input)})
  const body:unknown=await response.json()
  if(!response.ok)throw Object.assign(new Error('Synthetic save not confirmed'),
    {code:response.status===403?'42501':response.status===409?'40001':'network'})
  return body
}
const port:ClinicalChartPort={read,saveDraft}
const query=new URLSearchParams(location.search)
const testCase=query.get('case')??'ok'
document.documentElement.setAttribute('data-theme',query.get('theme')==='dark'?'dark':'light')
function Fixture(){
  const [branch,setBranch]=useState(id(2))
  const [account,setAccount]=useState(id(1))
  const [pet,setPet]=useState(id(3))
  const [mode,setMode]=useState<'overview'|'visits'|'history'|'encounter'>('overview')
  const [denied,setDenied]=useState(false)
  const role=query.get('role')==='receptionist'?'receptionist':
    query.get('role')==='administrator'?'administrator':'veterinarian'
  const syntheticSave=testCase==='write'||testCase==='conflict'||testCase==='uncertain'
  const change=(value:string,set:(value:string)=>void)=>{
    setDenied(false);set(value)
  }
  return <main className="page clinical-workspace" id="main-content">
    <h1>Clinical integration synthetic QA</h1>
    <p>Test-only fixture. No hosted clinical connection or medical record mutation.</p>
    <div className="clinical-daybar">
      <label>Chart section <select id="qa-mode" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}>
        <option value="overview">Overview</option><option value="visits">Appointments</option>
        <option value="history">Clinical history</option><option value="encounter">Encounter drafts</option>
      </select></label>
      <button id="qa-branch" type="button" onClick={()=>change(branch===id(2)?id(7):id(2),setBranch)}>Switch branch</button>
      <button id="qa-account" type="button" onClick={()=>change(account===id(1)?id(9):id(1),setAccount)}>Switch account</button>
      <button id="qa-patient" type="button" onClick={()=>change(pet===id(3)?id(8):id(3),setPet)}>Switch patient</button>
    </div>
    {denied?<p role="alert">Access revoked. All chart content cleared.</p>:
      <ChartIntegration key={account+':'+branch+':'+pet+':'+mode}
        accountId={account} branchId={branch} petId={pet} appointmentId={id(5)}
        role={role} mode={mode} port={port} syntheticSave={syntheticSave}
        onDenied={()=>setDenied(true)}/>}
  </main>
}
const node=document.getElementById('root')
if(!node)throw Error('Missing clinical fixture')
createRoot(node).render(<StrictMode><MemoryRouter><Fixture/></MemoryRouter></StrictMode>)
