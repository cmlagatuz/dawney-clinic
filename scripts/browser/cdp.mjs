/**
 * Dependency-free Chromium DevTools transport for isolated smoke acceptance.
 * Temporary blank browser profile; no screenshots, session or password logging.
 * A local Chrome/Chromium binary is required (also on GitHub hosted Ubuntu CI).
 */
import {spawn} from 'node:child_process';
import {discoverChromium} from './chromium-binary.mjs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function acceptedOrigin(value,{local=false}={}){
 const u=new URL(value);
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Expected bare browser origin');
 if(local){
  if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port)throw Error('Only local loopback preview allowed');
 } else if(u.protocol!=='https:'||
   !/^[a-z0-9-]+(?:\.[a-z0-9-]+)?\.pages\.dev$/.test(u.hostname)||u.port){
  throw Error('Only HTTPS Cloudflare Pages origin allowed');
 }
 return u.origin;
}
function cdp(socket){
 const pending=new Map();
 let next=0;
 socket.addEventListener('message',event=>{
  try{
   const reply=JSON.parse(event.data);
   if(!reply.id||!pending.has(reply.id))return;
   const job=pending.get(reply.id);
   clearTimeout(job.timeout);
   pending.delete(reply.id);
   if(reply.error)job.reject(Error('Chromium protocol command rejected'));
   else job.resolve(reply.result||{});
  }catch{ /* Do not log browser events or session contents. */ }
 });
 socket.addEventListener('close',()=>{
  for(const task of pending.values()){clearTimeout(task.timeout);task.reject(Error('Browser connection closed'));}
  pending.clear();
 });
 return {
  send(method,params={}){
   return new Promise((resolve,reject)=>{
    const id=++next;
    const timeout=setTimeout(()=>{pending.delete(id);reject(Error('Chromium command timed out'))},15000);
    pending.set(id,{resolve,reject,timeout});
    socket.send(JSON.stringify({id,method,params}));
   });
  },
  async value(expression){
   const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
   if(result.exceptionDetails)throw Error('Browser page evaluation failed');
   return result.result?.value;
  },
  async until(expression,timeoutMs=12000){
   const end=Date.now()+timeoutMs;
   while(Date.now()<end){
    try{if(await this.value(expression))return;}catch{ /* transient navigation context */ }
    await sleep(125);
   }
   throw Error('Expected browser UI state was not reached');
  },
  async goto(url){
   await this.send('Page.navigate',{url});
   await this.until('document.readyState === "complete"');
  }
 };
}
/**
 * The 18s startup deadline is retried at most once, and only before any page
 * assertions run. App / route / security failures are never retried or hidden.
 */
async function launchChromium(executable) {
 const profile=await mkdtemp(join(tmpdir(),'dawney-cdp-'));
 let proc, socket;
 let startupError=null, stderrTail='';
 const close=async()=>{
  try{socket?.close();}catch{}
  try{proc?.kill('SIGTERM');}catch{}
  await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});
 };
 try{
  proc=spawn(executable,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
   '--disable-gpu','--disable-extensions','--no-first-run','--no-default-browser-check',
   '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],
   {stdio:['ignore','ignore','pipe']});
  proc.once('error',err=>{startupError=err;});
  proc.stderr?.on('data',chunk=>{
   // Only bounded Chrome startup output; never log browser page/session content.
   stderrTail=(stderrTail+String(chunk)).slice(-280);
  });
  let port;
  for(let i=0;i<180;i++){
   if(startupError||proc.exitCode!==null||proc.signalCode!==null){
    throw Error('Chrome process exited before DevTools initialized');
   }
   try{
    const raw=await readFile(join(profile,'DevToolsActivePort'),'utf8');
    port=Number(raw.split('\n')[0]);
    if(Number.isInteger(port)&&port>0&&port<=65535)break;
   }catch{ /* browser starting; do not log temporary file paths */ }
   await sleep(100);
  }
  if(!port)throw Error('DevTools port not created within 18 seconds');
  let tab;
  for(let i=0;i<35;i++){
   if(startupError||proc.exitCode!==null||proc.signalCode!==null)
    throw Error('Chrome exited while opening DevTools target');
   try{
    const response=await fetch('http://127.0.0.1:'+port+'/json/list');
    if(response.ok){
     const tabs=await response.json();
     tab=tabs.find(x=>x.type==='page');
     if(tab?.webSocketDebuggerUrl)break;
    }
   }catch{ /* target starting */ }
   await sleep(100);
  }
  if(!tab?.webSocketDebuggerUrl)throw Error('No Chromium page target');
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Chromium socket timeout')),6000);
   socket.addEventListener('open',()=>{clearTimeout(timeout);resolve();},{once:true});
   socket.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Chromium socket failed'));},{once:true});
  });
  const browser=cdp(socket);
  await browser.send('Page.enable');
  await browser.send('Runtime.enable');
  return {browser,close};
 }catch(err){
  const code=typeof startupError?.code==='string'?startupError.code:'none';
  const status=proc?.exitCode??'none';
  const signal=proc?.signalCode??'none';
  // Redact network-looking strings to avoid leaking URLs in provider logs.
  const safeStderr=stderrTail.replace(/https?:\/\/\S+/g,'[redacted-url]')
   .replace(/[\r\n\t]+/g,' ').replace(/[^\x20-\x7e]/g,'').slice(-200);
  const reason=err instanceof Error?err.message:'Unknown Chrome startup error';
  await close();
  throw Error('Chromium launch failed: '+reason+'; executable='+executable+
   '; error_code='+code+'; exit='+status+'; signal='+signal+
   (safeStderr?'; stderr_tail='+safeStderr:''));
 }
}
export async function withChromium(callback){
 const paths=await discoverChromium();
 let lastError;
 for(let attempt=1;attempt<=2;attempt++){
  const binary=paths[(attempt-1)%paths.length];
  let session;
  try{
   session=await launchChromium(binary);
  }catch(err){
   lastError=err;
   // Retry only Chrome initialization, NEVER application assertions.
   if(attempt===2)throw Error('Chromium failed after 2 bounded startup attempts: '+lastError.message);
   console.error('Chromium startup retry 1/2: '+lastError.message);
   await sleep(400);
   continue;
  }
  try{
   return await callback(session.browser);
  }finally{
   await session.close();
  }
 }
 throw lastError??Error('Chromium did not initialize');
}
