import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { createTokenStore, type StringCrypto } from '../src/core/tokenStore';

const reverseB64: StringCrypto = {
  encryptString: (s) => Buffer.from(Buffer.from([...s].reverse().join('')).toString('base64')),
  decryptString: (b) => [...Buffer.from(b.toString(), 'base64').toString()].reverse().join(''),
};
const file = () => join(mkdtempSync(join(tmpdir(), 'wkw-')), 'token.bin');

test('save then load round-trips without plain text on disk', () => {
  const f = file();
  const store = createTokenStore(f, reverseB64);
  store.save('abc');
  expect(store.load()).toBe('abc');
  expect(readFileSync(f).toString()).not.toContain('abc');
});

test('missing file → null', () => {
  expect(createTokenStore(file(), reverseB64).load()).toBeNull();
});

test('decrypt failure → null', () => {
  const f = file();
  createTokenStore(f, reverseB64).save('abc');
  const broken = createTokenStore(f, { ...reverseB64, decryptString: () => { throw new Error('bad'); } });
  expect(broken.load()).toBeNull();
});
