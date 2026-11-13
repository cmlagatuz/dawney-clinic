import { test } from "node:test";
import assert from "node:assert/strict";
import { createClinicAuth, ClinicAuthError } from "../src/client.mjs";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const EMAIL_A = "a@example.invalid";
const EMAIL_B = "b@example.invalid";
const PASSWORD = "unique-test-password-12";
const apiUrl = "https://unit-test.supabase.invalid";

function fixture({ confirmed = true, failLogout = false } = {}) {
  const users = new Map([
    [EMAIL_A, { id: ID_A, email: EMAIL_A, email_confirmed_at: confirmed ? "2026-01-01T00:00:00Z" : null,
      user_metadata: { first_name: "Owner", last_name: "Alpha" }, is_anonymous: false }],
    [EMAIL_B, { id: ID_B, email: EMAIL_B, email_confirmed_at: "2026-01-01T00:00:00Z",
      user_metadata: { first_name: "Owner", last_name: "Beta" }, is_anonymous: false }]
  ]);
  const profiles = new Map();
  const calls = [];
  const resp = (status, body = null) => ({
    status, ok: status >= 200 && status < 300,
    async text() { return body === null ? "" : JSON.stringify(body); }
  });
  const current = (headers) => {
    const raw = headers.Authorization;
    if (!raw?.startsWith("Bearer t-")) return null;
    return [...users.values()].find(x => x.id === raw.slice("Bearer t-".length)) ?? null;
  };
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    const headers = options.headers ?? {};
    const body = options.body === undefined ? null : JSON.parse(options.body);
    calls.push({ path: url.pathname, method: options.method, body, headers, query: url.search });
    assert.equal(headers.apikey, "public-test-key");
    if (url.pathname === "/auth/v1/signup") return resp(200, {
      user: { id: users.get(body.email)?.id ?? ID_A, email: body.email },
      session: null
    });
    if (url.pathname === "/auth/v1/resend") return resp(200, {});
    if (url.pathname === "/auth/v1/verify") return resp(200, {
      access_token: "t-" + users.get(body.email).id,
      refresh_token: "r-" + users.get(body.email).id
    });
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const user = users.get(body.email);
      if (!user || body.password !== PASSWORD) {
        return resp(400, { code: "invalid_credentials", message: "wrong credentials" });
      }
      return resp(200, { access_token: "t-" + user.id, refresh_token: "r-" + user.id });
    }
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      const user = [...users.values()].find(x => "r-" + x.id === body.refresh_token);
      if (!user) return resp(401, { code: "invalid_refresh_token" });
      return resp(200, { access_token: "t-" + user.id, refresh_token: "r-" + user.id });
    }
    if (url.pathname === "/auth/v1/user") {
      const user = current(headers);
      return user ? resp(200, user) : resp(401, { code: "invalid_token" });
    }
    if (url.pathname === "/auth/v1/logout") {
      if (failLogout) throw new Error("Network lost");
      return resp(204);
    }
    if (url.pathname === "/rest/v1/owners") {
      const user = current(headers);
      if (!user) return resp(401, { code: "invalid_token" });
      if (options.method === "POST") {
        if (body.user_id && body.user_id !== user.id) return resp(403, { code: "42501" });
        if (profiles.has(user.id)) return resp(409, { code: "23505" });
        const created = { id: "profile-" + user.id, user_id: user.id,
          first_name: body.first_name, last_name: body.last_name,
          phone: body.phone ?? null, address: body.address ?? null };
        profiles.set(user.id, created);
        return resp(201, [created]);
      }
      const requested = url.searchParams.get("user_id");
      const row = profiles.get(user.id);
      return resp(200, row && requested === "eq." + user.id ? [row] : []);
    }
    throw new Error("Unhandled mock URL: " + input);
  };
  const create = () => createClinicAuth({ url: apiUrl, publishableKey: "public-test-key", fetchImpl });
  return { create, calls, profiles, fetchImpl, users };
}

