import {useCallback,useEffect,useMemo,useRef,useState,type KeyboardEvent} from 'react'
import type {User} from '@supabase/supabase-js'
import {Link} from 'react-router'
import {useAuth} from '../../hooks/AuthProvider'
import {PageHeading,EmptyState,LoadingCard} from '../../components/ui'
import {createPharmacyPort,type PharmacyPort} from '../../inventory/port'
import {INVENTORY_FILTERS,INVENTORY_SORTS,inventoryError,medicineCards,
  batchDisplayState,dayPlus} from '../../inventory/model.mjs'
import type {InventoryFailure,InventoryFilter,InventorySort,Snapshot,Detail,
  Catalog,MedicineCard,Rule,Alert} from '../../inventory/model.mjs'
import type {OpsBranch} from '../../ops/branch-model.mjs'
import '../../inventory/pharmacy.css'

type Branches={kind:'loading'}|{kind:'failed';reason:InventoryFailure}|
  {kind:'ready';branches:OpsBranch[]}
type Read<T>={kind:'loading'}|{kind:'failed';reason:InventoryFailure}|
  {kind:'ready';data:T}
type Tagged<T>=Read<T>&{key:string}
const ROLE_LABEL={administrator:'Administrator',veterinarian:'Veterinarian',receptionist:'Receptionist'} as const
const FAIL_TEXT:Record<InventoryFailure,string>={
  denied:'Inventory permission was denied or the secure session is no longer valid. Previously displayed stock has been cleared.',
  unavailable:'The inventory read-only migration or its approved reader is not available. No medicine quantities have been assumed.',
  network:'The clinic inventory could not be reached. The previous stock display has been hidden until a verified retry.',
  error:'The inventory reply could not be verified. No stock information has been displayed.'
}

