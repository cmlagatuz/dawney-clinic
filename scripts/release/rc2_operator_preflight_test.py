#!/usr/bin/env python3
"""Actual disposable Git/local-evidence regression; never use hosted data."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = "scripts/release/rc2_operator_preflight.py"
LEDGER = "docs/RC2_MIGRATION_BLOBS.tsv"
def git(*args, cwd=ROOT):
    return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()
def main():
    head = git("rev-parse", "HEAD")
    versions = [row.split("\t")[3].split("/")[-1].split("_")[0]
                for row in (ROOT / LEDGER).read_text().splitlines()[1:]]
    from rc2_operator_preflight import REQUIRED, TARGETS
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        work = tmp / "tree"
        packet = tmp / "packet.json"
        git("worktree", "add", "--detach", str(work), head)
        try:
            def fixture(target):
                ref, n = TARGETS[target]
                names = set(REQUIRED) - ({"staging_acceptance"} if target == "synthetic-staging" else set())
                evidence = {}
                for name in names:
                    raw = f"SYNTHETIC ONLY: {name} fixture\n".encode()
                    (tmp / (name + ".txt")).write_bytes(raw)
                    evidence[name] = {"status":"verified","reviewer":"synthetic-ci",
                                      "sha256":hashlib.sha256(raw).hexdigest()}
                return {"purpose":"synthetic-regression", "target":target, "project_ref":ref,
                        "source_sha":head, "history":versions[:n], "attestations":evidence}
            def run(value, reason=None, target="synthetic-staging", expected=head, purpose="synthetic-regression"):
                packet.write_text(json.dumps(value))
                p = subprocess.run([sys.executable, str(ROOT / SCRIPT), "--expected-source", expected,
                                    "--target", target, "--purpose", purpose, "--evidence", str(packet)],
                                    cwd=work, text=True, capture_output=True)
                if reason is None:
                    assert p.returncode == 0, p.stderr
                    remaining = 12 if target == "synthetic-staging" else 17
                    assert f"remaining={remaining}" in p.stdout
                    assert len([l for l in p.stdout.splitlines() if "\tsupabase/migrations/" in l]) == remaining
                    assert "NO AUTHORIZATION GRANTED" in p.stdout
                    print("PASS:", target, "exact prefix and", remaining, "remaining")
                else:
                    assert p.returncode != 0 and "RC2_PREFLIGHT_BLOCKED: " + reason in p.stderr, (reason,p.stdout,p.stderr)
                    print("PASS: rejected", reason)
            good = fixture("synthetic-staging")
            run(good)
            run(fixture("production"), target="production")
            def mutate(key, value):
                p = copy.deepcopy(good); p[key] = value; return p
            run(mutate("history", versions[:10] + ["99999999999999"]), "UNEXPECTED_HISTORY_VERSION")
            run(mutate("history", [versions[1],versions[0],*versions[2:11]]), "INCORRECT_HISTORY_SEQUENCE")
            run(mutate("history", versions[:10] + [versions[0]]), "DUPLICATE_HISTORY_VERSION")
            run(mutate("history", versions[:10]), "INCORRECT_HISTORY_LENGTH")
            run(mutate("history", versions[:12]), "INCORRECT_HISTORY_LENGTH")
            run(good, "WRONG_ENVIRONMENT_CLASSIFICATION", target="production")
            run(mutate("project_ref", TARGETS["production"][0]), "WRONG_ENVIRONMENT_CLASSIFICATION")
            run(good, "WRONG_EVIDENCE_PURPOSE", purpose="operator-reviewed")
            run(mutate("source_sha", "0"*40), "INCORRECT_EVIDENCE_SOURCE")
            run(good, "INCORRECT_PINNED_SOURCE", expected="0"*40)
            p=copy.deepcopy(good); del p["attestations"]["physical_schema"]
            run(p,"INCOMPLETE_PREREQUISITES")
            p=copy.deepcopy(good); p["attestations"]["physical_schema"]["status"]="unverified"
            run(p,"UNVERIFIED_PREREQUISITE")
            artifact=tmp/"physical_schema.txt"; raw=artifact.read_bytes(); artifact.unlink()
            run(good,"MISSING_PREREQUISITE_ARTIFACT"); artifact.write_bytes(b"changed")
            run(good,"PREREQUISITE_ARTIFACT_DIGEST_MISMATCH"); artifact.write_bytes(raw)
            path=work/"readme.md"; raw=path.read_bytes(); path.write_bytes(raw+b"\nsynthetic drift\n")
            run(good,"UNEXPECTED_WORKTREE_CHANGE"); path.write_bytes(raw)
            path=work/"unexpected.txt"; path.write_text("synthetic")
            run(good,"UNEXPECTED_WORKTREE_CHANGE"); path.unlink()
            def commit_change(path, raw, reason):
                path.write_bytes(raw)
                git("add", str(path.relative_to(work)),cwd=work)
                git("-c","user.name=CI","-c","user.email=ci@example.invalid","commit","-m","synthetic fixture",cwd=work)
                changed=git("rev-parse","HEAD",cwd=work)
                run(mutate("source_sha",changed),reason,expected=changed)
                git("reset","--hard",head,cwd=work)
            path=work/LEDGER
            commit_change(path,path.read_bytes()+b"\n","MANIFEST_DISCREPANCY")
            migration=next((work/"supabase/migrations").glob("*clinical_live_session_alignment.sql"))
            commit_change(migration,migration.read_bytes()+b"\n-- synthetic drift\n","MIGRATION_TREE_DRIFT")
            frontend=work/"web/src/lib/clinical-chart.ts"
            commit_change(frontend,frontend.read_bytes()+b"\n// synthetic drift\n","UNAPPROVED_FRONTEND_TREE")
            print("PASS: offline RC2 preflight synthetic regression (no provider operations)")
        finally:
            git("worktree","remove","--force",str(work))
if __name__ == "__main__":
    main()
