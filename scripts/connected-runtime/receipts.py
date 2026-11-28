"""Read-only independent receipts for the exact CLOUD runner, never a seed substitute."""
import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import time
import urllib.request

CASES=(
    "public","owner-register","owner-persistence","owner-isolation","staff-request",
    "admin-review","staff-persistence","operations","owner-status","clinical",
    "clinical-admin","clinical-role-denial","inventory","pharmacy","inventory-edit",
    "accountant-denial","session-transition","network-retry","owner-cancel",
    "finance-unavailable","private-attachment","attachment-owner-isolation",
    "email-callback","email-recovery","accessibility-mobile","clinical-uncertain",
    "controlled-late-response","additional-lifecycle")
OWNER="cmlagatuz"
REPO=OWNER+"/dawney-clinic"
LABEL="connected-runtime-execute"
BRANCH="ai/astra/rc2-connected-runtime-20261128"
WORKFLOW=".github/workflows/rc2-connected-runtime.yml"
WORKFLOW_ID=433513498
REPO_ID=222492572
PR_ID=5537994941
OWNER_ID=15047837
LABEL_PATTERN=re.compile(r"connected-runtime-execute-([1-9][0-9]{0,11})-([1-9][0-9]{0,11})")
PNG=base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nGMMrZ3GQEvARFPTRy0YtWDUglELRi0YtWDUglELRi0YtWDUAioCAJsdAaiiHDv7AAAAAElFTkSuQmCC")
UID=re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
SHA=re.compile(r"[a-f0-9]{40}")
def check(ok,reason):
    if not ok: raise RuntimeError(reason)

def is_owner(value):
    return isinstance(value,dict) and value.get("login")==OWNER and value.get("id")==OWNER_ID

def label_ids(name):
    match=LABEL_PATTERN.fullmatch(name) if isinstance(name,str) else None
    if match is None:return None
    sol,pm=map(int,match.groups())
    return (sol,pm) if sol!=pm else None

def requested(event,attempt):
    """A unique owner-applied label only; ordinary pushes and reruns never launch."""
    return (event.get("action")=="labeled" and label_ids(event.get("label",{}).get("name")) is not None
            and is_owner(event.get("sender")) and attempt=="1"
            and event.get("number")==146 and event.get("repository",{}).get("full_name")==REPO
            and event.get("repository",{}).get("id")==REPO_ID)

