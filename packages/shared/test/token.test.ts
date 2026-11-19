import { describe, expect, it } from "vitest";
import { generatePairingCode, signCompanionToken, verifyCompanionToken } from "../src/live/token";

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

  it("Pairing-Codes sind 6 Zeichen ohne verwechselbare Zeichen", () => {
    for (let i = 0; i < 50; i++) expect(generatePairingCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});