test("registration requests email verification and never creates an unverified owner", async () => {
  const env = fixture();
  const auth = env.create();
  const result = await auth.signUp({ email: EMAIL_A, password: PASSWORD, firstName: "Owner", lastName: "Alpha" });
  assert.equal(result.status, "verification_required");
  assert.equal(auth.accessToken(), null);
  assert.equal(env.profiles.size, 0);
  assert.equal(env.calls[0].body.data.first_name, "Owner");
  await auth.resendVerification(EMAIL_A);
  assert.equal(env.calls.at(-1).path, "/auth/v1/resend");
});

test("verified OTP returns a session and owner profile uses server-derived user_id", async () => {
  const env = fixture();
  const auth = env.create();
  const user = await auth.verifyEmailCode({ email: EMAIL_A, token: "123456" });
  assert.equal(user.id, ID_A);
  const owner = await auth.ensureOwnerProfile({ user_id: ID_B, address: "Test address" });
  assert.equal(owner.user_id, ID_A);
  assert.equal(owner.address, "Test address");
  const post = env.calls.find(x => x.path === "/rest/v1/owners" && x.method === "POST");
  assert.deepEqual(Object.keys(post.body).sort(), ["address", "first_name", "last_name"]);
  assert.equal((await auth.getOwnProfile()).id, owner.id);
  await auth.refreshSession();
  assert.equal(auth.accessToken(), "t-" + ID_A);
});

test("two logins see only their own profiles and reauthentication preserves DB state", async () => {
  const env = fixture();
  const alice = env.create(), bob = env.create();
  await alice.signIn({ email: EMAIL_A, password: PASSWORD });
  await bob.signIn({ email: EMAIL_B, password: PASSWORD });
  const a = await alice.ensureOwnerProfile();
  const b = await bob.ensureOwnerProfile();
  assert.notEqual(a.id, b.id);
  assert.equal((await alice.getOwnProfile()).id, a.id);
  assert.equal((await bob.getOwnProfile()).id, b.id);
  const blocked = await env.fetchImpl(apiUrl + "/rest/v1/owners?user_id=eq." + ID_B, {
    method: "GET", headers: { apikey: "public-test-key", Authorization: "Bearer " + alice.accessToken() }
  });
  assert.deepEqual(JSON.parse(await blocked.text()), []);
  await alice.signOut();
  assert.equal(alice.accessToken(), null);
  await alice.signIn({ email: EMAIL_A, password: PASSWORD });
  assert.equal((await alice.ensureOwnerProfile()).id, a.id);
  assert.equal(env.profiles.size, 2);
});

test("unverified users and invalid passwords cannot use authenticated profile flows", async () => {
  const env = fixture({ confirmed: false });
  const auth = env.create();
  await assert.rejects(auth.signIn({ email: EMAIL_A, password: PASSWORD }), (e) =>
    e instanceof ClinicAuthError && e.code === "email_unverified");
  assert.equal(auth.accessToken(), null);
  await assert.rejects(auth.signIn({ email: EMAIL_A, password: "not correct but long" }), (e) =>
    e instanceof ClinicAuthError && e.code === "invalid_credentials");
  await assert.rejects(auth.ensureOwnerProfile(), (e) => e.code === "no_session");
});

test("logout clears credentials even when the network is unavailable", async () => {
  const env = fixture({ failLogout: true });
  const auth = env.create();
  await auth.signIn({ email: EMAIL_B, password: PASSWORD });
  await assert.rejects(auth.signOut(), (e) => e.code === "network_unavailable");
  assert.equal(auth.accessToken(), null);
});

test("malformed inputs are rejected without submitting HTTP requests", async () => {
  const env = fixture();
  const auth = env.create();
  await assert.rejects(auth.signUp({ email: "bad", password: PASSWORD,
    firstName: "Name", lastName: "Family" }), (e) => e.code === "invalid_email");
  await assert.rejects(auth.verifyEmailCode({ email: EMAIL_A, token: "000" }),
    (e) => e.code === "invalid_otp");
  assert.equal(env.calls.length, 0);
});
