"""Deterministic offline contracts; no real approval, network, browser or database."""
import copy
import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from receipts import (CASES, OWNER, OWNER_ID, REPO, REPO_ID, PR_ID, BRANCH, WORKFLOW,
    WORKFLOW_ID, LABEL, requested, clearance, authorize, read_report, report_outcomes,
    receipt_status, literal, Collector)

class Contract(unittest.TestCase):
    def setUp(self):
        self.head="a"*40;self.cloud="b"*40;self.rid=731;self.sol_id=101;self.pm_id=102
        self.owner={"login":OWNER,"id":OWNER_ID}
        self.repo={"full_name":REPO,"id":REPO_ID}
        self.label={"name":LABEL+"-101-102","id":13}
        self.pr={"id":PR_ID,"number":146,"state":"open","draft":True,
            "head":{"sha":self.head,"ref":BRANCH,"repo":self.repo},"labels":[self.label]}
        self.event={"action":"labeled","label":self.label,"sender":self.owner,"number":146,
            "repository":self.repo,"pull_request":copy.deepcopy(self.pr)}
        self.sol=self.comment(101,"SOL CONNECTED RUNTIME AND RECEIPT PASS "+self.head+" "+self.cloud,"09:00:00")
        self.pm=self.comment(102,"PM CONNECTED EXECUTION CLEARANCE "+self.head+" "+self.cloud+" SOL=101","09:00:02")
        self.events=[{"id":301,"event":"labeled","label":{"name":self.label["name"]},
            "actor":self.owner,"created_at":self.at("09:00:04")}]
        self.run={"id":self.rid,"workflow_id":WORKFLOW_ID,"path":WORKFLOW,"event":"pull_request",
            "run_attempt":1,"head_sha":self.head,"head_branch":BRANCH,"status":"in_progress",
            "repository":self.repo,"head_repository":self.repo,"actor":self.owner,"triggering_actor":self.owner,
            "pull_requests":[{"id":PR_ID,"number":146,"head":self.pr["head"]}],
            "created_at":self.at("09:00:05")}
        self.runs=[copy.deepcopy(self.run)]
        self.now=dt.datetime(2026,11,28,9,5,tzinfo=dt.timezone.utc)
        self.p={"sourceSha":self.head,"webTree":self.cloud,"runId":"run-offline","runtimeEvidence":"offline-test-only"}
    def at(self,t):return "2026-11-28T"+t+"Z"
    def comment(self,cid,body,t):
        return {"id":cid,"body":body,"user":self.owner,"author_association":"OWNER",
            "issue_url":"https://api.github.com/repos/"+REPO+"/issues/146",
            "created_at":self.at(t),"updated_at":self.at(t)}
    def gate(self,**kw):
        params=dict(event=self.event,head=self.head,cloud=self.cloud,run_id=self.rid,run=self.run,
            pr=self.pr,sol=self.sol,pm=self.pm,events=self.events,runs=self.runs,now=self.now)
        params.update(kw);return clearance(**params)
    def read(self,path):
        fixed={"/issues/comments/101":self.sol,"/issues/comments/102":self.pm,"/actions/runs/731":self.run,
            "/issues/146/events?per_page=100&page=1":self.events,
            "/actions/runs?head_sha="+self.head+"&event=pull_request&per_page=100&page=1":
                {"total_count":len(self.runs),"workflow_runs":self.runs},"/pulls/146":self.pr}
        return copy.deepcopy(fixed[path])
    def auth(self,previous=None):
        return authorize(self.event,self.head,self.cloud,"1",str(self.rid),previous=previous,read=self.read,now=self.now)
    def test_default_refuses(self):
        for action in ("opened","synchronize","reopened"):
            self.assertFalse(requested({**self.event,"action":action},"1"))
        self.assertFalse(requested(self.event,"2"))
        self.assertFalse(requested({**self.event,"sender":{"login":"other"}},"1"))
        self.assertFalse(requested({**self.event,"label":{"name":LABEL}},"1"))
        self.assertFalse(requested({**self.event,"label":{"name":LABEL+"-101-101"}},"1"))
        self.assertTrue(requested(self.event,"1"))
        self.assertIsNone(authorize({**self.event,"action":"synchronize"},self.head,self.cloud,"1","731",
                                    read=Mock(side_effect=AssertionError("network must not run"))))
    def test_valid_order_and_recheck(self):
        token=self.auth();self.assertEqual(token,self.gate())
        self.assertEqual(self.auth(previous=token),token)
    def test_premature_trigger_and_same_second_refused(self):
        for t in ("08:59:59","09:00:01","09:00:02"):
            with self.subTest(t=t),self.assertRaises(RuntimeError):
                self.gate(events=[{**self.events[0],"created_at":self.at(t)}])
        for t in ("08:59:59","09:00:00"):
            with self.subTest(t=t),self.assertRaises(RuntimeError):
                self.gate(pm={**self.pm,"created_at":self.at(t),"updated_at":self.at(t)})
    def test_exact_comments_and_actor(self):
        for kwargs in (
            {"head":"c"*40},{"cloud":"c"*40},{"sol":{**self.sol,"id":99}},
            {"pm":{**self.pm,"body":self.pm["body"].replace("SOL=101","SOL=99")}},
            {"pm":{**self.pm,"author_association":"MEMBER"}},
            {"pm":{**self.pm,"updated_at":self.at("09:00:03")}},
            {"pm":{**self.pm,"issue_url":"https://api.github.com/repos/"+REPO+"/issues/63"}},
            {"pm":{**self.pm,"user":{"login":OWNER,"id":999}}}):
            with self.subTest(kwargs=list(kwargs)),self.assertRaises(RuntimeError):self.gate(**kwargs)
    def test_replayed_removed_replaced_and_ambiguous_label(self):
        for extra in (
            {**self.events[0],"id":302},
            {**self.events[0],"id":302,"event":"unlabeled"},
            {**self.events[0],"id":302,"label":{"name":LABEL+"-101-103"}},
            {**self.events[0],"id":302,"label":{"name":LABEL+"-103-102"}}):
            with self.subTest(extra=extra),self.assertRaises(RuntimeError):self.gate(events=self.events+[extra])
        for events in ([],[{**self.events[0],"actor":{"login":"other","id":99}}],
                       [{**self.events[0],"created_at":"ambiguous"}]):
            with self.assertRaises(RuntimeError):self.gate(events=events)
    def test_stale_run_and_approvals(self):
        for kwargs in (
            {"now":self.now+dt.timedelta(minutes=36)},
            {"sol":{**self.sol,"created_at":"2026-11-26T09:00:00Z","updated_at":"2026-11-26T09:00:00Z"}},
            {"pm":{**self.pm,"created_at":self.at("08:30:00"),"updated_at":self.at("08:30:00")}},
            {"run":{**self.run,"created_at":self.at("09:02:05")}},
            {"run":{**self.run,"created_at":self.at("09:00:03")}},
            {"run":{**self.run,"run_attempt":2}},{"run":{**self.run,"workflow_id":99}}):
            with self.subTest(kwargs=list(kwargs)),self.assertRaises(RuntimeError):self.gate(**kwargs)
        late=self.at("09:16:00")
        with self.assertRaises(RuntimeError):
            self.gate(events=[{**self.events[0],"created_at":late}],run={**self.run,"created_at":late})
    def test_run_replay_or_ambiguity(self):
        for runs in ([],[dict(self.run,id=732)],[self.run,dict(self.run,id=732)],
                     [dict(self.run,run_attempt=2)],[dict(self.run,created_at=self.at("09:00:06"))]):
            with self.assertRaises(RuntimeError):self.gate(runs=runs)
        # A previous preflight on this SHA and other workflows are not this trigger.
        self.assertEqual(self.gate(runs=[self.run,dict(self.run,id=730,created_at=self.at("08:59:50")),
                                      dict(self.run,id=729,workflow_id=99)]),self.gate())
    def test_changed_head_label_or_state_recheck(self):
        token=self.auth()
        for pr in ({**self.pr,"head":{**self.pr["head"],"sha":"c"*40}},
                   {**self.pr,"labels":[]},{**self.pr,"labels":[{**self.label,"id":99}]},
                   {**self.pr,"state":"closed"},{**self.pr,"draft":False}):
            with self.assertRaises(RuntimeError):self.gate(pr=pr)
        with self.assertRaises(RuntimeError):
            self.gate(events=self.events+[{"id":333,"event":"head_ref_force_pushed","created_at":self.at("09:00:03")}])
        self.pr["labels"]=[]
        with self.assertRaises(RuntimeError):self.auth(previous=token)
    def test_recheck_same_identity_and_unavailable_control_plane(self):
        token=self.auth()
        self.events[0]["id"]=999
        with self.assertRaises(RuntimeError):self.auth(previous=token)
        with self.assertRaises(RuntimeError):
            authorize(self.event,self.head,self.cloud,"1","731",read=Mock(side_effect=OSError("offline")),now=self.now)
        with self.assertRaises(RuntimeError):
            authorize(self.event,self.head,self.cloud,"2","731",previous=token,read=self.read,now=self.now)
    def report(self,out,rows=None,**kw):
        obj={**self.p,"evidenceClass":"isolated-synthetic-real-api-browser-not-hosted",
            "results":rows if rows is not None else [{"id":c,"status":"NOT_RUN"} for c in CASES]}
        obj.update(kw);path=out/"result.json";path.write_text(json.dumps(obj));path.chmod(0o600);return path
    def test_missing_invalid_after_launch_unknown(self):
        with tempfile.TemporaryDirectory() as root:
            out=Path(root);out.chmod(0o700)
            self.assertEqual(report_outcomes(out,self.p,True,False),(dict.fromkeys(CASES,"UNKNOWN"),False))
            self.assertEqual(report_outcomes(out,self.p,False,False),(dict.fromkeys(CASES,"NOT_RUN"),False))
            path=self.report(out,runId="wrong")
            self.assertEqual(report_outcomes(out,self.p,True,True),(dict.fromkeys(CASES,"UNKNOWN"),False))
            path.write_text("{broken");self.assertFalse(report_outcomes(out,self.p,True,True)[1])
    def test_partial_report_preserved_and_duplicates_not_promoted(self):
        with tempfile.TemporaryDirectory() as root:
            out=Path(root);out.chmod(0o700)
            rows=[{"id":"public","status":"PASS_BROWSER"},{"id":"owner-register","status":"FAIL"},
                {"id":"owner-persistence","status":"NOT_RUN"},{"id":"clinical","status":"PASS_BROWSER"},
                {"id":"clinical","status":"PASS_BROWSER"},{"id":"pharmacy","status":"invented"}]
            self.report(out,rows)
            states,complete=report_outcomes(out,self.p,True,False)
            self.assertFalse(complete)
            self.assertEqual(states["public"],"PASS_BROWSER");self.assertEqual(states["owner-register"],"FAIL")
            for case in ("owner-persistence","clinical","pharmacy","inventory"):self.assertEqual(states[case],"UNKNOWN")
    def test_complete_report_interrupted_placeholders_unknown(self):
        with tempfile.TemporaryDirectory() as root:
            out=Path(root);out.chmod(0o700)
            rows=[{"id":c,"status":"NOT_RUN"} for c in CASES];rows[0]["status"]="PASS_BROWSER"
            path=self.report(out,rows)
            self.assertTrue(read_report(path,self.p)[1])
            self.assertEqual(report_outcomes(out,self.p,True,True)[0]["owner-register"],"NOT_RUN")
            self.assertEqual(report_outcomes(out,self.p,True,False)[0]["owner-register"],"UNKNOWN")
            path.chmod(0o644);self.assertFalse(report_outcomes(out,self.p,True,True)[1])
    def test_no_promotion_and_scoped_status(self):
        for state in ("NOT_RUN","FAIL","BLOCKED","UNKNOWN"):
            self.assertEqual(receipt_status(state,"PASS"),state)
        self.assertEqual(receipt_status("PASS_BROWSER","PASS"),"PASS_PERSISTENCE")
        self.assertEqual(receipt_status("PASS_BROWSER","FAIL"),"FAIL_PERSISTENCE")
        self.assertEqual(receipt_status("PASS_BROWSER","UI_ONLY"),"PASS_BROWSER_ONLY")
        self.assertEqual(receipt_status("PASS_BROWSER","ISOLATION"),"PASS_BROWSER_ONLY")
        self.assertEqual(receipt_status("PASS_BROWSER","ISOLATION_FAIL"),"FAIL_ISOLATION_READBACK")
        self.assertEqual(receipt_status("PASS_BROWSER","REQUEST"),"PASS_REQUEST_RECEIPT")
    def test_pending_global_role_absence(self):
        c=Collector.__new__(Collector);c.p={"branchId":"branch"};c.marker="Synthetic test"
        c.auth_observed=Mock(return_value="applicant")
        c.final={"staff":[{"user_id":"applicant","requested_branch_id":"branch","note":"Synthetic test staff request",
                           "state":"pending","revision":1}],
                 "staff_events":[{"action":"request","actor_id":"applicant","target_id":"applicant",
                                  "branch_id":"branch","new_state":"pending"}],
                 "memberships":[],"global_roles":[],"staff_receipts":[]}
        self.assertEqual(c.staff_request()[1]["state"],"pending")
        c.final["global_roles"]=[{"user_id":"applicant","role":"receptionist"}]
        with self.assertRaises(RuntimeError):c.staff_request()
    def test_scoped_reconcile_not_session_revocation_or_pending_interval(self):
        c=Collector.__new__(Collector);c.observe_sessions=Mock();c.sessions=set();c.session_probe_errors=0;c.tokens={}
        c.snapshot=Mock(return_value={k:[] for k in ("owners","pets","appointments","staff","memberships","drafts","items",
                                                   "batches","movements","attachments","objects")})
        c.owner_access=Mock();c.staff_request=Mock(return_value=("applicant",{"state":"approved"}))
        states=dict.fromkeys(CASES,"UNKNOWN");states["session-transition"]=states["staff-request"]="PASS_BROWSER"
        with patch("builtins.print") as log:
            results=c.reconcile(states)
        self.assertEqual(results["session-transition"],"PASS_BROWSER_ONLY")
        self.assertEqual(results["staff-request"],"PASS_REQUEST_RECEIPT")
        self.assertEqual(results["public"],"UNKNOWN")
        lines=[" ".join(map(str,call.args)) for call in log.call_args_list]
        self.assertTrue(any("independent session revocation UNVERIFIED" in line for line in lines))
        self.assertTrue(any("intermediate-pending-no-grant-UNVERIFIED" in line for line in lines))
        c.owner_access.assert_called_once()
    def test_literal(self):
        self.assertEqual(literal("a'b"),"'a''b'")
        with self.assertRaises(RuntimeError):literal("a\\b")
if __name__=="__main__":unittest.main()
