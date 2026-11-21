/**
 * Read-only tracked-source risk guard. No network, credential access or writes.
 * Does not substitute for GitHub Secret Scanning or npm/composer vulnerability scans.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const strictVersion=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const sensitivePath=/(^|\/)(?:\.env(?:\..+)?|[^/]+\.(?:pem|p12|pfx|pgpass|pgdump|bak|sql\.gz))$/i;
const actualCredentialPatterns=[
 new RegExp('sb_'+'secret_[A-Za-z0-9_-]{20,}'),
 new RegExp('-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
 /postgres(?:ql)?:\/\/[^\s/@:]+:[^\s/@]+@[^\s/]+/i
];
export function findTrackedRisks(paths) {
 const warnings=[];
 for(const path of paths){
  if(sensitivePath.test(path)&&!path.endsWith('.env.example'))warnings.push('Sensitive tracked filename: '+path);
 }
 return warnings;
}
export function dependencyRisks(pkg,lock) {
 const warnings=[];
 if(pkg.private!==true)warnings.push('Web package must remain private');
 if(!lock||!Number.isInteger(lock.lockfileVersion)||lock.lockfileVersion<2) {
  warnings.push('Missing or obsolete npm lockfile');
 }
 for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})) {
  if(typeof version!=='string'||!strictVersion.test(version))warnings.push('Unpinned npm dependency: '+name);
 }
 if(!pkg.scripts?.build || !pkg.scripts?.test)warnings.push('Missing web build/test scripts');
 return warnings;
}
export function scanSource(readText,paths) {
 const warnings=[];
 for(const path of paths){
  if(/\.(?:png|jpe?g|gif|svg|woff2?|ttf|lock|ico)$/i.test(path))continue;
  const body=readText(path);
  if(body.includes('\u0000'))continue; // skip binary
  if(actualCredentialPatterns.some(pattern=>pattern.test(body)))warnings.push('Possible credential in tracked file: '+path);
 }
 return warnings;
}
export function runGuard(){
 const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'})
  .split('\u0000').filter(Boolean);
 const readText=path=>readFileSync(path,'utf8');
 const pkg=JSON.parse(readText('web/package.json'));
 const lock=JSON.parse(readText('web/package-lock.json'));
 return [
  ...findTrackedRisks(tracked),
  ...dependencyRisks(pkg,lock),
  ...scanSource(readText,tracked)
 ];
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const risks=runGuard();
  if(risks.length){
   for(const issue of risks)console.error('Repository safety check: '+issue);
   process.exitCode=1;
  }else{
   console.log('PASS: tracked artifact filenames, obvious credential patterns and pinned npm graph guard.');
   console.log('Not a full vulnerability audit or branch protection guarantee.');
  }
 }catch{
  console.error('Repository safety guard could not inspect tracked files');
  process.exitCode=1;
 }
}
