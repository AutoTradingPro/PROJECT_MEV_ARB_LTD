import assert from "node:assert/strict";
import { test } from "node:test";
import { ZeroAddress, id } from "ethers";
import { planWithdraw } from "./withdrawPlan";

const TOKEN = "0x0000000000000000000000000000000000000001";
const DEST = "0x0000000000000000000000000000000000000002";

function selector(signature: string): string {
  return id(signature).slice(0, 10).toLowerCase();
}

test("ethereum and polygon partial token rescue uses the two-arg treasury signature", () => {
  for (const chain of ["ethereum", "polygon"] as const) {
    const plan = planWithdraw({
      selectors: null,
      chain,
      native: false,
      pullAll: false,
      token: TOKEN,
      amount: 5n,
      available: 10n,
      dest: DEST,
    });
    assert.deepEqual(
      plan.map((call) => call.method),
      ["withdrawToken(address,uint256)", "rescueFunds(address,uint256)"],
      chain
    );
    assert.equal(plan.some((call) => call.method === "rescueFunds(address)"), false);
  }
});

test("bsc sweep never encodes rescueFunds", () => {
  const native = planWithdraw({
    selectors: null,
    chain: "bsc",
    native: true,
    pullAll: true,
    token: ZeroAddress,
    amount: 0n,
    available: 1n,
    dest: DEST,
  });
  const token = planWithdraw({
    selectors: null,
    chain: "bsc",
    native: false,
    pullAll: true,
    token: TOKEN,
    amount: 0n,
    available: 1n,
    dest: DEST,
  });
  assert.deepEqual(native.map((call) => call.method), ["withdrawBNB()"]);
  assert.deepEqual(token.map((call) => call.method), ["withdrawToken(address)"]);
});

test("bytecode selectors win over the chain profile", () => {
  const plan = planWithdraw({
    selectors: new Set([selector("rescueFunds(address)")]),
    chain: "ethereum",
    native: false,
    pullAll: true,
    token: TOKEN,
    amount: 0n,
    available: 4n,
    dest: DEST,
  });
  assert.deepEqual(plan.map((call) => call.method), ["rescueFunds(address)"]);
});
