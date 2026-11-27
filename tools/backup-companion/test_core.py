import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import core

class FakeCrypto:
    # State-machine tests only, not cryptographic evidence.
    def encrypt(self, data, check):
        check()
        return b"FIXTURE-CIPHERTEXT"
    def decrypt(self, data, check):
        check()
        return core.FIXTURE

class Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.now = 100
        self.auth = core.FixtureAuthority(lambda: self.now)

    def token(self):
        return self.auth.confirm(self.auth.challenge("fixture-system-administrator"))

    def run_backup(self, crypto=None, **kwargs):
        return core.backup(self.root, self.auth, self.token(),
                           crypto or FakeCrypto(), **kwargs)

    def refuse(self, code, fn):
        with self.assertRaisesRegex(core.Refused, "^" + code + "$"):
            fn()
        self.assertEqual(list(self.root.rglob("receipt.json")), [])

    def test_wrong_role(self):
        self.refuse("AUTH_DENIED", lambda: self.auth.challenge("accountant"))

    def test_invalid_challenge(self):
        self.auth.challenge("fixture-system-administrator")
        self.refuse("AUTH_DENIED", lambda: self.auth.confirm("bad"))

    def test_expired_challenge(self):
        code = self.auth.challenge("fixture-system-administrator")
        self.now += 61
        self.refuse("AUTH_EXPIRED", lambda: self.auth.confirm(code))

    def test_expired_grant(self):
        token = self.token()
        self.now += 301
        self.refuse("AUTH_EXPIRED", lambda: core.backup(self.root,self.auth,token,FakeCrypto()))

    def test_replay(self):
        token = self.token()
        self.auth.consume(token)
        self.refuse("AUTH_DENIED", lambda: core.backup(self.root,self.auth,token,FakeCrypto()))

    def test_cancel(self):
        self.refuse("CANCELLED", lambda: self.run_backup(cancel=lambda: True))

    def test_space(self):
        self.refuse("INSUFFICIENT_SPACE", lambda: self.run_backup(free=lambda _: 0))

    def test_missing_drive(self):
        self.root = self.root / "missing"
        self.refuse("DRIVE_UNAVAILABLE", self.run_backup)

    def test_drive_changed(self):
        calls = iter([1,2])
        self.refuse("DRIVE_CHANGED", lambda: self.run_backup(identity=lambda _: next(calls)))

    def test_interruption(self):
        class Interrupted(FakeCrypto):
            def encrypt(self, data, check):
                raise core.Refused("GPG_FAILED")
        self.refuse("GPG_FAILED", lambda: self.run_backup(Interrupted()))
        self.assertEqual(len(list(self.root.rglob("*.partial"))),1)

    def test_corrupt_archive(self):
        class Corrupt(FakeCrypto):
            def decrypt(self, data, check):
                return b"corrupt"
        self.refuse("FIXTURE_MISMATCH", lambda: self.run_backup(Corrupt()))

    def test_expired_during_export(self):
        def progress(phase):
            if phase == "encrypting":
                self.now += 301
        self.refuse("AUTH_EXPIRED", lambda: self.run_backup(progress=progress))

    def test_cancel_during_export(self):
        cancelled = False
        def progress(phase):
            nonlocal cancelled
            if phase == "encrypting":
                cancelled = True
        self.refuse("CANCELLED", lambda: self.run_backup(progress=progress,cancel=lambda:cancelled))

    def test_write_denied(self):
        with patch.object(Path, "open", side_effect=PermissionError):
            self.refuse("DESTINATION_OR_IO_FAILED", self.run_backup)

    def test_preserve_and_receipt(self):
        old = self.root / "existing.gpg"
        old.write_bytes(b"keep")
        receipt = self.run_backup()
        self.assertEqual(old.read_bytes(), b"keep")
        self.assertFalse(receipt["database_export"])
        self.assertEqual(receipt["sha256"],core.digest(b"FIXTURE-CIPHERTEXT"))
        self.assertEqual(len(list(self.root.rglob("receipt.json"))),1)

    @unittest.skipUnless(shutil.which("gpg"),"GPG unavailable")
    def test_real_gpg_and_corruption(self):
        exe = shutil.which("gpg")
        home = self.root / "gpg-home"
        home.mkdir(mode=0o700)
        with patch.dict(os.environ, {"GNUPGHOME":str(home)}):
            engine = core.Gpg(exe,test_fixture=True)
            receipt = self.run_backup(engine)
            archive = next(self.root.rglob("synthetic-fixture.json.gpg"))
            cipher = archive.read_bytes()
            self.assertEqual(receipt["sha256"],core.digest(cipher))
            self.assertNotIn(core.FIXTURE,cipher)
            broken = bytearray(cipher)
            broken[len(broken)//2] ^= 0x80
            with self.assertRaises(core.Refused):
                engine.decrypt(bytes(broken),lambda:None)

if __name__ == "__main__":
    unittest.main()
