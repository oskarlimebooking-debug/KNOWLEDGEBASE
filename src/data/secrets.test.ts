import { afterEach, describe, expect, it } from 'vitest';
import {
  clearAllSecrets,
  clearSecret,
  getSecret,
  setSecret,
} from './secrets';

// secrets.ts holds state in a module-level Map. Tests must reset that
// map between cases to keep them isolated.
afterEach(() => {
  clearAllSecrets();
});

describe('secret store', () => {
  it('round-trips a value', () => {
    setSecret('aiApiKey', 'sk-redacted');
    expect(getSecret('aiApiKey')).toBe('sk-redacted');
  });

  it('returns undefined for an unset secret', () => {
    expect(getSecret('never_set')).toBeUndefined();
  });

  it('overwrites an existing secret', () => {
    setSecret('k', 'v1');
    setSecret('k', 'v2');
    expect(getSecret('k')).toBe('v2');
  });

  it('round-trips an empty string without confusing it with absence', () => {
    setSecret('blank', '');
    expect(getSecret('blank')).toBe('');
  });

  it('removes a specific secret via clearSecret', () => {
    setSecret('a', '1');
    setSecret('b', '2');
    clearSecret('a');
    expect(getSecret('a')).toBeUndefined();
    expect(getSecret('b')).toBe('2');
  });

  it('clearSecret is a no-op for an unset key', () => {
    expect(() => clearSecret('never_set')).not.toThrow();
  });

  it('clearAllSecrets removes every stored secret', () => {
    setSecret('a', '1');
    setSecret('b', '2');
    clearAllSecrets();
    expect(getSecret('a')).toBeUndefined();
    expect(getSecret('b')).toBeUndefined();
  });

  it('rejects empty secret names', () => {
    expect(() => setSecret('', 'x')).toThrow();
    expect(() => getSecret('')).toThrow();
    expect(() => clearSecret('')).toThrow();
  });

  it('does not write secrets into sessionStorage', () => {
    // Defense-in-depth: prove the new storage model is not a sessionStorage
    // wrapper. If something else in the test environment populates
    // sessionStorage, that is fine — we only assert that *we* don't.
    setSecret('aiApiKey', 'sk-redacted');
    const ss: Storage | undefined = (globalThis as { sessionStorage?: Storage })
      .sessionStorage;
    if (ss !== undefined) {
      for (let i = 0; i < ss.length; i++) {
        const key = ss.key(i);
        if (key !== null) expect(ss.getItem(key)).not.toBe('sk-redacted');
      }
    }
  });
});
