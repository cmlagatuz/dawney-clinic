#!/usr/bin/env python3
"""Synthetic regression for the new manual operator utility. Optional disposable PG17 in CI."""
import hashlib
import importlib.util
from unittest.mock import patch
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[1]
UTILITY=ROOT/"manual-supabase-recovery.py"
def run(*args, ok=True, reason=None, **kw):
    p=subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kw)
    if (p.returncode==0)!=ok:
        raise AssertionError("unexpected exit: "+str(args[0])+" "+p.stderr.decode(errors="replace")[-500:])
    if reason:
        assert p.stderr.decode().startswith(reason+':'), p.stderr.decode()
        assert str(base) not in p.stderr.decode() and owner not in p.stderr.decode()
    return p.stdout

with tempfile.TemporaryDirectory(prefix="manual-synthetic-") as tmp:
    base=Path(tmp)
    os.umask(0o077)
    os.environ["GNUPGHOME"]=str(base/"gnupg")
    (base/"gnupg").mkdir(mode=0o700)
    for name in ("Owner","Other"):
        run("gpg","--batch","--pinentry-mode","loopback","--passphrase","","--quick-generate-key",name+" <"+name.lower()+"@example.invalid>","rsa2048","sign,encr","0")
    def fpr(name):
        return next(l.split(":")[9] for l in run("gpg","--with-colons","--list-keys",name).decode().splitlines() if l.startswith("fpr:"))
    owner,other=fpr("Owner"),fpr("Other")
    root,out,work=(base/n for n in ("collection","out","work"))
    for p in (root,out,work): p.mkdir(mode=0o700)
    for n in ("application","auth-identities","storage-metadata","storage-objects","configuration"):
        (root/n).mkdir(mode=0o700)
    app=root/"application"
    for n in ("roles.sql","schema.sql","data.sql","history_schema.sql","history_data.sql","managed_changes.sql"):
        (app/n).write_text("-- synthetic fixture\n")
    (root/"auth-identities/auth.sql").write_text("-- synthetic identity fixture\n")
    (root/"storage-metadata/storage.sql").write_text("-- synthetic storage metadata fixture\n")
    obj=root/"storage-objects/private/fixture.bin"
    obj.parent.mkdir()
    obj.write_bytes(b"\x00\xffDawney synthetic object")
    (root/"storage-metadata/objects.json").write_text(json.dumps([{"path":"private/fixture.bin","bytes":obj.stat().st_size,"sha256":hashlib.sha256(obj.read_bytes()).hexdigest()}]))
    (root/"configuration/inventory.json").write_text(json.dumps({"source":"synthetic-source","cutoff_utc":"2026-11-25T00:00:00Z","postgres_major":17,"cli_version":"3.0.0","auth_storage_versions":"synthetic only","settings":{k:"synthetic only" for k in ("auth","storage","extensions","realtime","functions","network","secrets_reconfiguration")},"coverage_attestation":"operator-reviewed-quiescent-export"}))
    # Only CI's explicitly provisioned container; never connect to a host or URL.
    cid=os.environ.get("DAWNEY_SYNTHETIC_PG_CONTAINER","")
    if cid:
        assert os.environ.get("GITHUB_ACTIONS")=="true" and len(cid)==64 and all(c in "0123456789abcdef" for c in cid)
        def sql(db, statement):
            return run("docker","exec","-i",cid,"psql","-XAt","-v","ON_ERROR_STOP=1","-U","postgres","-d",db,input=statement.encode())
        assert sql("postgres","show server_version_num;").decode().strip().startswith("17")
        sql("postgres","create database manual_source;")
        sql("manual_source","create schema auth; create schema storage; create schema supabase_migrations; create table auth.users(id int primary key); insert into auth.users values (7); create table public.pets(id int primary key, breed text); insert into public.pets values (1,'Chow Chow'); alter table public.pets enable row level security; create policy synthetic_read on public.pets for select using (false); create table storage.objects(name text); insert into storage.objects values ('private/fixture.bin'); create table supabase_migrations.schema_migrations(version text); insert into supabase_migrations.schema_migrations values ('20261113070302');")
        for name, flags in (("schema.sql",["--schema-only"]),("data.sql",["--data-only"])):
            (app/name).write_bytes(run("docker","exec",cid,"pg_dump","-U","postgres",*flags,"manual_source"))
        (app/"history_schema.sql").write_bytes(run("docker","exec",cid,"pg_dump","-U","postgres","--schema-only","--schema=supabase_migrations","manual_source"))
        (app/"history_data.sql").write_bytes(run("docker","exec",cid,"pg_dump","-U","postgres","--data-only","--schema=supabase_migrations","manual_source"))
        (root/"auth-identities/auth.sql").write_bytes(run("docker","exec",cid,"pg_dump","-U","postgres","--data-only","--schema=auth","manual_source"))
        (root/"storage-metadata/storage.sql").write_bytes(run("docker","exec",cid,"pg_dump","-U","postgres","--data-only","--schema=storage","manual_source"))
    def call(action, inp, dest, extra=(), ok=True, signer=owner, reason=None):
        return run(sys.executable,str(UTILITY),action,str(inp),str(dest),"--source","synthetic-source","--confirm-source","synthetic-source","--signer",signer,*extra,ok=ok,reason=reason)
    call("pack",root,out,("--recipient",owner))
    backup=next(out.iterdir())
    call("verify",backup,work)
    assert not list(work.iterdir())
    call("verify",backup,work,ok=False,signer=other,reason="SIGNATURE_INVALID")
    call("prepare-restore",backup,work,("--destination","synthetic-source","--confirm-destination","synthetic-source","--approval","OWNER-APPROVED-PREPARE-ONLY"),ok=False,reason="DESTINATION_MISMATCH")
    call("prepare-restore",backup,work,("--destination","synthetic-target","--confirm-destination","synthetic-wrong","--approval","OWNER-APPROVED-PREPARE-ONLY"),ok=False,reason="DESTINATION_MISMATCH")
    call("prepare-restore",backup,work,("--destination","synthetic-target","--confirm-destination","synthetic-target","--approval","OWNER-APPROVED-PREPARE-ONLY"))
    restored=next(work.iterdir())
    assert (restored/"storage-objects/private/fixture.bin").read_bytes()==obj.read_bytes()
    assert json.loads((restored/"RESTORE-PLAN.json").read_text())["status"]=="PREPARED_ONLY_NO_SQL_EXECUTED"
    for p in root.rglob("*"):
        if p.is_file(): assert (restored/p.relative_to(root)).read_bytes()==p.read_bytes()
    if cid:
        sql("postgres","create database manual_restored;")
        for name in ("schema.sql","data.sql"):
            run("docker","exec","-i",cid,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","manual_restored",input=(restored/"application"/name).read_bytes())
        result=sql("manual_restored","select breed from public.pets; select id from auth.users; select name from storage.objects; select version from supabase_migrations.schema_migrations; select relrowsecurity from pg_class where oid='public.pets'::regclass; select count(*) from pg_policies where policyname='synthetic_read';").decode().splitlines()
        assert result==["Chow Chow","7","private/fixture.bin","20261113070302","t","1"], result
        print("PASS: new portable package restored actual synthetic PG17 records, identity, metadata, history and RLS policy")
    # Failure paths do not publish a second package.
    missing=app/"history_data.sql"
    saved=missing.read_bytes()
    missing.unlink()
    call("pack",root,out,("--recipient",owner),ok=False,reason="COLLECTION_INCOMPLETE")
    missing.write_bytes(saved)
    obj.write_bytes(b"changed")
    call("pack",root,out,("--recipient",owner),ok=False)
    assert len(list(out.iterdir()))==1
    enc=backup/"application.gpg"
    saved=enc.read_bytes()
    enc.write_bytes(saved+b"x")
    call("verify",backup,work,ok=False,reason="BACKUP_CORRUPT")
    enc.write_bytes(saved)
    sig=backup/"recovery-set.json.sig"
    sig.unlink()
    call("verify",backup,work,ok=False,reason="SIGNATURE_INVALID")
    print("PASS: actual GPG signing/encryption/decryption, five components, object byte parity, missing/corrupt component, wrong signer and wrong target rejected")

    run(sys.executable,str(UTILITY),"verify",str(backup),str(work),"--source","synthetic-source","--confirm-source","synthetic-wrong","--signer",owner,ok=False,reason="SOURCE_MISMATCH")
    spec=importlib.util.spec_from_file_location("manual_recovery",UTILITY)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # The version commands alone are stubbed: actual GPG challenge, packaging,
    # inventory checks and guided prompts run. No installed remote CLI required.
    actual_tool=module.tool
    versions={"node":b"v22.0.0\n","gpg":b"gpg (GnuPG) 2.4.4\n","supabase":b"3.0.0\n","psql":b"psql (PostgreSQL) 17.7\n","pg_dump":b"pg_dump (PostgreSQL) 17.7\n"}
    def version_tool(args,*a,**kw):
        if args[1:]==["--version"]:
            return versions[args[0]]
        return actual_tool(args,*a,**kw)
    wizard=base/"wizard"
    wizard.mkdir(mode=0o700)
    listing=base/"independent-source.json"
    obj.write_bytes(b"\x00\xffDawney synthetic object")
    listing.write_text(json.dumps([{"path":"private/fixture.bin","bytes":obj.stat().st_size}]))
    # Simulated manual collection on the newly created directory; original
    # source fixture is copied only for this test.
    def simulate_collection(label):
        if label.startswith("When all manual"):
            folder=next(wizard.glob("collection-*"))
            for p in root.rglob("*"):
                if p.is_file() and p.name!="objects.json":
                    dest=folder/p.relative_to(root)
                    dest.parent.mkdir(parents=True,exist_ok=True)
                    shutil.copyfile(p,dest)
            return "COLLECTED"
        if label.startswith("Independent source-list"):
            return str(listing)
        return next(answers)
    answers=iter(["1","synthetic-source","synthetic-source",owner,owner,"READY","REVIEWED"])
    with patch.object(module,"tool",side_effect=version_tool),patch.object(module,"ask",side_effect=simulate_collection):
        module.guided(wizard)
    created=next((wizard/"backups").iterdir())
    assert len(list(wizard.glob("collection-*")))==1
    second=module.fresh_collection(wizard)
    assert len(list(wizard.glob("collection-*")))==2
    assert not list((second/"application").iterdir())
    run(sys.executable,str(UTILITY),"guide",str(wizard),input=("\n".join(["2","synthetic-source","synthetic-source",owner,str(created)])+"\n").encode())
    assert not list((wizard/"verification").iterdir())
    try:
        module.inventory_from_listing(second,listing)
        raise AssertionError("missing object accepted")
    except module.RecoveryError as exc:
        assert exc.code=="COLLECTION_INCOMPLETE"
    with patch.object(module,"tool",return_value=b"wrong-version\n"):
        try:
            module.check_ready(owner,owner,wizard)
            raise AssertionError("wrong version accepted")
        except module.RecoveryError as exc:
            assert exc.code=="VERSION_MISMATCH"
    with patch.object(module.subprocess,"run",side_effect=FileNotFoundError("PRIVATE-DO-NOT-PRINT")):
        try:
            module.tool(["missing-tool"])
            raise AssertionError("missing tool accepted")
        except module.RecoveryError as exc:
            assert exc.code=="TOOL_FAILURE" and "PRIVATE-DO-NOT-PRINT" not in str(exc)
    print("PASS: differentiated nonsecret P2 errors, guided first-run, fresh collection, independently supplied listing, real key challenge and offline verification; version commands simulated")
