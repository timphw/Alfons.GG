import { describe, expect, it } from "vitest";
import { parseRiotId, riotIdToSlug } from "../src/riot-id";

describe("parseRiotId", () => {
  it.each([
    ["Alfons#EUW", { gameName: "Alfons", tagLine: "EUW" }],
    ["Alfons #EUW ", { gameName: "Alfons", tagLine: "EUW" }],
    ["Alfons-EUW", { gameName: "Alfons", tagLine: "EUW" }],
    ["Der-Alfons#1234", { gameName: "Der-Alfons", tagLine: "1234" }],
    ["Gräfin%20Zahl-EUW", { gameName: "Gräfin Zahl", tagLine: "EUW" }],
  ])("%s", (input, expected) => {
    expect(parseRiotId(input)).toEqual(expected);
  });

  it.each(["Alfons", "#EUW", "Alfons#", "Al#EUW", "Alfons#TOOLONG1"])("lehnt %s ab", (input) => {
    expect(parseRiotId(input)).toBeNull();
  });

  it("Slug ist umkehrbar", () => {
    const id = { gameName: "Gräfin Zahl", tagLine: "EUW" };
    expect(parseRiotId(riotIdToSlug(id))).toEqual(id);
  });
});
