/**
 * Select one disposable test account per GitHub Actions registration dispatch.
 * The built-in Supabase email provider is heavily rate limited; never re-register
 * the already confirmed second account just to restore the first one.
 */
export function accountToRegister(target, environment) {
  if (target !== 'A' && target !== 'B') {
    throw new Error('Registration must target exactly one account: A or B.');
  }
  const emailKey = `DAWNEY_TEST_${target}_EMAIL`;
  const passwordKey = `DAWNEY_TEST_${target}_PASSWORD`;
  for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', emailKey, passwordKey]) {
    if (typeof environment[name] !== 'string' || !environment[name]) {
      throw new Error(`Missing GitHub Actions secret: ${name}`);
    }
  }
  return {
    label: target,
    email: environment[emailKey],
    password: environment[passwordKey]
  };
}
