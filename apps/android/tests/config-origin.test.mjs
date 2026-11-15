import assert from 'node:assert/strict';
import test from 'node:test';
import { pilotOrigin } from '../config-origin.mjs';
test('pilot uses one exact HTTPS origin and never accepts token-bearing or cleartext endpoints', () => {
  assert.equal(pilotOrigin('https://workforce.example/'), 'https://workforce.example');
  for (const value of ['', 'http://workforce.example', 'https://user:pass@workforce.example', 'https://workforce.example/employee', 'https://workforce.example/#token', 'https://workforce.example?token=secret', 'https://workforce.example:444', 'https://localhost', 'https://app.local']) {
    assert.throws(() => pilotOrigin(value));
  }
});
