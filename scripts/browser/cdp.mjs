/**
 * Dependency-free Chromium DevTools transport for isolated smoke acceptance.
 * Temporary blank browser profile; no screenshots, session or password logging.
 * A local Chrome/Chromium binary is required (also on GitHub hosted Ubuntu CI).
 */
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function browserBinary(){
 const bins=[process.env.DAWNEY_CHROME_BINARY,'google-chrome','chromium','chromium-browser']
  .filter(Boolean);
 for(const bin of bins){
  const version=spawnSync(bin,['--version'],{stdio:'ignore',timeout:3000});
  if(version.status===0)return bin;
 }
 throw Error('Chrome/Chromium is required for browser acceptance');
}
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
export async function withChromium(callback){
 const profile=await mkdtemp(join(tmpdir(),'dawney-cdp-'));
 const proc=spawn(browserBinary(),['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--disable-gpu','--disable-extensions','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let socket;
 try{
  let port;
  // Heavily contended free CI runners can take >10 seconds to initialize Chrome.
  // This is startup only: application/guard assertions retain their own tight deadlines.
  for(let i=0;i<350;i++){
   if(proc.exitCode!==null)throw Error('Chromium quit unexpectedly');
   try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}
   catch{ /* browser starting */ }
   await sleep(100);
  }
  if(!port)throw Error('Chromium debugging port unavailable');
  let tab;
  for(let i=0;i<30;i++){
   try{
    const response=await fetch('http://127.0.0.1:'+port+'/json/list');
    const tabs=await response.json();
    tab=tabs.find(x=>x.type==='page');
    if(tab?.webSocketDebuggerUrl)break;
   }catch{ /* page target starting */ }
   await sleep(100);
  }
  if(!tab?.webSocketDebuggerUrl)throw Error('No Chromium page target found');
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Chromium socket timeout')),6000);
   socket.addEventListener('open',()=>{clearTimeout(timeout);resolve();},{once:true});
   socket.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Chromium socket failed'));},{once:true});
  });
  const browser=cdp(socket);
  await browser.send('Page.enable');
  await browser.send('Runtime.enable');
  return await callback(browser);
 } finally {
  try{socket?.close();}catch{}
  proc.kill('SIGTERM');
  await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});
 }
}
