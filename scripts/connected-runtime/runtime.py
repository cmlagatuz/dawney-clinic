#!/usr/bin/env python3
"""Same-job synthetic browser runtime preflight. Never invokes connected scenarios by default."""
import datetime as dt
import importlib.util
import ipaddress
import struct
import json
import os
from pathlib import Path
import re
import secrets
import socket
import socketserver
import threading
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import time
from zoneinfo import ZoneInfo
from receipts import Collector, authorize, execute

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location("accepted",ROOT/"scripts/fullstack-synthetic/rehearse.py")
b=importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
A="9c71619083f61ecdd208223ed2334ca3fa3801a9"
C="2bb4818fe35a0048b64697c91ca90e5c58503aad"
H="8bb23dd31a516c16bc3e6544a25ef0cf9bb7403b"
WEB="f5dc0a98bf82fc75db7a5bf144f23236523505b8"
ALIAS="dawney-rc2-synthetic.supabase.co"
NS="dawney-rc2-browser"
NET="dawney-rc2-internal"
ROLES=("ownerNew","ownerOther","applicant","administrator","veterinarian","receptionist","accountant")
def require(ok,msg): b.require(ok,msg)
def run(args,**kw): return b.run(args,**kw)
def mark(msg): b.mark(msg)
def sqlstr(x):
    require(isinstance(x,str) and "'" not in x and "\\" not in x,"unsafe synthetic literal")
    return "'"+x+"'"
def git(*args,cwd=ROOT): return run(["git",*args],cwd=cwd).decode().strip()
def secure_write(path,data):
    with path.open("xb") as f: f.write(data)
    require(path.stat().st_mode&0o777==0o600,"private file mode")
def packet_write(path,data): secure_write(path,json.dumps(data).encode())

class Stack(b.Stack):
    def __init__(self,work):
        super().__init__(work,"dawney-connected-synthetic",True)
        p=self.conf/"config.toml"
        s=p.read_text().replace("enable_confirmations = false","enable_confirmations = true\nmax_frequency = \"1s\"\notp_length = 6")
        s=s.replace("[local_smtp]\nenabled = false","[local_smtp]\nenabled = true\nport = 54324\nadmin_email = \"clinic@example.test\"\nsender_name = \"Dawney Synthetic\"")
        s+="\n[auth.rate_limit]\nemail_sent = 100\n[auth.email.template.confirmation]\nsubject = \"Dawney synthetic signup confirmation\"\ncontent_path = \"./supabase/templates/confirmation.html\"\n"
        p.write_text(s)
        templates=self.conf/"templates";templates.mkdir()
        template=templates/"confirmation.html"
        template.write_text("Dawney synthetic confirmation code: {{ .Token }}\n")
        # CLI bind-mounts the static nonsecret template into Kong. Its different
        # container UID cannot read a host-owned 0600 file from our private umask.
        template.chmod(0o644)
        require(templates.stat().st_mode&0o777==0o700,"template parent not private")
    def cli(self,*args,timeout=180):
        if args[0]=="start":
            args=list(args)
            args[args.index("-x")+1]=args[args.index("-x")+1].replace("mailpit,","")
            args+=["--network-id",NET]
            # Sanitize start failure before returning; classify real connection
            # failures separately from application migration SQL failures.
            try:
                proc=subprocess.run([b.CLI,*args],cwd=self.dir,env=b.ENV,capture_output=True,timeout=timeout)
            except subprocess.TimeoutExpired:
                self.relays.diagnostics()
                raise RuntimeError("isolated CLI start exceeded its bounded timeout") from None
            if proc.returncode:
                raw=(proc.stdout+proc.stderr).decode("utf-8","replace")
                low=raw.lower()
                clues=[label for needle,label in (
                    ("connection refused","connection refused"),("connect:","connection error"),
                    ("timeout","timeout"),("timed out","timed out"),("no route to host","no route"),
                    ("health check","health check"),("migration","migration"),("permission denied","permission denied"),
                    ("failed to parse","config parse"),("no such host","DNS lookup"),
                    ("port is already allocated","port collision"),("network not found","network missing"),
                    ("dial tcp","TCP dial"),("database system is ready","database ready"),("failed to connect","DB connect")
                ) if needle in low]
                codes=sorted(set(re.findall(r"SQLSTATE[\s:=]+([A-Z0-9]{5})",raw,re.I)))
                versions=sorted(set(re.findall(r"\b(202611[0-9]{8})_[a-z0-9_]+\.sql\b",raw)))
                print("CLI_START_FAILURE_CLASSES:",",".join(clues),"SQLSTATES:",",".join(codes),
                      "MIGRATION_VERSIONS:",",".join(versions[-4:]),flush=True)
                self.relays.diagnostics()
                raise RuntimeError("isolated CLI startup failed; classified diagnostics above")
            return proc.stdout
        return super().cli(*args,timeout=timeout)

