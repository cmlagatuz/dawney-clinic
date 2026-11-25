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

def require(ok, message):
    if not ok:
        raise ValueError(message)

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
    require(path.is_dir() and not path.is_symlink(), "private directory required")
    require(not path.stat().st_mode & 0o077, "private directory must be mode 700 (use WSL Linux volume)")
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
            require(set(all_files[k]) == names, "missing or extra required component files")
            require(all(p.stat().st_size > 0 for p in all_files[k].values()), "empty required file")
    cfg = load_json(root/"configuration/inventory.json")
    required = {"source","cutoff_utc","postgres_major","cli_version","auth_storage_versions","settings","coverage_attestation"}
    require(isinstance(cfg,dict) and set(cfg)==required, "invalid configuration inventory")
    require(cfg["source"] == source and cfg["postgres_major"] == 17 and cfg["cli_version"] == "3.0.0", "source or tool version mismatch")
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
    require(FPR.fullmatch(signer), "expected signer must be full uppercase fingerprint")
    for name in ("recovery-set.json","recovery-set.json.sig"):
        p=folder/name
        require(p.is_file() and not p.is_symlink(),"manifest or signature missing")
    status=gpg("--status-fd","1","--verify",str(folder/"recovery-set.json.sig"),str(folder/"recovery-set.json"),capture=True).decode()
    valid=[l.split() for l in status.splitlines() if l.startswith("[GNUPG:] VALIDSIG ")]
    require(len(valid)==1 and (valid[0][2]==signer or valid[0][-1]==signer), "signature not from independently trusted signer")
    subprocess.run(["node",str(SCRIPT/"verify-recovery-set.mjs"),str(folder/"recovery-set.json")],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

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
        gpg("--decrypt","--output",str(plain),str(folder/row["file"]))
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
    check_collection(root,source)

def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest="action",required=True)
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
    require(a.source==a.confirm_source and REF.fullmatch(a.source),"source confirmation mismatch")
    work=private_dir(a.work)
    if a.action=="pack":
        result=pack(a.input,work,a.source,a.recipient,a.signer)
        print("Signed encrypted recovery set:",result.name)
        print("Collection completeness is operator-attested; run independent verify.")
        return
    source=private_dir(a.input)
    require(work!=source and work not in source.parents and source not in work.parents,"backup and work directories must be separate")
    if a.action=="prepare-restore":
        require(REF.fullmatch(a.destination) and a.destination==a.confirm_destination and a.destination!=a.source and a.destination not in EXISTING,"wrong, existing or unconfirmed restoration target")
        require(a.source.startswith("synthetic-")==a.destination.startswith("synthetic-"),"synthetic and hosted target types must not mix")
    with tempfile.TemporaryDirectory(prefix=".verify-",dir=work) as temp:
        root=Path(temp)
        unpack(source,root,a.source,a.signer)
        if a.action=="prepare-restore":
            result=work/("prepared-"+os.urandom(8).hex())
            result.mkdir(mode=0o700)
            try:
                for p in root.iterdir():
                    shutil.move(str(p),result/p.name)
                (result/"RESTORE-PLAN.json").write_text(json.dumps({"source":a.source,"destination":a.destination,"status":"PREPARED_ONLY_NO_SQL_EXECUTED"}),encoding="utf-8")
            except BaseException:
                shutil.rmtree(result)
                raise
            print("Verified restore files prepared:",result.name)
            print("STOP: separately approve and validate compatible empty destination; no SQL or upload executed.")
        else:
            print("PASS: trusted signature, five encrypted components, decrypted layout and object hashes; not a restore test.")

if __name__=="__main__":
    try:
        main()
    except (ValueError,OSError,subprocess.SubprocessError,zipfile.BadZipFile,RuntimeError,TypeError,KeyError):
        raise SystemExit("Recovery utility stopped: validation or tool failure. No hosted operation executed.")
