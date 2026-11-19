import { describe, expect, it } from "vitest";
import { signCompanionToken, signPairingCode, verifyCompanionToken, verifyPairingCode } from "../src/live/token";

const payload = { sub: "puuid-123", rid: "Alfons#EUW", reg: "euw", iat: 1_700_000_000, ver: 1 as const };

describe("Companion-Token", () => {
  it("Roundtrip", async () => {
    const token = await signCompanionToken(payload, "secret");
    expect(await verifyCompanionToken(token, "secret")).toEqual(payload);
  });

  it("lehnt falsches Secret und manipulierte Payloads ab", async () => {
    const token = await signCompanionToken(payload, "secret");
    expect(await verifyCompanionToken(token, "other")).toBeNull();
    const [, sig] = token.split(".");
    const forged = btoa(JSON.stringify({ ...payload, sub: "evil" })).replace(/=+$/, "");
    expect(await verifyCompanionToken(`${forged}.${sig}`, "secret")).toBeNull();
    expect(await verifyCompanionToken("garbage", "secret")).toBeNull();
    expect(await verifyCompanionToken("a.b.c", "secret")).toBeNull();
  });
});

describe("Pairing-Code", () => {
  const pair = { sub: "puuid-123", rid: "Alfons#EUW", reg: "euw", exp: 2_000 };

  it("gültig bis zum Ablauf", async () => {
    const code = await signPairingCode(pair, "secret");
    expect(await verifyPairingCode(code, "secret", 1_999)).toMatchObject({ ...pair, typ: "pair" });
    expect(await verifyPairingCode(`  ${code}\n`, "secret", 1_999)).not.toBeNull();
    expect(await verifyPairingCode(code, "secret", 2_001)).toBeNull();
    expect(await verifyPairingCode(code, "other", 1_999)).toBeNull();
  });

  it("Pairing-Code und Companion-Token sind nicht austauschbar", async () => {
    const code = await signPairingCode(pair, "secret");
    const token = await signCompanionToken(payload, "secret");
    expect(await verifyCompanionToken(code, "secret")).toBeNull();
    expect(await verifyPairingCode(token, "secret", 0)).toBeNull();
  });
});