class LoopbackRelays:
    """Observe exact isolated containers throughout CLI startup; never trust a
    TCP accept alone as proof that the local PostgreSQL relay works."""
    ENDPOINTS={"db":(54322,5432),"kong":(54321,8000),"inbucket":(54324,8025)}
    def __init__(self,label,subnet):
        self.label=label;self.subnet=ipaddress.ip_network(subnet)
        self.stop=threading.Event();self.ready=threading.Event();self.servers={}
        self.thread=threading.Thread(target=self.watch,daemon=True)
        self.error=None;self.states={};self.lock=threading.Lock()
    def start(self): self.thread.start()
    @staticmethod
    def reachable(port):
        try:
            with socket.create_connection(("127.0.0.1",port),timeout=0.2):return True
        except OSError:return False
    @staticmethod
    def protocol(host,port,name):
        try:
            with socket.create_connection((host,port),timeout=0.6) as sock:
                sock.settimeout(0.6)
                if name=="db":
                    sock.sendall(struct.pack("!II",8,80877103))
                    return sock.recv(1) in (b"S",b"N")
                sock.sendall(b"GET / HTTP/1.0\r\nHost: localhost\r\n\r\n")
                return sock.recv(12).startswith(b"HTTP/")
        except OSError:return False
    def record(self,name,state):
        with self.lock:
            if self.states.get(name)!=state:
                self.states[name]=state
                print("LOCAL_LIFECYCLE:",name,*state,flush=True)
    def diagnostics(self):
        with self.lock:
            for name in self.ENDPOINTS:
                print("LOCAL_FINAL:",name,*self.states.get(name,("not-observed",)),flush=True)
        print("LOCAL_WATCHER:",self.error or ("all-protocols-ready" if self.ready.is_set() else "not-ready"),flush=True)
    def inspect(self,name):
        try:
            p=subprocess.run(["docker","inspect","supabase_"+name+"_"+self.label],
                env=b.ENV,capture_output=True,timeout=8)
        except subprocess.TimeoutExpired:
            return None,"inspect-timeout"
        if p.returncode:return None,"absent"
        items=json.loads(p.stdout)
        require(len(items)==1 and items[0]["Name"]=="/supabase_"+name+"_"+self.label,"unexpected relay container identity")
        return items[0],None
    def bind(self,name,local,target,remote):
        class Handler(socketserver.BaseRequestHandler):
            def handle(self):
                import selectors
                try:
                    with socket.create_connection(self.server.target,timeout=10) as remote_sock:
                        self.request.settimeout(120);remote_sock.settimeout(120)
                        with selectors.DefaultSelector() as sel:
                            sel.register(self.request,selectors.EVENT_READ,remote_sock)
                            sel.register(remote_sock,selectors.EVENT_READ,self.request)
                            while True:
                                ready=sel.select(timeout=120)
                                if not ready:return
                                for key,_ in ready:
                                    data=key.fileobj.recv(65536)
                                    if not data:return
                                    key.data.sendall(data)
                except OSError:pass
        class Server(socketserver.ThreadingTCPServer):
            daemon_threads=True
            allow_reuse_address=True
        try:srv=Server(("127.0.0.1",local),Handler)
        except OSError:return False
        srv.target=(target,remote)
        thread=threading.Thread(target=srv.serve_forever,daemon=True)
        thread.start()
        self.servers[name]=(srv,thread)
        print("LOCAL_PORT:",name,"fixed loopback relay bound",flush=True)
        return True
    def watch(self):
        try:
            while not self.stop.is_set():
                qualified=set()
                for name,(local,remote) in self.ENDPOINTS.items():
                    item,reason=self.inspect(name)
                    if item is None:
                        self.record(name,(reason,))
                        continue
                    state=item["State"]
                    lifecycle=state.get("Status","unknown")
                    health=state.get("Health",{}).get("Status","none")
                    require(lifecycle in ("created","running","paused","restarting","removing","exited","dead"),"unknown lifecycle")
                    require(health in ("starting","healthy","unhealthy","none"),"unknown health")
                    if not state["Running"]:
                        self.record(name,(lifecycle,health,"not-running"))
                        continue
                    networks=item["NetworkSettings"]["Networks"]
                    require(not item["HostConfig"]["Privileged"] and set(networks).issubset({NET}),"relay container alternate network or privilege")
                    target=networks.get(NET,{}).get("IPAddress")
                    if not target:
                        self.record(name,(lifecycle,health,"awaiting-internal-address"))
                        continue
                    require(set(networks)=={NET} and ipaddress.ip_address(target) in self.subnet,"relay target not exclusively on exact internal network")
                    if name in self.servers:
                        require(self.servers[name][0].target==(target,remote),"relay target changed during startup")
                    elif not self.reachable(local):
                        self.bind(name,local,target,remote)
                    direct=self.protocol(target,remote,name)
                    forwarded=self.protocol("127.0.0.1",local,name)
                    pg="not-applicable"
                    if name=="db" and direct and forwarded:
                        try:
                            result=subprocess.run(["docker","exec","supabase_db_"+self.label,
                                "pg_isready","-h","127.0.0.1","-p","5432","-U","postgres","-d","postgres","-t","1"],
                                env=b.ENV,capture_output=True,timeout=4)
                            pg={0:"pg-accepting",1:"pg-rejecting",2:"pg-no-response",3:"pg-invalid"}.get(result.returncode,"pg-check-failed")
                        except subprocess.TimeoutExpired:pg="pg-check-timeout"
                    transport="fixed-relay" if name in self.servers else "docker-local"
                    self.record(name,(lifecycle,health,transport,"direct-ok" if direct else "direct-pending",
                        "local-ok" if forwarded else "local-pending",pg))
                    if direct and forwarded and (name!="db" or pg=="pg-accepting"):
                        qualified.add(name)
                if qualified==set(self.ENDPOINTS):
                    self.ready.set()
                    return
                self.stop.wait(.25)
        except Exception as exc:
            self.error="watcher-"+type(exc).__name__
            self.diagnostics()
    def wait_ready(self):
        require(self.ready.wait(20) and self.error is None,"fixed host relays did not qualify")
        self.diagnostics()
        mark("actual PostgreSQL accepting connections and all three fixed local transports respond")
    def close(self):
        self.stop.set();self.thread.join(timeout=12)
        for srv,thread in self.servers.values():
            srv.shutdown();srv.server_close();thread.join(timeout=5)

