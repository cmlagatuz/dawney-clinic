import { createClinicAuth } from "../src/client.mjs";
const required = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY",
  "DAWNEY_TEST_A_EMAIL", "DAWNEY_TEST_A_PASSWORD",
  "DAWNEY_TEST_B_EMAIL", "DAWNEY_TEST_B_PASSWORD"];
if (required.some(k => !process.env[k])) {
  throw new Error("Configure all live test secrets before registration.");
}
const a = createClinicAuth({
  url: process.env.SUPABASE_URL,
  publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY
});
const b = createClinicAuth({
  url: process.env.SUPABASE_URL,
  publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY
});
const results = [];
for (const [client, label, emailKey, passwordKey] of [
  [a, "A", "DAWNEY_TEST_A_EMAIL", "DAWNEY_TEST_A_PASSWORD"],
  [b, "B", "DAWNEY_TEST_B_EMAIL", "DAWNEY_TEST_B_PASSWORD"]
]) {
  const response = await client.signUp({
    email: process.env[emailKey],
    password: process.env[passwordKey],
    firstName: "Phase2",
    lastName: "Integration" + label
  });
  results.push({ testAccount: label, status: response.status });
  await client.signOut();
}
// No identity, key, token, OTP, email address or password is logged.
for (const row of results) console.log("Disposable test account", row.testAccount, row.status);
console.log("Verify each address through the trusted mailbox before running live RLS tests.");
