import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrivateKey } from "@injectivelabs/sdk-ts/core/accounts";
import { generateArbitrarySignDoc } from "@injectivelabs/sdk-ts/core/tx";
import { verifyOwnerSignature, sameOrigin } from "../src/lib/server/auth";
test("ADR-036 owner signature binds exact owner and message", () => {
  const key = PrivateKey.fromHex(randomBytes(32).toString("hex"));
  const owner = key.toBech32(),
    message = "Aegis test session: injective-888, nonce 123";
  const { signDocBuff } = generateArbitrarySignDoc(message, owner);
  const sig = {
    pub_key: { value: key.toPublicKey().toBase64() },
    signature: Buffer.from(key.sign(signDocBuff)).toString("base64"),
  };
  assert.doesNotThrow(() => verifyOwnerSignature(owner, message, sig));
  assert.throws(() => verifyOwnerSignature(owner, message + "tampered", sig));
  const other = PrivateKey.fromHex(randomBytes(32).toString("hex"));
  assert.throws(() => verifyOwnerSignature(other.toBech32(), message, sig));
});
test("mutation Origin fails closed", () => {
  process.env.APP_ORIGIN = "https://aegis.example";
  assert.doesNotThrow(() =>
    sameOrigin(
      new Request("https://aegis.example/api", {
        headers: { Origin: "https://aegis.example" },
      }),
    ),
  );
  assert.throws(() =>
    sameOrigin(
      new Request("https://aegis.example/api", {
        headers: { Origin: "https://evil.example" },
      }),
    ),
  );
  assert.throws(() => sameOrigin(new Request("https://aegis.example/api")));
});