def docker_network(s):
    net=json.loads(run(["docker","network","inspect",NET]))[0]
    require(net["Internal"] is True and net["Driver"]=="bridge","Docker network not internal")
    members=net["Containers"]
    require(len(members)==6,"expected exactly six isolated service containers")
    for cid,m in members.items():
        item=json.loads(run(["docker","inspect",cid]))[0]
        require(item["Name"].startswith("/supabase_") and item["Name"].endswith("_"+s.label),"unexpected network member")
        require(set(item["NetworkSettings"]["Networks"])=={NET} and not item["HostConfig"]["Privileged"],"service has alternate network or privilege")
        pid=str(item["State"]["Pid"])
        for family in ("-4","-6"):
            routes=run(["sudo","nsenter","-t",pid,"-n","ip",family,"route","show","default"]).strip()
            require(not routes,"service has external default route")
    require(run(["docker","exec",s.cid,"getent","ahostsv4","kong"]).strip(),"internal DNS positive control failed")
    run(["docker","exec",s.cid,"bash","-c","command -v timeout >/dev/null && command -v getent >/dev/null"])
    # Actual negative controls from real PG container; external DNS and TEST-NET
    # must not work, not merely Docker configuration metadata.
    for cmd in (["getent","ahostsv4","example.com"],
                ["timeout","2","bash","-c","echo >/dev/tcp/192.0.2.1/443"]):
        p=subprocess.run(["docker","exec",s.cid,*cmd],env=b.ENV,capture_output=True,timeout=10)
        require(p.returncode!=0,"container external reachability")
    mark("six actual service containers on internal bridge only, no IPv4/IPv6 default routes; external DNS/IP denied")

def certs(work):
    # Private CA and leaf only for ephemeral isolated namespace.
    run(["openssl","req","-x509","-newkey","rsa:2048","-nodes","-days","1","-subj","/CN=Dawney isolated runtime CA","-addext","basicConstraints=critical,CA:TRUE","-addext","keyUsage=critical,keyCertSign,cRLSign","-keyout",str(work/"ca.key"),"-out",str(work/"ca.crt")])
    for name,host in (("leaf",ALIAS),("wrong","wrong.example.test")):
        run(["openssl","req","-new","-newkey","rsa:2048","-nodes","-subj","/CN="+host,"-keyout",str(work/(name+".key")),"-out",str(work/(name+".csr"))])
        ext=work/(name+".ext")
        ext.write_text("basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:"+host+"\n")
        run(["openssl","x509","-req","-days","1","-in",str(work/(name+".csr")),"-CA",str(work/"ca.crt"),"-CAkey",str(work/"ca.key"),"-CAcreateserial","-extfile",str(ext),"-out",str(work/(name+".crt"))])
    run(["openssl","verify","-CAfile",str(work/"ca.crt"),"-verify_hostname",ALIAS,str(work/"leaf.crt")])
    home=work/"browser-home";home.mkdir(mode=0o700)
    db=home/".pki/nssdb";db.mkdir(parents=True,mode=0o700)
    run(["certutil","-N","--empty-password","-d","sql:"+str(db)])
    run(["certutil","-A","-d","sql:"+str(db),"-n","Dawney ephemeral CA","-t","C,,","-i",str(work/"ca.crt")])
    return home

def create_namespace(work):
    run(["sudo","ip","netns","add",NS])
    run(["sudo","ip","-n",NS,"link","set","lo","up"])
    run(["sudo","ip","netns","exec",NS,"sysctl","-w","net.ipv4.ip_unprivileged_port_start=0"])
    conf=Path("/etc/netns")/NS
    run(["sudo","mkdir","-p",str(conf)])
    for filename,contents in (("hosts","127.0.0.1 localhost "+ALIAS+"\n::1 localhost\n"),
                              ("resolv.conf","nameserver 192.0.2.1\noptions timeout:1 attempts:1\n"),
                              ("nsswitch.conf",Path("/etc/nsswitch.conf").read_text().replace(next(x for x in Path("/etc/nsswitch.conf").read_text().splitlines() if x.startswith("hosts:")),"hosts: files dns"))):
        run(["sudo","tee",str(conf/filename)],data=contents.encode())
    links=json.loads(run(["sudo","ip","-n",NS,"-j","link","show"]))
    require([x["ifname"] for x in links]==["lo"],"namespace has non-loopback interface")
    for family in ("-4","-6"):
        require(not run(["sudo","ip","-n",NS,family,"route","show","default"]).strip(),"namespace has default route")
    mark("actual Linux network namespace with only loopback and no default route")

def isolated_prefix(work,home):
    # Unprivileged process, no supplementary docker group or capability escalation.
    return ["sudo","ip","netns","exec",NS,"setpriv","--reuid",str(os.getuid()),"--regid",str(os.getgid()),"--clear-groups","--no-new-privs","env","-i",
            "PATH="+b.ENV["PATH"],"HOME="+str(home),"TMPDIR="+str(work),"LANG=C.UTF-8","LC_ALL=C.UTF-8","CI=true","NODE_EXTRA_CA_CERTS="+str(work/"ca.crt")]
