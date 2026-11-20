// Test-only Vite entrypoint for the REAL BillingStaffWorkspace; not imported by production.
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router'
import {BillingStaffWorkspace} from '../../src/billing/Workspace'
import type {BillingReadPort} from '../../src/billing/port'
import '../../src/styles.css'
const params=new URLSearchParams(location.search)
const accountId=params.get('actor')??'staff'
const call=async(path:string)=>{
  const res=await fetch('/__qa_billing/'+path)
  const data=await res.json()
  if(!res.ok)throw Object.assign(new Error(data.message??'Synthetic billing failed'),{code:data.code??String(res.status)})
  return data
}
const port:BillingReadPort={
 branches:()=>call('branches'),
 invoices:branchId=>call('invoices?branch='+encodeURIComponent(branchId)),
 detail:(branchId,invoiceId)=>call('detail?branch='+encodeURIComponent(branchId)+'&invoice='+encodeURIComponent(invoiceId))
}
const root=document.getElementById('root')
if(!root)throw Error('Missing synthetic billing mount point')
createRoot(root).render(<StrictMode><MemoryRouter><BillingStaffWorkspace
  key={accountId} accountId={accountId} port={port}/></MemoryRouter></StrictMode>)
