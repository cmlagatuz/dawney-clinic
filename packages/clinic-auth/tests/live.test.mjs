import { test } from "node:test";
import assert from "node:assert/strict";
import { createClinicAuth } from "../src/client.mjs";

const names = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY",
  "DAWNEY_TEST_A_EMAIL", "DAWNEY_TEST_A_PASSWORD",
  "DAWNEY_TEST_B_EMAIL", "DAWNEY_TEST_B_PASSWORD"];
const missing = names.filter(k => !process.env[k]);
if (missing.length) {
  throw new Error("Live HTTP test requires configured repository Actions secrets/environment values.");
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const a = createClinicAuth({ url, publishableKey: key });
const b = createClinicAuth({ url, publishableKey: key });
const emailA = process.env.DAWNEY_TEST_A_EMAIL;
const emailB = process.env.DAWNEY_TEST_B_EMAIL;
const passwordA = process.env.DAWNEY_TEST_A_PASSWORD;
const passwordB = process.env.DAWNEY_TEST_B_PASSWORD;

async function readAs(accessToken, table, filter = "") {
  const response = await fetch(url + "/rest/v1/" + table + "?select=*" + filter, {
    headers: { apikey: key, Authorization: "Bearer " + accessToken }
  });
  assert.equal(response.status, 200, "Authenticated PostgREST SELECT must succeed");
  return response.json();
}

test("real HTTPS Auth sessions, verified ownership, RLS and persistence after re-login", async () => {
  // This is opt-in and must only run against *dedicated disposable TEST Auth users*.
  // Owner profiles are synthetic; no pet or medical record is written.
  const { user: userA } = await a.signIn({ email: emailA, password: passwordA });
  const { user: userB } = await b.signIn({ email: emailB, password: passwordB });
  assert.notEqual(userA.id, userB.id, "Two distinct verified Auth accounts required");
  assert.ok(userA.email_confirmed_at && userB.email_confirmed_at, "Both emails must be confirmed");

  const ownerA = await a.ensureOwnerProfile({ firstName: "Phase2", lastName: "IntegrationA" });
  const ownerB = await b.ensureOwnerProfile({ firstName: "Phase2", lastName: "IntegrationB" });
  assert.equal(ownerA.user_id, userA.id);
  assert.equal(ownerB.user_id, userB.id);
  assert.notEqual(ownerA.id, ownerB.id);

  assert.deepEqual(await readAs(a.accessToken(), "owners",
    "&user_id=eq." + encodeURIComponent(userB.id)), []);
  assert.deepEqual(await readAs(b.accessToken(), "owners",
    "&user_id=eq." + encodeURIComponent(userA.id)), []);
  const ownA = await readAs(a.accessToken(), "owners",
    "&user_id=eq." + encodeURIComponent(userA.id));
  assert.equal(ownA.length, 1);
  assert.equal(ownA[0].id, ownerA.id);

  const staff = await fetch(url + "/rest/v1/staff_memberships", {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + a.accessToken(),
      "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userA.id, role: "administrator" })
  });
  assert.ok(staff.status === 401 || staff.status === 403,
    "A client must never grant themselves an administrative role");

  await a.signOut();
  assert.equal(a.accessToken(), null);
  await a.signIn({ email: emailA, password: passwordA });
  assert.equal((await a.getOwnProfile()).id, ownerA.id,
    "Previously saved row must survive full logout and reauthentication");
  await b.signOut();
  await a.signOut();
});
