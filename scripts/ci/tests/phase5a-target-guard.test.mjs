// Exercise the actual shell guard prefix, never execute SQL or contact a database.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
const workflow=readFileSync(new URL('../../../.github/workflows/phase5a-staff-postgres.yml',import.meta.url),'utf8')
for(const db of ['phase5a_staff_ci','phase5a_booking_ci']){
  test(db+' target guard rejects either mismatch before SQL sentinel',()=>{
    const prefix = ["          set -euo pipefail", "          test \"$PGHOST\" = '127.0.0.1'", "          test \"$PGDATABASE\" = '"+db+"'", "          psql"].join('\n')
    assert.ok(workflow.includes(prefix),'actual guard must immediately precede psql')
    const body=prefix.split('\n').slice(0,3).map(x=>x.trim()).join('\n')+'\nprintf "SQL_SENTINEL\\n"'
    for(const [host,database,ok] of [['127.0.0.1',db,true],['wrong-host.invalid',db,false],['127.0.0.1','wrong-db',false]]){
      const run=spawnSync('bash',['-c',body],{encoding:'utf8',env:{...process.env,PGHOST:host,PGDATABASE:database}})
      assert.equal(run.status,ok?0:1)
      assert.equal(run.stdout.includes('SQL_SENTINEL'),ok)
    }
    const legacy=spawnSync('bash',['-c','set -euo pipefail; test "$PGHOST" = 127.0.0.1 && test "$PGDATABASE" = '+db+'; echo SQL_SENTINEL'],{encoding:'utf8',env:{...process.env,PGHOST:'wrong-host.invalid',PGDATABASE:db}})
    assert.equal(legacy.status,0)
    assert.match(legacy.stdout,/SQL_SENTINEL/)
  })
}
