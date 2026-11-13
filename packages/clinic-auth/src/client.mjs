/**
 * Tiny dependency-free Supabase Auth/PostgREST adapter for the future React + TypeScript client.
 * Tokens are held in memory only; no localStorage, cookies, secrets or privileged API key.
 * Prefer @supabase/supabase-js for future production session persistence / PKCE.
 */
export class ClinicAuthError extends Error {
  constructor(message, code = "request_failed", status = 0) {
    super(message);
    this.name = "ClinicAuthError";
    this.code = code;
    this.status = status;
  }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const safeText = (value, max) => {
  if (typeof value !== "string") throw new ClinicAuthError("Invalid profile field", "invalid_input");
  const text = value.trim();
  if (!text || text.length > max) throw new ClinicAuthError("Invalid profile field", "invalid_input");
  return text;
};
const validEmail = (value) => {
  const email = safeText(value, 254).toLowerCase();
  if (!emailPattern.test(email)) throw new ClinicAuthError("Invalid email", "invalid_email");
  return email;
};
const validPassword = (value) => {
  if (typeof value !== "string" || value.length < 12 || value.length > 1024) {
    throw new ClinicAuthError("Use a password between 12 and 1024 characters", "invalid_password");
  }
  return value;
};
const mapError = (payload, status) => {
  const code = typeof payload?.code === "string" ? payload.code
    : (typeof payload?.error_code === "string" ? payload.error_code : "http_error");
  if (status === 429) return new ClinicAuthError("Too many attempts. Try again later.", "rate_limited", status);
  if (code === "email_not_confirmed") return new ClinicAuthError("Verify your email before signing in.", code, status);
  if (status === 401 || status === 403) return new ClinicAuthError("Authentication or access denied.", code, status);
  if (status === 409) return new ClinicAuthError("This record already exists.", code, status);
  return new ClinicAuthError("The request could not be completed.", code, status);
};

export function createClinicAuth({ url, publishableKey, fetchImpl = globalThis.fetch }) {
  if (typeof url !== "string" || !/^https:\/\//.test(url)) {
    throw new ClinicAuthError("Supabase URL must use HTTPS", "invalid_config");
  }
  if (typeof publishableKey !== "string" || !publishableKey) {
    throw new ClinicAuthError("A public Supabase publishable key is required", "invalid_config");
  }
  if (typeof fetchImpl !== "function") throw new ClinicAuthError("Fetch is unavailable", "invalid_config");
  const base = url.replace(/\/+$/, "");
  let session = null;

  async function request(path, { method = "GET", body, authenticated = false, headers = {} } = {}) {
    const token = authenticated ? session?.access_token : null;
    if (authenticated && !token) throw new ClinicAuthError("Please sign in again.", "no_session", 401);
    let response;
    try {
      response = await fetchImpl(base + path, {
        method,
        headers: {
          apikey: publishableKey,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
    } catch {
      throw new ClinicAuthError("Cannot reach the authentication service.", "network_unavailable");
    }
    let payload = null;
    try {
      const raw = await response.text();
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      if (response.ok) throw new ClinicAuthError("Malformed API response.", "bad_response", response.status);
    }
    if (!response.ok) throw mapError(payload, response.status);
    return payload;
  }

  function adoptSession(payload) {
    if (!payload?.access_token || !payload?.refresh_token) {
      throw new ClinicAuthError("An authenticated session was not returned.", "session_missing");
    }
    session = { access_token: payload.access_token, refresh_token: payload.refresh_token };
  }

  async function getCurrentUser() {
    if (!session) return null;
    const user = await request("/auth/v1/user", { authenticated: true });
    if (!user?.id || !user.email_confirmed_at || user.is_anonymous === true) {
      throw new ClinicAuthError("A verified email account is required.", "email_unverified", 403);
    }
    return user;
  }

  async function signUp({ email, password, firstName, lastName }) {
    email = validEmail(email);
    password = validPassword(password);
    const given = safeText(firstName, 150), family = safeText(lastName, 150);
    const response = await request("/auth/v1/signup", {
      method: "POST",
      body: { email, password, data: { first_name: given, last_name: family } }
    });
    if (response?.access_token && response?.refresh_token) {
      // Even if the Auth server auto-issues a session, verification is still checked via getUser.
      adoptSession(response);
      await getCurrentUser();
      return { status: "signed_in", userId: response.user?.id ?? null };
    }
    return { status: "verification_required", userId: response?.user?.id ?? null };
  }

  async function resendVerification(email) {
    await request("/auth/v1/resend", { method: "POST", body: { type: "signup", email: validEmail(email) } });
    return { status: "submitted" };
  }

  async function verifyEmailCode({ email, token }) {
    if (typeof token !== "string" || !/^\d{6,8}$/.test(token)) {
      throw new ClinicAuthError("Invalid verification code", "invalid_otp");
    }
    const response = await request("/auth/v1/verify", {
      method: "POST", body: { email: validEmail(email), token, type: "email" }
    });
    adoptSession(response);
    return getCurrentUser();
  }

  async function signIn({ email, password }) {
    const response = await request("/auth/v1/token?grant_type=password", {
      method: "POST", body: { email: validEmail(email), password: validPassword(password) }
    });
    adoptSession(response);
    try { return { user: await getCurrentUser(), session: { ...session } }; }
    catch (err) { session = null; throw err; }
  }

  async function refreshSession() {
    if (!session?.refresh_token) throw new ClinicAuthError("Please sign in again.", "no_session", 401);
    const response = await request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", body: { refresh_token: session.refresh_token }
    });
    adoptSession(response);
    return getCurrentUser();
  }

  async function signOut() {
    const hadSession = !!session;
    try {
      if (hadSession) await request("/auth/v1/logout?scope=local", {
        method: "POST", authenticated: true, body: {}
      });
    } finally {
      session = null; // Never leave a usable token in memory if the server is unreachable.
    }
  }

  async function getOwnProfile() {
    const user = await getCurrentUser();
    if (!user) throw new ClinicAuthError("Please sign in.", "no_session", 401);
    const query = new URLSearchParams({
      select: "id,user_id,first_name,last_name,phone,address",
      user_id: `eq.${user.id}`,
      limit: "1"
    });
    const rows = await request(`/rest/v1/owners?${query}`, { authenticated: true });
    if (!Array.isArray(rows)) throw new ClinicAuthError("Unexpected owner response", "bad_response");
    if (rows.length && rows[0].user_id !== user.id) {
      throw new ClinicAuthError("Owner identity mismatch", "ownership_violation", 403);
    }
    return rows[0] ?? null;
  }

  async function ensureOwnerProfile(details = {}) {
    const user = await getCurrentUser();
    if (!user) throw new ClinicAuthError("Please sign in.", "no_session", 401);
    const existing = await getOwnProfile();
    if (existing) return existing;
    // Metadata is only a profile suggestion, NEVER authorization or a staff role.
    const firstName = safeText(details.firstName ?? user.user_metadata?.first_name, 150);
    const lastName = safeText(details.lastName ?? user.user_metadata?.last_name, 150);
    const data = { first_name: firstName, last_name: lastName };
    if (details.phone !== undefined) data.phone = safeText(details.phone, 40);
    if (details.address !== undefined) data.address = safeText(details.address, 1000);
    try {
      const records = await request("/rest/v1/owners?select=id,user_id,first_name,last_name,phone,address", {
        method: "POST", authenticated: true, body: data,
        headers: { Prefer: "return=representation" }
      });
      if (!Array.isArray(records) || records.length !== 1 || records[0].user_id !== user.id) {
        throw new ClinicAuthError("Owner profile was not saved correctly", "ownership_violation", 403);
      }
      return records[0];
    } catch (error) {
      // Another tab may have inserted the unique (user_id) concurrently; read the real row.
      if (error instanceof ClinicAuthError && (error.code === "23505" || error.status === 409)) {
        const row = await getOwnProfile();
        if (row) return row;
      }
      throw error;
    }
  }

  return Object.freeze({
    signUp, resendVerification, verifyEmailCode, signIn,
    refreshSession, signOut, getCurrentUser, getOwnProfile, ensureOwnerProfile,
    /** For integration with PostgREST requests. NEVER log or persist bearer tokens. */
    accessToken: () => session?.access_token ?? null
  });
}
