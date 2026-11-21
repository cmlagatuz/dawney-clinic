import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountToRegister } from '../src/registration.mjs';

const fixture = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'public-test-key',
  DAWNEY_TEST_A_EMAIL: 'owner-a@example.invalid',
  DAWNEY_TEST_A_PASSWORD: 'Asecure19',
  DAWNEY_TEST_B_EMAIL: 'owner-b@example.invalid',
  DAWNEY_TEST_B_PASSWORD: 'Bsecure28'
};

test('registration targets only A without reading or returning B secrets', () => {
  const environment = { ...fixture };
  delete environment.DAWNEY_TEST_B_EMAIL;
  delete environment.DAWNEY_TEST_B_PASSWORD;
  const selected = accountToRegister('A', environment);
  assert.deepEqual(selected, {
    label: 'A', email: fixture.DAWNEY_TEST_A_EMAIL, password: fixture.DAWNEY_TEST_A_PASSWORD
  });
});

test('registration targets only B without requiring A secrets', () => {
  const environment = { ...fixture };
  delete environment.DAWNEY_TEST_A_EMAIL;
  delete environment.DAWNEY_TEST_A_PASSWORD;
  assert.deepEqual(accountToRegister('B', environment), {
    label: 'B', email: fixture.DAWNEY_TEST_B_EMAIL, password: fixture.DAWNEY_TEST_B_PASSWORD
  });
});

test('bulk or unknown operation is rejected before any registration', () => {
  for (const target of [undefined, '', 'AB', 'register', 'test', 'C']) {
    assert.throws(() => accountToRegister(target, fixture), /exactly one account/);
  }
});

test('missing selected email or password is detected without exposing values', () => {
  const env = { ...fixture };
  delete env.DAWNEY_TEST_A_PASSWORD;
  assert.throws(() => accountToRegister('A', env), /DAWNEY_TEST_A_PASSWORD/);
  assert.doesNotThrow(() => accountToRegister('B', env));
});
