"""Offline contract regressions; no database, browser, real actor or approval."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from receipts import CASES, OWNER, REPO, LABEL, requested, clearance, read_report, receipt_status, literal

class Contract(unittest.TestCase):
    def setUp(self):
        self.head="a"*40;self.cloud="b"*40
        self.event={"action":"labeled","label":{"name":LABEL},"sender":{"login":OWNER},"number":146,"repository":{"full_name":REPO}}
        self.comments=[{"id":i+1,"body":prefix+" "+self.head+" "+self.cloud,"user":{"login":OWNER},
                        "author_association":"OWNER","created_at":"2026-11-28T09:00:00Z","updated_at":"2026-11-28T09:00:00Z"}
                       for i,prefix in enumerate(("SOL CONNECTED RUNTIME AND RECEIPT PASS","PM CONNECTED EXECUTION CLEARANCE"))]
    def test_default_refuses(self):
        for action in ("opened","synchronize","reopened"):
            self.assertFalse(requested({**self.event,"action":action},"1"))
        self.assertFalse(requested(self.event,"2"))
        self.assertFalse(requested({**self.event,"sender":{"login":"other"}},"1"))
        self.assertFalse(requested({**self.event,"label":{"name":"ready"}},"1"))
        self.assertTrue(requested(self.event,"1"))
    def test_exact_separate_clearance(self):
        self.assertTrue(clearance(self.comments,self.head,self.cloud))
        self.assertFalse(clearance(self.comments[:1],self.head,self.cloud))
        self.assertFalse(clearance(self.comments,"c"*40,self.cloud))
        self.assertFalse(clearance(self.comments,self.head,"c"*40))
        self.assertFalse(clearance(self.comments+[self.comments[0]],self.head,self.cloud))
        self.assertFalse(clearance([self.comments[0],{**self.comments[1],"author_association":"MEMBER"}],self.head,self.cloud))
        self.assertFalse(clearance([self.comments[0],{**self.comments[1],"updated_at":"later"}],self.head,self.cloud))
        self.assertFalse(clearance([self.comments[0],{**self.comments[1],"id":1}],self.head,self.cloud))
    def test_report_strict(self):
        p={"sourceSha":self.head,"webTree":self.cloud,"runId":"run-offline","runtimeEvidence":"offline-test-only"}
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/"result.json"
            obj={**p,"evidenceClass":"isolated-synthetic-real-api-browser-not-hosted",
                 "results":[{"id":c,"status":"NOT_RUN"} for c in CASES]}
            obj["results"][0]["status"]="PASS_BROWSER"
            path.write_text(json.dumps(obj));path.chmod(0o600)
            self.assertEqual(read_report(path,p)["public"],"PASS_BROWSER")
            obj["results"][1]["id"]="public";path.write_text(json.dumps(obj))
            with self.assertRaises(RuntimeError):read_report(path,p)
            path.chmod(0o644)
            with self.assertRaises(RuntimeError):read_report(path,p)
    def test_no_promotion(self):
        for state in ("NOT_RUN","FAIL","BLOCKED"):
            self.assertEqual(receipt_status(state,"PASS"),state)
        self.assertEqual(receipt_status("PASS_BROWSER","PASS"),"PASS_PERSISTENCE")
        self.assertEqual(receipt_status("PASS_BROWSER","FAIL"),"FAIL_PERSISTENCE")
        self.assertEqual(receipt_status("PASS_BROWSER","UI_ONLY"),"PASS_BROWSER_ONLY")
    def test_literal(self):
        self.assertEqual(literal("a'b"),"'a''b'")
        with self.assertRaises(RuntimeError):literal("a\\b")
if __name__=="__main__":unittest.main()
