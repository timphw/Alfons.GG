import type { AllGameData, LcdEvent, LcdPlayer } from "./lcd-types";
import type { LiveEvent, LivePlayer, LiveSnapshot, TeamObjectives, TeamSide } from "./snapshot";

const STAT_KEYS = [
  "attackDamage", "abilityPower", "armor", "magicResist", "maxHealth", "currentHealth",
  "attackSpeed", "moveSpeed", "abilityHaste", "critChance", "lifeSteal", "omnivamp",
  "armorPenetrationFlat", "magicPenetrationFlat", "physicalLethality", "resourceMax",
] as const;

const FEED_EVENTS = new Set([
  "ChampionKill", "FirstBlood", "Multikill", "Ace", "DragonKill", "BaronKill", "HeraldKill",
  "HordeKill", "AtakhanKill", "TurretKilled", "InhibKilled", "FirstBrick", "GameEnd",
]);

export function playerRiotId(p: { riotId?: string; riotIdGameName?: string; riotIdTagLine?: string; summonerName?: string }): string {
  if (p.riotId) return p.riotId;
  if (p.riotIdGameName) return p.riotIdTagLine ? `${p.riotIdGameName}#${p.riotIdTagLine}` : p.riotIdGameName;
  return p.summonerName ?? "?";
}

/** "game_character_displayname_MonkeyKing" → "MonkeyKing" */
export function championKey(p: Pick<LcdPlayer, "rawChampionName" | "championName">): string {
  const raw = p.rawChampionName?.replace(/^game_character_displayname_/, "");
  if (raw && raw !== p.rawChampionName) return raw;
  return p.championName.replace(/[^A-Za-z0-9]/g, "");
}

/** "GeneratedTip_SummonerSpell_SummonerFlash_DisplayName" → "SummonerFlash" */
export function spellKey(s: { displayName: string; rawDisplayName?: string } | undefined): string {
  if (!s) return "";
  const m = s.rawDisplayName?.match(/SummonerSpell_(\w+?)_DisplayName/);
  return m?.[1] ?? s.displayName;
}

function emptyTeam(): TeamObjectives {
  return { kills: 0, towers: 0, inhibitors: 0, dragons: [], barons: 0, heralds: 0, grubs: 0, atakhan: 0, itemGold: 0 };
}

/** Turret_T1_... / Barracks_T1_... gehört ORDER → die Zerstörung zählt für CHAOS. */
function structureOwner(name: string | undefined): TeamSide | undefined {
  if (!name) return undefined;
  if (/_T1_/.test(name)) return "ORDER";
  if (/_T2_/.test(name)) return "CHAOS";
  return undefined;
}

const other = (t: TeamSide): TeamSide => (t === "ORDER" ? "CHAOS" : "ORDER");