def launch(args):
    p=subprocess.Popen(args,env=b.ENV,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,start_new_session=True)
    import selectors
    sel=selectors.DefaultSelector()
    try:
        sel.register(p.stdout,selectors.EVENT_READ)
        require(sel.select(timeout=15),"relay readiness timeout")
        require(p.stdout.readline().strip()==b"RELAY_READY","relay startup failed")
        return p
    except BaseException:
        p.terminate();p.wait(timeout=10)
        raise
    finally: sel.close()

def isolated_node(prefix,cloud,args,timeout=90):
    proc=subprocess.run(prefix+["node",str(HERE/"probe.mjs"),*args],cwd=cloud,
                        env=b.ENV,capture_output=True,timeout=timeout)
    # Only exact controlled marker lines, never raw stdout/stderr or mail/OTP.
    for line in proc.stdout.decode("utf-8","replace").splitlines():
        if re.fullmatch(r"(PASS|PROBE_BLOCKED|MAIL_SHAPE): [A-Za-z0-9 ,.:_()/=-]{1,200}",line):
            print(line,flush=True)
    require(proc.returncode==0,"isolated Node probe refused; controlled marker above")
    return proc.stdout.decode("utf-8","replace")

def qualify_mail_template(s):
    """Prove the actual local Auth and Kong template configuration before signup."""
    def exact_container(name):
        item=json.loads(run(["docker","inspect","supabase_"+name+"_"+s.label]))[0]
        require(item["Name"]=="/supabase_"+name+"_"+s.label and item["State"]["Running"]
                and set(item["NetworkSettings"]["Networks"])=={NET}
                and not item["HostConfig"]["Privileged"],"mail service identity/isolation mismatch")
        return item
    auth=exact_container("auth")
    kong=exact_container("kong")
    env=dict(line.split("=",1) for line in auth["Config"]["Env"] if "=" in line)
    endpoint="http://supabase_kong_"+s.label+":8088/email/confirmation.html"
    require(env.get("GOTRUE_MAILER_SUBJECTS_CONFIRMATION")=="Dawney synthetic signup confirmation",
            "Auth configured signup subject mismatch")
    require(env.get("GOTRUE_MAILER_TEMPLATES_CONFIRMATION")==endpoint,"Auth configured internal template route mismatch")
    require(env.get("GOTRUE_SMTP_HOST")=="supabase_inbucket_"+s.label
            and env.get("GOTRUE_SMTP_PORT")=="1025","Auth SMTP is not fixed local Mailpit")
    source=s.conf/"templates/confirmation.html"
    matches=[m for m in kong["Mounts"] if m.get("Destination")=="/home/kong/templates/email/confirmation.html"]
    require(len(matches)==1 and matches[0].get("Source")==str(source),"Kong exact template bind mismatch")
    require(source.stat().st_mode&0o777==0o644,"static template unreadable")
    address=ipaddress.ip_address(kong["NetworkSettings"]["Networks"][NET]["IPAddress"])
    require(address in s.relays.subnet,"Kong template outside internal subnet")
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),b.NoRedirect())
    try:
        with opener.open("http://"+str(address)+":8088/email/confirmation.html",timeout=8) as response:
            require(response.status==200 and response.read(4096)==source.read_bytes(),
                    "Kong did not serve exact static OTP template")
    except urllib.error.HTTPError as exc:
        raise RuntimeError("Kong internal template HTTP status "+str(exc.code)) from None
    mark("actual Auth subject and fixed SMTP config, exact Kong internal OTP template served")

def host_mail_check():
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),b.NoRedirect())
    with opener.open("http://127.0.0.1:54324/api/v1/messages?limit=100",timeout=8) as response:
        payload=json.load(response)
    require(isinstance(payload.get("messages"),list) and isinstance(payload.get("total"),int),"host Mailpit response shape")
    # No raw message or recipient. Check actual mail service independently
    # of namespace relay and the exact CLOUD parser.
    print("HOST_MAIL: messages="+str(len(payload["messages"]))+" total="+str(payload["total"]),flush=True)

