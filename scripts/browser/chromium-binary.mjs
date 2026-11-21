/** Chrome discovery on GitHub hosted runners.
 * Test X_OK, not a 3-second '--version' subprocess: runners can stall while
 * Chrome initializes even though its installed binary is perfectly usable.
 * The real CDP startup remains the authoritative browser health check.
 */
import {accessSync,constants} from 'node:fs';
import {delimiter,isAbsolute,join} from 'node:path';

const names=Object.freeze(['google-chrome','google-chrome-stable','chromium','chromium-browser']);
const explicitNames=['DAWNEY_CHROME_BINARY','CHROME_BIN','GOOGLE_CHROME_BIN'];
export function installedChromiumCandidates({
 env=process.env,canExecute=file=>{try{accessSync(file,constants.X_OK);return true;}catch{return false;}}
}={}){
 const dirs=(env.PATH??'').split(delimiter).filter(Boolean);
 const candidates=[];
 const seen=new Set();
 function push(candidate){
  if(!candidate||typeof candidate!=='string'||candidate.includes('\0'))return;
  const paths=isAbsolute(candidate)?[candidate]:
   candidate.includes('/')?[]:dirs.map(dir=>join(dir,candidate));
  for(const path of paths){
   if(seen.has(path))continue;
   seen.add(path);
   if(canExecute(path))candidates.push(path);
  }
 }
 for(const key of explicitNames)push(env[key]);
 for(const name of names)push(name);
 // Fixed stable Ubuntu/Chrome image paths, even if a runner's PATH is abnormal.
 for(const path of ['/usr/bin/google-chrome','/usr/bin/google-chrome-stable',
  '/usr/bin/chromium','/usr/bin/chromium-browser',
  '/opt/google/chrome/chrome','/opt/google/chrome/google-chrome'])push(path);
 return candidates;
}
/** Bounded race recovery for temporarily inaccessible runner binaries.
 * No untrusted shell commands, no browser state, no environment dumps. */
export async function discoverChromium({
 env=process.env,canExecute,wait=ms=>new Promise(r=>setTimeout(r,ms)),
 attempts=3,delayMs=300
}={}){
 if(!Number.isInteger(attempts)||attempts<1||attempts>5)throw Error('Invalid Chrome discovery attempts');
 for(let i=0;i<attempts;i++){
  const paths=installedChromiumCandidates({env,canExecute});
  if(paths.length)return paths;
  if(i+1<attempts)await wait(delayMs);
 }
 throw Error('Chrome/Chromium executable not found after '+attempts+
   ' bounded checks (PATH/DAWNEY_CHROME_BINARY/CHROME_BIN/GOOGLE_CHROME_BIN).');
}
