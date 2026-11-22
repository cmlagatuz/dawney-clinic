import {useCallback,useEffect,useMemo,useRef,useState,type KeyboardEvent} from 'react'
import {Link} from 'react-router'
import {EmptyState,LoadingCard,PageHeading} from '../components/ui'
import {billingFailure,billingList,billingDetail,BILLING_STATUSES,
  displayAmount,shownInvoices} from './model.mjs'
import type {BillingFailure,BillingWindow,Invoice,InvoiceDetail} from './model.mjs'
import type {OpsBranch} from '../ops/branch-model.mjs'
import type {BillingReadPort} from './port'
import {shortRef} from '../ops/ops-model.mjs'
import './billing.css'

type BranchState={kind:'loading'}|{kind:'failed';reason:BillingFailure}|
 {kind:'ready';branches:OpsBranch[]}
type Read<T>={kind:'loading'}|{kind:'failed';reason:BillingFailure}|
 {kind:'ready';data:T}
const roleName={administrator:'Administrator',veterinarian:'Veterinarian',receptionist:'Receptionist'}
const failureText:Record<BillingFailure,string>={
 denied:'This account or branch is no longer authorized. All previously loaded financial records have been cleared.',
 unavailable:'An approved, branch-scoped billing read API has not been integrated. No invoice, payment amount or receipt can be displayed.',
 network:'The billing read failed over the network. No invoices or zero balances were assumed.',
 error:'The financial response failed validation or could not be read. Previously displayed financial details are hidden.'
}
const financeDisabled='Requires approved clinic pricing and a signed, audited financial transaction API.'

