"""Offline synthetic-only backup companion. No provider/database access."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import stat
import subprocess
import time
import uuid

FIXTURE = b'{"format":"dawney-synthetic-fixture-v1","patients":[{"id":"fixture-1","name":"Example Pet"}]}\n'
MIN_FREE = 16 * 1024 * 1024  # fixture-only reserve, never a database sizing estimate
MAX_CIPHER = 1024 * 1024
SCOPE = "synthetic-fixture-only"

class Refused(Exception):
    pass

class FixtureAuthority:
    """In-process simulation only. Not real administrator authentication."""
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.pending = None
        self.grant = None

    def challenge(self, role):
        self.grant = None
        if role != "fixture-system-administrator":
            self.pending = None
            raise Refused("AUTH_DENIED")
        code = secrets.token_hex(4)
        self.pending = (code, self.clock() + 60)
        return code

    def confirm(self, response):
        pending, self.pending = self.pending, None
        if pending is None or self.clock() >= pending[1]:
            raise Refused("AUTH_EXPIRED")
        if not isinstance(response, str) or not secrets.compare_digest(response, pending[0]):
            raise Refused("AUTH_DENIED")
        self.grant = (secrets.token_hex(16), self.clock() + 300)
        return self.grant[0]

    def consume(self, token):
        grant, self.grant = self.grant, None
        if grant is None or not isinstance(token, str) or not secrets.compare_digest(token, grant[0]):
            raise Refused("AUTH_DENIED")
        if self.clock() >= grant[1]:
            raise Refused("AUTH_EXPIRED")
        return grant[1]

def digest(data):
    return hashlib.sha256(data).hexdigest()

def check_live(cancel, deadline, clock):
    if cancel():
        raise Refused("CANCELLED")
    if clock() >= deadline:
        raise Refused("AUTH_EXPIRED")

def no_reparse(path):
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
        raise Refused("DESTINATION_UNSAFE")
    return info

def root_identity(root):
    """Do not create the selected root. Fail if unavailable or redirected."""
    if not root.is_absolute() or not root.is_dir():
        raise Refused("DRIVE_UNAVAILABLE")
    if root.resolve(strict=True) != root:
        raise Refused("DESTINATION_UNSAFE")
    info = no_reparse(root)
    identity = (info.st_dev, info.st_ino)
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes
        if root != Path(root.anchor) or not root.drive or root.drive.startswith("\\\\"):
            raise Refused("DESTINATION_UNSAFE")
        kernel = ctypes.windll.kernel32
        if kernel.GetDriveTypeW(str(root)) not in (2, 3):
            raise Refused("DESTINATION_UNSAFE")
        serial = wintypes.DWORD()
        if not kernel.GetVolumeInformationW(str(root), None, 0, ctypes.byref(serial),
                                            None, None, None, 0):
            raise Refused("DRIVE_UNAVAILABLE")
        identity += (serial.value,)
    return identity

def ensure_folder(parent, name):
    folder = parent / name
    try:
        folder.mkdir()
    except FileExistsError:
        pass
    no_reparse(folder)
    if not folder.is_dir():
        raise Refused("DESTINATION_UNSAFE")
    return folder

def exclusive_write(path, data):
    with path.open("xb") as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())

def gpg_path():
    """Trusted installed Gpg4win locations only; no PATH or UI-supplied executable."""
    for env in ("ProgramFiles", "ProgramFiles(x86)"):
        base = os.environ.get(env)
        if base:
            for relative in ("GnuPG/bin/gpg.exe", "Gpg4win/bin/gpg.exe"):
                candidate = Path(base) / relative
                if candidate.is_file():
                    return str(candidate)
    raise Refused("GPG_NOT_FOUND")

class Gpg:
    def __init__(self, executable, test_fixture=False):
        self.exe = executable
        self.test_fixture = test_fixture

    def run(self, args, data, check):
        options = ["--no-options", "--no-symkey-cache", "--output", "-"]
        if self.test_fixture:
            # Public constant for isolated tests only; never used by GUI.
            options += ["--batch", "--pinentry-mode", "loopback",
                        "--passphrase", "PUBLIC-SYNTHETIC-TEST-ONLY"]
        else:
            options += ["--pinentry-mode", "ask"]
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        check()
        try:
            proc = subprocess.Popen([self.exe] + options + args, stdin=subprocess.PIPE,
                                    stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                    creationflags=flags)
        except OSError:
            raise Refused("GPG_START_FAILED") from None
        try:
            first = True
            while True:
                check()
                try:
                    out, _ = proc.communicate(input=data if first else None, timeout=0.2)
                    break
                except subprocess.TimeoutExpired:
                    first = False
            check()
            if proc.returncode != 0 or not out or len(out) > MAX_CIPHER:
                raise Refused("GPG_FAILED")
            return out
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.communicate()
            else:
                proc.wait()

    def encrypt(self, data, check):
        return self.run(["--cipher-algo", "AES256", "--compress-algo", "none",
                         "--symmetric"], data, check)

    def decrypt(self, data, check):
        return self.run(["--decrypt"], data, check)

def backup(root, authority, token, crypto, cancel=lambda: False,
           free=lambda p: shutil.disk_usage(p).free, identity=root_identity,
           progress=lambda phase: None):
    """Fixture only. A success receipt is written LAST; unfinished sets stay .partial.
    No overwrite, no deletion, no provider access. Root identity checks are best effort
    (not an adversarial filesystem security boundary).
    """
    deadline = authority.consume(token)
    root = Path(root)
    def live():
        check_live(cancel, deadline, authority.clock)
    live()
    try:
        initial = identity(root)
        def ready():
            live()
            if identity(root) != initial:
                raise Refused("DRIVE_CHANGED")
        def space():
            ready()
            if free(root) < MIN_FREE:
                raise Refused("INSUFFICIENT_SPACE")
        space()
        progress("checking_destination")
        parent = ensure_folder(ensure_folder(ensure_folder(root, "DAWNEY_BACKUPS"),
                                              "STAGING"), "SYNTHETIC_FIXTURES")
        space()
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        job = "fixture-" + stamp + "-" + uuid.uuid4().hex
        partial = parent / (job + ".partial")
        final = parent / job
        if final.exists():
            raise Refused("OUTPUT_EXISTS")
        partial.mkdir()  # exclusive reservation
        # Actual write probe: exclusively reserve the ciphertext file.
        archive = partial / "synthetic-fixture.json.gpg"
        with archive.open("xb") as handle:
            ready()
            progress("encrypting")
            cipher = crypto.encrypt(FIXTURE, ready)
            if not cipher or len(cipher) > MAX_CIPHER:
                raise Refused("ENCRYPTION_FAILED")
            space()
            handle.write(cipher)
            handle.flush()
            os.fsync(handle.fileno())
        ready()
        progress("verifying")
        ciphertext = archive.read_bytes()
        if digest(ciphertext) != digest(cipher):
            raise Refused("CIPHERTEXT_MISMATCH")
        plain = crypto.decrypt(ciphertext, ready)
        if digest(plain) != digest(FIXTURE) or plain != FIXTURE:
            raise Refused("FIXTURE_MISMATCH")
        # Exact format validation; not PostgreSQL archive validation.
        if json.loads(plain)["format"] != "dawney-synthetic-fixture-v1":
            raise Refused("FIXTURE_MISMATCH")
        ready()
        checksum = digest(ciphertext)
        exclusive_write(partial / "synthetic-fixture.json.gpg.sha256",
                        (checksum + "  synthetic-fixture.json.gpg\n").encode("ascii"))
        ready()
        if final.exists():
            raise Refused("OUTPUT_EXISTS")
        # Windows os.rename refuses an existing destination. No replacement API.
        partial.rename(final)
        ready()
        if digest((final / archive.name).read_bytes()) != checksum:
            raise Refused("CIPHERTEXT_MISMATCH")
        receipt = {"version": 1, "scope": SCOPE, "job_id": job,
                   "completed_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
                   "status": "verified_synthetic_fixture", "bytes": len(ciphertext),
                   "sha256": checksum, "authorization": "simulated",
                   "database_export": False, "restoration_verified": False}
        ready()
        exclusive_write(final / "receipt.json",
                        (json.dumps(receipt, sort_keys=True) + "\n").encode("utf-8"))
        return receipt
    except Refused:
        raise
    except (OSError, ValueError):
        raise Refused("DESTINATION_OR_IO_FAILED") from None