/** Reine Funktion: allgamedata → LiveSnapshot. */
export function normalizeAllGameData(data: AllGameData, maxEvents = 20): LiveSnapshot {
  const players: LivePlayer[] = data.allPlayers
    .filter((p) => p.team === "ORDER" || p.team === "CHAOS")
    .map((p) => {
      const items = (p.items ?? []).map((i) => ({
        id: i.itemID,
        slot: i.slot,
        count: i.count,
        price: i.price,
        name: i.displayName.slice(0, 80),
      }));
      return {
        riotId: playerRiotId(p),
        gameName: p.riotIdGameName ?? p.summonerName ?? playerRiotId(p).split("#")[0]!,
        tagLine: p.riotIdTagLine,
        champion: championKey(p),
        championName: p.championName,
        team: p.team as TeamSide,
        position: p.position ?? "",
        level: p.level,
        isDead: !!p.isDead,
        respawnTimer: p.respawnTimer ?? 0,
        isBot: !!p.isBot,
        kills: p.scores.kills,
        deaths: p.scores.deaths,
        assists: p.scores.assists,
        cs: p.scores.creepScore,
        wardScore: Math.round(p.scores.wardScore * 10) / 10,
        items,
        itemGold: items.reduce((s, i) => s + i.price * i.count, 0),
        spells: [spellKey(p.summonerSpells?.summonerSpellOne), spellKey(p.summonerSpells?.summonerSpellTwo)],
        keystone: p.runes?.keystone?.id,
        secondaryTree: p.runes?.secondaryRuneTree?.id,
      };
    });

  // Namen → Team, um Event-Killer zuzuordnen (Events nutzen je nach Client-Version unterschiedliche Namen)
  const teamOf = new Map<string, TeamSide>();
  for (const p of data.allPlayers) {
    if (p.team !== "ORDER" && p.team !== "CHAOS") continue;
    for (const n of [p.riotId, p.riotIdGameName, p.summonerName, playerRiotId(p)]) if (n) teamOf.set(n, p.team);
  }
  const killerTeam = (e: LcdEvent): TeamSide | undefined => (e.KillerName ? teamOf.get(e.KillerName) : undefined);

  const teams = { ORDER: emptyTeam(), CHAOS: emptyTeam() };
  for (const p of players) {
    teams[p.team].kills += p.kills;
    teams[p.team].itemGold += p.itemGold;
  }

  let result: LiveSnapshot["result"];
  const feed: LiveEvent[] = [];
  for (const e of data.events?.Events ?? []) {
    let team: TeamSide | undefined;
    let detail: string | undefined;
    switch (e.EventName) {
      case "DragonKill":
        team = killerTeam(e);
        detail = e.DragonType;
        if (team) teams[team].dragons.push(e.DragonType ?? "?");
        break;
      case "BaronKill":
        team = killerTeam(e);
        if (team) teams[team].barons++;
        break;
      case "HeraldKill":
        team = killerTeam(e);
        if (team) teams[team].heralds++;
        break;
      case "HordeKill":
        team = killerTeam(e);
        if (team) teams[team].grubs++;
        break;
      case "AtakhanKill":
        team = killerTeam(e);
        if (team) teams[team].atakhan++;
        break;
      case "TurretKilled": {
        const owner = structureOwner(e.TurretKilled);
        team = owner ? other(owner) : killerTeam(e);
        if (team) teams[team].towers++;
        detail = e.TurretKilled;
        break;
      }
      case "InhibKilled": {
        const owner = structureOwner(e.InhibKilled);
        team = owner ? other(owner) : killerTeam(e);
        if (team) teams[team].inhibitors++;
        detail = e.InhibKilled;
        break;
      }
      case "ChampionKill":
      case "FirstBlood":
      case "Multikill":
        team = killerTeam(e) ?? (e.Recipient ? teamOf.get(e.Recipient) : undefined);
        if (e.EventName === "Multikill") detail = String(e.KillStreak ?? "");
        break;
      case "Ace":
        team = e.AcingTeam === "ORDER" || e.AcingTeam === "CHAOS" ? e.AcingTeam : undefined;
        break;
      case "GameEnd":
        result = e.Result;
        break;
    }
    if (FEED_EVENTS.has(e.EventName)) {
      feed.push({
        id: e.EventID,
        time: e.EventTime,
        type: e.EventName,
        killer: (e.KillerName ?? e.Recipient ?? e.Acer)?.slice(0, 60),
        victim: e.VictimName?.slice(0, 60),
        assisters: e.Assisters?.slice(0, 5).map((a) => a.slice(0, 60)),
        team,
        detail: detail?.slice(0, 60),
      });
    }
  }

  const ap = data.activePlayer;
  const activePlayer =
    ap && !ap.error && ap.currentGold !== undefined
      ? {
          riotId: playerRiotId(ap),
          level: ap.level ?? 1,
          currentGold: Math.floor(ap.currentGold),
          stats: Object.fromEntries(
            STAT_KEYS.filter((k) => typeof ap.championStats?.[k] === "number").map((k) => [
              k,
              Math.round(ap.championStats![k]! * 100) / 100,
            ]),
          ),
        }
      : undefined;

  return {
    v: 1,
    gameTime: Math.round(data.gameData.gameTime * 10) / 10,
    gameMode: data.gameData.gameMode,
    mapNumber: data.gameData.mapNumber,
    status: result ? "ended" : "in-game",
    result,
    activePlayer,
    players,
    teams,
    events: feed.slice(-maxEvents),
  };
}
