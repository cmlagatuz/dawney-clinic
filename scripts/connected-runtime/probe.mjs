// Real preflight only; no application scenarios and no Auth state injection.
import assert from 'node:assert/strict'
import {readFile,access,constants} from 'node:fs/promises'
import {lookup} from 'node:dns/promises'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
const [mode,root,packetFile,...args]=process.argv.slice(2)
const guard=await import(pathToFileURL(resolve(root,'web/tests/connected/runtime-guard.mjs')))
const p=JSON.parse(await readFile(packetFile,'utf8'))
const origin='https://dawney-rc2-synthetic.supabase.co'
let step='initial'
try{
if(mode==='otp'){
  step='local-mail-list'
  const res=await fetch('http://127.0.0.1:54324/api/v1/messages?limit=100',{redirect:'error',signal:AbortSignal.timeout(5000)})
  assert.ok(res.ok)
  const list=await res.json()
  console.log('MAIL_SHAPE: list array='+Array.isArray(list.messages)+' total integer='+Number.isSafeInteger(list.total))
  step='exact-mail-parser'
  const email=args[0]
  const ids=guard.matchingSignupMessages(list,email)
  if(ids.length===1){
    const detailRes=await fetch('http://127.0.0.1:54324/api/v1/message/'+encodeURIComponent(ids[0]),{redirect:'error',signal:AbortSignal.timeout(5000)})
    assert.ok(detailRes.ok)
    const detail=await detailRes.json()
    console.log('MAIL_SHAPE: Text present='+ (typeof detail.Text==='string') +' HTML present='+ (typeof detail.HTML==='string') +' Text length='+ (typeof detail.Text==='string'?detail.Text.length:0))
    const otp=guard.extractSignupOtp(detail,ids[0],email)
    process.stdout.write(otp+'\n')
  }else{
    step='wait-real-mail'
    const seed={runId:p.runId,accounts:{ownerNew:{email}}}
    const otp=await guard.waitForSignupOtp(seed,'ownerNew')
    process.stdout.write(otp+'\n')
  }
}else if(mode==='transport'){
  step='namespace-process-controls'
  assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED,undefined)
  assert.equal(process.getgroups().length<=1,true)
  const status=await readFile('/proc/self/status','utf8')
  assert.match(status,/^NoNewPrivs:\s+1$/m)
  assert.match(status,/^CapEff:\s+0+$/m)
  await assert.rejects(access('/var/run/docker.sock',constants.W_OK))
  const links=JSON.parse(execFileSync('ip',['-j','link','show'],{encoding:'utf8'}))
  assert.deepEqual(links.map(x=>x.ifname),['lo'])
  for(const family of ['-4','-6']){
    const routes=JSON.parse(execFileSync('ip',[family,'-j','route','show','table','main'],{encoding:'utf8'}))
    assert.ok(routes.every(x=>x.dev==='lo'))
  }
  const addresses=await lookup(new URL(origin).hostname,{all:true})
  assert.ok(addresses.length&&addresses.every(x=>x.address==='127.0.0.1'||x.address==='::1'))
  await assert.rejects(lookup('example.com'))
  await assert.rejects(fetch('http://192.0.2.1/',{signal:AbortSignal.timeout(2000),redirect:'error'}))
  console.log('PASS: isolated Node namespace only loopback, no capabilities, no external DNS or IP route')
  step='node-trusted-tls-and-publishable-key'
  const health=await fetch(origin+'/auth/v1/health',{redirect:'error',headers:{apikey:p.publishableKey},signal:AbortSignal.timeout(8000)})
  assert.ok(health.ok)
  const catalog=await fetch(origin+'/rest/v1/clinic_branches?select=id,slug',{redirect:'error',headers:{apikey:p.publishableKey},signal:AbortSignal.timeout(8000)})
  assert.ok(catalog.ok)
  assert.ok((await catalog.json()).some(x=>x.slug==='naga'))
  await assert.rejects(fetch(origin+':4443/auth/v1/health',{signal:AbortSignal.timeout(5000),redirect:'error'}),e=>e.cause?.code==='ERR_TLS_CERT_ALTNAME_INVALID')
  console.log('PASS: Node real HTTPS publishable Auth/catalog and wrong-SAN refusal')
  step='chromium-trusted-tls-and-negative-controls'
  const {withChromium}=await import(pathToFileURL(resolve(root,'scripts/browser/cdp.mjs')))
  await withChromium(async b=>{
    await b.send('Network.enable')
    await b.send('Network.setExtraHTTPHeaders',{headers:{apikey:p.publishableKey}})
    const nav=await b.send('Page.navigate',{url:origin+'/auth/v1/health'})
    assert.equal(nav.errorText,undefined)
    await b.until('location.origin==='+JSON.stringify(origin)+'&&document.readyState==="complete"&&document.body.innerText.length>0')
    const body=await b.value('document.body.innerText')
    assert.ok(JSON.parse(body)&&!body.includes('Invalid API key'))
    await b.send('Network.setExtraHTTPHeaders',{headers:{}})
    const bad=await b.send('Page.navigate',{url:origin+':4443/auth/v1/health'})
    assert.match(bad.errorText??'',/ERR_CERT_COMMON_NAME_INVALID/)
    const external=await b.send('Page.navigate',{url:'http://192.0.2.1/'})
    assert.match(external.errorText??'',/ERR_(ADDRESS_UNREACHABLE|INTERNET_DISCONNECTED|CONNECTION_FAILED|CONNECTION_TIMED_OUT)/)
    const dns=await b.send('Page.navigate',{url:'https://example.com/'})
    assert.match(dns.errorText??'',/ERR_(NAME_NOT_RESOLVED|ADDRESS_UNREACHABLE|INTERNET_DISCONNECTED|DNS_TIMED_OUT)/)
  })
  console.log('PASS: actual Chromium trusted intended TLS, rejected wrong SAN and external IP/DNS')
}else if(mode==='preflight'){
  step='actual-cloud-v2-guard'
  const valid=guard.validatePacket(p,p.runId)
  guard.verifySource(root)
  guard.privatePacket(root,packetFile)
  await guard.verifyLocalBackend(valid)
  console.log('PASS: exact CLOUD v2 packet and actual catalog/mail freshness')
}else throw Error('unknown preflight mode')
}catch(e){
 // A closed vocabulary only. Never output exception text, addresses, mail or OTP.
 const known=[
  'local mail list incomplete or invalid','invalid local mail metadata','unexpected or ambiguous signup mail','duplicate signup mail',
  'signup mail recipient or identity mismatch','local signup code template mismatch','isolated local mail read unavailable',
  'real isolated mail not delivered within 45 seconds','stale signup mail',
  'anonymous taxonomy denial not verified','seeded synthetic owner authentication failed','seeded owner identity not verified',
  'authenticated local taxonomy catalog unavailable','local catalog preflight session cleanup failed',
  'runtime branch fixture mismatch','missing, inactive or unsupported synthetic species',
  'missing, inactive, pending or mismatched synthetic breed'
 ]
 const reason=known.find(x=>typeof e?.message==='string'&&e.message.includes(x))||
   (e?.name==='TimeoutError'?'request timeout':e?.name==='AssertionError'?'assertion failed':e?.name==='TypeError'?'transport or type error':'controlled failure')
 const code=typeof e?.cause?.code==='string'&&/^[A-Z0-9_]{2,40}$/.test(e.cause.code)?e.cause.code:'none'
 console.log('PROBE_BLOCKED: '+step+' - '+reason+' code='+code)
 process.exitCode=1
}
