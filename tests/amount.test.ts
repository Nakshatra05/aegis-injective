import test from "node:test";
import assert from "node:assert/strict";
import { units, display } from "../src/lib/amount";
import { preflight, proposalSchema } from "../src/lib/proposal";
import { MARKET, type Policy } from "../src/lib/config";
test("exact base units and reversible boundaries", () => {
  assert.equal(units("0.000001"), 1n);
  assert.equal(units("9007199254.740993"), 9007199254740993n);
  assert.equal(display(9007199254740993n), "9007199254.740993");
  assert.equal(units("0.000000000000000001", 18), 1n);
});
test("reject exponent, negatives, precision loss and overflow", () => {
  for (const s of [
    "1e6",
    "-1",
    "1.0000001",
    "01",
    "NaN",
    "1,000",
    "340282366920938463463374607431768211456",
  ])
    assert.throws(() => units(s));
});
const p: Policy = {
  id: 1,
  agent: "agent",
  per_order: "10000000",
  cap: "50000000",
  spent: "45000000",
  expires_at: 2000,
  revoked: false,
  max_price: "20000000",
  next_nonce: 0,
};
const proposal = {
  market: MARKET,
  direction: "buy" as const,
  quoteAmount: "5",
  limitPrice: "10",
  explanation: "Manual buy",
} as const;
test("preflight allows exact remaining allowance and blocks excess", () => {
  assert(preflight(p, proposal, 1000).every((x) => x.ok));
  assert(
    preflight(p, { ...proposal, quoteAmount: "5.000001" }, 1000).some(
      (x) => !x.ok,
    ),
  );
});
test("expiry, revocation and unauthorized designated agent block", () => {
  assert(!preflight(p, proposal, 2000)[0].ok);
  assert(!preflight({ ...p, revoked: true }, proposal, 1000)[0].ok);
  assert(!preflight(p, proposal, 1000, "other")[1].ok);
});
test("strict proposal rejects arbitrary fields, sell, invalid decimal, and wrong market", () => {
  for (const bad of [
    { ...proposal, direction: "sell" },
    { ...proposal, market: "other" },
    { ...proposal, quoteAmount: "1e9" },
    { ...proposal, execute: { anything: true } },
    { ...proposal, limitPrice: "1.000001" },
  ])
    assert(!proposalSchema.safeParse(bad).success);
});