export function BillingStaffWorkspace({accountId,port}:{accountId:string;port:BillingReadPort}){
 const [scope,setScope]=useState<BranchState>({kind:'loading'})
 const [selection,setSelection]=useState<string|null>(null)
 const [epoch,setEpoch]=useState(0)
 const retry=useCallback(()=>{setSelection(null);setScope({kind:'loading'});setEpoch(n=>n+1)},[])
 const deny=useCallback(()=>{setSelection(null);setScope({kind:'failed',reason:'denied'})},[])
 useEffect(()=>{
   let active=true
   setScope({kind:'loading'});setSelection(null)
   void port.branches().then(branches=>{
     if(!active)return
     if(!branches.length){setScope({kind:'failed',reason:'denied'});return}
     setScope({kind:'ready',branches})
     if(branches.length===1)setSelection(branches[0]?.id??null)
   },e=>{if(active)setScope({kind:'failed',reason:billingFailure(e)})})
   return()=>{active=false}
 },[accountId,port,epoch])
 const branch=scope.kind==='ready'&&selection?
   scope.branches.find(x=>x.id===selection)??null:null
 return <section className="page billing-workspace" aria-labelledby="billing-title">
   <PageHeading eyebrow="Clinic staff · controlled finance preview" title="Billing & invoices" id="billing-title"
     actions={<span className="billing-lock">Financial transactions disabled</span>}>
     Branch-specific estimates, invoices and receipts require a verified finance reader.
     This preview never invents prices, taxes, charges or payment confirmations.
   </PageHeading>
   <div className="billing-intro" role="status">
     <strong>Financial records are not yet connected.</strong>
     <span>Only approved backend responses may populate amounts and statuses. The billing flag is OFF by default.</span>
   </div>
   {scope.kind==='loading'&&<LoadingCard label="Verifying active staff identity and authorized clinic branches…" rows={4}/>}
   {scope.kind==='failed'&&<BillingFailurePanel kind={scope.reason} retry={retry}/>}
   {scope.kind==='ready'&&<div className="billing-branch">
     <label htmlFor="billing-branch">Authorized clinic branch</label>
     <select id="billing-branch" value={branch?.id??''} onChange={e=>{
       const next=scope.branches.find(b=>b.id===e.target.value)
       setSelection(next?.id??null)
     }}>
       <option value="">Choose a branch before reading financial records…</option>
       {scope.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
     </select>
     <span className="billing-muted">{branch?roleName[branch.role]+' · '+branch.name:'No branch selected'}</span>
   </div>}
   {scope.kind==='ready'&&!branch&&<EmptyState icon="shield" title="Choose an authorized branch">
     Only your active clinic memberships are listed. A branch ID from the URL or account metadata never grants permission.
   </EmptyState>}
   {branch&&<BillingBranch key={accountId+':'+branch.id} branch={branch} port={port} onDenied={deny}/>}
   <div className="billing-actions" aria-label="Unavailable finance workflows">
     {['Create estimate','Create invoice','Finalize invoice','Record payment',
       'Issue refund','Void invoice','Export records','Send receipt'].map(label=>
       <button key={label} type="button" disabled title={financeDisabled}
         className="button button-secondary button-small">{label} · unavailable</button>)}
   </div>
   <p className="billing-muted billing-boundary">No card processing, journal entry, invoice email, receipt generation or clinical billing mutation is available.
     <Link to="/app/ops"> Return to authorized appointment operations</Link>.</p>
 </section>
}
function BillingFailurePanel({kind,retry}:{kind:BillingFailure;retry:()=>void}){
 return <section className="card billing-failure" role="alert">
   <h2>{kind==='denied'?'Financial access denied':
     kind==='unavailable'?'Billing read service not integrated':'Unable to read financial records'}</h2>
   <p>{failureText[kind]}</p>
   <div className="billing-actions">
     <button type="button" className="button button-secondary" onClick={retry}>
       {kind==='denied'?'Recheck staff permissions':'Retry authorized read'}</button>
     <Link className="button button-quiet" to="/app/overview">Back to overview</Link>
   </div>
 </section>
}
function BillingBranch({branch,port,onDenied}:{branch:OpsBranch;port:BillingReadPort;onDenied:()=>void}){
 const [attempt,setAttempt]=useState(0)
 const [raw,setRaw]=useState<Read<BillingWindow>>({kind:'loading'})
 const [search,setSearch]=useState('')
 const [status,setStatus]=useState('all')
 const [chosen,setChosen]=useState<string|null>(null)
 const refresh=()=>{setChosen(null);setRaw({kind:'loading'});setAttempt(n=>n+1)}
 useEffect(()=>{
   let live=true
   setRaw({kind:'loading'});setChosen(null)
   void port.invoices(branch.id).then(data=>{
     if(!live)return
     try{setRaw({kind:'ready',data:billingList(data,branch.id)})}
     catch{setRaw({kind:'failed',reason:'error'})}
   },e=>{
     if(!live)return
     const kind=billingFailure(e)
     setRaw({kind:'failed',reason:kind})
     if(kind==='denied')onDenied()
   })
   return()=>{live=false}
 },[branch.id,port,attempt,onDenied])
 const invoices=raw.kind==='ready'?raw.data.items:[]
 const visible=useMemo(()=>shownInvoices(invoices,{query:search,status}),[invoices,search,status])
 const selected=raw.kind==='ready'?invoices.find(i=>i.id===chosen)??null:null
 const refs=useRef<Array<HTMLButtonElement|null>>([])
 const navigateKeys=(e:KeyboardEvent<HTMLButtonElement>,index:number)=>{
   let next=index
   if(e.key==='ArrowDown')next=Math.min(visible.length-1,index+1)
   else if(e.key==='ArrowUp')next=Math.max(0,index-1)
   else if(e.key==='Home')next=0
   else if(e.key==='End')next=visible.length-1
   else return
   e.preventDefault()
   refs.current[next]?.focus()
 }
 return <section aria-label={branch.name+' financial records'} className="billing-branch-body">
   <div className="billing-toolbar">
     <div><h2>{branch.name} · billing</h2>
       <p className="billing-muted">Only RLS-authorized financial records from this branch may appear.</p></div>
     <button type="button" className="button button-secondary" onClick={refresh}>Refresh branch billing</button>
   </div>
   {raw.kind==='loading'&&<LoadingCard label="Rechecking branch authority and financial records…" rows={5}/>}
   {raw.kind==='failed'&&<BillingFailurePanel kind={raw.reason} retry={refresh}/>}
   {raw.kind==='ready'&&<>
     <div className="billing-stats" aria-label="Counts from the verified returned window">
       <div><strong>{raw.data.hasMore?'At least ':''}{invoices.length}</strong><span>Returned estimates & invoices</span></div>
       <div><strong>{invoices.filter(x=>x.status==='issued').length}{raw.data.hasMore?' +':''}</strong><span>Issued in returned rows</span></div>
       <div><strong>{invoices.filter(x=>x.status==='paid').length}{raw.data.hasMore?' +':''}</strong><span>Paid in returned rows</span></div>
     </div>
     {raw.data.hasMore&&<p role="alert" className="billing-banner">
       More financial records exist than this authorized 100-row window. Counts are incomplete; search and filters apply only to loaded rows.</p>}
     <div className="billing-filters">
       <label>Search loaded invoices<input type="search" autoComplete="off"
         placeholder="Invoice number or reference" value={search}
         onChange={e=>{setSearch(e.target.value);setChosen(null)}}/></label>
       <label>Invoice status<select value={status} onChange={e=>{setStatus(e.target.value);setChosen(null)}}>
         <option value="all">All approved statuses</option>
         {BILLING_STATUSES.map(x=><option value={x} key={x}>{x}</option>)}
       </select></label>
     </div>
     <p className="billing-muted" role="status" aria-live="polite">{visible.length} records match in this loaded window.</p>
     {invoices.length===0?<EmptyState icon="calendar" title="No invoices in this verified branch read">
       The authorized response contained no invoices. This is not a claim of a zero account balance.</EmptyState>
     :visible.length===0?<EmptyState icon="calendar" title="No matching invoices in loaded records">
       Clear filters or search. No new financial records are queried by this local filter.</EmptyState>
     :<div className="billing-split">
       <section className="billing-list" aria-label="Invoice and estimate results">
         <h3>Invoices and estimates</h3>
         <ul>{visible.map((item,i)=><li key={item.id}>
           <button type="button" className={'billing-invoice'+(chosen===item.id?' is-selected':'')}
             aria-pressed={chosen===item.id} ref={el=>{refs.current[i]=el}}
             onKeyDown={e=>navigateKeys(e,i)} onClick={()=>setChosen(item.id)}>
             <span className="billing-invoice-head"><strong>{item.invoice_no}</strong><span className="billing-status">{item.status}</span></span>
             <span className="billing-muted">{item.kind} · Patient {shortRef(item.pet_id)}</span>
             <span className="billing-total">{displayAmount(item.totals.total_minor,item.currency_code,item.minor_scale)}</span>
           </button></li>)}</ul>
       </section>
       <div className="billing-detail">
         {selected?<InvoicePanel key={branch.id+':'+selected.id} item={selected} branchId={branch.id}
           port={port} onDenied={onDenied}/>
         :<section className="card" aria-label="Invoice detail not selected"><h3>Select an invoice</h3>
           <p>Choose a verified record to inspect issued amounts, itemization, payments and receipts. Nothing is loaded by default.</p></section>}
       </div>
     </div>}
   </>}
 </section>
}
function InvoicePanel({item,branchId,port,onDenied}:{item:Invoice;branchId:string;port:BillingReadPort;onDenied:()=>void}){
 const [attempt,setAttempt]=useState(0)
 const [raw,setRaw]=useState<Read<InvoiceDetail>>({kind:'loading'})
 useEffect(()=>{
   let live=true
   setRaw({kind:'loading'})
   void port.detail(branchId,item.id).then(payload=>{
     if(!live)return
     try{
       const detail=billingDetail(payload,branchId,item.id)
       if(detail.header.owner_id!==item.owner_id||detail.header.pet_id!==item.pet_id||
          detail.header.currency_code!==item.currency_code||
          detail.header.invoice_no!==item.invoice_no)throw Error('Invoice identity changed')
       setRaw({kind:'ready',data:detail})
     }catch{setRaw({kind:'failed',reason:'error'})}
   },error=>{
     if(!live)return
     const reason=billingFailure(error)
     setRaw({kind:'failed',reason})
     if(reason==='denied')onDenied()
   })
   return()=>{live=false}
 },[branchId,item.id,port,attempt,onDenied])
 const value=(n:number)=>displayAmount(n,item.currency_code,item.minor_scale)
 return <section aria-label={'Invoice '+item.invoice_no+' details'} className="billing-invoice-detail">
   <div className="billing-detail-heading"><div><span className="billing-muted">{item.kind}</span><h3>{item.invoice_no}</h3></div>
     <span className="billing-status">{item.status}</span></div>
   <p className="billing-muted">Patient {shortRef(item.pet_id)} · Appointment {item.appointment_id?shortRef(item.appointment_id):'Not linked'}.
     No unscoped patient chart or owner record is requested.</p>
   {raw.kind==='loading'&&<LoadingCard label="Verifying invoice details against this branch…" rows={4}/>}
   {raw.kind==='failed'&&<section className="card billing-failure" role="alert">
     <h4>{raw.reason==='unavailable'?'Invoice detail API unavailable':'Invoice detail not accessible'}</h4>
     <p>{failureText[raw.reason]}</p>
     <button type="button" className="button button-secondary button-small"
       onClick={()=>setAttempt(n=>n+1)}>Retry invoice read</button>
   </section>}
   {raw.kind==='ready'&&<>
     <section aria-label="Invoice itemization">
       <h4>Itemization from approved records</h4>
       {raw.data.lines.length===0?<p className="billing-muted">The verified invoice contains no line items.</p>
       :<div className="billing-table-scroll"><table className="billing-table">
         <thead><tr><th scope="col">Item</th><th scope="col">Qty</th>
           <th scope="col">Unit price</th><th scope="col">Line total</th></tr></thead>
         <tbody>{raw.data.lines.map(l=><tr key={l.id}><th scope="row">{l.description}
           <small>{l.category}</small></th><td>{l.quantity} {l.unit_label}</td>
           <td>{l.unit_price_minor===null?'Not provided':value(l.unit_price_minor)}</td>
           <td>{value(l.line_total_minor)}</td></tr>)}</tbody>
       </table></div>}
     </section>
     <dl className="billing-totals">{([
       ['Subtotal',raw.data.header.totals.subtotal_minor],
       ['Approved discounts',-raw.data.header.totals.discount_minor],
       ['Approved taxes',raw.data.header.totals.tax_minor],
       ['Invoice total',raw.data.header.totals.total_minor],
       ['Gross payments',raw.data.header.totals.paid_minor],
       ['Refunded amount',raw.data.header.totals.refunded_minor],
       ['Remaining balance',raw.data.header.totals.balance_minor]
     ] as [string,number][]).map(([label,minor])=>
       <div key={label}><dt>{label}</dt><dd>{value(minor)}</dd></div>)}</dl>
     <section aria-label="Payment history"><h4>Payment history</h4>
       {raw.data.payments.length===0?<p className="billing-muted">No payment entries in this verified invoice history.</p>
       :<ul className="billing-history">{raw.data.payments.map(x=><li key={x.id}>
         <span>{x.status} · {x.method_label}</span><strong>{value(x.amount_minor)}</strong>
         <time dateTime={x.occurred_at}>{new Date(x.occurred_at).toLocaleDateString('en-US',{timeZone:'UTC'})}</time>
       </li>)}</ul>}
     </section>
     <section aria-label="Issued receipts"><h4>Issued receipts</h4>
       {raw.data.receipts.length===0?<p className="billing-muted">No verified receipt records linked to this invoice.</p>
       :<ul className="billing-history">{raw.data.receipts.map(x=><li key={x.id}>
         <span>Receipt {x.receipt_no}</span><strong>{value(x.amount_minor)}</strong>
         <time dateTime={x.issued_at}>{new Date(x.issued_at).toLocaleDateString('en-US',{timeZone:'UTC'})}</time>
       </li>)}</ul>}
     </section>
   </>}
 </section>
}