def timestamp(value):
    # GitHub REST timestamps have second precision. Equal approval/trigger
    # timestamps are ambiguous and refused rather than ordered by guessed IDs.
    check(isinstance(value,str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z",value),
          "unverified GitHub timestamp")
    try:return dt.datetime.strptime(value,"%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
    except ValueError:raise RuntimeError("unverified GitHub timestamp") from None

def positive_id(value):
    return type(value) is int and value>0

def exact_pr(pr,head,label):
    return (pr.get("id")==PR_ID and pr.get("number")==146 and pr.get("state")=="open" and pr.get("draft") is True
            and pr.get("head",{}).get("sha")==head and pr.get("head",{}).get("ref")==BRANCH
            and pr.get("head",{}).get("repo",{}).get("full_name")==REPO
            and pr.get("head",{}).get("repo",{}).get("id")==REPO_ID
            and positive_id(label.get("id"))
            and [l.get("id") for l in pr.get("labels",[]) if l.get("name")==label.get("name")]==[label["id"]])

def approval_comment(comment,cid,body):
    check(comment.get("id")==cid and is_owner(comment.get("user")) and comment.get("author_association")=="OWNER"
          and comment.get("issue_url")=="https://api.github.com/repos/"+REPO+"/issues/146"
          and comment.get("body")==body and comment.get("created_at")==comment.get("updated_at"),
          "exact immutable owner approval mismatch")
    return timestamp(comment.get("created_at"))

def run_identity(run,run_id,head):
    check(run.get("id")==run_id and run.get("workflow_id")==WORKFLOW_ID and run.get("path")==WORKFLOW
          and run.get("event")=="pull_request" and run.get("run_attempt")==1
          and run.get("head_sha")==head and run.get("head_branch")==BRANCH and run.get("status")=="in_progress"
          and run.get("repository",{}).get("id")==REPO_ID and run.get("repository",{}).get("full_name")==REPO
          and run.get("head_repository",{}).get("id")==REPO_ID
          and is_owner(run.get("actor")) and is_owner(run.get("triggering_actor")),"workflow occurrence identity mismatch")
    prs=run.get("pull_requests")
    check(isinstance(prs,list) and len(prs)==1 and prs[0].get("id")==PR_ID and prs[0].get("number")==146
          and prs[0].get("head",{}).get("sha")==head and prs[0].get("head",{}).get("ref")==BRANCH
          and prs[0].get("head",{}).get("repo",{}).get("id")==REPO_ID,"workflow PR identity mismatch")
    return timestamp(run.get("created_at"))

def clearance(event,head,cloud,run_id,run,pr,sol,pm,events,runs,now):
    """Pure verification over trusted GitHub GET responses and runner event.

    Exact comment IDs in a single-use label avoid guessing which approval
    pair or historical label event an invocation refers to.
    """
    check(SHA.fullmatch(head) and SHA.fullmatch(cloud) and positive_id(run_id),"invalid execution identity")
    check(requested(event,"1"),"not an exact owner label event")
    label=event["label"];sol_id,pm_id=label_ids(label["name"])
    check(exact_pr(event["pull_request"],head,label) and exact_pr(pr,head,label),"changed PR or label identity")
    sol_time=approval_comment(sol,sol_id,"SOL CONNECTED RUNTIME AND RECEIPT PASS "+head+" "+cloud)
    pm_time=approval_comment(pm,pm_id,"PM CONNECTED EXECUTION CLEARANCE "+head+" "+cloud+" SOL="+str(sol_id))
    # An approval ID may not appear in another execution label occurrence,
    # even if it was removed/reapplied or paired with another comment.
    relevant=[]
    for e in events:
        if e.get("event") not in ("labeled","unlabeled"):continue
        ids=label_ids(e.get("label",{}).get("name"))
        if ids and set(ids).intersection((sol_id,pm_id)):relevant.append(e)
    check(len(relevant)==1,"missing, ambiguous or replayed execution label")
    trigger=relevant[0]
    check(trigger.get("event")=="labeled" and trigger.get("label",{}).get("name")==label["name"]
          and positive_id(trigger.get("id")) and is_owner(trigger.get("actor")),"execution label occurrence mismatch")
    trigger_time=timestamp(trigger.get("created_at"))
    check(sol_time<pm_time<trigger_time,"approval chronology unverified")
    check(pm_time-sol_time<=dt.timedelta(hours=24) and trigger_time-pm_time<=dt.timedelta(minutes=15),
          "stale approvals")
    # Any post-approval force push, close/reopen or draft-state transition
    # invalidates the pair; current PR/head and event snapshot also must match.
    for e in events:
        if e.get("event") in ("head_ref_force_pushed","closed","reopened","ready_for_review","convert_to_draft"):
            check(timestamp(e.get("created_at"))<sol_time,"PR state changed since approval")
    created=run_identity(run,run_id,head)
    check(trigger_time<=created<=trigger_time+dt.timedelta(minutes=2)
          and created<=now<=trigger_time+dt.timedelta(minutes=35),"stale or unrelated workflow occurrence")
    # Only one matching workflow run may exist since this label occurrence.
    # Ordinary workflow runs on the same commit can make this ambiguous; fail
    # closed rather than infer causation from a near timestamp or latest label.
    matching=[]
    for candidate in runs:
        check(candidate.get("head_sha")==head and candidate.get("event")=="pull_request","workflow list identity mismatch")
        if candidate.get("workflow_id")==WORKFLOW_ID and timestamp(candidate.get("created_at"))>=trigger_time:
            matching.append(candidate)
    check(len(matching)==1 and matching[0].get("id")==run_id
          and matching[0].get("created_at")==run.get("created_at") and matching[0].get("run_attempt")==1,
          "ambiguous or replayed workflow occurrence")
    # Immutable comparison token retained only in the host process, never in
    # the private browser packet/environment. Re-read and compare before launch.
    return (head,cloud,label["name"],label["id"],sol_id,sol["created_at"],pm_id,pm["created_at"],
            trigger["id"],trigger["created_at"],run_id,run["created_at"])

def github_read(path):
    # Host control plane only, fixed public GitHub API, no token/redirect/proxy.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
    with opener.open(urllib.request.Request("https://api.github.com/repos/"+REPO+path,
                     headers={"Accept":"application/vnd.github+json","User-Agent":"Dawney isolated acceptance gate",
                              "Cache-Control":"no-cache","X-GitHub-Api-Version":"2022-11-28"}),timeout=12) as response:
        check(response.status==200,"approval source unavailable")
        data=response.read(2_000_001)
        check(len(data)<=2_000_000,"approval response bound exceeded")
        return json.loads(data)

def bounded_events(read):
    result=[]
    for page in range(1,11):
        batch=read("/issues/146/events?per_page=100&page="+str(page))
        check(isinstance(batch,list) and len(batch)<=100 and all(isinstance(e,dict) and positive_id(e.get("id")) for e in batch),
              "issue event response invalid")
        result.extend(batch)
        if len(batch)<100:break
    else:raise RuntimeError("issue event bound exceeded")
    check(len({e["id"] for e in result})==len(result),"issue event pagination ambiguous")
    return result

def bounded_runs(read,head):
    result=[];total=None
    for page in range(1,11):
        batch=read("/actions/runs?head_sha="+head+"&event=pull_request&per_page=100&page="+str(page))
        count=batch.get("total_count")
        check(type(count) is int and 0<=count<1000 and (total is None or total==count),"workflow count ambiguous")
        total=count;items=batch.get("workflow_runs")
        check(isinstance(items,list) and len(items)<=100 and all(isinstance(e,dict) and positive_id(e.get("id")) for e in items),
              "workflow list invalid")
        result.extend(items)
        if len(result)>=total or len(items)<100:break
    else:raise RuntimeError("workflow list bound exceeded")
    check(len(result)==total and len({e["id"] for e in result})==total,"workflow list incomplete or ambiguous")
    return result

def authorize(event,head,cloud,attempt,run_id,previous=None,read=github_read,now=None):
    if not requested(event,attempt):
        check(previous is None,"execution authorization revoked")
        return None
    try:
        check(SHA.fullmatch(head) and SHA.fullmatch(cloud) and isinstance(run_id,str)
              and re.fullmatch(r"[1-9][0-9]{0,19}",run_id),"invalid authorization identity")
        sol_id,pm_id=label_ids(event["label"]["name"]);rid=int(run_id)
        # Read exact immutable IDs; never select a later approval by scanning
        # text. Only this label name/occurrence can consume these two IDs.
        sol=read("/issues/comments/"+str(sol_id))
        pm=read("/issues/comments/"+str(pm_id))
        run=read("/actions/runs/"+run_id)
        events=bounded_events(read)
        runs=bounded_runs(read,head)
        pr=read("/pulls/146") # latest PR/label check, immediately before verdict
        token=clearance(event,head,cloud,rid,run,pr,sol,pm,events,runs,
                        now if now is not None else dt.datetime.now(dt.timezone.utc))
        check(previous is None or token==previous,"execution authorization changed")
        return token
    except Exception:
        raise RuntimeError("connected execution chronology/clearance refused; no browser launch") from None

def literal(value):
    # Only exact generated packet identities/markers; no SQL identifier or
    # untrusted result text becomes a query. Escape single quotes defensively.
    check(isinstance(value,str) and len(value)<=300 and "\x00" not in value
          and "\\" not in value,"unsafe receipt literal")
    return "'"+value.replace("'","''")+"'"

def uuid(value):
    check(isinstance(value,str) and UID.fullmatch(value),"invalid receipt UUID")
    return literal(value)+"::uuid"

def singleton(rows):
    check(isinstance(rows,list) and len(rows)==1,"expected exactly one persisted row")
    return rows[0]

def private_regular(path,limit):
    st=path.lstat()
    check(stat.S_ISREG(st.st_mode) and st.st_uid==os.getuid()
          and stat.S_IMODE(st.st_mode)==0o600 and st.st_size<=limit,"private evidence file contract")
    return st

def read_report(path,p):
    private_regular(path,256_000)
    obj=json.loads(path.read_bytes())
    check(isinstance(obj,dict) and obj.get("sourceSha")==p["sourceSha"]
          and obj.get("webTree")==p["webTree"] and obj.get("runId")==p["runId"]
          and obj.get("runtimeEvidence")==p["runtimeEvidence"]
          and obj.get("evidenceClass")=="isolated-synthetic-real-api-browser-not-hosted","browser report identity mismatch")
    rows=obj.get("results")
    check(isinstance(rows,list) and len(rows)<=2*len(CASES),"browser report case count")
    states={};seen=set();invalid=set();complete=True
    for row in rows:
        if not isinstance(row,dict) or not isinstance(row.get("id"),str) or row["id"] not in CASES:
            complete=False;continue
        case=row["id"]
        if case in seen or row.get("status") not in ("PASS_BROWSER","FAIL","BLOCKED","NOT_RUN"):
            invalid.add(case);complete=False
        else:states[case]=row["status"]
        seen.add(case)
    for case in invalid:states.pop(case,None)
    return states,complete and len(states)==len(CASES)

def report_outcomes(output,p,launched,orderly):
    # A child may have committed a write before publishing its first/next
    # result. Absence or corruption is unknown, never proof of nonexecution.
    fallback="UNKNOWN" if launched else "NOT_RUN"
    states=dict.fromkeys(CASES,fallback)
    try:
        st=output.lstat()
        check(stat.S_ISDIR(st.st_mode) and st.st_uid==os.getuid()
              and stat.S_IMODE(st.st_mode)==0o700,"private browser output directory")
        reported,complete=read_report(output/"result.json",p)
    except Exception:return states,False
    for case,value in reported.items():
        states[case]="UNKNOWN" if launched and value=="NOT_RUN" and not (complete and orderly) else value
    return states,complete

def receipt_status(browser,verification):
    if browser!="PASS_BROWSER":return browser
    return {"PASS":"PASS_PERSISTENCE","FAIL":"FAIL_PERSISTENCE",
            "UI_ONLY":"PASS_BROWSER_ONLY","BLOCKED":"BLOCKED",
            "REQUEST":"PASS_REQUEST_RECEIPT","ISOLATION":"PASS_BROWSER_ONLY",
            "ISOLATION_FAIL":"FAIL_ISOLATION_READBACK"}[verification]

class Collector:
    def __init__(self,s,p,b):
        self.s=s;self.p=p;self.b=b;self.run=p["runId"];self.marker="Synthetic "+self.run
        self.branch=uuid(p["branchId"]);self.other=uuid(p["otherBranchId"])
        self.visit=uuid(p["checkedInVisitId"]);self.clinical_pet=uuid(p["checkedInPetId"])
        self.roles={role:literal(a["email"]) for role,a in p["accounts"].items()}
        self.sku=literal("UAT-"+self.run.upper())
        self.filename=literal("synthetic-"+self.run+"-health-card.png")
        self.concern=literal(self.marker+" appointment")
        self.patient=literal(self.marker+" patient")
        self.sessions=set();self.session_probe_errors=0;self.tokens={};self.baseline=None
        self.fixture_ids={k:uuid(v["id"]) for k,v in p["lifecycleVisits"].items()}
        self.fixture_sql=",".join(self.fixture_ids.values())
        self.user_sql="select id from auth.users where email in ("+",".join(self.roles.values())+")"
        self.new_user_sql="select id from auth.users where email in ("+self.roles["ownerNew"]+","+self.roles["applicant"]+")"
        self.app_sql="select id from public.appointments where concern="+self.concern+" or owner_id in (select id from public.owners where user_id in ("+self.new_user_sql+"))"
        self.inventory_sql="select id from public.medicine_catalog where product_code="+self.sku

    def rows(self,sql):
        check(sql.lower().startswith("select "),"receipt requires read-only select")
        # Actual PostgreSQL, not browser storage. Force read-only session and
        # fixed local container, never an external database connection.
        query="select coalesce(json_agg(q),'[]'::json) from ("+sql+") q;"
        data=self.b.run(["docker","exec","-i","-e","PGOPTIONS=-c default_transaction_read_only=on",
                         self.s.cid,"psql","-XAtq","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],
                         data=query.encode(),timeout=15)
        result=json.loads(data)
        check(isinstance(result,list),"database receipt shape")
        return result

    def observe_sessions(self):
        # Only sessions created by actual browser activity: the two actors are
        # absent at baseline, and collector logins happen only AFTER observation.
        try:
            rows=self.rows("select u.email from auth.users u where u.email in ("+
                    self.roles["ownerNew"]+","+self.roles["applicant"]+") and u.email_confirmed_at is not null "
                    "and (u.banned_until is null or u.banned_until<=now()) and exists "
                    "(select 1 from auth.sessions s where s.user_id=u.id and (s.not_after is null or s.not_after>now()))")
            for role in ("ownerNew","applicant"):
                if any(row["email"]==self.p["accounts"][role]["email"] for row in rows):
                    self.sessions.add(role)
        except Exception:
            self.session_probe_errors+=1

    def snapshot(self):
        ids="("+self.app_sql+" union select id from public.appointments where id in ("+self.fixture_sql+"))"
        return {
            "users":self.rows("select id,email,email_confirmed_at is not null as verified,role from auth.users where id in ("+self.user_sql+")"),
            "owners":self.rows("select id,user_id,first_name,last_name from public.owners where user_id in ("+self.new_user_sql+")"),
            "pets":self.rows("select id,owner_id,name,species_id,breed_id from public.pets where name="+self.patient+
                       " or owner_id in (select id from public.owners where user_id in ("+self.new_user_sql+"))"),
            "appointments":self.rows("select id,owner_id,pet_id,branch_id,service_id,resource_id,concern,status,lifecycle_revision,request_nonce,"
                "extract(epoch from ends_at-starts_at)::int as duration,created_by from public.appointments where id in ("+self.app_sql+")"),
            "fixtures":self.rows("select id,status,lifecycle_revision,branch_id,pet_id from public.appointments where id in ("+self.fixture_sql+")"),
            "appointment_events":self.rows("select appointment_id,actor_id,previous_status,new_status from public.appointment_events where appointment_id in "+ids+" order by id"),
            "transitions":self.rows("select e.appointment_id,e.actor_id,e.request_id,e.branch_id,e.action,e.old_status,e.new_status,e.old_revision,e.new_revision,"
                "r.request_payload,r.response from clinic_private.appointment_transition_events e left join clinic_private.appointment_transition_receipts r "
                "on r.actor_id=e.actor_id and r.request_id=e.request_id and r.appointment_id=e.appointment_id where e.appointment_id in "+ids+" order by e.new_revision"),
            "transition_receipts":self.rows("select appointment_id,actor_id,request_id from clinic_private.appointment_transition_receipts where appointment_id in "+ids),
            "staff":self.rows("select user_id,requested_branch_id,note,state,revision,reviewed_by from public.staff_access_requests where user_id in ("+self.new_user_sql+")"),
            "memberships":self.rows("select user_id,branch_id,role,is_active,assigned_by from public.staff_branch_memberships where user_id in ("+self.new_user_sql+")"),
            "global_roles":self.rows("select user_id,role,is_active from public.staff_memberships where user_id in ("+self.new_user_sql+")"),
            "staff_events":self.rows("select e.actor_id,e.target_id,e.branch_id,e.action,e.old_state,e.new_state,e.new_role,e.request_id,r.request_payload,r.response "
                "from clinic_private.staff_operation_events e left join clinic_private.staff_review_receipts r on r.actor_id=e.actor_id and r.nonce=e.request_id "
                "where e.target_id in ("+self.new_user_sql+") order by e.id"),
            "staff_receipts":self.rows("select actor_id,nonce from clinic_private.staff_review_receipts where request_payload->>'target' in (select id::text from auth.users where id in ("+self.new_user_sql+"))"),
            "drafts":self.rows("select id,appointment_id,branch_id,pet_id,author_id,revision,status,complaint,examination,assessment,plan from public.clinical_encounter_drafts where appointment_id="+self.visit),
            "clinical_audit":self.rows("select a.draft_id,a.appointment_id,a.branch_id,a.pet_id,a.actor_id,a.request_id,a.revision,a.action,a.payload,r.payload as receipt_payload,r.response "
                "from clinic_private.clinical_draft_audit a left join clinic_private.clinical_draft_requests r on r.actor_id=a.actor_id and r.request_id=a.request_id "
                "and r.appointment_id=a.appointment_id and r.branch_id=a.branch_id and r.pet_id=a.pet_id where a.appointment_id="+self.visit+" order by a.revision"),
            "clinical_receipts":self.rows("select actor_id,request_id from clinic_private.clinical_draft_requests where appointment_id="+self.visit),
            "items":self.rows("select id,product_code,generic_name,category,is_controlled,is_active from public.medicine_catalog where id in ("+self.inventory_sql+")"),
            "rules":self.rows("select branch_id,medicine_id,branch_display_name,reorder_point_units,expiry_warning_days,profile_revision from public.branch_medicine_rules where medicine_id in ("+self.inventory_sql+")"),
            "batches":self.rows("select id,branch_id,medicine_id,lot_number,expiry_date,on_hand_units,reserved_units,quarantined_units from public.branch_stock_batches where medicine_id in ("+self.inventory_sql+")"),
            "movements":self.rows("select branch_id,medicine_id,batch_id,event_id,event_type,delta_on_hand,delta_reserved,delta_quarantined,after_on_hand,recorded_by from public.stock_movements where medicine_id in ("+self.inventory_sql+")"),
            "inventory_receipts":self.rows("select actor_id,nonce,branch_id,kind,request_payload,response from clinic_private.inventory_write_receipts where response->>'itemId' in (select id::text from public.medicine_catalog where id in ("+self.inventory_sql+"))"),
            "attachments":self.rows("select a.id,a.pet_id,a.category,a.version_no,a.object_path,a.original_filename,a.mime_type,a.size_bytes,a.uploaded_by,"
                "o.owner_id as object_owner,o.metadata->>'mimetype' as object_mime,(o.metadata->>'size')::bigint as object_size,b.public as bucket_public "
                "from public.pet_attachments a left join storage.objects o on o.name=a.object_path and o.bucket_id='clinical-attachments' "
                "left join storage.buckets b on b.id=o.bucket_id where a.original_filename="+self.filename+
                " or a.pet_id in (select id from public.pets where name="+self.patient+")"),
            "objects":self.rows("select name from storage.objects where bucket_id='clinical-attachments' and name in "
                "(select object_path from public.pet_attachments where original_filename="+self.filename+")")
        }

    def prepare(self):
        self.baseline=self.snapshot()
        check(not any(row["email"] in [self.p["accounts"][r]["email"] for r in ("ownerNew","applicant")]
                      for row in self.baseline["users"]),"new browser actors already exist")
        for key in ("owners","pets","appointments","staff","memberships","global_roles","staff_events","staff_receipts",
                    "drafts","clinical_audit","clinical_receipts","items","rules","batches","movements","inventory_receipts","attachments","objects"):
            check(not self.baseline[key],"browser-created baseline not empty")
        check(len(self.baseline["fixtures"])==5,"lifecycle baseline incomplete")
        check(len(self.baseline["users"])==5,"seed user baseline incomplete")
        for key,value in self.fixture_ids.items():
            row=singleton([r for r in self.baseline["fixtures"] if r["id"]==self.p["lifecycleVisits"][key]["id"]])
            check(row["status"]=={"checkIn":"confirmed","noShow":"confirmed","decline":"requested","cancel":"confirmed","complete":"checked_in"}[key],
                  "lifecycle baseline state mismatch")
        print("PASS: actual read-only receipt schema and fresh browser-marker baseline; five fixture revisions captured privately",flush=True)

    def user(self,role):
        row=singleton([u for u in self.final["users"] if u["email"]==self.p["accounts"][role]["email"]])
        check(row["verified"] is True and row["role"]=="authenticated","verified Auth identity missing")
        return row["id"]

    def session(self,role):
        uid=self.user(role)
        if role not in self.tokens:
            login=self.s.http("POST","/auth/v1/token?grant_type=password",body=self.p["accounts"][role])
            check(login["user"]["id"]==uid,"independent Auth identity mismatch")
            token=login["access_token"]
            self.b.live_session(self.s,(uid,token))
            self.tokens[role]=token
        return self.tokens[role]

    def auth_observed(self,role):
        check(role in self.sessions,"no browser-created verified Auth session observed")
        return self.user(role)

    def owner(self):
        uid=self.auth_observed("ownerNew")
        owner=singleton([row for row in self.final["owners"] if row["user_id"]==uid]);pet=singleton(self.final["pets"])
        check(owner["user_id"]==uid and owner["first_name"]=="Synthetic" and owner["last_name"]==self.run
              and pet["owner_id"]==owner["id"] and pet["name"]==self.marker+" patient"
              and pet["species_id"]==self.p["speciesId"] and pet["breed_id"]==self.p["breedId"]
              and not any(r["user_id"]==uid for r in self.final["global_roles"]+self.final["memberships"]),
              "owner/patient relationship or role mismatch")
        return uid,owner,pet

    def appointment(self):
        uid,owner,pet=self.owner();a=singleton(self.final["appointments"])
        check(a["owner_id"]==owner["id"] and a["pet_id"]==pet["id"] and a["created_by"]==uid
              and a["branch_id"]==self.p["branchId"] and a["service_id"]==self.p["serviceId"]
              and a["resource_id"]==self.b.ROOM and a["duration"]==1800
              and a["concern"]==self.marker+" appointment" and bool(UID.fullmatch(a["request_nonce"] or ""))
              and a["status"] in ("requested","confirmed","cancelled"),"appointment identity/nonce/status mismatch")
        events=[e for e in self.final["appointment_events"] if e["appointment_id"]==a["id"]]
        expected=[(None,"requested",uid)]
        if a["status"] in ("confirmed","cancelled"):expected.append(("requested","confirmed",self.user("receptionist")))
        if a["status"]=="cancelled":expected.append(("confirmed","cancelled",uid))
        check([(e["previous_status"],e["new_status"],e["actor_id"]) for e in events]==expected
              and a["lifecycle_revision"]==len(expected),"appointment event/revision mismatch")
        return a

    def transition(self,aid,action,old,new,rev,role,prior=0):
        events=[e for e in self.final["transitions"] if e["appointment_id"]==aid]
        receipts=[r for r in self.final["transition_receipts"] if r["appointment_id"]==aid]
        check(len(events)==len(receipts)==prior+1,"appointment transition/receipt count mismatch")
        e=events[-1];uid=self.user(role);branch=self.p["branchId"]
        check(e["action"]==action and e["old_status"]==old and e["new_status"]==new
              and e["old_revision"]==rev and e["new_revision"]==rev+1 and e["actor_id"]==uid
              and e["branch_id"]==branch and e["request_payload"]=={"appointmentId":aid,"branchId":branch,"action":action,"expectedRevision":rev}
              and e["response"]=={"kind":"staff_appointment_transition","appointmentId":aid,"branchId":branch,"status":new,"revision":rev+1,"action":action},
              "appointment transition durable receipt mismatch")

    def confirmed(self):
        a=self.appointment()
        check(a["status"] in ("confirmed","cancelled"),"confirmation missing")
        self.transition(a["id"],"confirm","requested","confirmed",1,"receptionist")
        return a

    def owner_access(self):
        _,_,pet=self.owner();a=self.appointment()
        token=self.session("ownerNew");other=self.session("ownerOther")
        check(len(self.s.rows("pets","select=id&id=eq."+pet["id"],token))==1
              and self.s.rows("pets","select=id&id=eq."+pet["id"],other)==[]
              and len(self.s.rows("appointments","select=id&id=eq."+a["id"],token))==1
              and self.s.rows("appointments","select=id&id=eq."+a["id"],other)==[],
              "owner API isolation mismatch")

    def staff_request(self):
        uid=self.auth_observed("applicant");row=singleton(self.final["staff"])
        event=singleton([e for e in self.final["staff_events"] if e["action"]=="request"])
        check(row["user_id"]==uid and row["requested_branch_id"]==self.p["branchId"]
              and row["note"]==self.marker+" staff request" and row["state"] in ("pending","approved")
              and event["actor_id"]==event["target_id"]==uid and event["branch_id"]==self.p["branchId"]
              and event["new_state"]=="pending","staff request provenance mismatch")
        if row["state"]=="pending":
            check(row["revision"]==1 and not self.final["memberships"] and not self.final["global_roles"] and not self.final["staff_receipts"],
                  "pending staff request granted access")
        return uid,row

    def approval(self):
        uid,row=self.staff_request();admin=self.user("administrator");branch=self.p["branchId"]
        grant=singleton(self.final["memberships"]);global_role=singleton(self.final["global_roles"])
        event=singleton([e for e in self.final["staff_events"] if e["action"]=="approve"])
        singleton(self.final["staff_receipts"])
        check(row["state"]=="approved" and row["revision"]==2 and row["reviewed_by"]==admin
              and grant["user_id"]==uid and grant["branch_id"]==branch and grant["role"]=="receptionist"
              and grant["is_active"] is True and grant["assigned_by"]==admin
              and global_role=={"user_id":uid,"role":"receptionist","is_active":True}
              and event["actor_id"]==admin and event["target_id"]==uid and event["branch_id"]==branch
              and event["old_state"]=="pending" and event["new_state"]=="approved" and event["new_role"]=="receptionist"
              and event["request_payload"]=={"target":uid,"action":"approve","role":"receptionist","branches":[branch],"expectedRevision":1}
              and event["response"]["userId"]==uid and event["response"]["revision"]==2 and event["response"]["state"]=="approved"
              and event["response"]["role"]=="receptionist",
              "staff approval, branch grant or durable receipt mismatch")

    def branch_access(self):
        self.approval();token=self.session("applicant")
        check(self.s.rpc("assert_staff_branch",{"p_branch":self.p["branchId"]},token)==self.p["branchId"],
              "approved branch RPC mismatch")
        self.denied("assert_staff_branch",{"p_branch":self.p["otherBranchId"]},token)
        self.denied("list_staff_access_requests",{"p_branch":self.p["branchId"]},token)

    def denied(self,rpc,args,token):
        response=self.s.rpc(rpc,args,token,expected=(401,403))
        check(isinstance(response,dict) and response.get("code")=="42501","unrecognized authorization denial")

    def clinical(self):
        d=singleton(self.final["drafts"]);a=singleton(self.final["clinical_audit"]);singleton(self.final["clinical_receipts"])
        uid=self.user("veterinarian");branch=self.p["branchId"];pet=self.p["checkedInPetId"];visit=self.p["checkedInVisitId"]
        check(d["branch_id"]==branch and d["pet_id"]==pet and d["appointment_id"]==visit and d["author_id"]==uid
              and d["revision"]==1 and d["status"]=="draft" and d["complaint"]==self.marker+" encounter"
              and all(d[k]=="" for k in ("examination","assessment","plan")),"clinical draft mismatch")
        payload={"branchId":branch,"petId":pet,"appointmentId":visit,"expectedRevision":0,
                 "complaint":d["complaint"],"examination":"","assessment":"","plan":""}
        response=a["response"]
        check(a["draft_id"]==d["id"] and a["appointment_id"]==visit and a["branch_id"]==branch and a["pet_id"]==pet
              and a["actor_id"]==uid and a["revision"]==1 and a["action"]=="created" and a["payload"]==a["receipt_payload"]==payload
              and all(response.get(k)==v for k,v in {"kind":"saved","id":d["id"],"appointmentId":visit,"branchId":branch,
                    "petId":pet,"authorId":uid,"status":"draft","revision":1}.items()) and isinstance(response.get("updatedAt"),str),
              "clinical audit or durable receipt mismatch")
        return d

    def chart(self,role,branch=None):
        return self.s.rpc("read_staff_patient_chart",{"p_branch":branch or self.p["branchId"],
                    "p_pet":self.p["checkedInPetId"],"p_section":"drafts"},self.session(role))

    def clinical_admin(self):
        d=self.clinical()
        for role in ("veterinarian","administrator"):
            response=self.chart(role)
            check(response.get("kind")=="ok" and any(v["id"]==d["id"] and v["revision"]==d["revision"] for v in response["items"]),
                  "authorized clinical readback mismatch")
        check(self.chart("administrator",self.p["otherBranchId"]).get("kind")=="not_found","cross-branch clinical disclosure")

    def clinical_denial(self):
        self.clinical()
        args={"p_branch":self.p["branchId"],"p_pet":self.p["checkedInPetId"],"p_section":"drafts"}
        self.denied("read_staff_patient_chart",args,self.session("receptionist"))

    def inventory(self):
        item=singleton(self.final["items"]);rule=singleton(self.final["rules"]);batch=singleton(self.final["batches"])
        movement=singleton(self.final["movements"]);receipts=self.final["inventory_receipts"]
        uid=self.user("receptionist");branch=self.p["branchId"];mid=item["id"]
        check(item["product_code"]=="UAT-"+self.run.upper() and item["category"]=="supply" and item["is_active"] is True
              and item["is_controlled"] is False and rule["medicine_id"]==mid and rule["branch_id"]==branch
              and batch["medicine_id"]==mid and batch["branch_id"]==branch and batch["lot_number"]=="LOT-"+self.run
              and batch["expiry_date"]==self.p["expiryDay"] and batch["on_hand_units"]==10
              and batch["reserved_units"]==batch["quarantined_units"]==0
              and movement["branch_id"]==branch and movement["medicine_id"]==mid and movement["batch_id"]==batch["id"]
              and movement["event_type"]=="receipt" and movement["delta_on_hand"]==movement["after_on_hand"]==10
              and movement["delta_reserved"]==movement["delta_quarantined"]==0 and movement["recorded_by"]==uid,
              "inventory balance or movement mismatch")
        check(len(receipts)==2,"inventory write receipt count mismatch")
        create=singleton([r for r in receipts if r["kind"]=="create"])
        receive=singleton([r for r in receipts if r["kind"]=="receive"])
        check(all(r["actor_id"]==uid and r["branch_id"]==branch and r["response"]["itemId"]==mid for r in receipts)
              and create["request_payload"]["opening"]==0 and create["request_payload"]["code"]==item["product_code"]
              and create["response"]["onHandUnits"]==0 and receive["nonce"]==movement["event_id"]
              and receive["request_payload"]["quantity"]==10 and receive["request_payload"]["lot"]==batch["lot_number"]
              and receive["response"]["eventId"]==movement["event_id"] and receive["response"]["batchId"]==batch["id"]
              and receive["response"]["receivedUnits"]==receive["response"]["lotOnHandUnits"]==10,
              "inventory durable receipt mismatch")
        return item,rule

    def balance(self,role):
        item,_=self.inventory()
        response=self.s.rpc("get_branch_inventory_balance",{"p_branch":self.p["branchId"],"p_medicine":item["id"]},self.session(role))
        check(response["itemId"]==item["id"] and response["onHandUnits"]==10,"fresh inventory balance mismatch")

    def inventory_edit(self):
        item,rule=self.inventory()
        check(rule["profile_revision"]==2 and rule["branch_display_name"]==self.marker+" supply edited"
              and rule["reorder_point_units"]==2 and rule["expiry_warning_days"]==60,"inventory edit revision mismatch")
        self.balance("administrator")
        self.denied("get_branch_inventory_balance",{"p_branch":self.p["otherBranchId"],"p_medicine":item["id"]},self.session("administrator"))

    def accountant(self):
        uid=self.user("accountant");token=self.session("accountant")
        grants=self.rows("select branch_id,role,is_active from public.staff_branch_memberships where user_id="+uuid(uid))
        check(grants==[{"branch_id":self.p["branchId"],"role":"accountant","is_active":True}],"accountant grant mismatch")
        self.denied("assert_staff_branch",{"p_branch":self.p["branchId"]},token)
        self.denied("list_staff_access_requests",{"p_branch":self.p["branchId"]},token)
        self.denied("read_staff_patient_chart",{"p_branch":self.p["branchId"],"p_pet":self.p["checkedInPetId"],"p_section":"drafts"},token)
        item,_=self.inventory()
        self.denied("get_branch_inventory_balance",{"p_branch":self.p["branchId"],"p_medicine":item["id"]},token)

    def attachment(self,denial=False):
        uid,owner,pet=self.owner();a=singleton(self.final["attachments"]);obj=singleton(self.final["objects"])
        path=a["object_path"]
        check(isinstance(path,str) and re.fullmatch(r"pets/[0-9a-f-]{36}/owners/[0-9a-f-]{36}/[0-9a-f-]{36}\.png",path)
              and path.startswith("pets/"+pet["id"]+"/owners/"+uid+"/")
              and obj["name"]==path and a["pet_id"]==pet["id"] and a["uploaded_by"]==a["object_owner"]==uid
              and a["category"]=="health_card" and a["version_no"]==1
              and a["original_filename"]=="synthetic-"+self.run+"-health-card.png"
              and a["mime_type"]==a["object_mime"]=="image/png" and a["size_bytes"]==a["object_size"]==len(PNG)
              and a["bucket_public"] is False,"private attachment metadata/ownership mismatch")
        token=self.session("ownerNew")
        check(len(self.s.rows("pet_attachments","select=id&id=eq."+a["id"],token))==1,"authorized attachment metadata absent")
        data=self.s.http("GET","/storage/v1/object/authenticated/clinical-attachments/"+path,token=token,raw=True)
        check(data==PNG and hashlib.sha256(data).digest()==hashlib.sha256(PNG).digest(),"attachment SHA256/byte mismatch")
        if denial:
            other=self.session("ownerOther")
            check(self.s.rows("pet_attachments","select=id&id=eq."+a["id"],other)==[],"cross-owner attachment metadata exposed")
            self.b.download_denied(self.s,path,other,"browser-created-attachment-unrelated-owner")

    def lifecycle(self):
        mapping={"checkIn":("check_in","checked_in","receptionist"),"noShow":("no_show","no_show","receptionist"),
                 "decline":("decline","cancelled","receptionist"),"cancel":("cancel","cancelled","receptionist"),
                 "complete":("complete","completed","veterinarian")}
        for key,(action,status,role) in mapping.items():
            aid=self.p["lifecycleVisits"][key]["id"]
            before=singleton([a for a in self.baseline["fixtures"] if a["id"]==aid])
            after=singleton([a for a in self.final["fixtures"] if a["id"]==aid])
            previous=[e for e in self.baseline["transitions"] if e["appointment_id"]==aid]
            current=[e for e in self.final["transitions"] if e["appointment_id"]==aid]
            check(current[:-1]==previous and after["status"]==status and after["lifecycle_revision"]==before["lifecycle_revision"]+1
                  and after["branch_id"]==before["branch_id"] and after["pet_id"]==before["pet_id"],"lifecycle fixture change mismatch")
            self.transition(aid,action,before["status"],status,before["lifecycle_revision"],role,len(previous))

    def cancellation(self):
        a=self.confirmed()
        check(a["status"]=="cancelled" and a["lifecycle_revision"]==3,"owner cancellation missing")

    def reconcile(self,states,quiescent=True):
        self.observe_sessions()
        self.final=self.snapshot()
        print("BROWSER_CREATED_COUNTS:",json.dumps({k:len(self.final[k]) for k in
             ("owners","pets","appointments","staff","memberships","drafts","items","batches","movements","attachments","objects")},sort_keys=True),flush=True)
        print("BROWSER_SESSION_OBSERVATION:",len(self.sessions),"of 2 new actors; observation errors",self.session_probe_errors,flush=True)
        checks={
            "owner-register":self.owner,"owner-persistence":self.appointment,"owner-isolation":self.owner_access,
            "staff-request":self.staff_request,"admin-review":self.approval,"staff-persistence":self.branch_access,
            "operations":self.confirmed,"owner-status":self.confirmed,"clinical":self.clinical,
            "clinical-admin":self.clinical_admin,"clinical-role-denial":self.clinical_denial,
            "inventory":lambda:self.balance("administrator"),"pharmacy":lambda:self.balance("veterinarian"),
            "inventory-edit":self.inventory_edit,"accountant-denial":self.accountant,
            "owner-cancel":self.cancellation,"private-attachment":self.attachment,
            "attachment-owner-isolation":lambda:self.attachment(True),"additional-lifecycle":self.lifecycle}
        outcomes={}
        try:
            for case in CASES:
                browser=states[case];verification="UI_ONLY";scope="browser-only"
                if browser=="PASS_BROWSER":
                    if not quiescent:verification="BLOCKED";scope="browser-not-quiescent"
                    elif case=="session-transition":
                        # Fresh observer logins verify owner isolation only;
                        # they cannot establish the old browser session's revocation.
                        scope="browser-session-transition;independent-owner-isolation-only"
                        try:
                            self.owner_access();verification="ISOLATION"
                            print("OWNER_ISOLATION_READBACK: session-transition PASS; independent session revocation UNVERIFIED",flush=True)
                        except Exception:
                            verification="ISOLATION_FAIL"
                            print("OWNER_ISOLATION_READBACK: session-transition FAIL; independent session revocation UNVERIFIED",flush=True)
                    elif case in checks:
                        try:
                            result=checks[case]();verification="PASS";scope="case-persistence"
                            if case=="staff-request":
                                verification="REQUEST"
                                scope=("request-event;final-pending-no-branch-or-global-grant" if result[1]["state"]=="pending"
                                       else "request-event;final-approved;intermediate-pending-no-grant-UNVERIFIED")
                            elif case in ("admin-review","staff-persistence"):
                                scope="final-approval-and-grant;intermediate-pending-no-grant-UNVERIFIED"
                        except Exception as exc:
                            verification="FAIL";scope="independent-check-failed"
                            print("RECEIPT_CHECK_FAILED:",case,type(exc).__name__,flush=True)
                    elif case in ("email-callback","email-recovery","clinical-uncertain","controlled-late-response"):
                        verification="BLOCKED"
                    outcomes[case]=receipt_status(browser,verification)
                else:
                    outcomes[case]=browser;scope="browser-"+browser.lower()
                    if browser=="FAIL" and case in checks and quiescent:
                        try:
                            checks[case]()
                            partial="persisted-invariant-observed"
                        except Exception:partial="absent-or-mismatch"
                        print("PARTIAL_DB_CHECK:",case,partial,"browser failure unchanged",flush=True)
                print("CASE_RECEIPT:",case,"browser="+browser,"result="+outcomes[case],"scope="+scope,flush=True)
        finally:
            # Observer sessions are independently obtained, never counted as
            # browser sessions, and are cleaned up with local Auth logout.
            for token in self.tokens.values():
                try:self.s.http("POST","/auth/v1/logout?scope=local",token=token,expected=(200,204))
                except Exception:print("RECEIPT_OBSERVER_LOGOUT_FAILED",flush=True)
            self.tokens.clear()
        return outcomes

def stop_process(proc):
    if proc.poll() is not None:return
    # The browser launch owns a distinct session/process group. The two
    # fixed relays have their own groups and must survive for receipt readback.
    for sig in ("TERM","KILL"):
        subprocess.run(["sudo","kill","-"+sig,"--","-"+str(proc.pid)],capture_output=True,timeout=5)
        try:proc.wait(timeout=8);return
        except subprocess.TimeoutExpired:pass
    raise RuntimeError("browser process could not be stopped")

def namespace_pids(b):
    text=b.run(["sudo","ip","netns","pids","dawney-rc2-browser"],timeout=8).decode().split()
    check(all(re.fullmatch(r"[1-9][0-9]*",pid) for pid in text),"namespace process inventory invalid")
    return {int(pid) for pid in text}

def quiesce(b,baseline):
    # Ensure there are no stray browser descendants able to commit writes
    # during independent readback. Never signal baseline relay or host PIDs.
    for sig in ("TERM","KILL"):
        current=namespace_pids(b)
        check(baseline.issubset(current),"namespace relay unexpectedly stopped")
        extra=current-baseline
        if not extra:return True
        b.run(["sudo","kill","-"+sig,"--",*map(str,sorted(extra))],timeout=8)
        time.sleep(1)
    return namespace_pids(b)==baseline

def execute(s,p,b,collector,prefix,cloud,work,packet_path,recheck):
    check(collector.baseline is not None,"fresh receipt baseline required")
    output=work/"new-evidence";log=work/"browser-private.log"
    check(not output.exists() and not log.exists(),"fresh private evidence required")
    args=prefix+["env","DAWNEY_CONNECTED_PACKET="+str(packet_path),
        "DAWNEY_CONNECTED_APPROVAL="+p["runId"],"DAWNEY_CONNECTED_EVIDENCE="+str(output),
        "node",str(cloud/"web/tests/connected/run.mjs")]
    timed_out=False;proc=None;started=time.monotonic();launch_failed=False
    baseline=namespace_pids(b)
    check(len(baseline)==1,"expected only fixed namespace relay before browser launch")
    with log.open("xb") as private_log:
        # Exact authority must still hold after lengthy bootstrap, immediately
        # before Popen. Host-side GET only; isolated browser receives no token.
        recheck()
        print("CONNECTED_EXECUTION_GATE: EXACT_OCCURRENCE_REVALIDATED",flush=True)
        try:
            proc=subprocess.Popen(args,cwd=cloud,env=b.ENV,stdout=private_log,stderr=subprocess.STDOUT,start_new_session=True)
            while proc.poll() is None:
                collector.observe_sessions()
                if time.monotonic()-started>=900:
                    timed_out=True;stop_process(proc);break
                time.sleep(1)
        except Exception:
            launch_failed=True
            print("BROWSER_PROCESS_CONTROL_FAILED",flush=True)
        finally:
            if proc is not None and proc.poll() is None:
                try:stop_process(proc)
                except Exception:launch_failed=True
    quiescent=False
    try:quiescent=quiesce(b,baseline) and (proc is None or proc.poll() is not None)
    except Exception:pass
    print("BROWSER_NAMESPACE_QUIESCENT:",str(quiescent).lower(),flush=True)
    rc=proc.returncode if proc is not None else None
    print("BROWSER_EXIT:",rc,"timeout="+str(timed_out).lower(),flush=True)
    states,report_valid=report_outcomes(output,p,launched=proc is not None,
                                         orderly=quiescent and not timed_out and not launch_failed and rc in (0,1,2))
    if not report_valid:
        print("BROWSER_REPORT_MISSING_OR_INCOMPLETE: unresolved cases UNKNOWN after launch; valid partial states retained",flush=True)
    # No browser stdout, screenshots, packet or raw database rows uploaded.
    screenshots=0
    if report_valid:
        try:
            for file in output.iterdir():
                if file.suffix==".png":
                    check(re.fullmatch(r"[a-z0-9-]+\.png",file.name),"screenshot filename")
                    private_regular(file,20_000_000)
                    with file.open("rb") as f:check(f.read(8)==b"\x89PNG\r\n\x1a\n","invalid PNG header")
                    screenshots+=1
        except Exception:report_valid=False
    print("PRIVATE_SYNTHETIC_SCREENSHOTS:",screenshots,"not published; destroyed at teardown",flush=True)
    # Even failure, timeout, or incomplete report must reach actual readback.
    try:outcomes=collector.reconcile(states,quiescent=quiescent)
    except Exception:
        print("RECEIPT_COLLECTION_FAILED: database readback unavailable",flush=True)
        outcomes={case:("FAIL_PERSISTENCE" if state=="PASS_BROWSER" else state) for case,state in states.items()}
        for case in CASES:print("CASE_RECEIPT:",case,"browser="+states[case],"result="+outcomes[case],flush=True)
        report_valid=False
    summary={k:sum(v==k for v in outcomes.values()) for k in sorted(set(outcomes.values()))}
    print("CONNECTED_RECEIPT_SUMMARY:",json.dumps(summary,sort_keys=True),flush=True)
    # Preserve exact browser exit independently of receipt verdict; never turn
    # browser failure/blocked into green CI. The current runner always exits 1/2.
    if timed_out:return 124
    if rc is None:return 1
    if rc!=0:return rc if rc>0 else 128-rc
    return 0 if report_valid and quiescent and not launch_failed and all(v in ("PASS_PERSISTENCE","PASS_BROWSER_ONLY","PASS_REQUEST_RECEIPT") for v in outcomes.values()) else 1
