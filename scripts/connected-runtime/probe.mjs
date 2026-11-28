// Real preflight only; no application scenarios and no Auth state injection.
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {lookup} from 'node:dns/promises'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
const [mode,root,packetFile,...args]=process.argv.slice(2)
const guard=await import(pathToFileURL(resolve(root,'web/tests/connected/runtime-guard.mjs')))
const p=JSON.parse(await readFile(packetFile,'utf8'))
const origin='https://dawney-rc2-synthetic.supabase.co'
if(mode==='otp'){
  // Same accepted Mailpit parser used for real seed accounts; code returned
  // privately to the parent pipe, never printed to GitHub logs.
  const email=args[0]
  const seed={runId:p.runId,accounts:{ownerNew:{email}}}
  const otp=await guard.waitForSignupOtp(seed,'ownerNew')
  process.stdout.write(otp)
}else if(mode==='preflight'){
  assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED,undefined)
  assert.equal(process.getgroups().length<=1,true)
  const status=await readFile('/proc/self/status','utf8')
  assert.match(status,/^NoNewPrivs:\s+1$/m)
  assert.match(status,/^CapEff:\s+0+$/m)
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
  const valid=guard.validatePacket(p,p.runId)
  guard.verifySource(root)
  guard.privatePacket(root,packetFile)
  await guard.verifyLocalBackend(valid)
  await assert.rejects(fetch(origin+':4443/auth/v1/health',{signal:AbortSignal.timeout(5000),redirect:'error'}),e=>e.cause?.code==='ERR_TLS_CERT_ALTNAME_INVALID')
  console.log('PASS: exact CLOUD v2 packet, real HTTPS publishable health/catalog/mail and Node wrong-SAN refusal')
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
}else throw Error('unknown preflight mode')