def seed(s,work,cloud,prefix,pub):
    stage=b.stage
    stage("real_mail_and_seed_actors")
    runid="run-"+secrets.token_hex(6)
    accounts={k:{"email":k.lower()+"-"+runid+"@example.test","password":secrets.token_urlsafe(30)+"Aa1!"} for k in ROLES}
    scratch=work/"mail-context.json"
    packet_write(scratch,{"runId":runid})
    actual={}
    for role in ROLES:
        if role in ("ownerNew","applicant"): continue
        account=accounts[role]
        signup=s.http("POST","/auth/v1/signup",body=account,expected=(200,201))
        require(not signup.get("access_token"),"signup unexpectedly auto-confirmed")
        host_mail_check()
        output=isolated_node(prefix,cloud,["otp",str(cloud),str(scratch),account["email"]],timeout=60)
        codes=[line for line in output.splitlines() if re.fullmatch(r"[0-9]{6,8}",line)]
        require(len(codes)==1,"actual Mailpit OTP format")
        otp=codes[0]
        s.http("POST","/auth/v1/verify",body={"email":account["email"],"token":otp,"type":"signup"})
        result=s.http("POST","/auth/v1/token?grant_type=password",body=account)
        actor=(result["user"]["id"],result["access_token"])
        b.live_session(s,actor)
        require(s.sql("select count(*) from auth.users where id="+sqlstr(actor[0])+" and email_confirmed_at is not null;")=="1","actual Auth verification missing")
        actual[role]=actor
    require(len({v[0] for v in actual.values()})==5,"seed actors not distinct")
    for role in ("ownerNew","applicant"):
        require(s.sql("select count(*) from auth.users where email="+sqlstr(accounts[role]["email"])+";")=="0","signup actor already registered")
    mark("five real signup Mailpit OTP parser verify/login and live sessions; two signup actors genuinely absent")
    stage("branch_and_owner_seed")
    admin,ta=actual["administrator"]
    owner_id,to=actual["ownerOther"]
    vet,tv=actual["veterinarian"]
    s.sql(f"select clinic_private.bootstrap_first_administrator('{admin}'); insert into public.staff_branch_memberships(user_id,branch_id,role,is_active) values ('{admin}','{b.NAGA}','administrator',true),('{admin}','{b.CAVITE}','administrator',true);")
    for role in ("veterinarian","receptionist","accountant"):
        user,token=actual[role]
        s.rpc("request_staff_access",{"p_branch":b.NAGA,"p_note":"synthetic"},token)
        revision=int(s.sql(f"select revision from public.staff_access_requests where user_id='{user}';"))
        s.rpc("review_staff_access",{"p_target":user,"p_action":"approve","p_role":role,"p_branches":[b.NAGA],"p_expected_revision":revision,"p_request_id":b.uid()},ta)
        require(s.sql(f"select count(*) from public.staff_branch_memberships where user_id='{user}' and branch_id='{b.NAGA}' and role='{role}' and is_active;")=="1","branch grant mismatch")
        require(s.sql(f"select count(*) from public.staff_branch_memberships where user_id='{user}' and branch_id='{b.CAVITE}';")=="0","unwanted cross branch grant")
    s.rpc("assert_staff_branch",{"p_branch":b.NAGA},tv)
    s.rpc("assert_staff_branch",{"p_branch":b.CAVITE},tv,expected=(401,403))
    s.rpc("list_staff_access_requests",{"p_branch":b.NAGA},actual["accountant"][1],expected=(401,403))
    owner=s.insert("owners",{"first_name":"Synthetic","last_name":runid},to)
    other_name="Synthetic "+runid+" other Chow Chow"
    pet=s.insert("pets",{"owner_id":owner["id"],"name":other_name,"species":"Dog","breed":"Chow Chow"},to)
    require(pet["species_id"]=="dog" and pet["breed"]=="Chow Chow","historical taxonomy changed")
    clinical=s.insert("pets",{"owner_id":owner["id"],"name":"Synthetic "+runid+" clinical","species":"Dog","breed":"Labrador Retriever"},to)
    require(clinical["id"]!=pet["id"],"distinct clinical patient required")
    mark("actual owner/pets and canonical Dog/Chow Chow retained; three staff grants, branch and accountant denial")
    stage("approved_synthetic_booking_and_lifecycle_seed")
    # All test bookings through actual owner RPC and staff transition. Use a
    # synthetic 5-minute fixture service and separate resources; no clock edits,
    # triggers disabled or past bookings inserted by privileged SQL.
    hours=json.dumps({d:[{"open":"00:00","close":"23:59"}] for d in ("sun","mon","tue","wed","thu","fri","sat")})
    s.sql(f"""update public.clinic_branches set booking_enabled=true,owner_approved_at=now(),owner_approved_by='{admin}' where id in ('{b.NAGA}','{b.CAVITE}');
update public.branch_booking_policies set is_approved=true,approved_at=now(),approved_by='{admin}',lead_minutes=0,max_advance_days=90,slot_step_minutes=5,weekly_hours='{hours}' where branch_id in ('{b.NAGA}','{b.CAVITE}');
update public.species_catalog set clinic_supported=true where id='dog';
insert into public.appointment_resources(id,name,branch_id) values('{b.ROOM}','Synthetic browser room','{b.NAGA}');
insert into public.clinic_services(id,slug,display_name,duration_minutes,is_active,owner_approved_at,owner_approved_by,published_at,branch_id) values('{b.SERVICE}','synthetic-browser-visit','Synthetic browser visit',30,true,now(),'{admin}',now(),'{b.NAGA}');
insert into public.clinic_service_species values('{b.SERVICE}','dog');
insert into public.clinic_service_resources(service_id,resource_id,capacity) values('{b.SERVICE}','{b.ROOM}',1);""")
    fixture_service=b.uid()
    s.sql(f"""insert into public.clinic_services(id,slug,display_name,duration_minutes,is_active,owner_approved_at,owner_approved_by,published_at,branch_id) values('{fixture_service}','synthetic-fixture-visit','Synthetic fixture visit',5,true,now(),'{admin}',now(),'{b.NAGA}');
insert into public.clinic_service_species values('{fixture_service}','dog');""")
    now=dt.datetime.now(dt.timezone.utc)
    # Wait only for an actual near-term slot; if calendar cannot fit, stop.
    next_slot=dt.datetime.fromtimestamp(((int(now.timestamp())+30)//300+1)*300,dt.timezone.utc)
    local=next_slot.astimezone(ZoneInfo("Asia/Manila"))
    require(local.hour<23 or local.minute<=50,"calendar boundary prevents bounded real lifecycle fixture")
    visit_day=local.date().isoformat()
    ids={}
    def transition(appointment,action,token):
        rev=int(s.sql(f"select lifecycle_revision from public.appointments where id='{appointment}';"))
        request=b.uid()
        receipt=s.rpc("transition_staff_appointment",{"p_appointment":appointment,"p_branch":b.NAGA,"p_action":action,"p_expected_revision":rev,"p_request_id":request},token)
        require(receipt["revision"]==rev+1,"lifecycle revision mismatch")
        require(s.sql(f"select count(*) from clinic_private.appointment_transition_receipts where appointment_id='{appointment}' and request_id='{request}';")=="1","lifecycle receipt mismatch")
    for name in ("clinical","checkIn","noShow","decline","cancel","complete"):
        room=b.uid()
        s.sql(f"insert into public.appointment_resources(id,name,branch_id) values('{room}','Fixture {name}','{b.NAGA}'); insert into public.clinic_service_resources(service_id,resource_id,capacity) values('{fixture_service}','{room}',1);")
        start=next_slot if name in ("clinical","checkIn","noShow","complete") else next_slot+dt.timedelta(days=1)
        payload={"p_pet_id":clinical["id"] if name=="clinical" else pet["id"],"p_service_id":fixture_service,"p_resource_id":room,"p_starts_at":start.isoformat(),"p_request_nonce":b.uid(),"p_concern":"Fixture "+name,"p_details":None}
        appt=s.rpc("request_service_appointment",payload,to)
        require(s.rpc("request_service_appointment",payload,to)==appt,"booking nonce replay mismatch")
        ids[name]={"id":appt,"day":start.astimezone(ZoneInfo("Asia/Manila")).date().isoformat()}
        if name!="decline": transition(appt,"confirm",tv)
        if name in ("clinical","complete"): transition(appt,"check_in",tv)
    require(len({v["id"].replace("-","")[:6] for v in ids.values()})==6,"abbreviated visit collision")
    require(clinical["id"][:6]!=pet["id"][:6],"abbreviated patient collision")
    # Completion prerequisite is a separately seeded, operator-authorized
    # encounter link, not clinical finalization. No trigger/clock change.
    s.sql(f"insert into public.branch_encounters(appointment_id,branch_id,pet_id,opened_by) values('{ids['complete']['id']}','{b.NAGA}','{pet['id']}','{vet}');")
    wait=max(0,(next_slot-dt.datetime.now(dt.timezone.utc)).total_seconds()+2)
    require(wait<=340,"no-show fixture timing exceeds bound")
    time.sleep(wait)
    require(s.sql(f"select (starts_at<=clock_timestamp())::text from public.appointments where id='{ids['noShow']['id']}';")=="true","no-show not actually due")
    require(s.sql(f"select (clock_timestamp() between starts_at-interval '1 hour' and ends_at+interval '1 day')::text from public.appointments where id='{ids['checkIn']['id']}';")=="true","check-in window expired")
    require(s.sql(f"select count(*) from public.clinical_encounter_drafts where appointment_id='{ids['clinical']['id']}';")=="0","clinical draft must start empty")
    expected={"clinical":"checked_in","checkIn":"confirmed","noShow":"confirmed","decline":"requested","cancel":"confirmed","complete":"checked_in"}
    for name,status in expected.items():
        require(s.sql(f"select status from public.appointments where id='{ids[name]['id']}';")==status,"fixture status mismatch")
    mark("actual six unique appointments and lifecycle receipts; real elapsed no-show/check-in windows, empty clinical draft")
    stage("inventory_and_private_attachment_seed")
    expiry=(dt.datetime.now(ZoneInfo("Asia/Manila")).date()+dt.timedelta(days=20)).isoformat()
    sku="FIXTURE-"+runid.upper()
    inv=s.rpc("create_branch_inventory_item",{"p_branch":b.NAGA,"p_request_id":b.uid(),"p_product_code":sku,"p_name":"Fixture supply","p_description":"synthetic","p_category":"supply","p_unit":"piece","p_formulation":None,"p_strength":None,"p_reorder_point":2,"p_lot":"FIXTURE","p_expiry":expiry,"p_supplier":"Fixture supplier","p_opening_units":10},ta)
    med=inv["itemId"]
    require(s.sql(f"select coalesce(sum(delta_on_hand),0) from public.stock_movements where medicine_id='{med}' and branch_id='{b.NAGA}';")=="10","stock movement parity")
    s.rpc("get_branch_inventory_balance",{"p_branch":b.NAGA,"p_medicine":med},actual["receptionist"][1])
    s.rpc("get_branch_inventory_balance",{"p_branch":b.NAGA,"p_medicine":med},actual["accountant"][1],expected=(401,403))
    s.http("POST","/storage/v1/bucket",body={"id":b.BUCKET,"name":b.BUCKET,"public":False,"file_size_limit":5242880,"allowed_mime_types":["application/pdf","image/png","image/jpeg"]},expected=(200,201),service=True)
    path="pets/"+pet["id"]+"/owners/"+owner_id+"/"+b.uid()+".pdf"
    data=b"%PDF-1.4\nSynthetic attachment only.\n%%EOF\n"
    s.http("POST","/storage/v1/object/"+b.BUCKET+"/"+path,token=to,body=data,expected=(200,201),ctype="application/pdf")
    s.insert("pet_attachments",{"pet_id":pet["id"],"category":"health_card","object_path":path,"original_filename":"fixture.pdf","mime_type":"application/pdf","size_bytes":len(data)},to)
    b.download_allowed(s,path,to,data,"connected-seed-owner")
    b.download_denied(s,path,actual["accountant"][1],"connected-seed-unrelated")
    require(s.sql("select count(*) from public.medicine_catalog where product_code="+sqlstr("UAT-"+runid.upper())+";")=="0","browser SKU not fresh")
    mark("actual seed stock ledger +10 and near-expiry lot, receptionist read/accountant deny, private bytes allow/deny")
    labels={row["slug"]:row["display_name"] for row in s.rows("clinic_branches","select=slug,display_name")}
    packet={"version":2,"sourceSha":H,"webTree":WEB,"runId":runid,"backendOrigin":"https://"+ALIAS,
        "runtime":"isolated-disposable-full-stack","networkIsolation":True,"syntheticOnly":True,"noExternalMail":True,"freshSeed":True,"migrationCount":23,
        "runtimeEvidence":"github-actions-runtime-"+os.environ["GITHUB_RUN_ID"],"mailOrigin":"http://127.0.0.1:54324","publishableKey":pub,"authLinks":False,
        "accounts":accounts,"branchId":b.NAGA,"otherBranchId":b.CAVITE,"branchLabel":labels["naga"],"otherBranchLabel":labels["cavite"],
        "serviceId":b.SERVICE,"speciesId":"dog","speciesLabel":"Dog","breedId":"dog-labrador-retriever","checkedInVisitId":ids["clinical"]["id"],"checkedInPetId":clinical["id"],
        "checkedInDay":visit_day,"expiryDay":expiry,"otherOwnerPet":other_name,"lifecycleVisits":{k:v for k,v in ids.items() if k!="clinical"}}
    return packet

def main():
    require(os.environ.get("GITHUB_ACTIONS")=="true" and os.environ.get("RUNNER_ENVIRONMENT")=="github-hosted","disposable GitHub-hosted only")
    event=json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    require(event["repository"]["full_name"]=="cmlagatuz/dawney-clinic" and event["repository"]["private"] is False
            and event["pull_request"]["head"]["repo"]["full_name"]=="cmlagatuz/dawney-clinic","exact public repository PR only")
    os.umask(0o077)
    b.ENV={"PATH":os.environ["PATH"],"LANG":"C.UTF-8","LC_ALL":"C.UTF-8","CI":"true"}
    require(git("rev-parse","HEAD")==event["pull_request"]["head"]["sha"],"wrong job checkout")
    execute_authorized=authorize(event,git("rev-parse","HEAD"),C,os.environ.get("GITHUB_RUN_ATTEMPT",""))
    print("CONNECTED_EXECUTION_GATE:", "AUTHORIZED_EXPLICIT_LABEL" if execute_authorized else "PREFLIGHT_ONLY",flush=True)
    git("merge-base","--is-ancestor",A,"HEAD")
    require(set(git("diff","--name-only",A,"HEAD").splitlines())=={"scripts/connected-runtime/runtime.py","scripts/connected-runtime/relay.py","scripts/connected-runtime/probe.mjs",".github/workflows/rc2-connected-runtime.yml","docs/RC2_CONNECTED_RUNTIME.md","scripts/connected-runtime/receipts.py","scripts/connected-runtime/test_receipts.py"},"unexpected verification delta")
    for path,tree in (("web",WEB),("supabase","8750a8be478c56acc5b6e9740946138f0b2f39f7"),("scripts/recovery","f105bb506be210707683eb5e4a988383b0ee49ad")):
        require(git("rev-parse","HEAD:"+path)==tree,"frozen tree mismatch "+path)
    require(git("hash-object","scripts/fullstack-synthetic/rehearse.py")=="65a414531e44e8f1cfb85dad418cfeb5fa0a3841","accepted recovery harness changed")
    b.MIGRATIONS=[]
    for line in (ROOT/"docs/RC2_MIGRATION_BLOBS.tsv").read_text().splitlines():
        if not line or line.startswith("#"):continue
        _,mode,blob,path=line.split("\t")
        require(mode=="100644" and git("hash-object",path)==blob,"migration provenance")
        b.MIGRATIONS.append(ROOT/path)
    require(len(b.MIGRATIONS)==23,"23 exact migrations required")
    mark("exact frozen RC2 trees, accepted PR144 parent and all migration blobs")
    with tempfile.TemporaryDirectory(prefix="dawney-connected-",dir=os.environ["RUNNER_TEMP"]) as directory:
        work=Path(directory)
        hosthome=work/"host-home";hosthome.mkdir()
        b.ENV.update(HOME=str(hosthome),TMPDIR=str(work))
        cloud=work/"cloud"
        s=None;procs=[];net=False;ns=False;checked=False;ports=None;bridge=None;rules=[]
        try:
            b.stage("dependency_and_source_preflight")
            available=int(re.search(r"MemAvailable:\s+(\d+)",Path("/proc/meminfo").read_text())[1])*1024
            require(available>=7*2**30 and shutil.disk_usage(work).free>=10*2**30,"runner resource floor")
            for name in ("docker","openssl","certutil","node","npm","ip","setpriv","sudo","curl","tar"):
                require(shutil.which(name),name+" unavailable")
            require(re.match(r"v(22|23|24|25|26)\.",run(["node","--version"]).decode()),"Node compatibility")
            run(["docker","version","--format","{{.Server.Version}}"])
            git("fetch","--no-tags","https://github.com/cmlagatuz/dawney-clinic.git",C)
            git("worktree","add","--detach",str(cloud),C);checked=True
            require(git("rev-parse","HEAD",cwd=cloud)==C,"wrong CLOUD checkout")
            require(git("rev-parse",H+":web",cwd=cloud)==WEB,"CLOUD frozen web tree")
            require(all(x.startswith("web/tests/connected/") for x in git("diff","--name-only",H,"HEAD","--","web",cwd=cloud).splitlines()),"unreviewed CLOUD application changes")
            require(not git("diff","--name-only",H,"HEAD","--","scripts/browser",cwd=cloud),"browser driver changed")
            run(["npm","ci","--ignore-scripts","--no-audit","--no-fund"],cwd=cloud/"web",timeout=180)
            run(["node","--test","web/tests/connected/runtime-guard.test.mjs"],cwd=cloud)
            mark("exact CLOUD 2bb4818 checkout, locked deps and offline contract tests")
            archive=work/"cli.tar.gz"
            run(["curl","--fail","--silent","--show-error","--location","--max-time","90","--output",str(archive),"https://github.com/supabase/cli/releases/download/v3.0.0/supabase_3.0.0_linux_amd64.tar.gz"])
            require(b.sha(archive.read_bytes())=="eeb61edcd59a4735fcb5e58596574f25d03d420efca779f43ddb307e1cc5c754","CLI archive checksum")
            run(["tar","-xzf",str(archive),"-C",str(work),"supabase"])
            b.CLI=str(work/"supabase")
            require(run([b.CLI,"--version"]).decode().strip()=="3.0.0","CLI version")
            b.stage("internal_stack_start")
            for local in (54321,54322,54324):
                require(not LoopbackRelays.reachable(local),"unexpected pre-existing localhost listener")
            run(["docker","network","create","--internal","--opt","com.docker.network.bridge.host_binding_ipv4=127.0.0.1",NET]);net=True
            # Prevent new container-initiated connections to the runner itself.
            # Scoped to the new bridge only; existing host networking unchanged.
            network=json.loads(run(["docker","network","inspect",NET]))[0]
            bridge="br-"+network["Id"][:12]
            require(re.fullmatch(r"br-[0-9a-f]{12}",bridge),"invalid isolated bridge")
            for executable in ("iptables","ip6tables"):
                rule=["-i",bridge,"-m","conntrack","--ctstate","NEW","-j","DROP"]
                run(["sudo",executable,"-I","INPUT","1",*rule])
                rules.append((executable,rule))
            s=Stack(work)
            require(network["Internal"] is True and network["Driver"]=="bridge","unexpected startup network")
            subnets=[v["Subnet"] for v in network["IPAM"]["Config"] if ":" not in v["Subnet"]]
            require(len(subnets)==1,"exact IPv4 internal subnet required")
            ports=LoopbackRelays(s.label,subnets[0]);s.relays=ports;ports.start()
            s.start()
            ports.wait_ready()
            info=json.loads(s.cli("status","-o","json"))
            pub=info.get("PUBLISHABLE_KEY","")
            require(re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]{8,}",pub) and pub!=s.service,"genuine CLI publishable key missing")
            require(s.sql("select version from supabase_migrations.schema_migrations order by version;").splitlines()==[x.name.split("_")[0] for x in b.MIGRATIONS],"actual migration history mismatch")
            mark("actual exact 23 migration history, native local publishable key")
            docker_network(s)
            b.stage("tls_and_process_namespace")
            home=certs(work)
            create_namespace(work);ns=True
            prefix=isolated_prefix(work,home)
            procs.append(launch([sys.executable,str(HERE/"relay.py"),"host",str(work)]))
            procs.append(launch(prefix+[sys.executable,str(HERE/"relay.py"),"namespace",str(work)]))
            b.stage("real_node_chromium_transport_preflight")
            transport=work/"transport.json";packet_write(transport,{"publishableKey":pub})
            isolated_node(prefix,cloud,["transport",str(cloud),str(transport)],timeout=90)
            qualify_mail_template(s)
            host_mail_check()
            # No packet until real fixture seed and enforced controls; probe
            # consumes it in the same namespace and verifies all assertions.
            packet=seed(s,work,cloud,prefix,pub)
            path=work/"runtime.json";packet_write(path,packet)
            b.stage("real_node_chromium_and_cloud_v2_preflight")
            result=isolated_node(prefix,cloud,["preflight",str(cloud),str(path)],timeout=90)
            require("PASS: exact CLOUD v2 packet and actual catalog/mail freshness" in result,"missing actual packet preflight")
            mark("actual private version 2 packet validated against exact CLOUD guard in same-job runtime")
            print("OPTIONAL_AUTH_LINKS_BLOCKED: OTP-only local template; callback and recovery links unqualified",flush=True)
            b.stage("authoritative_receipt_baseline")
            collector=Collector(s,packet,b)
            collector.prepare()
            if not execute_authorized:
                print("CONNECTED_RUNTIME_PREFLIGHT_PASS; CONNECTED_APPLICATION_SCENARIOS_NOT_RUN",flush=True)
            else:
                print("CONNECTED_RUNTIME_PREFLIGHT_PASS; EXPLICIT_CONNECTED_EXECUTION_AUTHORIZED",flush=True)
                b.stage("connected_application_and_authoritative_receipts")
                return execute(s,packet,b,collector,prefix,cloud,work,path)
        finally:
            for p in reversed(procs):
                if p.poll() is None:p.terminate()
                try:p.wait(timeout=8)
                except subprocess.TimeoutExpired:p.kill();p.wait()
            if ns:
                run(["sudo","ip","netns","delete",NS])
            if s and s.started:s.stop()
            if ports:ports.close()
            for executable,rule in reversed(rules):
                run(["sudo",executable,"-D","INPUT",*rule])
            if net:
                # CLI may remove the custom network when stopping; only remove if present.
                if subprocess.run(["docker","network","inspect",NET],env=b.ENV,capture_output=True).returncode==0:
                    run(["docker","network","rm",NET])
            if checked:git("worktree","remove","--force",str(cloud))

if __name__=="__main__":
    try:sys.exit(main())
    except Exception as e:
        print("BLOCKED/FAILED:",b.STAGE,type(e).__name__,str(e) if isinstance(e,RuntimeError) else "sanitized runtime error",flush=True)
        sys.exit(1)
