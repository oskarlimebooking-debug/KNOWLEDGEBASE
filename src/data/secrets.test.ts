import { describe, expect, it } from 'vitest';
import {
  SECRET_PREFIX,
  clearAllSecrets,
  clearSecret,
  getSecret,
  setSecret,
} from './secrets';

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

  it('clearAllSecrets leaves non-secret sessionStorage entries alone', () => {
    sessionStorage.setItem('unrelated', 'keep me');
    setSecret('a', '1');
    clearAllSecrets();
    expect(sessionStorage.getItem('unrelated')).toBe('keep me');
    expect(getSecret('a')).toBeUndefined();
  });

  it('stores under a reserved prefix so non-secret keys cannot collide', () => {
    setSecret('foo', 'bar');
    const matching = Object.keys({ ...Array.from({ length: sessionStorage.length }) })
      .map((_, i) => sessionStorage.key(i))
      .filter((k): k is string => typeof k === 'string' && k.startsWith(SECRET_PREFIX));
    expect(matching).toHaveLength(1);
  });

  it('rejects empty secret names', () => {
    expect(() => setSecret('', 'x')).toThrow();
    expect(() => getSecret('')).toThrow();
    expect(() => clearSecret('')).toThrow();
  });
});
