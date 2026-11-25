#!/usr/bin/env python3
"""Offline manual recovery packaging; no database, network or hosted restore commands."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile

COMPONENTS = {
    "application": {"roles.sql", "schema.sql", "data.sql", "history_schema.sql", "history_data.sql", "managed_changes.sql"},
    "auth-identities": {"auth.sql"},
    "storage-metadata": {"storage.sql", "objects.json"},
    "storage-objects": set(),
    "configuration": {"inventory.json"},
}
EXISTING = {"lgimhirgvresvbsdugac", "gxklkkoffpkdcxbqjlav"}
REF = re.compile(r"^[a-z0-9]{20}$|^synthetic-[a-z0-9-]{1,40}$")
FPR = re.compile(r"^[A-F0-9]{40}$")
SCRIPT = Path(__file__).resolve().parent

class RecoveryError(Exception):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)

# Only literal, developer-controlled validation messages may reach the operator.
# Never interpolate exception text, paths, patient names or tool stderr.
def require(ok, message, code="COLLECTION_INCOMPLETE"):
    if not ok:
        raise RecoveryError(code, message)

def tool(args, code="TOOL_FAILURE", message="Check the installed tool, local permissions and key readiness; retry offline."):
    try:
        return subprocess.run(args, check=True, stdout=subprocess.PIPE,
                              stderr=subprocess.DEVNULL, timeout=120).stdout
    except (OSError, subprocess.SubprocessError):
        raise RecoveryError(code, message) from None

def digest(path):
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()

def safe_name(s):
    p = PurePosixPath(s)
    return (bool(s) and not p.is_absolute() and str(p) == s
            and all(re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_. -]*", part)
                    and not part.endswith((".", " "))
                    and part.split(".")[0].upper() not in
                    {"CON","PRN","AUX","NUL",*[f"COM{i}" for i in range(1,10)],*[f"LPT{i}" for i in range(1,10)]}
                    for part in p.parts))

def private_dir(path):
    require(path.is_dir() and not path.is_symlink(), "Choose an existing private directory.", "PRIVATE_WORKSPACE")
    require(not path.stat().st_mode & 0o077, "Use an encrypted WSL Linux directory with mode 700.", "PRIVATE_WORKSPACE")
    return path.resolve()

def files(folder):
    require(folder.is_dir() and not folder.is_symlink(), "component directory missing")
    result = {}
    for p in folder.rglob("*"):
        require(not p.is_symlink(), "symlink rejected")
        if p.is_dir():
            continue
        name = p.relative_to(folder).as_posix()
        require(p.is_file() and safe_name(name), "unsupported file/path; do not rename silently")
        result[name] = p
    require(len({n.casefold() for n in result}) == len(result), "case-colliding names")
    return result

def load_json(p):
    require(p.stat().st_size <= 16*1024*1024, "inventory exceeds supported size")
    return json.loads(p.read_text(encoding="utf-8"))

def check_collection(root, source):
    require(REF.fullmatch(source), "invalid source identifier")
    require(set(p.name for p in root.iterdir()) == set(COMPONENTS), "collection must contain exactly five component directories")
    all_files = {k: files(root/k) for k in COMPONENTS}
    for k, names in COMPONENTS.items():
        if k != "storage-objects":
            require(set(all_files[k]) == names, "Check the required files for component " + k + "; recreate missing exports or remove unrelated files.", "COLLECTION_INCOMPLETE")
            require(all(p.stat().st_size > 0 for p in all_files[k].values()), "empty required file")
    cfg = load_json(root/"configuration/inventory.json")
    required = {"source","cutoff_utc","postgres_major","cli_version","auth_storage_versions","settings","coverage_attestation"}
    require(isinstance(cfg,dict) and set(cfg)==required, "invalid configuration inventory")
    require(cfg["source"] == source, "The recorded source differs from the confirmed source; do not relabel it.", "SOURCE_MISMATCH")
    require(cfg["postgres_major"] == 17 and cfg["cli_version"] == "3.0.0", "Check PostgreSQL 17 and Supabase CLI 3.0.0.", "VERSION_MISMATCH")
    require(re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z",cfg["cutoff_utc"]), "invalid cutoff")
    datetime.datetime.strptime(cfg["cutoff_utc"], "%Y-%m-%dT%H:%M:%SZ")
    require(isinstance(cfg["auth_storage_versions"],str) and bool(cfg["auth_storage_versions"].strip()), "missing compatibility inventory")
    require(isinstance(cfg["settings"],dict) and set(cfg["settings"])=={"auth","storage","extensions","realtime","functions","network","secrets_reconfiguration"}, "missing settings category")
    require(all(isinstance(v,str) and v.strip() for v in cfg["settings"].values()), "missing settings description")
    require(cfg["coverage_attestation"] == "operator-reviewed-quiescent-export", "operator coverage attestation missing")
    index = load_json(root/"storage-metadata/objects.json")
    require(isinstance(index,list), "invalid object inventory")
    seen=set()
    for row in index:
        require(isinstance(row,dict) and set(row)=={"path","bytes","sha256"}, "invalid object inventory row")
        name=row["path"]
        require(isinstance(name,str) and safe_name(name) and "/" in name and name not in seen and name in all_files["storage-objects"], "missing, duplicate or unsafe object")
        p=all_files["storage-objects"][name]
        require(type(row["bytes"]) is int and row["bytes"]==p.stat().st_size and row["sha256"]==digest(p), "object size or SHA256 mismatch")
        seen.add(name)
    require(seen == set(all_files["storage-objects"]), "unlisted objects")
    return all_files

def gpg(*args, capture=False):
    # Never print GPG stderr: owner key names/paths may be private.
    return subprocess.run(["gpg","--batch",*args],check=True,stdout=subprocess.PIPE if capture else subprocess.DEVNULL,stderr=subprocess.DEVNULL).stdout

def signature(folder, signer):
    require(FPR.fullmatch(signer), "Enter the independently trusted full uppercase signing fingerprint.", "KEY_NOT_READY")
    for name in ("recovery-set.json","recovery-set.json.sig"):
        p=folder/name
        require(p.is_file() and not p.is_symlink(),"Manifest or detached signature missing; use the complete original backup.", "SIGNATURE_INVALID")
    require(shutil.which("gpg") is not None, "Install GnuPG before verification.", "TOOL_FAILURE")
    status=tool(["gpg","--batch","--status-fd","1","--verify",str(folder/"recovery-set.json.sig"),str(folder/"recovery-set.json")], "SIGNATURE_INVALID", "Signature verification failed; obtain the original signed manifest and trusted public key.").decode()
    valid=[l.split() for l in status.splitlines() if l.startswith("[GNUPG:] VALIDSIG ")]
    require(len(valid)==1 and (valid[0][2]==signer or valid[0][-1]==signer), "Signature is not from the independently trusted owner key.", "SIGNATURE_INVALID")
    require(shutil.which("node") is not None, "Install Node 22 for manifest verification.", "TOOL_FAILURE")
    tool(["node",str(SCRIPT/"verify-recovery-set.mjs"),str(folder/"recovery-set.json")], "BACKUP_CORRUPT", "Encrypted component missing, changed or invalid; use an intact backup copy.")

def pack(root, out, source, recipient, signer):
    root=private_dir(root)
    out=private_dir(out)
    require(root != out and root not in out.parents and out not in root.parents, "collection and output must be separate")
    require(FPR.fullmatch(recipient) and FPR.fullmatch(signer), "full uppercase fingerprints required")
    collections=check_collection(root,source)
    with tempfile.TemporaryDirectory(prefix=".packing-",dir=out) as temp:
        stage=Path(temp)
        manifest={"format":"dawney-recovery-set","version":1,"created_utc":datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),"components":{}}
        for key, entries in collections.items():
            plain=stage/"component.zip"
            with zipfile.ZipFile(plain,"w",zipfile.ZIP_DEFLATED,allowZip64=True) as z:
                for name,p in sorted(entries.items()):
                    z.write(p,name)
            encrypted=stage/(key+".gpg")
            gpg("--trust-model","always","--recipient",recipient,"--encrypt","--output",str(encrypted),str(plain))
            plain.unlink()
            manifest["components"][key]={"file":encrypted.name,"bytes":encrypted.stat().st_size,"sha256":digest(encrypted)}
        (stage/"recovery-set.json").write_text(json.dumps(manifest,sort_keys=True),encoding="utf-8")
        gpg("--local-user",signer,"--detach-sign","--output",str(stage/"recovery-set.json.sig"),str(stage/"recovery-set.json"))
        signature(stage,signer)
        # Publish only after verification; unique new folder, never overwrite.
        result=out/("backup-"+datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S")+"-"+os.urandom(4).hex())
        result.mkdir(mode=0o700)
        try:
            for p in stage.iterdir():
                shutil.move(str(p),result/p.name)
        except BaseException:
            shutil.rmtree(result)
            raise
    return result

def unpack(folder, root, source, signer):
    folder=private_dir(folder)
    signature(folder,signer)
    manifest=load_json(folder/"recovery-set.json")
    require(set(p.name for p in folder.iterdir())=={"recovery-set.json","recovery-set.json.sig",*[v["file"] for v in manifest["components"].values()]}, "unexpected backup file")
    for key, row in manifest["components"].items():
        target=root/key
        target.mkdir(mode=0o700)
        plain=root/"component.zip"
        try:
            gpg("--decrypt","--output",str(plain),str(folder/row["file"]))
        except (OSError,subprocess.SubprocessError):
            raise RecoveryError("KEY_NOT_READY","Cannot decrypt verified ciphertext; check authorized owner decryption key and GPG agent.") from None
        with zipfile.ZipFile(plain) as z:
            seen=set()
            for item in z.infolist():
                name=item.filename
                mode=item.external_attr>>16
                require(safe_name(name) and name.casefold() not in seen and not item.is_dir() and not stat.S_ISLNK(mode), "unsafe archive member")
                seen.add(name.casefold())
                dest=target/name
                dest.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
                with z.open(item) as src, dest.open("xb") as dst:
                    shutil.copyfileobj(src,dst)
        plain.unlink()
    try:
        check_collection(root,source)
    except RecoveryError as exc:
        if exc.code == "SOURCE_MISMATCH":
            raise
        raise RecoveryError("BACKUP_CORRUPT", "Decrypted component coverage or object integrity failed; use an intact backup.") from None


def check_ready(recipient, signer, work, collection_tools=True):
    require(sys.version_info[:2] == (3,12), "Use Python 3.12.", "VERSION_MISMATCH")
    require(FPR.fullmatch(recipient) and FPR.fullmatch(signer), "Enter full uppercase fingerprints, verified independently.", "KEY_NOT_READY")
    versions=[(["node","--version"],r"^v22\."),
              (["gpg","--version"],r"^gpg \(GnuPG\) 2\.[4-9]\.")]
    if collection_tools:
        versions += [(["supabase","--version"],r"^3\.0\.0$"),
                     (["psql","--version"],r"^psql \(PostgreSQL\) 17\."),
                     (["pg_dump","--version"],r"^pg_dump \(PostgreSQL\) 17\.")]
    for cmd, pattern in versions:
        value=tool(cmd).decode().strip().splitlines()
        require(value and re.search(pattern,value[0]), "Install the documented compatible version of "+cmd[0]+".", "VERSION_MISMATCH")
        print("READY:",cmd[0])
    require(shutil.disk_usage(work).free >= 64*1024*1024, "Free more encrypted workspace disk; 64 MiB is only a startup floor, not backup capacity.", "PRIVATE_WORKSPACE")
    # Real nonsecret challenge, not simply key presence. Key agent may prompt.
    try:
        with tempfile.TemporaryDirectory(dir=work) as temp:
            p=Path(temp)
            (p/"challenge").write_bytes(os.urandom(32))
            gpg("--trust-model","always","--recipient",recipient,"--encrypt","--output",str(p/"challenge.gpg"),str(p/"challenge"))
            gpg("--decrypt","--output",str(p/"readback"),str(p/"challenge.gpg"))
            require((p/"readback").read_bytes()==(p/"challenge").read_bytes(),"Encryption readback failed.", "KEY_NOT_READY")
            gpg("--local-user",signer,"--detach-sign","--output",str(p/"challenge.sig"),str(p/"challenge"))
            status=tool(["gpg","--batch","--status-fd","1","--verify",str(p/"challenge.sig"),str(p/"challenge")], "KEY_NOT_READY", "Signing challenge failed; check owner key and agent.").decode()
            valid=[l.split() for l in status.splitlines() if l.startswith("[GNUPG:] VALIDSIG ")]
            require(len(valid)==1 and (valid[0][2]==signer or valid[0][-1]==signer),"Signing challenge used the wrong key.", "KEY_NOT_READY")
    except (OSError,subprocess.SubprocessError):
        raise RecoveryError("KEY_NOT_READY","Check owner encryption/decryption and signing keys in the local GPG agent.") from None
    print("READY: encryption, decryption and signing challenge")

def fresh_collection(work):
    root=Path(tempfile.mkdtemp(prefix="collection-"+datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")+"-",dir=work))
    for name in COMPONENTS:
        (root/name).mkdir(mode=0o700)
    return root

def inventory_from_listing(root, listing):
    # The listing MUST come independently from the source; never derive completeness from downloads.
    require(listing.is_file() and not listing.is_symlink() and root not in listing.resolve().parents,"Supply an independently collected source listing outside the collection directory.", "COLLECTION_INCOMPLETE")
    rows=load_json(listing)
    require(isinstance(rows,list),"Source listing must be a JSON array of path/bytes records.", "COLLECTION_INCOMPLETE")
    local=files(root/"storage-objects")
    seen=set()
    index=[]
    for row in rows:
        require(isinstance(row,dict) and set(row) in ({"path","bytes"},{"path","bytes","sha256"}),"Source listing requires path and byte count, with optional source SHA256.")
        name=row["path"]
        require(isinstance(name,str) and safe_name(name) and "/" in name and name not in seen and name in local,"Source listing and downloads differ; finish collection.")
        p=local[name]
        require(type(row["bytes"]) is int and row["bytes"]==p.stat().st_size,"Source object size differs; download again.")
        sha=digest(p)
        require("sha256" not in row or row["sha256"]==sha,"Independent source checksum differs; download again.")
        index.append({"path":name,"bytes":row["bytes"],"sha256":sha})
        seen.add(name)
    require(seen==set(local),"Unlisted downloads or missing source listing entries; reconcile before packaging.")
    with (root/"storage-metadata/objects.json").open("x",encoding="utf-8") as f:
        json.dump(index,f)
    print("INVENTORY PREPARED:",len(index),"listed objects checked; provider completeness NOT VERIFIED.")

def ask(label):
    return input(label+" ").strip()

def guided(work):
    work=private_dir(work)
    repo=SCRIPT.parents[1]
    require(work!=repo and repo not in work.parents and work not in repo.parents,"Use a separate encrypted workspace, not the repository.", "PRIVATE_WORKSPACE")
    print("Dawney manual recovery | 1 Create backup | 2 Verify backup | 3 Prepare restore | 0 Exit")
    action=ask("Choose:")
    if action=="0":
        return
    require(action in ("1","2","3"),"Choose 1, 2, 3 or 0.", "INVALID_SELECTION")
    source=ask("Source project reference (or synthetic identifier):")
    require(REF.fullmatch(source) and source==ask("Independently confirm source reference:"),"Recheck the source reference.", "SOURCE_MISMATCH")
    signer=ask("Independently trusted signing fingerprint (uppercase):")
    require(FPR.fullmatch(signer),"Use the full uppercase signing fingerprint.", "KEY_NOT_READY")
    if action=="1":
        recipient=ask("Owner encryption fingerprint (uppercase):")
        require(ask("Confirm encrypted private disk, owner key custody, adequate free space and approved collection (type READY):")=="READY","Workspace or approval not confirmed.", "PRIVATE_WORKSPACE")
        check_ready(recipient,signer,work)
        root=fresh_collection(work)
        print("FRESH COLLECTION:",root)
        print("Use the guide's authorized manual database exports, Auth and Storage collection and configuration inventory in this folder. No exports run here.")
        print("Supply an independent source-list JSON (path/bytes, optional source SHA256), not a list generated from downloads.")
        require(ask("When all manual exports and independent listing are ready, type COLLECTED (or stop):")=="COLLECTED","Collection not confirmed; retain private folder for review.", "COLLECTION_INCOMPLETE")
        listing=Path(ask("Independent source-list JSON path:")).expanduser()
        inventory_from_listing(root,listing)
        print("Complete configuration/inventory.json from the guide; include actual cutoff and reviewed settings, never secrets.")
        require(ask("Confirm five components, source listing and quiescent cutoff independently reviewed (type REVIEWED):")=="REVIEWED","Coverage not attested; backup not created.")
        require((root/"configuration/inventory.json").is_file(),"Finish the reviewed configuration inventory before packaging.")
        cfg=load_json(root/"configuration/inventory.json")
        require(isinstance(cfg,dict) and cfg.get("coverage_attestation")=="operator-reviewed-quiescent-export","Complete the explicit configuration coverage attestation.")
        out=work/"backups"
        out.mkdir(mode=0o700,exist_ok=True)
        result=pack(root,out,source,recipient,signer)
        print("PACKAGE CREATED:",result.name,"(in workspace backups directory)")
        print("Copy complete folder to separate encrypted media; choose Verify with independently trusted signer. Provider completeness and restore NOT VERIFIED.")
        return
    backup=Path(ask("Backup folder:")).expanduser()
    scratch=work/"verification"
    scratch.mkdir(mode=0o700,exist_ok=True)
    scratch=private_dir(scratch)
    if action=="2":
        verify_or_prepare(backup,scratch,source,signer)
    else:
        destination=ask("Separately approved independent destination reference:")
        require(destination==ask("Independently confirm destination reference:"),"Recheck the destination reference.", "DESTINATION_MISMATCH")
        require(ask("Type OWNER-APPROVED-PREPARE-ONLY:")=="OWNER-APPROVED-PREPARE-ONLY","Separate preparation approval required.", "DESTINATION_MISMATCH")
        verify_or_prepare(backup,scratch,source,signer,destination)

class PrivateParser(argparse.ArgumentParser):
    def error(self, message):
        raise RecoveryError("INVALID_ARGUMENTS", "Check --help and supply the required operation arguments.")

def main():
    os.umask(0o077)
    parser=PrivateParser(description=__doc__)
    sub=parser.add_subparsers(dest="action",required=True)
    p=sub.add_parser("guide",help="Manually launched offline guided workflow")
    p.add_argument("work",type=Path)
    for action in ("pack","verify","prepare-restore"):
        p=sub.add_parser(action)
        p.add_argument("input",type=Path)
        p.add_argument("work",type=Path)
        p.add_argument("--source",required=True)
        p.add_argument("--confirm-source",required=True)
        p.add_argument("--signer",required=True)
        if action=="pack":
            p.add_argument("--recipient",required=True)
        if action=="prepare-restore":
            p.add_argument("--destination",required=True)
            p.add_argument("--confirm-destination",required=True)
            p.add_argument("--approval",required=True,choices=["OWNER-APPROVED-PREPARE-ONLY"])
    a=parser.parse_args()
    if a.action=="guide":
        guided(a.work)
        return
    require(a.source==a.confirm_source and REF.fullmatch(a.source),"Recheck and independently confirm the exact source identifier.", "SOURCE_MISMATCH")
    work=private_dir(a.work)
    if a.action=="pack":
        result=pack(a.input,work,a.source,a.recipient,a.signer)
        print("PACKAGE CREATED:",result.name)
        print("Collection completeness is operator-attested; run independent verify.")
        return
    if a.action=="prepare-restore":
        require(a.destination==a.confirm_destination,"Recheck destination confirmation.", "DESTINATION_MISMATCH")
    verify_or_prepare(a.input,work,a.source,a.signer,a.destination if a.action=="prepare-restore" else None)

def verify_or_prepare(backup, work, source, signer, destination=None):
    folder=private_dir(backup)
    require(work!=folder and work not in folder.parents and folder not in work.parents,"backup and work directories must be separate")
    if destination is not None:
        require(REF.fullmatch(destination) and destination!=source and destination not in EXISTING,"Choose a separately approved independent destination; existing clinic projects, source and mismatched confirmations are refused.", "DESTINATION_MISMATCH")
        require(source.startswith("synthetic-")==destination.startswith("synthetic-"),"Synthetic and hosted target types must not mix.", "DESTINATION_MISMATCH")
    with tempfile.TemporaryDirectory(prefix=".verify-",dir=work) as temp:
        root=Path(temp)
        unpack(folder,root,source,signer)
        if destination is not None:
            result=work/("prepared-"+os.urandom(8).hex())
            result.mkdir(mode=0o700)
            try:
                for p in root.iterdir():
                    shutil.move(str(p),result/p.name)
                (result/"RESTORE-PLAN.json").write_text(json.dumps({"source":source,"destination":destination,"status":"PREPARED_ONLY_NO_SQL_EXECUTED"}),encoding="utf-8")
            except BaseException:
                shutil.rmtree(result)
                raise
            print("PREPARED ONLY:",result.name)
            print("STOP: separately approve and validate compatible empty destination; no SQL or upload executed.")
        else:
            print("INTEGRITY VERIFIED: trusted signature, five encrypted components, decrypted layout and object hashes; coverage operator-attested; RESTORE NOT VERIFIED.")

if __name__=="__main__":
    try:
        main()
    except RecoveryError as exc:
        raise SystemExit(f"{exc.code}: {exc}. No hosted operation executed.") from None
    except (zipfile.BadZipFile, json.JSONDecodeError, UnicodeError):
        raise SystemExit("INVALID_FORMAT: Check the collection or backup format; use original files. No hosted operation executed.") from None
    except (ValueError,OSError,subprocess.SubprocessError,RuntimeError,TypeError,KeyError,EOFError):
        raise SystemExit("TOOL_FAILURE: Check installed tools, private disk space, local permissions and key readiness. No hosted operation executed.") from None
    except KeyboardInterrupt:
        raise SystemExit("CANCELLED: No hosted operation executed.") from None
