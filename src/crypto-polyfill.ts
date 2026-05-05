/**
 * @nestjs/schedule uses global `crypto.randomUUID()` (Web Crypto). Node 18 exposes
 * `randomUUID` only via `node:crypto`; the global exists from Node 19+.
 * Load this module before any Nest bootstrap (import first in main.ts).
 */
import { webcrypto } from "node:crypto";

if (typeof globalThis.crypto?.randomUUID !== "function") {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}
