import { describe, expect, it, vi } from "vitest";
import { RiotClient, RiotApiError } from "../src/riot/client";
import { FakeClock } from "./fake-clock";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("RiotClient", () => {
  it("sendet den API-Key als Header und cached Antworten", async () => {
    const fetchMock = vi.fn(async () => json({ puuid: "p1", gameName: "Alfons", tagLine: "EUW" }));
    const client = new RiotClient({ apiKey: "KEY", fetch: fetchMock as unknown as typeof fetch });
    const a = await client.getAccountByRiotId("europe", "Alfons", "EUW");
    const b = await client.getAccountByRiotId("europe", "Alfons", "EUW");
    expect(a?.puuid).toBe("p1");
    expect(b).toEqual(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Alfons/EUW");
    expect((init.headers as Record<string, string>)["X-Riot-Token"]).toBe("KEY");
  });

  it("dedupliziert parallele Requests", async () => {
    const fetchMock = vi.fn(async () => json(["EUW1_1"]));
    const client = new RiotClient({ apiKey: "K", fetch: fetchMock as unknown as typeof fetch });
    await Promise.all([client.getMatchIds("europe", "p"), client.getMatchIds("europe", "p")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gibt null bei 404 zurück (z.B. nicht im Spiel)", async () => {
    const client = new RiotClient({
      apiKey: "K",
      fetch: (async () => json({ status: { status_code: 404 } }, 404)) as unknown as typeof fetch,
    });
    expect(await client.getActiveGame("euw1", "p")).toBeNull();
  });

  it("wartet bei 429 die Retry-After-Zeit ab und versucht erneut", async () => {
    const clock = new FakeClock();
    const responses = [json({}, 429, { "Retry-After": "3" }), json({ puuid: "p" })];
    const fetchMock = vi.fn(async () => responses.shift()!);
    const client = new RiotClient({ apiKey: "K", fetch: fetchMock as unknown as typeof fetch, clock });
    const p = client.getAccountByPuuid("europe", "p");
    await clock.advance(2000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await clock.advance(1500);
    expect(await p).toEqual({ puuid: "p" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("wirft RiotApiError bei 403", async () => {
    const client = new RiotClient({
      apiKey: "K",
      fetch: (async () => json({ status: { message: "Forbidden" } }, 403)) as unknown as typeof fetch,
    });
    await expect(client.getSummonerByPuuid("euw1", "p")).rejects.toBeInstanceOf(RiotApiError);
  });
});
