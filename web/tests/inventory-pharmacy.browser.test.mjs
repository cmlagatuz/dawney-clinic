// CLOUD Issue78: real Vite + headless Chromium + intercepted synthetic HTTP only.
// Never uses real clinics, inventory, staff sessions, transaction endpoints or exports.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
import {withChromium} from '../../scripts/browser/cdp.mjs'

function pharmacyFixture(){
  const uuid=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0')
  const ids={naga:uuid(1),cavite:uuid(2),a:uuid(3),b:uuid(4),c:uuid(5),
    nLot1:uuid(6),nLot2:uuid(7),nExpired:uuid(8),nHeld:uuid(11),
    nRecalled:uuid(12),nReserved:uuid(13),cLot:uuid(14),movementN:uuid(15),
    movementC:uuid(16),staff:uuid(90),otherStaff:uuid(91)}
  const remote='https://issue51-fixtures.supabase.co'
  const RealDate=Date,freeze=RealDate.parse('2026-11-20T01:00:00Z')
  class FixedDate extends RealDate{
    constructor(...args){super(...(args.length?args:[freeze]))}
    static now(){return freeze}
  }
  window.Date=FixedDate
  const params=new URL(location.href).searchParams
  const theme=params.get('theme')==='dark'?'dark':'light'
  const scenario=params.get('case')||'normal'
  localStorage.setItem('dawney-theme',theme)
  const user={id:scenario==='account-switch'?ids.otherStaff:ids.staff,aud:'authenticated',role:'authenticated',
    email:'pharmacy-fixture@example.test',email_confirmed_at:'2025-01-01T00:00:00Z',
    created_at:'2025-01-01T00:00:00Z',app_metadata:{},user_metadata:{}}
  const expiry=Math.floor(RealDate.now()/1000)+86400*365
  const token=['{"alg":"HS256","typ":"JWT"}',JSON.stringify({sub:user.id,exp:expiry}),'fixture']
    .map(x=>btoa(x).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')).join('.')
  localStorage.setItem('dawney.auth.v1',JSON.stringify({
    user,access_token:token,refresh_token:'synthetic-test',expires_at:expiry
  }))
  window.__pharmacyMock={calls:[],blocked:[],mutations:[],assertions:[],
    recovered:false,revoked:false}
  const catalogue=[
    {id:ids.a,product_code:'QA78-A',generic_name:'Synthetic Medicine Alpha',formulation:'vial',
      strength:'1 mg',stock_unit:'vial',minimum_shelf_life_days:0,requires_refrigeration:false,
      is_controlled:false,is_active:true},
    {id:ids.b,product_code:'QA78-B',generic_name:'Synthetic Medicine Beta',formulation:'tablet',
      strength:'2 mg',stock_unit:'tablet',minimum_shelf_life_days:0,requires_refrigeration:false,
      is_controlled:false,is_active:true},
    {id:ids.c,product_code:'QA78-C',generic_name:'Synthetic Medicine Gamma',formulation:'solution',
      strength:'5 mg',stock_unit:'bottle',minimum_shelf_life_days:0,requires_refrigeration:true,
      is_controlled:false,is_active:true}
  ]
  const rules={
    [ids.naga]:[
      {branch_id:ids.naga,medicine_id:ids.a,reorder_point_units:10,expiry_warning_days:30},
      {branch_id:ids.naga,medicine_id:ids.b,reorder_point_units:3,expiry_warning_days:60}
    ],
    [ids.cavite]:[
      {branch_id:ids.cavite,medicine_id:ids.a,reorder_point_units:5,expiry_warning_days:90}
    ]
  }
  const alert=(medicine,branch,available,point,days,near,expired,held)=>({
    medicine_id:medicine,product_code:medicine===ids.a?'QA78-A':'QA78-B',
    available_units:available,reorder_point_units:point,
    out_of_stock:available===0,low_stock:available<=point,
    expiry_warning_days:days,near_expiry_batches:near,
    expired_batches:expired,quarantined_batches:held
  })
  const alerts={
    [ids.naga]:[alert(ids.a,ids.naga,12,10,30,1,1,2),
      alert(ids.b,ids.naga,0,3,60,0,0,0)],
    [ids.cavite]:[alert(ids.a,ids.cavite,2,5,90,1,0,0)]
  }
  const makeBatch=(id,branch,lot,expiry,disposition,onHand,reserved=0,quarantined=0)=>({
    id,branch_id:branch,medicine_id:ids.a,lot_number:lot,
    received_on:'2026-10-15',expiry_date:expiry,
    disposition,on_hand_units:onHand,reserved_units:reserved,
    quarantined_units:quarantined,
    unit_cost_minor:999999,currency_code:'PHP' // MUST NOT appear even if malicious provider sends extra fields.
  })
  const lots={
    [ids.naga]:[
      makeBatch(ids.nExpired,ids.naga,'LOT-N-EXP','2026-11-19','released',9),
      makeBatch(ids.nHeld,ids.naga,'LOT-N-Q','2026-11-29','quarantined',10),
      makeBatch(ids.nRecalled,ids.naga,'LOT-N-R','2026-11-30','recalled',6),
      makeBatch(ids.nLot1,ids.naga,'LOT-N-20','2026-12-10','released',5,1),
      makeBatch(ids.nReserved,ids.naga,'LOT-N-RES','2026-12-15','released',3,3),
      makeBatch(ids.nLot2,ids.naga,'LOT-N-40','2026-12-30','released',8)
    ],
    [ids.cavite]:[makeBatch(ids.cLot,ids.cavite,'LOT-C-45','2027-01-04','released',2)]
  }
  const fefo={
    [ids.naga]:[
      {batch_id:ids.nLot1,lot_number:'LOT-N-20',expiry_date:'2026-12-10',available_units:4,received_on:'2026-10-15'},
      {batch_id:ids.nLot2,lot_number:'LOT-N-40',expiry_date:'2026-12-30',available_units:8,received_on:'2026-10-15'}
    ],
    [ids.cavite]:[{batch_id:ids.cLot,lot_number:'LOT-C-45',
      expiry_date:'2027-01-04',available_units:2,received_on:'2026-10-15'}]
  }
  const makeMovement=(id,branch,batch,event)=>({
    id,branch_id:branch,medicine_id:ids.a,batch_id:batch,event_id:uuid(branch===ids.naga?19:20),
    event_type:event,delta_on_hand:2,delta_reserved:0,delta_quarantined:0,
    after_on_hand:2,after_reserved:0,after_quarantined:0,
    reason_code:'fixture_receipt',recorded_by:ids.staff,recorded_at:'2026-11-20T01:00:00Z'
  })
  const ledger={
    [ids.naga]:[makeMovement(ids.movementN,ids.naga,ids.nLot1,'receipt')],
    [ids.cavite]:[makeMovement(ids.movementC,ids.cavite,ids.cLot,'opening')]
  }
  const original=window.fetch.bind(window)
  const json=(body,status=200)=>new Response(JSON.stringify(body),{
    status,headers:{'content-type':'application/json','access-control-allow-origin':'*'}})
  window.fetch=async(input,init)=>{
    const req=new Request(input,init),url=new URL(req.url)
    if(url.origin===location.origin)return original(input,init)
    if(url.origin!==remote){window.__pharmacyMock.blocked.push('nonfixture-origin');throw Error('Remote blocked')}
    if(req.method==='OPTIONS')return json({})
    window.__pharmacyMock.calls.push(req.method+' '+url.pathname)
    const selected=field=>url.searchParams.get(field)?.replace(/^eq\./,'')
    if(url.pathname==='/auth/v1/user')
      return scenario==='expired'?json({message:'JWT expired'},401):json(user)
    if(url.pathname==='/rest/v1/staff_memberships'){
      return json(scenario==='denied'||scenario==='account-switch'?[]:[{user_id:user.id,role:'veterinarian',is_active:true}])
    }
    if(url.pathname==='/rest/v1/staff_branch_memberships'){
      const branches=scenario==='both'?[ids.naga,ids.cavite]:[ids.naga]
      return json(branches.map(branch_id=>({
        user_id:ids.staff,branch_id,role:'veterinarian',is_active:true
      })))
    }
    if(url.pathname==='/rest/v1/clinic_branches'){
      if(selected('id')){
        return json({id:selected('id'),timezone:'Asia/Manila'})
      }
      return json([
        {id:ids.naga,slug:'naga',display_name:'Synthetic Naga'},
        {id:ids.cavite,slug:'cavite',display_name:'Synthetic Cavite'}
      ])
    }
    const isReadonlyRPC=url.pathname==='/rest/v1/rpc/assert_staff_branch'||
      url.pathname==='/rest/v1/rpc/list_branch_medicine_alerts'||
      url.pathname==='/rest/v1/rpc/list_branch_medicine_fefo'
    if(isReadonlyRPC&&req.method==='POST'){
      const payload=await req.json(),branch=payload.p_branch
      window.__pharmacyMock.assertions.push(branch)
      if(scenario==='revoked'||scenario==='revocation-after'&&window.__pharmacyMock.revoked)
        return json({code:'42501',message:'Not authorized for branch'},403)
      if(branch!==ids.naga&&branch!==ids.cavite)
        return json({code:'42501',message:'Not authorized for branch'},403)
      if(url.pathname.endsWith('/assert_staff_branch'))return json(branch)
      if(scenario==='missing')return json({code:'PGRST202',message:'Read RPC not installed'},404)
      if(url.pathname.endsWith('/list_branch_medicine_alerts')){
        return json(scenario==='empty'?[]:alerts[branch])
      }
      if(url.pathname.endsWith('/list_branch_medicine_fefo'))return json(fefo[branch]??[])
    }
    if(req.method!=='GET'){
      window.__pharmacyMock.mutations.push(req.method+' '+url.pathname)
      return json({message:'Synthetic writes not permitted'},403)
    }
    if(url.searchParams.get('select')?.includes('unit_cost')||
       url.searchParams.get('select')?.includes('currency_code')){
      window.__pharmacyMock.blocked.push('cost-field-read')
      return json({message:'Restricted columns'},403)
    }
    if(url.pathname==='/rest/v1/medicine_catalog'){
      if(scenario==='network'&&!window.__pharmacyMock.recovered)
        throw Error('Failed to fetch synthetic catalog')
      return json(scenario==='empty'?[]:catalogue)
    }
    if(url.pathname==='/rest/v1/branch_medicine_rules'){
      return json(scenario==='empty'?[]:rules[selected('branch_id')]??[])
    }
    if(url.pathname==='/rest/v1/branch_stock_batches'){
      if(selected('medicine_id')!==ids.a)return json([])
      return json(lots[selected('branch_id')]??[])
    }
    if(url.pathname==='/rest/v1/stock_movements'){
      if(selected('medicine_id')!==ids.a)return json([])
      return json(ledger[selected('branch_id')]??[])
    }
    window.__pharmacyMock.blocked.push(url.pathname)
    return json({message:'Unreviewed inventory endpoint'},404)
  }
}

test('CLOUD Issue78: real Chromium pharmacy isolation, FEFO, statuses, keyboard and no writes',
  {timeout:180000},async()=>{
  process.env.VITE_SUPABASE_URL='https://issue51-fixtures.supabase.co'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_issue51_offline'
  process.env.VITE_PHASE5B_PHARMACY_UI='true'
  const root=fileURLToPath(new URL('../',import.meta.url))
  const vite=await createServer({root,server:{host:'127.0.0.1',port:0,strictPort:false}})
  try{
    await vite.listen()
    const origin='http://127.0.0.1:'+vite.httpServer.address().port
    await withChromium(async browser=>{
      await browser.send('Page.addScriptToEvaluateOnNewDocument',
        {source:'('+pharmacyFixture.toString()+')()'})
      for(const width of [360,768,1440]){
        await browser.send('Emulation.setDeviceMetricsOverride',
          {width,height:900,deviceScaleFactor:1,mobile:false})
        for(const theme of ['light','dark']){
          await browser.goto(origin+'/app/pharmacy?theme='+theme)
          await browser.until('document.querySelectorAll(".pharmacy-medicine").length===3')
          const facts=await browser.value(`({
            viewport:innerWidth,theme:document.documentElement.getAttribute('data-theme'),
            heading:document.querySelector('#pharmacy-title')?.textContent.trim(),
            overflow:document.documentElement.scrollWidth>innerWidth,
            results:document.querySelectorAll('.pharmacy-medicine').length,
            available:document.querySelector('.pharmacy-kpi')?.textContent,
            mutations:window.__pharmacyMock.mutations,
            blocked:window.__pharmacyMock.blocked,
            costs:document.querySelector('#main-content')?.textContent.includes('999999'),
            assertions:window.__pharmacyMock.assertions.length,
            contrast:(()=>{
              const el=document.querySelector('.pharmacy-medicine')
              const parse=s=>(s.match(/[0-9.]+/g)||[]).slice(0,3).map(Number)
              const light=c=>{const v=c/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}
              const lum=rgb=>.2126*light(rgb[0])+.7152*light(rgb[1])+.0722*light(rgb[2])
              const x=lum(parse(getComputedStyle(el).color))
              const y=lum(parse(getComputedStyle(el).backgroundColor))
              return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)
            })()
          })`)
          assert.equal(facts.viewport,width)
          assert.equal(facts.theme,theme)
          assert.equal(facts.heading,'Veterinary pharmacy')
          assert.equal(facts.overflow,false,'overflow '+width+'/'+theme)
          assert.equal(facts.results,3)
          assert.match(facts.available,/2/)
          assert.deepEqual(facts.mutations,[],'no clinical or inventory mutations')
          assert.deepEqual(facts.blocked,[],'no unknown endpoint or cost-field read')
          assert.equal(facts.costs,false)
          assert.ok(facts.assertions>0,'branch was checked by server')
          assert.ok(facts.contrast>=4.5,'WCAG AA body contrast at '+width+'/'+theme)
          await browser.value('document.querySelector(".pharmacy-medicine").click();true')
          await browser.until('!!document.querySelector(".pharmacy-detail")')
          await browser.until('document.activeElement===document.querySelector(".pharmacy-detail-head h2")')
          await browser.until('!!document.querySelector(".pharmacy-batches")')
          // One code has available 12, a separate configured code has true out-of-stock;
          // unconfigured third catalog item never gets a fabricated zero balance.
          const ctx=await browser.value(`({
            lots:[...document.querySelectorAll('.pharmacy-batch strong')].map(x=>x.textContent),
            labels:[...document.querySelectorAll('.pharmacy-batch .pharmacy-tag')].map(x=>x.textContent),
            disabled:[...document.querySelectorAll('.pharmacy-actions-panel button')].every(x=>x.disabled)
          })`)
          assert.equal(ctx.lots.some(v=>v.includes('LOT-N-EXP')),true,'Synthetic returned lots: '+JSON.stringify(ctx.lots))
          assert.equal(ctx.labels.some(v=>v.includes('Expired')),true)
          assert.equal(ctx.labels.some(v=>v.includes('Quarantined')),true)
          assert.equal(ctx.disabled,true)
          // Actual keyboard ArrowRight advances the tab and focus.
          await browser.value('document.querySelector("#pharmacy-tab-batches").focus();true')
          await browser.send('Input.dispatchKeyEvent',
            {type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39})
          await browser.send('Input.dispatchKeyEvent',
            {type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39})
          await browser.until('document.querySelector("#pharmacy-tab-fefo")?.getAttribute("aria-selected")==="true"')
          assert.equal(await browser.value('document.activeElement?.id'),'pharmacy-tab-fefo')
          const fefo=await browser.value(`[...document.querySelectorAll('.pharmacy-fefo strong')]
            .map(x=>x.textContent)`)
          assert.deepEqual(fefo,['LOT-N-20','LOT-N-40'],'FEFO order from RPC, no expired/held lots')
          await browser.value('document.querySelector("#pharmacy-tab-ledger").click();true')
          await browser.until('document.querySelector(".pharmacy-ledger li")!==null')
          assert.equal(await browser.value('document.querySelectorAll(".pharmacy-ledger li").length'),1)
          await browser.value('document.querySelector("#pharmacy-tab-batches").click();true')
          await browser.until('!!document.querySelector(".pharmacy-batches")')
          await browser.value(`(()=>{const el=document.querySelector('.pharmacy-detail-actions select');
            el.value='60';el.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
          await browser.until(`[...document.querySelectorAll('.pharmacy-batch')]
            .some(x=>x.textContent.includes('LOT-N-40')&&x.textContent.includes('approaching expiry'))`)
          assert.deepEqual(await browser.value('window.__pharmacyMock.mutations'),[])
        }
      }
      // Filtered view and keyboard navigation must not query arbitrary branches.
      await browser.goto(origin+'/app/pharmacy')
      await browser.until('document.querySelectorAll(".pharmacy-medicine").length===3')
      await browser.value(`(()=>{const e=[...document.querySelectorAll('.pharmacy-controls select')]
        .find(x=>x.previousElementSibling?.textContent==='Stock status');
        e.value='out';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
      await browser.until('document.querySelectorAll(".pharmacy-medicine").length===1')
      assert.equal(await browser.value('document.querySelector(".pharmacy-medicine").textContent.includes("Beta")'),true)
      await browser.value(`(()=>{const e=[...document.querySelectorAll('.pharmacy-controls select')]
        .find(x=>x.previousElementSibling?.textContent==='Stock status');
        e.value='unconfigured';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
      await browser.until('document.querySelectorAll(".pharmacy-medicine").length===1')
      assert.equal(await browser.value('document.querySelector(".pharmacy-medicine").textContent.includes("Gamma")'),true)

      // Two authorized memberships: no implicit branch, Naga/Cavite lots remain isolated.
      await browser.goto(origin+'/app/pharmacy?case=both')
      await browser.until('!!document.querySelector("#pharmacy-branch option[value]")')
      assert.equal(await browser.value('document.querySelector(".pharmacy-medicine")===null'),true)
      await browser.value(`(()=>{const el=document.querySelector('#pharmacy-branch');
        el.value='20000000-0000-4000-8000-000000000001';
        el.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
      await browser.until('document.querySelectorAll(".pharmacy-medicine").length===3')
      await browser.value('document.querySelector(".pharmacy-medicine").click();true')
      await browser.until('!!document.querySelector(".pharmacy-batches")')
      assert.equal(await browser.value('document.querySelector(".pharmacy-batches").textContent.includes("LOT-N-20")'),true)
      await browser.value(`(()=>{const el=document.querySelector('#pharmacy-branch');
        el.value='20000000-0000-4000-8000-000000000002';
        el.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
      await browser.until('document.querySelector(".pharmacy-detail")===null')
      await browser.until('document.querySelectorAll(".pharmacy-medicine").length===3')
      await browser.value('document.querySelector(".pharmacy-medicine").click();true')
      await browser.until('!!document.querySelector(".pharmacy-batches")')
      const branch=await browser.value(`({
        text:document.querySelector('.pharmacy-detail').textContent,
        calls:window.__pharmacyMock.calls,
        mutations:window.__pharmacyMock.mutations,
        blocked:window.__pharmacyMock.blocked
      })`)
      assert.equal(branch.text.includes('LOT-C-45'),true,'Cavite separate lot')
      assert.equal(branch.text.includes('LOT-N-20'),false,'no Naga lot in Cavite')
      assert.equal(await browser.value('document.querySelector(".pharmacy-medicine").textContent.includes("2 vial available")'),
        true,'branch-specific quantity is shown on the authorized catalog result')
      assert.deepEqual(branch.mutations,[])
      assert.deepEqual(branch.blocked,[])
      // Revalidation after a previously successful stock read must revoke and
      // clear the entire branch screen, not leave cached medicine/ledger details.
      await browser.goto(origin+'/app/pharmacy?case=revocation-after')
      await browser.until('document.querySelectorAll(".pharmacy-medicine").length===3')
      await browser.value('document.querySelector(".pharmacy-medicine").click();true')
      await browser.until('!!document.querySelector(".pharmacy-batches")')
      await browser.value(`window.__pharmacyMock.revoked=true;
        [...document.querySelectorAll('.pharmacy-toolbar button')][0].click();true`)
      await browser.until('!!document.querySelector(".pharmacy-failure")')
      assert.equal(await browser.value('!!document.querySelector(".pharmacy-medicine")'),false,
        'revocation clears stock from the previously successful read')

      // New account token on a fresh document must never inherit old branch data.
      await browser.goto(origin+'/app/pharmacy?case=account-switch')
      await browser.until('!!document.querySelector(".pharmacy-failure")')
      assert.equal(await browser.value('!!document.querySelector(".pharmacy-medicine")'),false)
      assert.equal(await browser.value('window.__pharmacyMock.calls.some(x=>x.includes("/medicine_catalog"))'),false)

      // Branch and account revocation cannot display previous records.
      await browser.goto(origin+'/app/pharmacy?case=denied')
      await browser.until('!!document.querySelector(".pharmacy-failure")')
      assert.equal(await browser.value('!!document.querySelector(".pharmacy-medicine")'),false)
      assert.equal(await browser.value('window.__pharmacyMock.calls.some(x=>x.includes("/medicine_catalog"))'),false)
      await browser.goto(origin+'/app/pharmacy?case=revoked')
      await browser.until('!!document.querySelector(".pharmacy-failure")')
      assert.equal(await browser.value('!!document.querySelector(".pharmacy-medicine")'),false)
      // Network failure can recover only from an explicit re-read; no fallback data.
      await browser.goto(origin+'/app/pharmacy?case=network')
      await browser.until('!!document.querySelector(".pharmacy-failure button")')
      assert.equal(await browser.value('!!document.querySelector(".pharmacy-medicine")'),false)
      await browser.value('window.__pharmacyMock.recovered=true;document.querySelector(".pharmacy-failure button").click();true')
      await browser.until('document.querySelectorAll(".pharmacy-medicine").length===3')
      assert.equal(await browser.value('window.__pharmacyMock.mutations.length'),0)
      await browser.goto(origin+'/app/pharmacy?case=missing')
      await browser.until('!!document.querySelector(".pharmacy-failure")')
      assert.equal(await browser.value('!!document.querySelector(".pharmacy-medicine")'),false)
      await browser.goto(origin+'/app/pharmacy?case=empty')
      await browser.until('!!document.querySelector(".pharmacy-controls")')
      assert.equal(await browser.value('document.querySelectorAll(".pharmacy-medicine").length'),0)
      await browser.goto(origin+'/app/pharmacy?case=expired')
      await browser.until('location.pathname==="/auth/signin"')
      assert.equal(await browser.value('!!document.querySelector(".pharmacy-medicine")'),false)
    })
  }finally{
    await vite.close()
    delete process.env.VITE_PHASE5B_PHARMACY_UI
  }
})
