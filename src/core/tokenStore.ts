import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface StringCrypto {
  encryptString(s: string): Buffer;
  decryptString(b: Buffer): string;
}

export function createTokenStore(file: string, crypto: StringCrypto) {
  return {
    load(): string | null {
      try {
        return crypto.decryptString(readFileSync(file)) || null;
      } catch {
        return null;
      }
    },
    save(token: string): void {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, crypto.encryptString(token));
    },
  };
}
