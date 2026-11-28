"""Offline watcher regressions; actual volume collision runs in isolated CI."""
import copy
import json
import subprocess
import unittest
from unittest.mock import patch
from runtime import LoopbackRelays, WatcherFault, NET, b

class WatcherTests(unittest.TestCase):
    def setUp(self):
        # Production main initializes the accepted harness environment. Mock
        # it here without importing runner credentials or touching Docker.
        env=patch.object(b,"ENV",{},create=True)
        env.start();self.addCleanup(env.stop)
        self.r=LoopbackRelays("synthetic-test","172.30.0.0/24","a"*64)
        self.name="supabase_db_synthetic-test"
        self.item={"Name":"/"+self.name,"Id":"b"*64,
            "State":{"Status":"running","Running":True,"Health":{"Status":"starting"}},
            "HostConfig":{"Privileged":False,"NetworkMode":NET},
            "NetworkSettings":{"Networks":{NET:{"NetworkID":"a"*64,"IPAddress":"172.30.0.2"}}}}
    def inspect(self,rc=0,out=None,err=b""):
        p=subprocess.CompletedProcess([],rc,json.dumps([self.item] if out is None else out).encode(),err)
        with patch("runtime.subprocess.run",return_value=p) as command:
            value=self.r.inspect("db")
            self.assertEqual(command.call_args.args[0],["docker","container","inspect",self.name])
            return value
    def test_volume_only_is_container_absent(self):
        self.assertEqual(self.inspect(1,[],("Error: No such container: "+self.name).encode()),(None,"container-absent"))
        self.assertEqual(self.inspect(1,[],("Error response from daemon: No such container: "+self.name).encode()),(None,"container-absent"))
        with self.assertRaisesRegex(WatcherFault,"container-name-mismatch"):
            self.inspect(out=[{"Name":self.name,"Driver":"local"}])
    def test_inspect_timeout_pending_other_failure_fatal(self):
        with patch("runtime.subprocess.run",side_effect=subprocess.TimeoutExpired("docker",8)):
            self.assertEqual(self.r.inspect("db"),(None,"inspect-timeout"))
        with self.assertRaisesRegex(WatcherFault,"container-inspect-command-failed"):
            self.inspect(1,[],b"permission denied")
    def test_exact_identity_pinned(self):
        self.assertEqual(self.inspect()[0]["Id"],"b"*64)
        self.item["Id"]="c"*64
        with self.assertRaisesRegex(WatcherFault,"container-id-changed"):self.inspect()
    def test_created_and_address_pending(self):
        self.item["State"]={"Status":"created","Running":False,"Health":{"Status":""}}
        self.item["NetworkSettings"]["Networks"][NET]={"IPAddress":"","NetworkID":""}
        self.assertEqual(self.r.endpoint("db",self.item),(("created","initializing","not-running"),None))
        self.item["State"]={"Status":"running","Running":True}
        self.assertEqual(self.r.endpoint("db",self.item),(("running","none","awaiting-internal-address"),None))
    def test_ready_target(self):
        self.assertEqual(self.r.endpoint("db",self.item),(("running","starting"),"172.30.0.2"))
    def test_isolation_violations_fatal(self):
        for kind,change in (
            ("privileged-container",lambda v:v["HostConfig"].update(Privileged=True)),
            ("alternate-network-mode",lambda v:v["HostConfig"].update(NetworkMode="host")),
            ("alternate-network-membership",lambda v:v["NetworkSettings"]["Networks"].update(bridge={})),
            ("network-id-mismatch",lambda v:v["NetworkSettings"]["Networks"][NET].update(NetworkID="d"*64)),
            ("relay-address-or-network-mismatch",lambda v:v["NetworkSettings"]["Networks"][NET].update(IPAddress="192.0.2.1")),
            ("invalid-relay-address",lambda v:v["NetworkSettings"]["Networks"][NET].update(IPAddress="invalid")),
            ("unknown-lifecycle",lambda v:v["State"].update(Status="mystery")),
            ("unknown-health",lambda v:v["State"].update(Health={"Status":"mystery"})),
            ("container-terminal-state",lambda v:v["State"].update(Status="dead",Running=False))):
            with self.subTest(kind=kind):
                item=copy.deepcopy(self.item);change(item)
                with self.assertRaisesRegex(WatcherFault,kind):self.r.endpoint("db",item)
    def test_watcher_fault_is_terminal_and_classified(self):
        with patch.object(self.r,"inspect",side_effect=WatcherFault("container-name-mismatch")):
            self.r.watch()
        self.assertTrue(self.r.failed.is_set())
        self.assertFalse(self.r.ready.is_set())
        self.assertEqual(self.r.error,"db:container-name-mismatch")
if __name__=="__main__":unittest.main()
