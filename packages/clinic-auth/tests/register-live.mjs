import { createClinicAuth, ClinicAuthError } from "../src/client.mjs";
import { accountToRegister } from "../src/registration.mjs";

// Run only after confirming the targeted test account is ABSENT in Supabase Auth.
// NEVER log test addresses, passwords, Auth tokens or Supabase keys.
const target = accountToRegister(process.env.DAWNEY_REGISTER_TARGET, process.env);
const auth = createClinicAuth({
  url: process.env.SUPABASE_URL,
  publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY
});
try {
  const result = await auth.signUp({
    email: target.email,
    password: target.password,
    firstName: "Phase2",
    lastName: "Integration" + target.label
  });
  if (result.status !== "verification_required") {
    await auth.signOut();
    throw new Error("Email confirmation was not required. Stop and check Supabase Auth settings.");
  }
  console.log("Registration for test account " + target.label + ": verification_required");
  console.log("Confirm that mailbox before running operation=test. Do not re-register other accounts.");
} catch (error) {
  if (error instanceof ClinicAuthError && error.status === 429) {
    console.error("Supabase Auth returned 429: signup stopped. No automatic retry.");
    console.error("The free hosted email provider has a low project-wide allowance; wait for the limit to reset.");
    console.error("Do not disable email verification or repeat registration for an existing account.");
    process.exitCode = 1;
  } else {
    throw error;
  }
}
