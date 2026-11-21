import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,chmodSync,readdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

const root=resolve(import.meta.dirname,'..')
const backup=join(root,'backup-clinic.sh')
const verify=join(root,'verify-archive.sh')
const cmd=(script,args=[],env={})=>spawnSync('bash',[script,...args],{encoding:'utf8',env:{...process.env,...env}})

test('scripts pass Bash syntax validation',()=>{
 for(const s of [backup,verify]) assert.equal(spawnSync('bash',['-n',s]).status,0)
})
test('backup fails closed without confidential environment configuration',()=>{
 const x=cmd(backup,[],{PGHOST:'',PGUSER:'',PGDATABASE:'',PGPASSFILE:'',DAWNEY_BACKUP_RECIPIENT_FPR:''})
 assert.notEqual(x.status,0)
 assert.match(x.stderr,/Missing prerequisite|Set PGHOST/)
})
test('checksum/archived-object pipeline functions with isolated fake tools',()=>{
 const dir=mkdtempSync(join(tmpdir(),'dawney-backup-mock-'))
 const bin=join(dir,'bin'),out=join(dir,'private-output')
 mkdirSync(bin);mkdirSync(out)
 const fake={
  'pg_dump':`#!/bin/bash\nfor a in "$@"; do case "$a" in --file=*) printf 'FAKE_ARCHIVE' > "\${a#--file=}";; esac; done\n`,
  'pg_restore':`#!/bin/bash\nif [[ "$1" == '--list' ]]; then echo 'mock PostgreSQL entries'; else exit 1; fi\n`,
  'gpg':`#!/bin/bash\nout=''; in=''; while [[ $# -gt 0 ]]; do case "$1" in --output) out="$2"; shift 2;; --recipient) shift 2;; --batch|--yes|--encrypt|--quiet|--decrypt) shift;; *) in="$1"; shift;; esac; done; cp "$in" "$out"\n`
 }
 try{
  for(const [n,data] of Object.entries(fake)){writeFileSync(join(bin,n),data,{mode:0o700});chmodSync(join(bin,n),0o700)}
  const pgpass=join(dir,'pgpass');writeFileSync(pgpass,'mock:5432:mock:mock:mock',{mode:0o600});chmodSync(pgpass,0o600)
  const env={PATH:bin+':'+process.env.PATH,PGHOST:'mock',PGUSER:'mock',PGDATABASE:'mock',PGPASSFILE:pgpass,
   DAWNEY_BACKUP_RECIPIENT_FPR:'A'.repeat(40),DAWNEY_BACKUP_DIR:out}
  const created=cmd(backup,[],env)
  assert.equal(created.status,0,created.stderr)
  const names=readdirSync(out)
  const archive=names.find(n=>n.endsWith('.pgdump.gpg'))
  assert.ok(archive)
  assert.ok(names.includes(archive+'.sha256'))
  const check=cmd(verify,[join(out,archive)],env)
  assert.equal(check.status,0,check.stderr)
  assert.match(check.stdout,/not a full restore test/i)
  const data=readFileSync(join(out,archive))
  assert.equal(data.toString(),'FAKE_ARCHIVE') // mock copies, real run uses GPG encryption
 } finally {rmSync(dir,{recursive:true,force:true})}
})