#!/usr/bin/env python3
"""Offline, read-only operator evidence and exact-source consistency check.
No provider, SQL, network, deployment, or approval action is implemented.
Trust: run a reviewed copy from a PM-approved checkout, obtain expected SHA
and evidence independently; this tool does not authenticate human attestations.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

BASE = "ce427658860d9f3421d9dde06dc0fdb0c84a87da"
RC1 = "2e029697fc2c446171a951167b30bcf7679c286e"
PREPARATION = "939bc5f1237d90df431d06408e8812682fd58421"
CLINICAL_IMPORT = "32606649a3e4359df998d26d9ace50aab91cef64"
CLINICAL_WEB_TREE = "8152e80d44df78c0486aa46f066a8204300b9d66"
CI_CHECKPOINT = "8a3b35f94b63ac318b9f977d33d4f7153fbd2cc5"
FINAL_IMPORT = "a811b6e4a3f692839ff574678f885a4622e44b75"
FINAL_WEB_TREE = "f5dc0a98bf82fc75db7a5bf144f23236523505b8"
INITIAL_README_BLOB = "c4e6929a5d64b31124d999c6cf5970e1fafccf47"
FINAL_README_BLOB = "ea890c3f9e8243f62410f1591cbe39f26c86f0d5"
FINAL_LEDGER = "docs/RC2_FINAL_SOURCE_BLOBS.tsv"
FINAL_PATHS = [".github/workflows/full-tree-pg17-security.yml",".github/workflows/phase3-release.yml",".github/workflows/rc1-preparation.yml",".github/workflows/staff-appointment-lifecycle-pg17.yml","docs/AI_HANDOFF.md","docs/RC2_CI_INTEGRITY.md","docs/RC2_FINAL_IMPORT_BLOBS.tsv","docs/RC2_OPERATIONAL_REGISTER.md","docs/RC2_OPERATOR_RELEASE_PACKET.md","docs/RC2_RECOVERY_OPERATOR_GUIDE.md","readme.md","scripts/ci/rc2_backend_source_guard.sh","scripts/ci/rc2_backend_source_guard_test.sh","scripts/ci/rc2_frozen_checks.sh","scripts/release/mandatory-test-gate.mjs","scripts/release/rc2_operator_preflight.py","scripts/release/rc2_operator_preflight_test.py"]
LEDGER = "docs/RC2_MIGRATION_BLOBS.tsv"
LEDGER_BLOB = "2ddb4814f6bfd383f4acccac38a510f8ba71baea"
RC1_PREFLIGHT = "scripts/release/rc1_staging_preflight.sh"
RC1_PREFLIGHT_BLOB = "06dd63dae7dab0afc8633a747412148d3692d972"
TARGETS = {
    "synthetic-staging": ("gxklkkoffpkdcxbqjlav", 11),
    "production": ("lgimhirgvresvbsdugac", 6),
}
REQUIRED = (
    "target_identity", "history_snapshot", "physical_schema",
    "provider_compatibility", "auth_storage_api", "source_acceptance",
    "owner_scope_approval", "quiescent_cutoff", "backup_completeness",
    "independent_backup_verification", "independent_destination_capacity",
    "independent_restore_acceptance", "staging_acceptance",
    "rollback_stop_plan",
)
HEX40 = re.compile(r"[0-9a-f]{40}")
HEX64 = re.compile(r"[0-9a-f]{64}")
MIGRATION = re.compile(r"supabase/migrations/([0-9]{14})_[a-z0-9_]+\.sql")

class Blocked(Exception):
    pass

def need(condition, reason):
    if not condition:
        raise Blocked(reason)

def git(*args):
    env = dict(os.environ, GIT_NO_LAZY_FETCH="1", GIT_OPTIONAL_LOCKS="0",
               GIT_TERMINAL_PROMPT="0", GIT_CONFIG_NOSYSTEM="1")
    result = subprocess.run(["git", "-c", "core.fsmonitor=false", "-c",
                             "core.hooksPath=/dev/null", "-c",
                             "protocol.allow=never", *args],
                            env=env, stdout=subprocess.PIPE,
                            stderr=subprocess.DEVNULL, check=False)
    need(result.returncode == 0, "GIT_REFERENCE_OR_LOCAL_OBJECT_UNAVAILABLE")
    return result.stdout

def blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()

def tree(ref, path=None):
    args = ["ls-tree", "-r", "-z", ref]
    if path is not None:
        args += ["--", path]
    rows = {}
    for line in git(*args).split(b"\0"):
        if not line:
            continue
        meta, name = line.split(b"\t", 1)
        mode, kind, sha = meta.decode("ascii").split()
        name = name.decode("utf-8")
        need(kind == "blob" and mode in ("100644", "100755"), "UNSUPPORTED_SOURCE_MODE")
        need(name not in rows, "DUPLICATE_SOURCE_PATH")
        rows[name] = (mode, sha)
    return rows

def no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        need(key not in result, "DUPLICATE_EVIDENCE_KEY")
        result[key] = value
    return result

def read_packet(path):
    need(path.is_file() and not path.is_symlink(), "MISSING_EVIDENCE_PACKET")
    need(path.stat().st_size <= 262144, "EVIDENCE_PACKET_TOO_LARGE")
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=no_duplicate_keys)

def verify_source(expected):
    need(bool(HEX40.fullmatch(expected)), "INCORRECT_PINNED_SOURCE")
    need(git("rev-parse", "HEAD").decode().strip() == expected, "INCORRECT_PINNED_SOURCE")
    git("cat-file", "-e", BASE + "^{commit}")
    git("cat-file", "-e", RC1 + "^{commit}")
    git("merge-base", "--is-ancestor", BASE, expected)
    git("merge-base", "--is-ancestor", RC1, BASE)
    git("merge-base", "--is-ancestor", PREPARATION, expected)
    git("merge-base", "--is-ancestor", CLINICAL_IMPORT, expected)
    need(git("rev-parse", CLINICAL_IMPORT + "^").decode().strip() == PREPARATION,
         "INCORRECT_CLINICAL_IMPORT_PARENT")
    need(git("rev-parse", CLINICAL_IMPORT + ":web").decode().strip() == CLINICAL_WEB_TREE,
         "INCORRECT_CLINICAL_IMPORT_TREE")
    git("merge-base", "--is-ancestor", CI_CHECKPOINT, expected)
    git("merge-base", "--is-ancestor", FINAL_IMPORT, expected)
    need(git("rev-parse", FINAL_IMPORT + "^").decode().strip() == CI_CHECKPOINT,
         "INCORRECT_FINAL_IMPORT_PARENT")
    need(git("rev-parse", FINAL_IMPORT + ":web").decode().strip() == FINAL_WEB_TREE,
         "INCORRECT_FINAL_IMPORT_TREE")
    need(git("rev-parse", expected + ":web").decode().strip() == FINAL_WEB_TREE,
         "UNAPPROVED_FRONTEND_TREE")
    need(git("rev-parse", FINAL_IMPORT + ":readme.md").decode().strip() == INITIAL_README_BLOB,
         "INCORRECT_INITIAL_README_IMPORT")
    need(git("rev-parse", expected + ":readme.md").decode().strip() == FINAL_README_BLOB,
         "UNAPPROVED_README")
    actual = tree(expected)
    # Inspect actual checked-out bytes and executable bits, not just index flags.
    need(not git("status", "--porcelain=v1", "--untracked-files=all",
                 "--ignore-submodules=none"), "UNEXPECTED_WORKTREE_CHANGE")
    for name, (mode, sha) in actual.items():
        file = Path(name)
        need(file.is_file() and not file.is_symlink(), "UNEXPECTED_SOURCE_FILE")
        need(blob(file.read_bytes()) == sha, "UNEXPECTED_SOURCE_BYTES")
        need(bool(file.stat().st_mode & stat.S_IXUSR) == (mode == "100755"),
             "UNEXPECTED_SOURCE_MODE")
    need(actual.get(LEDGER) == ("100644", LEDGER_BLOB), "MANIFEST_DISCREPANCY")
    need(actual.get(RC1_PREFLIGHT) == ("100755", RC1_PREFLIGHT_BLOB),
         "HISTORICAL_PREFLIGHT_DRIFT")
    rows = Path(LEDGER).read_text(encoding="utf-8").splitlines()
    need(len(rows) == 24 and rows[0].startswith("# sequence\t"), "MANIFEST_DISCREPANCY")
    ordered, versions = {}, []
    for i, row in enumerate(rows[1:], 1):
        parts = row.split("\t")
        need(len(parts) == 4, "MANIFEST_DISCREPANCY")
        seq, mode, sha, path = parts
        match = MIGRATION.fullmatch(path)
        need(seq == f"{i:02d}" and mode == "100644" and bool(HEX40.fullmatch(sha))
             and match is not None and path not in ordered, "MANIFEST_DISCREPANCY")
        versions.append(match.group(1))
        ordered[path] = (mode, sha)
    need(versions == sorted(set(versions)) and len(versions) == 23, "MANIFEST_SEQUENCE")
    need(ordered == tree(BASE, "supabase/migrations"), "BASE_MIGRATION_DRIFT")
    need(ordered == tree(expected, "supabase/migrations"), "MIGRATION_TREE_DRIFT")
    need(list(ordered.items())[:21] == list(tree(RC1, "supabase/migrations").items()),
         "RC1_MIGRATION_DRIFT")
    # Even ignored extra files in the migration directory are refused.
    need(set(Path("supabase/migrations").iterdir()) == {Path(p) for p in ordered},
         "UNEXPECTED_MIGRATION_FILE")
    baseline = tree(FINAL_IMPORT)
    delta = sorted(name for name in set(actual) | set(baseline) if actual.get(name) != baseline.get(name))
    need(delta == sorted(FINAL_PATHS + [FINAL_LEDGER]), "UNAPPROVED_FINAL_DELTA")
    final_rows = Path(FINAL_LEDGER).read_text(encoding="utf-8").splitlines()
    need(len(final_rows) == len(FINAL_PATHS) + 1 and final_rows[0] == "# mode\tblob\tpath", "FINAL_MANIFEST_DISCREPANCY")
    need(final_rows[1:] == ["\t".join((*actual[name], name)) for name in FINAL_PATHS], "FINAL_MANIFEST_DISCREPANCY")
    return versions, ordered

def verify_packet(path, purpose, target, expected, versions):
    packet = read_packet(path)
    need(isinstance(packet, dict) and set(packet) == {
        "purpose", "target", "project_ref", "source_sha", "history", "attestations"
    }, "MALFORMED_EVIDENCE_PACKET")
    ref, count = TARGETS[target]
    need(packet["purpose"] == purpose, "WRONG_EVIDENCE_PURPOSE")
    need(packet["target"] == target and packet["project_ref"] == ref, "WRONG_ENVIRONMENT_CLASSIFICATION")
    need(packet["source_sha"] == expected, "INCORRECT_EVIDENCE_SOURCE")
    history = packet["history"]
    need(isinstance(history, list) and all(isinstance(v, str) and re.fullmatch(r"[0-9]{14}", v)
         for v in history), "INVALID_HISTORY_FORMAT")
    need(len(set(history)) == len(history), "DUPLICATE_HISTORY_VERSION")
    need(all(v in versions for v in history), "UNEXPECTED_HISTORY_VERSION")
    need(len(history) == count, "INCORRECT_HISTORY_LENGTH")
    need(history == versions[:count], "INCORRECT_HISTORY_SEQUENCE")
    attestations = packet["attestations"]
    required = set(REQUIRED)
    # A staging migration cannot require acceptance of its own future result.
    if target == "synthetic-staging":
        required.remove("staging_acceptance")
    need(isinstance(attestations, dict) and set(attestations) == required,
         "INCOMPLETE_PREREQUISITES")
    for name in sorted(required):
        evidence = attestations[name]
        need(isinstance(evidence, dict) and set(evidence) == {"status", "reviewer", "sha256"},
             "MALFORMED_PREREQUISITE")
        need(evidence["status"] == "verified" and isinstance(evidence["reviewer"], str)
             and bool(re.fullmatch(r"[A-Za-z0-9_.-]{2,80}", evidence["reviewer"]))
             and isinstance(evidence["sha256"], str) and bool(HEX64.fullmatch(evidence["sha256"])),
             "UNVERIFIED_PREREQUISITE")
        artifact = path.parent / (name + ".txt")
        need(artifact.is_file() and not artifact.is_symlink() and 0 < artifact.stat().st_size <= 1048576,
             "MISSING_PREREQUISITE_ARTIFACT")
        need(hashlib.sha256(artifact.read_bytes()).hexdigest() == evidence["sha256"],
             "PREREQUISITE_ARTIFACT_DIGEST_MISMATCH")
    return count

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-source", required=True, help="independently PM-approved exact commit")
    parser.add_argument("--target", choices=tuple(TARGETS), required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--purpose", choices=("operator-reviewed", "synthetic-regression"),
                        default="operator-reviewed")
    args = parser.parse_args()
    try:
        evidence = args.evidence.absolute()
        os.chdir(git("rev-parse", "--show-toplevel").decode().strip())
        need(not evidence.is_relative_to(Path.cwd()), "EVIDENCE_MUST_BE_OUTSIDE_REPOSITORY")
        versions, ordered = verify_source(args.expected_source)
        count = verify_packet(evidence, args.purpose, args.target, args.expected_source, versions)
        print("RC2 OFFLINE CONSISTENCY PASS:", args.purpose, args.target,
              f"prefix={count} remaining={23-count}")
        for i, (path, (mode, sha)) in enumerate(ordered.items(), 1):
            if i > count:
                print(f"{i:02d}\t{mode}\t{sha}\t{path}")
        print("NO SQL EXECUTED / NO HOSTED ACCESS / NO AUTHORIZATION GRANTED.")
        print("Human attestation authenticity, physical schema, provider restore and approval must be independently verified.")
        return 0
    except (Blocked, OSError, ValueError, TypeError, UnicodeError) as exc:
        reason = str(exc) if isinstance(exc, Blocked) else "INVALID_OR_UNREADABLE_LOCAL_INPUT"
        print("RC2_PREFLIGHT_BLOCKED:", reason, file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
