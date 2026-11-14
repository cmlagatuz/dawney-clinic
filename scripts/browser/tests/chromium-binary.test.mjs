import test from 'node:test';
import assert from 'node:assert/strict';
import {delimiter} from 'node:path';
import {installedChromiumCandidates,discoverChromium} from '../chromium-binary.mjs';

test('uses actual executable path instead of the time-sensitive --version probe',()=>{
 const paths=installedChromiumCandidates({
  env:{PATH:['/runner/bin','/usr/bin'].join(delimiter)},
  canExecute:p=>p==='/usr/bin/google-chrome'
 });
 assert.deepEqual(paths,['/usr/bin/google-chrome']);
});
test('explicit Chrome path takes priority, ignores non-executable files',()=>{
 const paths=installedChromiumCandidates({
  env:{DAWNEY_CHROME_BINARY:'/opt/google/chrome/chrome',PATH:'/usr/bin'},
  canExecute:p=>p==='/opt/google/chrome/chrome'||p==='/usr/bin/chromium'
 });
 assert.deepEqual(paths,['/opt/google/chrome/chrome','/usr/bin/chromium']);
});
test('deduplicates fallback paths, does not execute shell commands',()=>{
 const paths=installedChromiumCandidates({
  env:{CHROME_BIN:'chromium',PATH:'/usr/bin'},
  canExecute:p=>p==='/usr/bin/chromium'
 });
 assert.deepEqual(paths,['/usr/bin/chromium']);
});
test('discovery has bounded retries and succeeds after transient runner outage',async()=>{
 let waits=0;
 const paths=await discoverChromium({
  env:{PATH:'/usr/bin'},attempts:3,delayMs:1,
  canExecute:p=>waits>=1&&p==='/usr/bin/google-chrome',
  wait:async()=>{waits++;}
 });
 assert.deepEqual(paths,['/usr/bin/google-chrome']);
 assert.equal(waits,1);
});
test('definitive missing Chrome fails instead of skipping assertions',async()=>{
 let waits=0;
 await assert.rejects(discoverChromium({
  env:{PATH:'/absent'},attempts:3,
  canExecute:()=>false,wait:async()=>{waits++;}
 }),/not found after 3 bounded checks/);
 assert.equal(waits,2);
});
test('reject invalid retry counts',async()=>{
 await assert.rejects(discoverChromium({attempts:0}),/Invalid Chrome discovery attempts/);
 await assert.rejects(discoverChromium({attempts:99}),/Invalid Chrome discovery attempts/);
});
