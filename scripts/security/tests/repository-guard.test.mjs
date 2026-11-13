import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findTrackedRisks,dependencyRisks,scanSource} from '../repository-guard.mjs';
test('deny accidental private env and backup artifacts while allowing examples',()=>{
 assert.deepEqual(findTrackedRisks(['web/.env.example','docs/README.md']),[]);
 assert.ok(findTrackedRisks(['web/.env.local','private/backup.pgdump','cert.pem']).length===3);
});
test('guard npm exact versions and existing lock',()=>{
 const pkg={private:true,scripts:{build:'x',test:'y'},dependencies:{react:'19.3.1'}};
 assert.deepEqual(dependencyRisks(pkg,{lockfileVersion:3}),[]);
 pkg.dependencies.react='^19.3.1';
 assert.ok(dependencyRisks(pkg,{lockfileVersion:3}).some(r=>r.includes('Unpinned')));
});
test('scan detects private signing material without exposing match in log',()=>{
 const file='application.mjs';
 const findings=scanSource(()=> '-----BEGIN PRIVATE KEY-----',[file]);
 assert.deepEqual(findings,['Possible credential in tracked file: '+file]);
});