export function PharmacyPage(){
  const {user}=useAuth()
  if(!user)return <p role="alert">Sign in with an authorized staff account to access pharmacy inventory.</p>
  return <PharmacyAccount key={user.id} user={user}/>
}
function PharmacyAccount({user}:{user:User}){
  const port=useMemo(()=>createPharmacyPort(user),[user.id])
  const [access,setAccess]=useState<Branches>({kind:'loading'})
  const [selected,setSelected]=useState<string|null>(null)
  const [attempt,setAttempt]=useState(0)
  const retry=useCallback(()=>{
    setAccess({kind:'loading'});setSelected(null);setAttempt(n=>n+1)
  },[])
  const revoked=useCallback(()=>{
    setAccess({kind:'failed',reason:'denied'});setSelected(null)
  },[])
  useEffect(()=>{
    let live=true
    setAccess({kind:'loading'});setSelected(null)
    void port.branches().then(branches=>{
      if(!live)return
      if(!branches.length){setAccess({kind:'failed',reason:'denied'});return}
      setAccess({kind:'ready',branches})
      if(branches.length===1)setSelected(branches[0]?.id??null)
    },error=>{if(live)setAccess({kind:'failed',reason:inventoryError(error)})})
    return ()=>{live=false}
  },[port,attempt])
  const branch=access.kind==='ready'&&selected
    ?access.branches.find(x=>x.id===selected)??null:null
  return <div className="page pharmacy" aria-labelledby="pharmacy-title">
    <PageHeading id="pharmacy-title" eyebrow="Clinic staff · read-only preview"
      title="Veterinary pharmacy"
      actions={<span className="pharmacy-lock">Stock transactions disabled</span>}>
      Medicine catalog, branch stock, expiry warnings and ledger information from
      authorized read-only records. No receiving, dispensing, procurement or transfers are enabled.
    </PageHeading>
    {access.kind==='loading'&&<LoadingCard label="Checking current staff account and authorized clinic branches…" rows={4}/>}
    {access.kind==='failed'&&<PharmacyFailure reason={access.reason} retry={retry}/>}
    {access.kind==='ready'&&<section className="pharmacy-branch" aria-label="Branch authorization">
      <label htmlFor="pharmacy-branch">Authorized clinic branch</label>
      <select id="pharmacy-branch" value={branch?.id??''} onChange={e=>{
        const next=access.branches.find(x=>x.id===e.target.value)
        setSelected(next?.id??null)
      }}>
        <option value="">Select a branch to read its stock…</option>
        {access.branches.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <span className="pharmacy-muted">{branch?ROLE_LABEL[branch.role]+' · '+branch.name:'Nothing selected'}</span>
      <p className="pharmacy-muted">Branch selection is an interface filter, not permission.
        Each stock read independently checks your active staff membership and RLS.</p>
    </section>}
    {access.kind==='ready'&&!branch&&<EmptyState icon="shield" title="Choose an authorized branch">
      Pharmacy inventory is never loaded before a verified branch selection.
      Naga and Cavite stock are kept separate.</EmptyState>}
    {branch&&<PharmacyBranch key={user.id+':'+branch.id} branch={branch}
      port={port} onDenied={revoked}/>}
    <p className="pharmacy-muted pharmacy-footer-note">
      The 15th inventory migration is a proposed, unapplied backend contract.
      When the read service is absent this preview shows an error, never invented stock quantities.
      Clinic-live activation requires ASTRA security review and owner approval.</p>
  </div>
}

function PharmacyFailure({reason,retry}:{reason:InventoryFailure;retry:()=>void}){
  return <section className="card pharmacy-failure" role="alert">
    <h2>{reason==='denied'?'Staff inventory access denied':'Medicine inventory unavailable'}</h2>
    <p>{FAIL_TEXT[reason]}</p>
    <div className="pharmacy-actions">
      <button type="button" className="button button-secondary" onClick={retry}>Recheck access</button>
      <Link to="/app/overview" className="button button-quiet">Back to overview</Link>
    </div>
  </section>
}

function PharmacyBranch({branch,port,onDenied}:{branch:OpsBranch;port:PharmacyPort;onDenied:()=>void}){
  const [retry,setRetry]=useState(0)
  const key=branch.id+':'+retry
  const [raw,setRaw]=useState<Tagged<Snapshot>>({key,kind:'loading'})
  const state:Tagged<Snapshot>=raw.key===key?raw:{key,kind:'loading'}
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState<InventoryFilter>('all')
  const [sort,setSort]=useState<InventorySort>('name')
  const [chosen,setChosen]=useState<string|null>(null)
  const [focused,setFocused]=useState(0)
  const medicineButtons=useRef<Array<HTMLButtonElement|null>>([])
  const deniedRef=useRef(onDenied);deniedRef.current=onDenied
  useEffect(()=>{
    let live=true
    setRaw({key,kind:'loading'})
    void port.overview(branch.id).then(data=>{
      if(live)setRaw({key,kind:'ready',data})
    },error=>{
      if(!live)return
      const reason=inventoryError(error)
      setRaw({key,kind:'failed',reason})
      if(reason==='denied')deniedRef.current()
    })
    return ()=>{live=false}
  },[branch.id,port,key])
  const cards=useMemo(()=>state.kind==='ready'?
    medicineCards(state.data,{search,filter,sort}):[],[state,search,filter,sort])
  const chosenCard=cards.find(card=>card.medicine.id===chosen)??null
  function changeSearch(value:string){setSearch(value);setChosen(null);setFocused(0)}
  function changeFilter(value:InventoryFilter){setFilter(value);setChosen(null);setFocused(0)}
  function changeSort(value:InventorySort){setSort(value);setChosen(null);setFocused(0)}
  function listKeys(e:KeyboardEvent<HTMLButtonElement>,index:number){
    let next:number
    if(e.key==='ArrowDown')next=Math.min(index+1,cards.length-1)
    else if(e.key==='ArrowUp')next=Math.max(index-1,0)
    else if(e.key==='Home')next=0
    else if(e.key==='End')next=cards.length-1
    else return
    e.preventDefault();setFocused(next);medicineButtons.current[next]?.focus()
  }
  return <section aria-label={branch.name+' medicine inventory'} className="pharmacy-body">
    <div className="pharmacy-toolbar">
      <div><h2>{branch.name} stock</h2>
        <p className="pharmacy-muted">Stock and warnings shown only after a successful verified read.</p></div>
      <button type="button" className="button button-secondary" onClick={()=>{
        setChosen(null);setRetry(n=>n+1)
      }}>Refresh inventory</button>
    </div>
    {state.kind==='loading'&&<LoadingCard label={'Reading '+branch.name+' stock and catalog…'} rows={5}/>}
    {state.kind==='failed'&&<section className="card pharmacy-failure" role="alert">
      <h3>Stock read unsuccessful</h3><p>{FAIL_TEXT[state.reason]}</p>
      <button type="button" className="button button-secondary" onClick={()=>{setChosen(null);setRetry(n=>n+1)}}>
        Try again</button></section>}
    {state.kind==='ready'&&<>
      <PharmacySummary data={state.data}/>
      <div className="pharmacy-controls">
        <label><span>Search medications</span>
          <input value={search} onChange={e=>changeSearch(e.target.value)}
            type="search" placeholder="Generic name, code, formulation…" autoComplete="off"/></label>
        <label><span>Stock status</span><select value={filter}
          onChange={e=>changeFilter(e.target.value as InventoryFilter)}>
          {INVENTORY_FILTERS.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}
        </select></label>
        <label><span>Sort medicine list</span><select value={sort}
          onChange={e=>changeSort(e.target.value as InventorySort)}>
          {INVENTORY_SORTS.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}
        </select></label>
      </div>
      <p className="pharmacy-muted" aria-live="polite" role="status">
        {cards.length} medicine(s) match the selected filters.
        {state.data.catalog.hasMore?' Only the first 100 catalog rows were read; search results may be incomplete.':''}
      </p>
      {cards.length===0
        ?<EmptyState icon="pulse" title={search||filter!=='all'?'No matching medicine in loaded rows':'No medicines in the authorized catalog'}>
          {search||filter!=='all'?'Clear search or filters to inspect the returned catalog.':
            'A successful empty catalog read is not evidence that a branch is stocked.'}</EmptyState>
        :<div className="pharmacy-shell">
          <section className="pharmacy-list-section" aria-label="Medication results">
            <ul className="pharmacy-medicines">{cards.map((card,index)=>
              <li key={card.medicine.id}><button type="button" className={'pharmacy-medicine'+
                (chosenCard?.medicine.id===card.medicine.id?' is-selected':'')}
                ref={el=>{medicineButtons.current[index]=el}}
                aria-pressed={chosenCard?.medicine.id===card.medicine.id}
                onKeyDown={e=>listKeys(e,index)}
                onFocus={()=>setFocused(index)}
                onClick={()=>setChosen(card.medicine.id)}>
                <span className="pharmacy-medicine-title">
                  <strong>{card.medicine.generic_name}</strong>
                  <span className="pharmacy-code">{card.medicine.product_code}</span>
                </span>
                <span className="pharmacy-muted">{card.medicine.strength} · {card.medicine.formulation}</span>
                <MedicineStatus card={card}/>
                <span className="pharmacy-muted">
                  {card.alert?`${card.alert.available_units.toLocaleString()} ${card.medicine.stock_unit} available`
                    :'Quantity unavailable — no verified branch configuration'}</span>
              </button></li>)}</ul>
          </section>
          <section className="pharmacy-detail-area" aria-label="Selected medication">
            {chosenCard?<MedicineDetail key={branch.id+':'+chosenCard.medicine.id}
              port={port} branch={branch} medicine={chosenCard.medicine} rule={chosenCard.rule}
              alert={chosenCard.alert} today={state.data.today} timezone={state.data.timezone}
              onDenied={onDenied}/>
            :<div className="card pharmacy-prompt">
              <h3>Choose a medication</h3>
              <p>Select an item from {branch.name}'s authorized catalog to inspect stock batches,
                backend-ordered FEFO candidates and the branch ledger.</p>
              <p>Receipt, adjustment, dispensing and transfer remain unavailable.</p>
            </div>}</section>
        </div>}
      {cards.length>0&&<p className="pharmacy-muted">Arrow ↑/↓ and Home/End move across medication results.
        Tab and Enter also navigate normally. Selection never authorizes a stock transaction.</p>}
    </>}
  </section>
}

function PharmacySummary({data}:{data:Snapshot}){
  const alerts=data.alerts.items
  const total=(pick:(a:Alert)=>boolean)=>alerts.filter(pick).length
  const partial=data.alerts.hasMore||data.rules.hasMore||data.catalog.hasMore
  const tiles=[
    {label:'Configured medicines in read',count:alerts.length},
    {label:'Out of stock',count:total(x=>x.out_of_stock)},
    {label:'Low stock (nonzero)',count:total(x=>x.low_stock&&!x.out_of_stock)},
    {label:'Near-expiry medicine alerts',count:total(x=>x.near_expiry_batches>0)},
    {label:'Expired-lot medicine alerts',count:total(x=>x.expired_batches>0)},
    {label:'Quarantined / recalled alerts',count:total(x=>x.quarantined_batches>0)}
  ]
  return <><div className="pharmacy-kpis" aria-label="Read-only branch stock indicators">
    {tiles.map(tile=><div className="pharmacy-kpi" key={tile.label}>
      <strong>{partial?'≥ ':''}{tile.count.toLocaleString()}</strong><span>{tile.label}</span>
    </div>)}</div>
    {partial&&<p role="alert" className="pharmacy-advisory">
      Results are incomplete: one or more authorized reads exceeded the bounded page.
      Counts shown are lower bounds; do not treat catalog coverage or stock as complete.</p>}
    <p className="pharmacy-muted">Counts come from the branch-authorized alert RPC.
      A medicine without a branch rule is <strong>unconfigured</strong>, not verified out of stock.
      Expired and quarantined lots are tracked separately from usable units.</p></>
}
function MedicineStatus({card}:{card:MedicineCard}){
  const {medicine,alert}=card
  if(!medicine.is_active)return <span className="pharmacy-tag">Inactive catalog item</span>
  if(!card.rule||!alert)return <span className="pharmacy-tag">Branch not configured</span>
  return <span className="pharmacy-tags">
    {alert.out_of_stock?<span className="pharmacy-tag is-danger">Out of stock</span>:
      alert.low_stock?<span className="pharmacy-tag is-warning">Low stock</span>:
      <span className="pharmacy-tag is-ok">Available</span>}
    {alert.near_expiry_batches>0&&<span className="pharmacy-tag is-warning">Near expiry · {alert.near_expiry_batches} lot(s)</span>}
    {alert.expired_batches>0&&<span className="pharmacy-tag is-danger">Expired · {alert.expired_batches} lot(s)</span>}
    {alert.quarantined_batches>0&&<span className="pharmacy-tag">Held · {alert.quarantined_batches} lot(s)</span>}
  </span>
}
const DETAILS_TABS=[
  {id:'batches',name:'Stock batches'},
  {id:'fefo',name:'FEFO candidates'},
  {id:'ledger',name:'Movement history'}
] as const
type DetailTab=typeof DETAILS_TABS[number]['id']
function MedicineDetail({port,branch,medicine,rule,alert,today,timezone,onDenied}:{
  port:PharmacyPort;branch:OpsBranch;medicine:Catalog;rule:Rule|null;
  alert:Alert|null;today:string;timezone:string;onDenied:()=>void
}){
  const [attempt,setAttempt]=useState(0)
  const key=branch.id+':'+medicine.id+':'+attempt
  const [raw,setRaw]=useState<Tagged<Detail>>({key,kind:'loading'})
  const state:Tagged<Detail>=raw.key===key?raw:{key,kind:'loading'}
  const [tab,setTab]=useState<DetailTab>('batches')
  const [horizon,setHorizon]=useState<30|60|90>(rule?.expiry_warning_days??30)
  const tabs=useRef<Array<HTMLButtonElement|null>>([])
  const title=useRef<HTMLHeadingElement>(null)
  const deniedRef=useRef(onDenied);deniedRef.current=onDenied
  useEffect(()=>{title.current?.focus()},[medicine.id])
  useEffect(()=>{
    let live=true;setRaw({key,kind:'loading'})
    void port.medicine(branch.id,medicine.id).then(data=>{
      if(live)setRaw({key,kind:'ready',data})
    },error=>{
      if(!live)return
      const reason=inventoryError(error)
      setRaw({key,kind:'failed',reason})
      if(reason==='denied')deniedRef.current()
    })
    return ()=>{live=false}
  },[port,branch.id,medicine.id,key])
  const tabKey=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
    let next:number
    if(event.key==='ArrowRight')next=(index+1)%DETAILS_TABS.length
    else if(event.key==='ArrowLeft')next=(index+DETAILS_TABS.length-1)%DETAILS_TABS.length
    else if(event.key==='Home')next=0
    else if(event.key==='End')next=DETAILS_TABS.length-1
    else return
    event.preventDefault()
    const target=DETAILS_TABS[next]
    if(target){setTab(target.id);tabs.current[next]?.focus()}
  }
  const eligible=new Set(state.kind==='ready'?state.data.fefo.items.map(b=>b.batch_id):[])
  return <div className="pharmacy-detail">
    <div className="pharmacy-detail-head"><div>
      <p className="eyebrow">Authorized branch record · {branch.name}</p>
      <h2 ref={title} tabIndex={-1}>{medicine.generic_name}</h2>
      <p className="pharmacy-muted">{medicine.product_code} · {medicine.strength}
        · {medicine.formulation} · units: {medicine.stock_unit}</p></div>
      <MedicineStatus card={{medicine,rule,alert}}/>
    </div>
    <div className="pharmacy-medicine-meta">
      <span>{medicine.requires_refrigeration?'Refrigeration noted in catalog':'No refrigeration classification noted'}</span>
      <span>{medicine.is_controlled?'Controlled classification — verify clinic policy':'No controlled classification noted'}</span>
      <span>Minimum shelf life: {medicine.minimum_shelf_life_days} days</span>
      {rule?<span>Branch reorder point: {rule.reorder_point_units} {medicine.stock_unit}
        · configured warning: {rule.expiry_warning_days} days</span>
        :<span>Branch stock thresholds have not been configured</span>}
    </div>
    <div className="pharmacy-tabs" role="tablist" aria-label="Medication details">
      {DETAILS_TABS.map((item,index)=><button type="button" key={item.id}
        id={'pharmacy-tab-'+item.id} aria-controls={'pharmacy-panel-'+item.id}
        role="tab" aria-selected={tab===item.id} tabIndex={tab===item.id?0:-1}
        ref={el=>{tabs.current[index]=el}} onClick={()=>setTab(item.id)}
        onKeyDown={e=>tabKey(e,index)}>{item.name}</button>)}
    </div>
    <section className="pharmacy-panel" tabIndex={0} role="tabpanel"
      id={'pharmacy-panel-'+tab} aria-labelledby={'pharmacy-tab-'+tab}>
      {state.kind==='loading'&&<LoadingCard label="Reading authorized lots, FEFO and ledger…" rows={3}/>}
      {state.kind==='failed'&&<div role="alert" className="pharmacy-advisory">
        <p>{FAIL_TEXT[state.reason]}</p>
        <button type="button" className="button button-secondary" onClick={()=>setAttempt(n=>n+1)}>
          Retry medication reads</button></div>}
      {state.kind==='ready'&&<>
        {tab==='batches'&&<>
          <div className="pharmacy-detail-actions"><h3>Stock batches</h3>
            <label>Expiry preview horizon <select value={horizon}
              onChange={e=>setHorizon(Number(e.target.value) as 30|60|90)}>
              {[30,60,90].map(n=><option key={n} value={n}>{n} days</option>)}
            </select></label></div>
          <p className="pharmacy-muted">Lot warning preview uses this browser's time translated to
            {timezone} ({today} when loaded); server-computed alerts and FEFO are authoritative.
            Changing this view does not alter the clinic's {rule?.expiry_warning_days??'unconfigured'}-day policy.</p>
          <p className="pharmacy-muted">Received / reserved / quarantined quantities are separate.
            Eligibility is derived ONLY from the backend FEFO function, not from this preview.</p>
          {state.data.batches.items.length===0?<p className="pharmacy-empty">No batch rows were returned for this branch and medicine.</p>
          :<ul className="pharmacy-batches">{state.data.batches.items.map(batch=>{
            const status=batchDisplayState(batch,today,horizon,eligible)
            return <li key={batch.id} className="pharmacy-batch">
              <div className="pharmacy-batch-top"><strong>Lot {batch.lot_number}</strong>
                <span className={'pharmacy-tag is-'+status.kind}>{status.label}</span></div>
              <dl><div><dt>Expires</dt><dd>{batch.expiry_date}</dd></div>
                <div><dt>Received</dt><dd>{batch.received_on}</dd></div>
                <div><dt>On hand</dt><dd>{batch.on_hand_units.toLocaleString()} {medicine.stock_unit}</dd></div>
                <div><dt>Reserved</dt><dd>{batch.reserved_units.toLocaleString()}</dd></div>
                <div><dt>Quarantined units</dt><dd>{batch.quarantined_units.toLocaleString()}</dd></div>
                <div><dt>Available on batch</dt><dd>{(batch.on_hand_units-batch.reserved_units-batch.quarantined_units).toLocaleString()}</dd></div></dl>
            </li>})}</ul>}
          {state.data.batches.hasMore&&<p role="alert" className="pharmacy-advisory">
            More than 100 batch rows were returned. Only a partial ordered page is displayed.</p>}
        </>}
        {tab==='fefo'&&<>
          <h3>First-expiring-first-out candidates</h3>
          <p className="pharmacy-muted">Directly from authorized server RPC, already ordered by expiry,
            receipt, lot and ID. These are inventory-read candidates, <strong>not</strong> dispensing authorization.
            Expired, recalled, quarantined, fully reserved and insufficient-shelf-life lots are excluded server-side.</p>
          {state.data.fefo.items.length===0
            ?<p className="pharmacy-empty">No FEFO-eligible lots were returned. This does not necessarily
              mean there are zero physical on-hand units.</p>
            :<ol className="pharmacy-fefo">{state.data.fefo.items.map(candidate=><li key={candidate.batch_id}>
              <strong>{candidate.lot_number}</strong>
              <span>Expires {candidate.expiry_date}</span>
              <span>{candidate.available_units.toLocaleString()} {medicine.stock_unit} eligible units</span>
              </li>)}</ol>}
          {state.data.fefo.hasMore&&<p role="alert" className="pharmacy-advisory">
            FEFO list truncated; this is only the first 100 authorized candidates.</p>}
        </>}
        {tab==='ledger'&&<>
          <h3>Immutable movement history</h3>
          <p className="pharmacy-muted">Read-only, branch-and-medicine filtered audit rows; no patient,
            prescription, cost or purchasing information is requested.</p>
          {state.data.movements.items.length===0
            ?<p className="pharmacy-empty">No authorized movement entries returned. This is not proof of a complete historical ledger.</p>
            :<ol className="pharmacy-ledger">{state.data.movements.items.map(row=><li key={row.id}>
              <div className="pharmacy-batch-top"><strong>{row.event_type.replaceAll('_',' ')}</strong>
                <time dateTime={row.recorded_at}>{new Intl.DateTimeFormat(undefined,
                  {timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(row.recorded_at))}</time></div>
              <p>Reason: {row.reason_code.replaceAll('_',' ')} · Batch {row.batch_id.slice(0,8)}</p>
              <p>Change: {row.delta_on_hand>=0?'+':''}{row.delta_on_hand} {medicine.stock_unit} on hand.
                Balance after: {row.after_on_hand} on hand, {row.after_reserved} reserved,
                {row.after_quarantined} quarantined.</p>
              </li>)}</ol>}
          {state.data.movements.hasMore&&<p role="alert" className="pharmacy-advisory">
            Audit ledger exceeds 50 rows. Results are a partial latest-first page.</p>}
        </>}
      </>}
    </section>
    <section className="pharmacy-actions-panel" aria-label="Unavailable inventory transactions">
      <h3>Stock operations require secure approval</h3>
      <div className="pharmacy-actions">
        {['Receive stock','Adjust quantity','Dispense medicine','Transfer between branches'].map(label=>
          <button type="button" key={label} className="button button-secondary" disabled
            aria-describedby="pharmacy-transaction-help">{label} — unavailable</button>)}
      </div>
      <p id="pharmacy-transaction-help" className="pharmacy-muted">
        No transaction endpoints are enabled. Requires ASTRA's audited, branch-checked,
        idempotent batch-lock transaction contracts and explicit clinic owner approval.</p>
    </section>
  </div>
}
