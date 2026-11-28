"""Deterministic offline contracts; no real approval, network, browser or database."""
import copy
import datetime as dt
import json
from pathlib import Path
import tempfile
import os
import urllib.error
import socket
import ssl
import unittest
from unittest.mock import Mock, patch
from receipts import (CASES, OWNER, OWNER_ID, REPO, REPO_ID, PR_ID, BRANCH, WORKFLOW,
    WORKFLOW_ID, LABEL, requested, clearance, authorize, read_report, report_outcomes,
    receipt_status, literal, Collector, execute, unavailable_readback,
    GateRefusal, github_read, diagnostic, HISTORICAL_HEAD, HISTORICAL_RUN, HISTORICAL_SOL, HISTORICAL_PM,
    HISTORICAL_EVENT, http_reason, host_reader, credential_isolation)

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
            self.assertEqual(report_outcomes(out,self.p,True,True)[0]["owner-register"],"UNKNOWN")
            for row in rows:
                if row["id"] in ("clinical-uncertain","controlled-late-response"):row["status"]="BLOCKED"
            self.report(out,rows)
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
    def test_recheck_refusal_prevents_process_launch(self):
        with tempfile.TemporaryDirectory() as root:
            work=Path(root);collector=Mock();collector.baseline={}
            recheck=Mock(side_effect=RuntimeError("approval revoked"))
            with patch("receipts.namespace_pids",return_value={123}),patch("receipts.subprocess.Popen") as launch:
                with self.assertRaisesRegex(RuntimeError,"approval revoked"):
                    execute(None,self.p,Mock(),collector,["isolated"],work,work,work/"packet.json",recheck)
            recheck.assert_called_once();launch.assert_not_called()
    def test_unavailable_readback_does_not_erase_or_overclaim_browser(self):
        for case in ("session-transition","staff-request","clinical"):
            self.assertEqual(unavailable_readback(case,"PASS_BROWSER"),"UNVERIFIED")
        self.assertEqual(unavailable_readback("public","PASS_BROWSER"),"PASS_BROWSER_ONLY")
        for state in ("UNKNOWN","FAIL","BLOCKED","NOT_RUN"):
            self.assertEqual(unavailable_readback("staff-request",state),state)
    def test_gate_fixed_reason_and_stage(self):
        for path,exc,code in (
            ("/issues/comments/101",urllib.error.HTTPError("https://example.invalid/secret",403,"secret",{"X-RateLimit-Remaining":"0"},None),"API_RATE_LIMIT"),
            ("/issues/comments/101",urllib.error.HTTPError("https://example.invalid/secret",404,"secret",{},None),"HTTP_404"),
            ("/issues/comments/101",urllib.error.HTTPError("https://example.invalid/secret",503,"secret",{},None),"HTTP_5XX"),
            ("/issues/comments/101",urllib.error.URLError(socket.gaierror("secret")),"API_DNS"),
            ("/issues/comments/101",urllib.error.URLError(ssl.SSLError("secret")),"API_TLS"),
            ("/issues/comments/101",TimeoutError("secret"),"API_TIMEOUT"),
            ("/issues/comments/101",OSError("secret"),"API_TRANSPORT")):
            def read(p):
                if p==path:raise exc
                return self.read(p)
            with self.subTest(code=code),self.assertRaises(GateRefusal) as cm:
                authorize(self.event,self.head,self.cloud,"1","731",read=read,now=self.now)
            self.assertEqual((cm.exception.stage,cm.exception.code),("ENTRY_SOL_COMMENT",code))
            self.assertNotIn("secret",str(cm.exception))
    def test_distinguish_predicate_failures(self):
        for attr,value,code in (
            ("pr",{**self.pr,"labels":[]},"LIVE_PR_LABEL_IDENTITY"),
            ("pm",{**self.pm,"created_at":self.at("09:00:00"),"updated_at":self.at("09:00:00")},"CHRONOLOGY_ORDER"),
            ("run",{**self.run,"status":"queued"},"WORKFLOW_STATUS_NOT_IN_PROGRESS"),
            ("run",{**self.run,"pull_requests":[]},"WORKFLOW_PR_NOT_VISIBLE"),
            ("events",[],"LABEL_HISTORY_MISSING_OR_NOT_VISIBLE"),
            ("runs",[],"WORKFLOW_RUN_NOT_VISIBLE"),
            ("sol",[],"SCHEMA_COMMENT")):
            saved=getattr(self,attr);setattr(self,attr,value)
            try:
                with self.subTest(code=code),self.assertRaises(GateRefusal) as cm:self.auth()
                self.assertEqual(cm.exception.code,code)
            finally:setattr(self,attr,saved)
        def malformed(path):
            if path.startswith("/actions/runs?"):return {"total_count":2,"workflow_runs":[self.run]}
            return self.read(path)
        with self.assertRaises(GateRefusal) as cm:
            authorize(self.event,self.head,self.cloud,"1","731",read=malformed,now=self.now)
        self.assertEqual((cm.exception.stage,cm.exception.code),("ENTRY_RUN_LIST","PAGINATION_RUN_INCOMPLETE"))
        with self.assertRaises(GateRefusal) as cm:
            authorize({**self.event,"sender":{"id":0,"login":"other"}},self.head,self.cloud,"1","731",read=self.read)
        self.assertEqual(cm.exception.code,"EVENT_IDENTITY")
    def test_http_reason_no_raw_values(self):
        self.assertEqual(http_reason(429,{}),"API_RATE_LIMIT")
        self.assertEqual(http_reason(403,{"Retry-After":"secret"}),"API_RATE_LIMIT")
        self.assertEqual(http_reason(403,{}),"HTTP_403")
        self.assertEqual(http_reason(302,{}),"HTTP_REDIRECT_REFUSED")
        self.assertEqual(http_reason(418,{}),"HTTP_4XX")
        with patch("receipts.urllib.request.build_opener") as opener:
            response=opener.return_value.open.return_value.__enter__.return_value
            response.status=200;response.read.return_value=b"not json: secret"
            with self.assertRaises(GateRefusal) as cm:github_read("/pulls/146",token="fake-test-token")
            self.assertEqual(cm.exception.code,"SCHEMA_JSON")
            self.assertNotIn("secret",str(cm.exception))
    def test_diagnostic_only_synchronize_never_grants(self):
        event={**self.event,"action":"synchronize"}
        sol=self.comment(HISTORICAL_SOL,"SOL CONNECTED RUNTIME AND RECEIPT PASS "+HISTORICAL_HEAD+" "+self.cloud,"09:00:00")
        pm=self.comment(HISTORICAL_PM,"PM CONNECTED EXECUTION CLEARANCE "+HISTORICAL_HEAD+" "+self.cloud+" SOL="+str(HISTORICAL_SOL),"09:00:02")
        old={**self.run,"id":HISTORICAL_RUN,"head_sha":HISTORICAL_HEAD,"status":"completed","conclusion":"failure"}
        history=[{**self.events[0],"id":HISTORICAL_EVENT,"label":{"name":LABEL+"-"+str(HISTORICAL_SOL)+"-"+str(HISTORICAL_PM)}}]
        def read(path):
            fixed={"/issues/comments/"+str(HISTORICAL_SOL):sol,"/issues/comments/"+str(HISTORICAL_PM):pm,
                   "/actions/runs/"+str(HISTORICAL_RUN):old,"/issues/146/events?per_page=100&page=1":history}
            return copy.deepcopy(fixed[path]) if path in fixed else self.read(path)
        with patch("receipts.authorize") as auth,patch("receipts.clearance") as clearance_mock,patch("receipts.execute") as launch:
            self.assertIsNone(diagnostic(event,self.head,self.cloud,"1","731",read=read))
            auth.assert_not_called();clearance_mock.assert_not_called();launch.assert_not_called()
        never=Mock(side_effect=AssertionError("must not read"))
        for e,attempt in ((self.event,"1"),(event,"2")):
            with self.assertRaises(GateRefusal):diagnostic(e,self.head,self.cloud,attempt,"731",read=never)
        never.assert_not_called()
    def test_authenticated_get_only_and_path_refusal(self):
        fake="fake-test-token"
        with patch("receipts.urllib.request.build_opener") as opener:
            response=opener.return_value.open.return_value.__enter__.return_value
            response.status=200;response.read.return_value=b'{"id":146}'
            self.assertEqual(github_read("/pulls/146",token=fake),{"id":146})
            req=opener.return_value.open.call_args.args[0]
            self.assertEqual(req.full_url,"https://api.github.com/repos/"+REPO+"/pulls/146")
            self.assertEqual(req.get_method(),"GET")
            self.assertEqual(req.get_header("Authorization"),"Bearer "+fake)
            proxy,redirect=opener.call_args.args
            self.assertEqual(proxy.proxies,{})
            self.assertIsNone(redirect.redirect_request(None,None,302,None,None,"https://example.invalid"))
            opener.reset_mock()
            for path in ("https://example.invalid","/../other","/pulls/147","/pulls/146?x=1","/actions/runs/1%2f..",
                         "/issues/146/events?per_page=100&page=11","/actions/runs?head_sha=bad&event=pull_request&per_page=100&page=1"):
                with self.subTest(path=path),self.assertRaises(GateRefusal) as cm:github_read(path,token=fake)
                self.assertEqual(cm.exception.code,"AUTH_PATH_REFUSED")
            opener.assert_not_called()
    def test_missing_invalid_denied_and_limited_token_fail_closed(self):
        with patch("receipts.urllib.request.build_opener") as opener:
            for value,code in ((None,"AUTH_TOKEN_MISSING"),("","AUTH_TOKEN_MISSING"),("bad\nsecret","AUTH_TOKEN_FORMAT")):
                with self.assertRaises(GateRefusal) as cm:github_read("/pulls/146",token=value)
                self.assertEqual(cm.exception.code,code)
                self.assertNotIn("secret",str(cm.exception))
            opener.assert_not_called()
            for status,headers,code in ((401,{},"HTTP_401"),(403,{},"HTTP_403"),(429,{},"API_RATE_LIMIT"),(302,{},"HTTP_REDIRECT_REFUSED")):
                opener.reset_mock()
                opener.return_value.open.side_effect=urllib.error.HTTPError("https://example.invalid/secret",status,"secret",headers,None)
                with self.assertRaises(GateRefusal) as cm:github_read("/pulls/146",token="fake-test-token")
                self.assertEqual(cm.exception.code,code)
                self.assertNotIn("secret",str(cm.exception))
                opener.return_value.open.assert_called_once()
    def test_host_reader_removes_token_before_child_and_keeps_private_reader(self):
        env={"GITHUB_ACTIONS":"true","RUNNER_ENVIRONMENT":"github-hosted","GITHUB_REPOSITORY":REPO,"GITHUB_TOKEN":"fake-test-token"}
        with patch.dict(os.environ,env,clear=True),patch("receipts.ctypes.CDLL") as libc,patch("receipts.github_read") as get:
            libc.return_value.prctl.return_value=0
            reader=host_reader()
            self.assertNotIn("GITHUB_TOKEN",os.environ)
            self.assertEqual(libc.return_value.prctl.call_args_list[0].args,(4,0,0,0,0))
            reader("/pulls/146")
            get.assert_called_once_with("/pulls/146",token="fake-test-token")
            with patch("receipts.subprocess.run") as child:
                child.return_value.returncode=0;child.return_value.stdout=child.return_value.stderr=b""
                credential_isolation({"PATH":"/usr/bin"})
                self.assertEqual(child.call_args.kwargs["env"],{"PATH":"/usr/bin"})
                self.assertNotIn("fake-test-token",str(child.call_args))
                child.return_value.returncode=3
                with self.assertRaises(GateRefusal):credential_isolation({"PATH":"/usr/bin"})
                with self.assertRaises(GateRefusal):credential_isolation({"GITHUB_TOKEN":"fake-test-token"})
        with patch.dict(os.environ,env,clear=True),patch("receipts.ctypes.CDLL") as libc:
            libc.return_value.prctl.return_value=1
            with self.assertRaises(GateRefusal) as cm:host_reader()
            self.assertEqual(cm.exception.code,"AUTH_PROCESS_PROTECTION")
    def test_authenticated_failure_at_entry_and_recheck_never_grants(self):
        for previous,stage in ((None,"ENTRY_SOL_COMMENT"),(self.auth(),"RECHECK_SOL_COMMENT")):
            with patch("receipts.urllib.request.build_opener") as opener:
                opener.return_value.open.side_effect=urllib.error.HTTPError("https://example.invalid",403,"secret",{},None)
                with self.assertRaises(GateRefusal) as cm:
                    authorize(self.event,self.head,self.cloud,"1","731",previous=previous,
                              read=lambda path:github_read(path,token="fake-test-token"),now=self.now)
                self.assertEqual((cm.exception.stage,cm.exception.code),(stage,"HTTP_403"))
                opener.return_value.open.assert_called_once()
    def test_literal(self):
        self.assertEqual(literal("a'b"),"'a''b'")
        with self.assertRaises(RuntimeError):literal("a\\b")
if __name__=="__main__":unittest.main()
