#!/usr/bin/env python3
"""Disposable synthetic-only Supabase CLI rehearsal. Never accepts remote URLs or credentials."""
import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import urllib.error
import uuid

ROOT = Path(__file__).resolve().parents[2]
FROZEN = "8bb23dd31a516c16bc3e6544a25ef0cf9bb7403b"
NAGA = "11111111-0000-4000-8000-000000000077"
CAVITE = "22222222-0000-4000-8000-000000000077"
BUCKET = "clinical-attachments"
SERVICE = "cccc0000-7777-4777-8777-000000000051"
ROOM = "bbbb0000-7777-4777-8777-000000000051"
STAGE = "preflight"
checks = []
def mark(name):
    checks.append(name)
    print("PASS:", name, flush=True)
def stage(name):
    global STAGE
    STAGE = name
    print("STAGE:", name, flush=True)
def require(value, name):
    if not value:
        raise RuntimeError(name)
def uid():
    return str(uuid.uuid4())
def sha(data):
    return hashlib.sha256(data).hexdigest()
def run(args, cwd=None, data=None, timeout=180):
    try:
        p = subprocess.run(args, cwd=cwd, input=data, capture_output=True,
                           env=ENV, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError("command timeout: " + Path(args[0]).name) from None
    if p.returncode:
        # Never emit status JSON, SQL dump, credentials, raw stdout/stderr.
        msg = (p.stderr + p.stdout).decode("utf-8", "replace").lower()
        reasons = [("no space left", "disk space exhausted"), ("rate limit", "registry rate limit"),
                   ("pull access denied", "image pull denied"), ("manifest unknown", "image unavailable"),
                   ("connection refused", "connection refused"), ("permission denied", "permission denied"),
                   ("health check", "service health check failed"), ("migration", "migration execution failed"),
                   ("already exists", "object already exists"), ("unknown flag", "unsupported CLI flag"),
                   ("not found", "required resource not found"), ("does not exist", "required object missing")]
        hint = next((label for needle,label in reasons if needle in msg), "see failed stage; raw output suppressed")
        raise RuntimeError(f"{Path(args[0]).name} exit {p.returncode}: {hint}")
    return p.stdout

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        return None
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
class Stack:
    def __init__(self, work, label, migrations):
        self.dir = work / label
        self.dir.mkdir(mode=0o700)
        self.label = label
        conf = self.dir / "supabase"
        conf.mkdir()
        self.conf = conf
        # Explicit local configuration; same standard ports, stacks sequential.
        (conf/"config.toml").write_text(f'''project_id = "{label}"
[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
[db]
port = 54322
shadow_port = 54320
major_version = 17
[db.seed]
enabled = false
[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
enable_signup = true
enable_anonymous_sign_ins = false
[auth.email]
enable_signup = true
enable_confirmations = false
[storage]
enabled = true
file_size_limit = "5MiB"
[realtime]
enabled = false
[studio]
enabled = false
[local_smtp]
enabled = false
''')
        (conf/"migrations").mkdir()
        if migrations:
            for path in MIGRATIONS:
                shutil.copyfile(path,conf/"migrations"/path.name)
        self.cid = None
        self.started = False
    def cli(self,*args,timeout=180):
        return run([CLI,*args],cwd=self.dir,timeout=timeout)
    def start(self):
        # Start actual Auth, Storage, PostgREST, gateway and PG; exclude optional services.
        self.cli("start","-x","realtime,studio,mailpit,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta",timeout=420)
        self.started = True
        info = json.loads(self.cli("status","-o","json"))
        # Allow only the expected loopback address and no redirects/proxies.
        require(info.get("API_URL") in ("http://127.0.0.1:54321","http://localhost:54321"),"unexpected local API URL")
        self.anon = info.get("ANON_KEY") or info.get("PUBLISHABLE_KEY")
        self.service = info.get("SERVICE_ROLE_KEY") or info.get("SECRET_KEY")
        require(self.anon and self.service,"local API credentials missing")
        # Exact isolated container name, no external connection string.
        self.cid = run(["docker","inspect","--format","{{.Id}}","supabase_db_"+self.label]).decode().strip()
        require(re.fullmatch(r"[a-f0-9]{64}",self.cid),"local container identity missing")
        require(self.sql("show server_version_num;").startswith("17"),"PG17 required")
        print("PG major: 17; isolated container:",self.label,flush=True)
        images=run(["docker","ps","--format","{{.Names}} {{.Image}}"]).decode().splitlines()
        self.images=sorted(line.split(" ",1)[1] for line in images if line.split(" ",1)[0].endswith("_"+self.label))
        require(any("gotrue" in x or "auth" in x for x in self.images) and any("storage" in x for x in self.images) and any("postgrest" in x for x in self.images),"real service images missing")
        print("LOCAL_SERVICE_IMAGES:",",".join(self.images),flush=True)
        # Service health verified by actual HTTP operations below, not ignored.
    def stop(self):
        if self.started:
            self.cli("stop",timeout=120)
            self.started = False
    def sql(self, statement):
        return run(["docker","exec","-i",self.cid,"psql","-XAt","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],data=statement.encode()).decode().strip()
    def dump(self,path,*args):
        self.cli("db","dump",*args,"-f",str(path),timeout=180)
        require(path.is_file() and path.stat().st_size>0,"missing dump component")
    def raw_data(self,path,*args):
        path.write_bytes(run(["docker","exec",self.cid,"pg_dump","-U","postgres","-d","postgres","--data-only",*args]))
        require(path.stat().st_size>0,"empty data dump")
    def http(self,method,path,token=None,body=None,expected=(200,),raw=False,ctype="application/json",prefer=None,service=False,trace=None):
        require(path.startswith(("/auth/v1/","/rest/v1/","/storage/v1/")),"invalid local route")
        require(method not in ("GET","HEAD") or body is None,"read request must not carry a body")
        key = self.service if service else self.anon
        headers={"apikey":key,"Authorization":"Bearer "+(token or key),"Content-Type":ctype}
        if prefer: headers["Prefer"]=prefer
        data = body if isinstance(body,bytes) else (json.dumps(body).encode() if body is not None else None)
        req=urllib.request.Request("http://127.0.0.1:54321"+path,data=data,headers=headers,method=method)
        try:
            with HTTP.open(req,timeout=20) as response:
                status,b=response.status,response.read()
        except urllib.error.HTTPError as exc:
            status,b=exc.code,exc.read()
        if trace:
            # Controlled labels only; never log object path, bearer token or raw body.
            print("HTTP:",self.label,trace,method,status,flush=True)
        if status not in expected:
            # Endpoint and normalized database code only, no error payload or token.
            code = ""
            try:
                parsed = json.loads(b)
                candidate = parsed.get("code","")
                if isinstance(candidate,str) and re.fullmatch(r"[A-Z0-9_]{2,24}",candidate):
                    code = " code="+candidate
            except (ValueError, AttributeError):
                pass
            route = path.split("?")[0].split("/")
            name = route[4] if len(route)>4 and route[3]=="rpc" else route[1]+"/"+route[3]
            raise RuntimeError("unexpected HTTP status "+str(status)+" for "+method+" "+name+code)
        if raw: return b
        return json.loads(b) if b else None
    def rpc(self,name,args,token,expected=(200,)):
        return self.http("POST","/rest/v1/rpc/"+name,token,args,expected)
    def signup(self,role):
        email = role+"@example.invalid"
        self.http("POST","/auth/v1/signup",body={"email":email,"password":PASSWORD},expected=(200,201))
        return self.login(role)
    def login(self,role):
        result=self.http("POST","/auth/v1/token?grant_type=password",body={"email":role+"@example.invalid","password":PASSWORD})
        require(result.get("access_token") and result.get("user",{}).get("id"),"no real auth session")
        return result["user"]["id"],result["access_token"]
    def rows(self,table,query,token=None):
        return self.http("GET","/rest/v1/"+table+"?"+query,token)
    def insert(self,table,value,token):
        return self.http("POST","/rest/v1/"+table,token,value,(201,),prefer="return=representation")[0]

def live_session(s, actor):
    # Decode only to correlate a real signed token already obtained from Auth
    # with its actual live row; not a replacement for API signature validation.
    user,token=actor
    part=token.split(".")[1]
    claims=json.loads(base64.urlsafe_b64decode(part+"="*(-len(part)%4)))
    sid=str(uuid.UUID(claims["session_id"]))
    require(claims["sub"]==user and claims["role"]=="authenticated"
            and claims["exp"]>time.time(),"fresh Auth claims mismatch")
    require(s.sql(f"select count(*) from auth.sessions where id='{sid}' and user_id='{user}';")=="1","fresh Auth session row absent")
    return sid

def object_metadata(s):
    # Compare stable supported attributes only; Storage API generates new
    # object ID, version, ETag/timestamps on re-upload.
    return json.loads(s.sql("""select coalesce(json_agg(json_build_object(
       'bucket',bucket_id,'name',name,'owner_id',owner_id,
       'size',(metadata->>'size')::bigint,'mimetype',metadata->>'mimetype')
       order by name),'[]'::json) from storage.objects;"""))

def download_allowed(s,path,token,data,label):
    result=s.http("GET","/storage/v1/object/authenticated/"+BUCKET+"/"+path,
                  token=token,expected=(200,),raw=True,trace=label)
    require(result==data and sha(result)==sha(data),"authorized Storage byte mismatch")
    return result

def download_denied(s,path,token,label):
    # A legacy Storage 400 can wrap a real authorization denial. Verify
    # controlled error semantics, not just any malformed-request response.
    result=s.http("GET","/storage/v1/object/authenticated/"+BUCKET+"/"+path,
                  token=token,expected=(400,401,403,404),trace=label)
    require(isinstance(result,dict),"Storage denial body not structured")
    values=[str(result.get(k,"")).lower() for k in ("code","error","message","statusCode")]
    combined=" ".join(values)
    # Exact permitted semantic families only; other validation/DB errors fail.
    allowed=("object not found","nosuchkey","not_found","not found",
             "accessdenied","access denied","unauthorized","forbidden",
             "permission denied","row-level security","not authorized")
    require(any(x in combined for x in allowed),"Storage response is not a recognized access denial")
    print("DENIAL:",s.label,label,"recognized access-denied/not-found response",flush=True)

def snapshot(s):
    tables=s.sql("select schemaname||'.'||tablename from pg_tables where schemaname in ('public','clinic_private','supabase_migrations') order by 1;").splitlines()
    require(len(tables)>20,"application tables missing")
    out={}
    for name in tables:
        require(re.fullmatch(r"[a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*",name),"unexpected identifier")
        out[name]=s.sql("select count(*)||':'||coalesce(md5(string_agg(to_jsonb(t)::text, E'\\n' order by to_jsonb(t)::text)),md5('')) from "+name+" t;")
    return out

def fixture(s):
    stage("real_auth_and_owner_registration")
    people={k:s.signup(k) for k in ("owner-a","owner-b","administrator","veterinarian")}
    require(len({v[0] for v in people.values()})==4,"duplicate user UUID")
    a,ta=people["owner-a"]; b,tb=people["owner-b"]; admin,tadmin=people["administrator"]; vet,tvet=people["veterinarian"]
    owner=s.insert("owners",{"first_name":"Fixture","last_name":"Owner"},ta)
    pet=s.insert("pets",{"owner_id":owner["id"],"name":"Fixture Chow Chow","species":"Dog","breed":"Chow Chow"},ta)
    require(pet["species_id"]=="dog","taxonomy mismatch")
    require(s.rows("pets","id=eq."+pet["id"]+"&select=id",tb)==[],"cross owner read")
    mark("real Auth signup/password login, owner/pet registration and isolation")
    stage("staff_approval_branch_and_inventory")
    s.sql(f"select clinic_private.bootstrap_first_administrator('{admin}'); insert into public.staff_branch_memberships(user_id,branch_id,role,is_active) values ('{admin}','{NAGA}','administrator',true);")
    s.rpc("request_staff_access",{"p_branch":NAGA,"p_note":"synthetic"},tvet)
    revision=int(s.sql(f"select revision from public.staff_access_requests where user_id='{vet}';"))
    s.rpc("review_staff_access",{"p_target":vet,"p_action":"approve","p_role":"veterinarian","p_branches":[NAGA],"p_expected_revision":revision,"p_request_id":uid()},tadmin)
    s.rpc("assert_staff_branch",{"p_branch":NAGA},tvet)
    s.rpc("assert_staff_branch",{"p_branch":CAVITE},tvet,expected=(401,403))
    mark("actual staff request/approval and branch allow/deny")
    inv=s.rpc("create_branch_inventory_item",{"p_branch":NAGA,"p_request_id":uid(),"p_product_code":"SYNTHETIC-001","p_name":"Fixture supply","p_description":"synthetic","p_category":"supply","p_unit":"piece","p_formulation":None,"p_strength":None,"p_reorder_point":2,"p_lot":"FIXTURE","p_expiry":(dt.date.today()+dt.timedelta(days=180)).isoformat(),"p_supplier":"Fixture supplier","p_opening_units":10},tadmin)
    med=s.sql("select id from public.medicine_catalog where product_code='SYNTHETIC-001';")
    require(bool(med),"inventory row missing")
    balance=s.rpc("get_branch_inventory_balance",{"p_branch":NAGA,"p_medicine":med},tadmin)
    mark("actual pharmacy item and balance RPC")
    stage("appointment_request_and_clinical_draft")
    hours=json.dumps({d:[{"open":"08:00","close":"17:00"}] for d in ("sun","mon","tue","wed","thu","fri","sat")})
    s.sql(f"""update public.clinic_branches set booking_enabled=true,owner_approved_at=now(),owner_approved_by='{admin}' where id='{NAGA}';
update public.branch_booking_policies set is_approved=true,approved_at=now(),approved_by='{admin}',lead_minutes=0,max_advance_days=90,slot_step_minutes=30,weekly_hours='{hours}' where branch_id='{NAGA}';
update public.species_catalog set clinic_supported=true where id='dog';
insert into public.appointment_resources(id,name,branch_id) values('{ROOM}','Synthetic room','{NAGA}');
insert into public.clinic_services(id,slug,display_name,duration_minutes,is_active,owner_approved_at,owner_approved_by,published_at,branch_id) values('{SERVICE}','synthetic-dog-visit','Synthetic dog visit',30,true,now(),'{admin}',now(),'{NAGA}');
insert into public.clinic_service_species values('{SERVICE}','dog');
insert into public.clinic_service_resources(service_id,resource_id,capacity) values('{SERVICE}','{ROOM}',1);""")
    start=s.sql("select ((date_trunc('day',now() at time zone 'Asia/Manila') + interval '2 days 10 hours') at time zone 'Asia/Manila')::text;")
    args={"p_pet_id":pet["id"],"p_service_id":SERVICE,"p_resource_id":ROOM,"p_starts_at":start,"p_request_nonce":uid(),"p_concern":"Synthetic appointment","p_details":None}
    appt=s.rpc("request_service_appointment",args,ta)
    require(isinstance(appt,str) and s.rpc("request_service_appointment",args,ta)==appt,"booking replay mismatch")
    mark("actual owner appointment request and idempotent retry")
    # The frozen draft contract accepts a matching appointment. Keep the future
    # visit confirmed; never try to check in two days early.
    rev=int(s.sql(f"select lifecycle_revision from public.appointments where id='{appt}';"))
    for action in ("confirm",):
        s.rpc("transition_staff_appointment",{"p_appointment":appt,"p_branch":NAGA,"p_action":action,"p_expected_revision":rev,"p_request_id":uid()},tvet)
        rev=int(s.sql(f"select lifecycle_revision from public.appointments where id='{appt}';"))
    draftargs={"p_branch":NAGA,"p_pet":pet["id"],"p_appointment":appt,"p_request_id":uid(),"p_expected_revision":0,"p_complaint":"Synthetic draft","p_examination":"","p_assessment":"","p_plan":""}
    draft=s.rpc("save_staff_clinical_encounter_draft",draftargs,tvet)
    require(draft.get("revision")==1,"draft revision")
    require(s.rpc("save_staff_clinical_encounter_draft",draftargs,tvet)==draft,"draft replay")
    mark("actual appointment lifecycle and clinical draft receipt")
    stage("private_storage_real_bytes")
    # Frozen migration #5 requires a private bucket created through the Storage
    # API or dashboard, not a SQL insert. This is isolated operator fixture setup.
    bucket_expected={"id":BUCKET,"name":BUCKET,"public":False,"file_size_limit":5242880,
                     "allowed_mime_types":["application/pdf","image/png","image/jpeg"]}
    count=s.sql("select count(*) from storage.buckets where id='clinical-attachments';")
    require(count in ("0","1"),"invalid bucket inventory")
    if count=="0":
        s.http("POST","/storage/v1/bucket",body=bucket_expected,expected=(200,201),service=True)
    observed=json.loads(s.sql("select row_to_json(b)::text from (select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='clinical-attachments') b;"))
    require(observed["id"]==BUCKET and observed["name"]==BUCKET and observed["public"] is False
            and observed["file_size_limit"]==5242880
            and sorted(observed["allowed_mime_types"])==sorted(bucket_expected["allowed_mime_types"]),
            "private bucket fixture configuration mismatch")
    mark("private clinical bucket configured through actual Storage API")
    path="pets/"+pet["id"]+"/owners/"+a+"/"+uid()+".pdf"
    data=b"%PDF-1.4\nDawney synthetic fixture, no patient data.\n%%EOF\n"
    s.http("POST","/storage/v1/object/"+BUCKET+"/"+path,ta,data,(200,201),ctype="application/pdf")
    download_allowed(s,path,ta,data,"source-owner-get")
    # Actual application metadata, linked to the uploaded immutable object.
    attachment=s.insert("pet_attachments",{"pet_id":pet["id"],"category":"health_card",
        "object_path":path,"original_filename":"fixture.pdf","mime_type":"application/pdf","size_bytes":len(data)},ta)
    require(attachment["object_path"]==path and attachment["pet_id"]==pet["id"],"attachment relationship")
    download_allowed(s,path,ta,data,"source-owner-get-after-attachment")
    download_denied(s,path,tb,"source-unrelated-owner-get")
    mark("actual private Storage upload/download and unrelated owner denial")
    return people,owner,pet,appt,med,path,data,balance,draft

def storage_policies(s):
    # Only exact application policies on the existing managed storage.objects.
    return s.sql("""select format('CREATE POLICY %I ON storage.objects AS %s FOR %s TO %s%s%s;',policyname,permissive,cmd,
       (select string_agg(quote_ident(x::text),',') from unnest(roles) x),
       case when qual is null then '' else ' USING ('||qual||')' end,
       case when with_check is null then '' else ' WITH CHECK ('||with_check||')' end)
       from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'clinical%' order by policyname;""")
def package(s,work,f):
    stage("coordinated_synthetic_collection")
    people,owner,pet,appt,med,path,data,balance,draft=f
    before=snapshot(s)
    root=work/"collection"; out=work/"encrypted"; prepared=work/"prepared"; verify=work/"verify"
    for p in (root,out,prepared,verify): p.mkdir(mode=0o700)
    for n in ("application","auth-identities","storage-metadata","storage-objects","configuration"): (root/n).mkdir()
    app=root/"application"
    s.dump(app/"roles.sql","--role-only")
    s.dump(app/"schema.sql","--schema","public,clinic_private")
    s.dump(app/"data.sql","--schema","public,clinic_private","--data-only","--use-copy")
    s.dump(app/"history_schema.sql","--schema","supabase_migrations")
    s.dump(app/"history_data.sql","--schema","supabase_migrations","--data-only","--use-copy")
    # Local identical-service-version synthetic fixture only, not a managed export recipe.
    # Restore supported account records, not old sessions/tokens.
    s.raw_data(root/"auth-identities/auth.sql","--table=auth.users","--table=auth.identities")
    s.raw_data(root/"storage-metadata/storage.sql","--table=storage.buckets","--table=storage.objects")
    pol=storage_policies(s)
    require("clinical" in pol,"storage policy collection absent")
    (app/"managed_changes.sql").write_text(pol+"\n")
    # Independent DB inventory vs real authenticated Storage download.
    listed=json.loads(s.sql("select coalesce(json_agg(json_build_object('path',bucket_id||'/'||name,'bytes',(metadata->>'size')::bigint) order by name),'[]'::json) from storage.objects;"))
    require(listed==[{"path":BUCKET+"/"+path,"bytes":len(data)}],"source object listing mismatch")
    obj=root/"storage-objects"/BUCKET/path
    obj.parent.mkdir(parents=True)
    obj.write_bytes(s.http("GET","/storage/v1/object/authenticated/"+BUCKET+"/"+path,people["owner-a"][1],raw=True))
    require(obj.read_bytes()==data,"collection object mismatch")
    listed[0]["sha256"]=sha(obj.read_bytes())
    (root/"storage-metadata/objects.json").write_text(json.dumps(listed))
    bucket=json.loads(s.sql("select row_to_json(b)::text from (select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='clinical-attachments') b;"))
    require(bucket["public"] is False,"private bucket required")
    config={"source":"synthetic-source","cutoff_utc":dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),"postgres_major":17,"cli_version":"3.0.0","auth_storage_versions":"same pinned local CLI runtime; user/identity rows only; sessions excluded; no managed equivalence","settings":{k:"isolated fixture only" for k in ("auth","storage","extensions","realtime","functions","network","secrets_reconfiguration")},"coverage_attestation":"operator-reviewed-quiescent-export"}
    meta=object_metadata(s)
    require(meta==[{"bucket":BUCKET,"name":path,"owner_id":people["owner-a"][0],"size":len(data),"mimetype":"application/pdf"}],"source object metadata mismatch")
    config["settings"]["storage"]=json.dumps({"bucket":bucket,"object_metadata":meta})
    (root/"configuration/inventory.json").write_text(json.dumps(config))
    require(before==snapshot(s),"source application changed during collection")
    mark("actual local logical collection, independent object listing and stable application snapshot")
    stage("existing_signed_recovery_utility")
    run(["gpg","--batch","--pinentry-mode","loopback","--passphrase","","--quick-generate-key","Fixture <fixture@example.invalid>","rsa2048","sign,encr","0"])
    listing=run(["gpg","--with-colons","--list-keys"]).decode().splitlines()
    fingerprint=next(l.split(":")[9] for l in listing if l.startswith("fpr:"))
    utility=str(ROOT/"scripts/recovery/manual-supabase-recovery.py")
    def call(action,inp,dest,*extra):
        run([sys.executable,utility,action,str(inp),str(dest),"--source","synthetic-source","--confirm-source","synthetic-source","--signer",fingerprint,*extra])
    call("pack",root,out,"--recipient",fingerprint)
    backup=next(out.iterdir())
    copy=work/"independent-copy"; shutil.copytree(backup,copy)
    call("verify",copy,verify)
    call("prepare-restore",copy,prepared,"--destination","synthetic-target","--confirm-destination","synthetic-target","--approval","OWNER-APPROVED-PREPARE-ONLY")
    result=next(prepared.iterdir())
    for src in root.rglob("*"):
        if src.is_file(): require(src.read_bytes()==(result/src.relative_to(root)).read_bytes(),"prepared component mismatch")
    mark("frozen signed five-component pack, separate encrypted copy and verified preparation")
    return result,before,bucket,pol

def restore(s,package_info,f):
    stage("clean_independent_destination_import")
    prepared,before,bucket,pol=package_info
    people,owner,pet,appt,med,path,data,balance,draft=f
    require(s.sql("select count(*) from pg_tables where schemaname='clinic_private';")=="0","destination not clean")
    require(s.sql("select count(*) from auth.users;")=="0","destination identities not empty")
    # Same local PG17/Auth/Storage versions. No hosted connection. Restore logical
    # roles/schema then data in a single transaction, using documented replica mode
    # only in this disposable import session; never disable runtime RLS.
    s.sql("create extension if not exists btree_gist with schema extensions;")
    app=prepared/"application"
    # Local CLI initializes migration ledger even in some empty projects; do not
    # silently overwrite it. Restore its schema only if absent; assert empty otherwise.
    history_exists=s.sql("select to_regclass('supabase_migrations.schema_migrations') is not null;")=="t"
    if history_exists:
        require(s.sql("select count(*) from supabase_migrations.schema_migrations;")=="0","destination history not empty")
    sequence=[app/"roles.sql",app/"schema.sql"]
    if not history_exists: sequence.append(app/"history_schema.sql")
    sql=b"BEGIN;\n"+b"\n".join(x.read_bytes() for x in sequence)+b"\nSET LOCAL session_replication_role=replica;\n"
    sql+=b"\n".join(x.read_bytes() for x in [prepared/"auth-identities/auth.sql",app/"data.sql",app/"history_data.sql"])+b"\nSET LOCAL session_replication_role=origin;\n"+(app/"managed_changes.sql").read_bytes()+b"\nCOMMIT;\n"
    run(["docker","exec","-i",s.cid,"psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],data=sql,timeout=180)
    require(before==snapshot(s),"application/history row fingerprint mismatch")
    require(storage_policies(s)==pol,"storage policy definitions mismatch")
    require(s.sql("select count(*) from auth.users;")=="4","auth identities count mismatch")
    require(s.sql("select count(*) from auth.identities;")=="4","auth identity provider count mismatch")
    require(s.sql("select count(*) from auth.sessions;")=="0","old sessions unexpectedly restored")
    s.sql("notify pgrst, 'reload schema';")
    time.sleep(2)
    mark("clean destination application rows/history, identity counts and Storage policy parity")
    stage("fresh_auth_and_storage_restore")
    fresh={k:s.login(k) for k in people}
    require(all(fresh[k][0]==people[k][0] for k in people),"Auth UUID mismatch after fresh login")
    require(len({live_session(s,actor) for actor in fresh.values()})==len(fresh),"distinct fresh sessions required")
    require(all(fresh[k][1]!=people[k][1] for k in people),"old access token reused")
    mark("fresh real Auth for four restored UUIDs and distinct live sessions")
    ta=fresh["owner-a"][1]; tb=fresh["owner-b"][1]; admin=fresh["administrator"][1]; vet=fresh["veterinarian"][1]
    s.http("POST","/storage/v1/bucket",body=bucket,expected=(200,201),service=True)
    contents=(prepared/"storage-objects"/BUCKET/path).read_bytes()
    require(contents==data,"prepared object content mismatch")
    s.http("POST","/storage/v1/object/"+BUCKET+"/"+path,token=ta,body=contents,expected=(200,201),ctype="application/pdf",trace="restored-owner-upload")
    inventory=json.loads((prepared/"configuration/inventory.json").read_text())
    expected_meta=json.loads(inventory["settings"]["storage"])["object_metadata"]
    require(object_metadata(s)==expected_meta,"restored stable object metadata mismatch")
    mark("restored Storage bucket path owner size and MIME match signed collection")
    download_allowed(s,path,ta,contents,"restored-owner-get")
    mark("restored authorized Storage download and SHA256 byte parity")
    download_denied(s,path,tb,"restored-unrelated-owner-get")
    mark("restored unrelated-owner Storage denial")
    require(s.sql("select count(*) from storage.objects;")=="1","restored object count")
    newbucket=json.loads(s.sql("select row_to_json(b)::text from (select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='clinical-attachments') b;"))
    require(bucket==newbucket,"bucket configuration mismatch")
    require(s.rows("pet_attachments","object_path=eq."+path+"&select=pet_id,object_path,size_bytes,mime_type",ta)==[{"pet_id":pet["id"],"object_path":path,"size_bytes":len(data),"mime_type":"application/pdf"}],"restored attachment relationship mismatch")
    require(s.rows("pet_attachments","object_path=eq."+path+"&select=id",tb)==[],"restored attachment metadata leaked")
    require(s.rows("pets","id=eq."+pet["id"]+"&select=id",ta)==[{"id":pet["id"]}],"owner restored read")
    require(s.rows("pets","id=eq."+pet["id"]+"&select=id",tb)==[],"restored owner isolation")
    s.rpc("assert_staff_branch",{"p_branch":NAGA},vet)
    s.rpc("assert_staff_branch",{"p_branch":CAVITE},vet,expected=(401,403))
    require(s.rpc("get_branch_inventory_balance",{"p_branch":NAGA,"p_medicine":med},admin)==balance,"restored stock balance mismatch")
    s.rpc("read_staff_patient_chart",{"p_branch":NAGA,"p_pet":pet["id"],"p_section":"appointments"},vet)
    require(s.sql(f"select count(*) from public.clinical_encounter_drafts where appointment_id='{appt}' and revision=1;")=="1","restored clinical draft revision mismatch")
    require(s.rows("appointments","id=eq."+appt+"&select=id,status",ta)==[{"id":appt,"status":"confirmed"}],"restored appointment")
    mark("fresh real Auth, same UUID, actual Storage bytes/metadata/private access and backend API after restore")

def main():
    global ENV,CLI,MIGRATIONS,PASSWORD
    require(os.environ.get("GITHUB_ACTIONS")=="true" and os.environ.get("RUNNER_ENVIRONMENT")=="github-hosted","only disposable standard hosted runner")
    payload=json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    require(payload["repository"]["full_name"]=="cmlagatuz/dawney-clinic" and payload["repository"]["private"] is False,"public approved repository required")
    os.umask(0o077)
    # No inherited provider tokens, proxies, PG vars or credentials.
    ENV={"PATH":os.environ["PATH"],"LANG":"C.UTF-8","LC_ALL":"C.UTF-8","CI":"true","GITHUB_ACTIONS":"true"}
    base=Path(os.environ["RUNNER_TEMP"])
    with tempfile.TemporaryDirectory(prefix="dawney-fullstack-",dir=base) as temp:
        work=Path(temp); home=work/"home"; home.mkdir(); gnupg=work/"gnupg"; gnupg.mkdir(mode=0o700)
        ENV.update(HOME=str(home),GNUPGHOME=str(gnupg),TMPDIR=str(work))
        stage("runtime_and_frozen_source")
        available=int(re.search(r"MemAvailable:\s+(\d+)",Path("/proc/meminfo").read_text())[1])*1024
        free=shutil.disk_usage(work).free
        print(f"CPU={os.cpu_count()} RAM_AVAILABLE_MIB={available//2**20} WORK_FREE_MIB={free//2**20}",flush=True)
        require(os.cpu_count()>=2 and available>=7*2**30 and free>=10*2**30,"insufficient CI resources for bounded reduced service stack")
        print("Docker server:",run(["docker","version","--format","{{.Server.Version}}"]).decode().strip(),flush=True)
        dockerroot=Path(run(["docker","info","--format","{{.DockerRootDir}}"]).decode().strip())
        print("DOCKER_FREE_MIB=",shutil.disk_usage(dockerroot).free//2**20,flush=True)
        require(shutil.disk_usage(dockerroot).free>=10*2**30,"insufficient Docker image space")
        for tool in ("gpg","node","curl","tar"): require(shutil.which(tool),tool+" unavailable")
        require(run(["git","rev-parse","HEAD:web"],cwd=ROOT).decode().strip()=="f5dc0a98bf82fc75db7a5bf144f23236523505b8","web tree changed")
        require(run(["git","rev-parse","HEAD:supabase"],cwd=ROOT).decode().strip()=="8750a8be478c56acc5b6e9740946138f0b2f39f7","migration tree changed")
        require(run(["git","rev-parse","HEAD:scripts/recovery"],cwd=ROOT).decode().strip()=="f105bb506be210707683eb5e4a988383b0ee49ad","recovery tree changed")
        MIGRATIONS=[]
        for line in (ROOT/"docs/RC2_MIGRATION_BLOBS.tsv").read_text().splitlines():
            if line.startswith("#") or not line: continue
            _,mode,blob,path=line.split("\t")
            require(mode=="100644" and run(["git","hash-object",path],cwd=ROOT).decode().strip()==blob,"migration blob mismatch")
            MIGRATIONS.append(ROOT/path)
        require(len(MIGRATIONS)==23,"migration count")
        mark("actual free public runner resources, Docker and exact frozen source pins")
        stage("pinned_cli_acquisition")
        archive=work/"cli.tar.gz"
        run(["curl","--fail","--silent","--show-error","--location","--max-time","90","--output",str(archive),"https://github.com/supabase/cli/releases/download/v3.0.0/supabase_3.0.0_linux_amd64.tar.gz"])
        require(sha(archive.read_bytes())=="eeb61edcd59a4735fcb5e58596574f25d03d420efca779f43ddb307e1cc5c754","official CLI archive checksum mismatch")
        run(["tar","-xzf",str(archive),"-C",str(work),"supabase"])
        CLI=str(work/"supabase")
        require(run([CLI,"--version"]).decode().strip()=="3.0.0","CLI version")
        mark("official CLI v3.0.0 verified")
        PASSWORD=secrets.token_urlsafe(32)+"Aa1!"
        src=Stack(work,"dawney-synthetic-source",True)
        dest=None
        try:
            stage("source_real_services_and_migrations")
            src.start()
            expected=[x.name.split("_")[0] for x in MIGRATIONS]
            require(src.sql("select version from supabase_migrations.schema_migrations order by version;").splitlines()==expected,"migration history mismatch")
            mark("real local PG17 and all 23 recorded migrations")
            fixture_data=fixture(src)
            t=time.monotonic()
            pack=package(src,work,fixture_data)
            backup_seconds=round(time.monotonic()-t,2)
            source_id=src.cid
            source_images=src.images
            src.stop()
            dest=Stack(work,"dawney-synthetic-target",False)
            stage("destination_real_services")
            t=time.monotonic()
            dest.start()
            require(dest.cid!=source_id,"same database container")
            require(dest.images==source_images,"source/destination service version mismatch")
            restore(dest,pack,fixture_data)
            print("SYNTHETIC_BACKUP_SECONDS=",backup_seconds,"RESTORE_AND_START_SECONDS=",round(time.monotonic()-t,2),flush=True)
            print("FULLSTACK_SYNTHETIC_SCOPED_PASS",flush=True)
        finally:
            # Stop only our named isolated stacks, never remote. Runner discards workspace.
            if dest: dest.stop()
            src.stop()

if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        # Only controlled stage and error label; no raw provider or local secret data.
        print("BLOCKED/FAILED:",STAGE, type(exc).__name__,str(exc) if isinstance(exc,RuntimeError) else "unexpected local runtime error",flush=True)
        print("Completed checks:",len(checks),flush=True)
        sys.exit(1)
