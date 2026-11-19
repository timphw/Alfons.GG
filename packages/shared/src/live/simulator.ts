import type { AllGameData, LcdEvent, LcdItem, LcdPlayer, LcdTeam } from "./lcd-types";

/**
 * Deterministischer Spielsimulator: erzeugt allgamedata-Frames im Format der Live Client Data API.
 * Dient als Mock-Modus für den Companion und als Fixture-Quelle für Tests.
 * Kein Ersatz für echte Aufnahmen (`companion record`), aber strukturell identisch.
 */

interface ItemDef {
  id: number;
  name: string;
  price: number;
}

interface RosterEntry {
  name: string;
  tag: string;
  champ: string; // DDragon-ID
  champName: string;
  team: "ORDER" | "CHAOS";
  position: "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";
  spells: [string, string];
  keystone: [number, string];
  primary: [number, string];
  secondary: [number, string];
  build: ItemDef[];
}

const I = (id: number, name: string, price: number): ItemDef => ({ id, name, price });

const ROSTER: RosterEntry[] = [
  {
    name: "Garnele", tag: "EUW", champ: "Darius", champName: "Darius", team: "ORDER", position: "TOP",
    spells: ["SummonerFlash", "SummonerTeleport"], keystone: [8010, "Eroberer"], primary: [8000, "Präzision"], secondary: [8400, "Entschlossenheit"],
    build: [I(1054, "Dorans Schild", 450), I(3047, "Stahlkappen", 1200), I(6631, "Schrittbrecher", 3300), I(3053, "Steraks Pfand", 3200), I(3742, "Totmannsplatte", 2900)],
  },
  {
    name: "Waldfee", tag: "EUW", champ: "LeeSin", champName: "Lee Sin", team: "ORDER", position: "JUNGLE",
    spells: ["SummonerFlash", "SummonerSmite"], keystone: [8010, "Eroberer"], primary: [8000, "Präzision"], secondary: [8100, "Dominanz"],
    build: [I(1102, "Windläufer-Welpe", 450), I(6692, "Finsternis", 2900), I(3158, "Ionische Stiefel", 900), I(3071, "Schwarzes Beil", 3000), I(6333, "Todestanz", 3300)],
  },
  {
    name: "Mittelfeld", tag: "EUW", champ: "Ahri", champName: "Ahri", team: "ORDER", position: "MIDDLE",
    spells: ["SummonerFlash", "SummonerDot"], keystone: [8112, "Elektrisieren"], primary: [8100, "Dominanz"], secondary: [8200, "Zauberei"],
    build: [I(1056, "Dorans Ring", 400), I(6655, "Ludens Begleiter", 2750), I(3020, "Zauberschuhe", 1100), I(4645, "Schattenflamme", 3200), I(3089, "Rabadons Todeshaube", 3600)],
  },
  {
    name: "Alfons", tag: "EUW", champ: "Jinx", champName: "Jinx", team: "ORDER", position: "BOTTOM",
    spells: ["SummonerFlash", "SummonerHeal"], keystone: [8008, "Tödliches Tempo"], primary: [8000, "Präzision"], secondary: [8300, "Inspiration"],
    build: [I(1055, "Dorans Klinge", 450), I(3006, "Berserkerbeinschienen", 1100), I(6672, "Krakentöter", 3100), I(3031, "Klinge der Unendlichkeit", 3450), I(3094, "Schnellfeuerkanone", 2650)],
  },
  {
    name: "Hakenmeister", tag: "EUW", champ: "Thresh", champName: "Thresh", team: "ORDER", position: "UTILITY",
    spells: ["SummonerFlash", "SummonerExhaust"], keystone: [8439, "Nachbeben"], primary: [8400, "Entschlossenheit"], secondary: [8300, "Inspiration"],
    build: [I(3865, "Weltatlas", 400), I(3047, "Stahlkappen", 1200), I(3190, "Medaillon der Eisernen Solari", 2200), I(3109, "Ritterlicher Schwur", 2300)],
  },
  {
    name: "Felsbrocken", tag: "1234", champ: "Malphite", champName: "Malphite", team: "CHAOS", position: "TOP",
    spells: ["SummonerFlash", "SummonerTeleport"], keystone: [8437, "Griff der Untoten"], primary: [8400, "Entschlossenheit"], secondary: [8200, "Zauberei"],
    build: [I(1054, "Dorans Schild", 450), I(3068, "Sonnenfeuer-Aegis", 2700), I(3047, "Stahlkappen", 1200), I(3075, "Dornenpanzer", 2450)],
  },
  {
    name: "Blutdurst", tag: "1234", champ: "Warwick", champName: "Warwick", team: "CHAOS", position: "JUNGLE",
    spells: ["SummonerFlash", "SummonerSmite"], keystone: [8010, "Eroberer"], primary: [8000, "Präzision"], secondary: [8400, "Entschlossenheit"],
    build: [I(1103, "Moosstampfer-Welpe", 450), I(3153, "Klinge des gestürzten Königs", 3200), I(3111, "Quecksilberstiefel", 1250), I(3748, "Titanische Hydra", 3300)],
  },
  {
    name: "Schattenmann", tag: "1234", champ: "Zed", champName: "Zed", team: "CHAOS", position: "MIDDLE",
    spells: ["SummonerFlash", "SummonerDot"], keystone: [8112, "Elektrisieren"], primary: [8100, "Dominanz"], secondary: [8000, "Präzision"],
    build: [I(1055, "Dorans Klinge", 450), I(3142, "Youmuus Geistklinge", 2800), I(3158, "Ionische Stiefel", 900), I(6694, "Serylda's Groll", 3000)],
  },
  {
    name: "Stilwechsel", tag: "1234", champ: "Samira", champName: "Samira", team: "CHAOS", position: "BOTTOM",
    spells: ["SummonerFlash", "SummonerBarrier"], keystone: [8021, "Leichtfüßigkeit"], primary: [8000, "Präzision"], secondary: [8100, "Dominanz"],
    build: [I(1055, "Dorans Klinge", 450), I(3072, "Blutdürster", 3400), I(3006, "Berserkerbeinschienen", 1100), I(3031, "Klinge der Unendlichkeit", 3450)],
  },
  {
    name: "Sternenheil", tag: "1234", champ: "Soraka", champName: "Soraka", team: "CHAOS", position: "UTILITY",
    spells: ["SummonerFlash", "SummonerExhaust"], keystone: [8214, "Aery herbeirufen"], primary: [8200, "Zauberei"], secondary: [8400, "Entschlossenheit"],
    build: [I(3865, "Weltatlas", 400), I(3158, "Ionische Stiefel", 900), I(6617, "Mondsteinerneuerer", 2200), I(3504, "Glühendes Rauchfass", 2300)],
  },
];

const CS_PER_MIN: Record<RosterEntry["position"], number> = { TOP: 7, JUNGLE: 5.5, MIDDLE: 7.5, BOTTOM: 8, UTILITY: 1.2 };
const XP_RATE: Record<RosterEntry["position"], number> = { TOP: 0.85, JUNGLE: 0.75, MIDDLE: 0.85, BOTTOM: 0.75, UTILITY: 0.6 };
const DRAGONS = ["Fire", "Water", "Earth", "Air", "Hextech", "Chemtech"];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SimPlayer {
  r: RosterEntry;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  ward: number;
  gold: number; // ungespendetes Gold
  bought: number; // Index im Build
  deadUntil: number;
  bonusXp: number;
}

export interface SimulatorOptions {
  seed?: number;
  /** Index des aktiven Spielers im Roster (Standard: Alfons/Jinx) */
  activeIndex?: number;
  /** Spielende nach x Sekunden */
  durationSec?: number;
}

export class GameSimulator {
  private rand: () => number;
  private t = 0;
  private players: SimPlayer[];
  private events: LcdEvent[] = [];
  private eventId = 0;
  private nextKillAt = 200;
  private nextDragonAt = 300;
  private nextTowerAt = 720;
  private nextBaronAt = 1500;
  private grubsDone = false;
  private heraldDone = false;
  private ended = false;
  readonly activeIndex: number;
  readonly durationSec: number;

  constructor(opts: SimulatorOptions = {}) {
    this.rand = mulberry32(opts.seed ?? 42);
    this.activeIndex = opts.activeIndex ?? 3;
    this.durationSec = opts.durationSec ?? 32 * 60;
    this.players = ROSTER.map((r) => ({
      r, kills: 0, deaths: 0, assists: 0, cs: 0, ward: 0, gold: 500, bought: 0, deadUntil: 0, bonusXp: 0,
    }));
    this.pushEvent({ EventName: "GameStart" });
    for (const p of this.players) this.buy(p);
  }

  get gameTime(): number {
    return this.t;
  }

  /** Simuliert `dtSec` Spielsekunden in 1-s-Schritten und gibt den aktuellen Frame zurück. */
  advance(dtSec: number): AllGameData {
    const steps = Math.max(1, Math.round(dtSec));
    for (let i = 0; i < steps && !this.ended; i++) this.step(dtSec / steps);
    return this.frame();
  }

  /** Springt ohne Zwischenframes zu `t` Sekunden. */
  fastForward(toSec: number): AllGameData {
    while (this.t < toSec && !this.ended) this.step(1);
    return this.frame();
  }

  private pushEvent(e: Omit<LcdEvent, "EventID" | "EventTime">) {
    this.events.push({ EventID: this.eventId++, EventTime: Math.round(this.t * 1000) / 1000, ...e });
  }

  private step(dt: number) {
    this.t += dt;
    const t = this.t;
    if (t >= 65 && this.events.every((e) => e.EventName !== "MinionsSpawning"))
      this.pushEvent({ EventName: "MinionsSpawning" });

    for (const p of this.players) {
      const alive = t >= p.deadUntil;
      if (t > 65) p.gold += 2.04 * dt;
      if (alive && t > 90) {
        const csGain = (CS_PER_MIN[p.r.position] / 60) * dt * (0.85 + this.rand() * 0.3);
        p.cs += csGain;
        p.gold += csGain * 21;
      }
      p.ward += ((p.r.position === "UTILITY" ? 1.6 : 0.45) / 60) * dt;
      this.buy(p);
    }

    if (t >= this.nextKillAt) {
      this.championKill();
      this.nextKillAt = t + 18 + this.rand() * 35;
    }
    if (t >= this.nextDragonAt) {
      this.objective("DragonKill", { DragonType: DRAGONS[Math.floor(this.rand() * DRAGONS.length)]!, Stolen: "False" });
      this.nextDragonAt = t + 300;
    }
    if (!this.grubsDone && t >= 360) {
      const killer = this.randomPlayer(undefined, "JUNGLE");
      for (let i = 0; i < 3; i++) this.pushEvent({ EventName: "HordeKill", KillerName: killer.r.name, Assisters: [], Stolen: "False" });
      this.grubsDone = true;
    }
    if (!this.heraldDone && t >= 900) {
      this.objective("HeraldKill", { Stolen: "False" });
      this.heraldDone = true;
    }
    if (t >= this.nextBaronAt) {
      this.objective("BaronKill", { Stolen: "False" });
      this.nextBaronAt = t + 360;
    }
    if (t >= this.nextTowerAt) {
      this.tower();
      this.nextTowerAt = t + 70 + this.rand() * 80;
    }
    if (t >= this.durationSec) {
      const order = this.teamKills("ORDER") + this.rand() * 5;
      const chaos = this.teamKills("CHAOS") + this.rand() * 5;
      const winner: LcdTeam = order >= chaos ? "ORDER" : "CHAOS";
      const activeTeam = this.players[this.activeIndex]!.r.team;
      this.pushEvent({ EventName: "GameEnd", Result: winner === activeTeam ? "Win" : "Lose" });
      this.ended = true;
    }
  }

  private teamKills(team: LcdTeam) {
    return this.players.filter((p) => p.r.team === team).reduce((s, p) => s + p.kills, 0);
  }

  private randomPlayer(team?: LcdTeam, position?: string, aliveOnly = true): SimPlayer {
    const pool = this.players.filter(
      (p) => (!team || p.r.team === team) && (!position || p.r.position === position) && (!aliveOnly || this.t >= p.deadUntil),
    );
    const list = pool.length ? pool : this.players.filter((p) => !team || p.r.team === team);
    return list[Math.floor(this.rand() * list.length)]!;
  }

  private level(p: SimPlayer): number {
    return Math.min(18, 1 + Math.floor((this.t / 60) * XP_RATE[p.r.position] + p.bonusXp));
  }

  private championKill() {
    // ORDER ist im Seed leicht vorne – so gibt es eine sichtbare Gold-Differenz
    const killerTeam: LcdTeam = this.rand() < 0.56 ? "ORDER" : "CHAOS";
    const victimTeam: LcdTeam = killerTeam === "ORDER" ? "CHAOS" : "ORDER";
    const killer = this.randomPlayer(killerTeam);
    const victim = this.randomPlayer(victimTeam);
    const assisters = this.players
      .filter((p) => p.r.team === killerTeam && p !== killer && this.t >= p.deadUntil && this.rand() < 0.4)
      .slice(0, 3);
    const first = !this.events.some((e) => e.EventName === "ChampionKill");
    killer.kills++;
    killer.gold += first ? 400 : 300;
    killer.bonusXp += 0.4;
    victim.deaths++;
    victim.deadUntil = this.t + 6 + this.level(victim) * 1.8;
    for (const a of assisters) {
      a.assists++;
      a.gold += 150;
    }
    this.pushEvent({
      EventName: "ChampionKill",
      KillerName: killer.r.name,
      VictimName: victim.r.name,
      Assisters: assisters.map((a) => a.r.name),
    });
    if (first) this.pushEvent({ EventName: "FirstBlood", Recipient: killer.r.name });
  }

  private objective(name: string, extra: Partial<LcdEvent>) {
    const team: LcdTeam = this.rand() < 0.58 ? "ORDER" : "CHAOS";
    const killer = this.randomPlayer(team, "JUNGLE");
    for (const p of this.players) if (p.r.team === team) p.gold += name === "BaronKill" ? 300 : 50;
    this.pushEvent({ EventName: name, KillerName: killer.r.name, Assisters: [], ...extra });
  }

  private tower() {
    const team: LcdTeam = this.rand() < 0.6 ? "ORDER" : "CHAOS";
    const owner = team === "ORDER" ? "T2" : "T1";
    const lane = ["L", "C", "R"][Math.floor(this.rand() * 3)]!;
    const killer = this.randomPlayer(team);
    for (const p of this.players) if (p.r.team === team) p.gold += 100;
    this.pushEvent({ EventName: "TurretKilled", TurretKilled: `Turret_${owner}_${lane}_03_A`, KillerName: killer.r.name, Assisters: [] });
  }

  private buy(p: SimPlayer) {
    const next = p.r.build[p.bought];
    if (next && p.gold >= next.price) {
      p.gold -= next.price;
      p.bought++;
    }
  }

  private frame(): AllGameData {
    const allPlayers: LcdPlayer[] = this.players.map((p) => {
      const items: LcdItem[] = p.r.build.slice(0, p.bought).map((it, slot) => ({
        itemID: it.id,
        displayName: it.name,
        price: it.price,
        count: 1,
        slot,
        canUse: false,
        consumable: false,
      }));
      items.push({ itemID: 3340, displayName: "Unsichtbares Auge", price: 0, count: 1, slot: 6, canUse: true, consumable: false });
      const dead = this.t < p.deadUntil;
      return {
        championName: p.r.champName,
        rawChampionName: `game_character_displayname_${p.r.champ}`,
        isBot: false,
        isDead: dead,
        items,
        level: this.level(p),
        position: p.r.position,
        respawnTimer: dead ? Math.round((p.deadUntil - this.t) * 10) / 10 : 0,
        riotId: `${p.r.name}#${p.r.tag}`,
        riotIdGameName: p.r.name,
        riotIdTagLine: p.r.tag,
        summonerName: `${p.r.name}#${p.r.tag}`,
        team: p.r.team,
        scores: {
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          creepScore: Math.floor(p.cs),
          wardScore: Math.round(p.ward * 10) / 10,
        },
        summonerSpells: {
          summonerSpellOne: spell(p.r.spells[0]),
          summonerSpellTwo: spell(p.r.spells[1]),
        },
        runes: {
          keystone: { id: p.r.keystone[0], displayName: p.r.keystone[1] },
          primaryRuneTree: { id: p.r.primary[0], displayName: p.r.primary[1] },
          secondaryRuneTree: { id: p.r.secondary[0], displayName: p.r.secondary[1] },
        },
        skinID: 0,
      };
    });

    const me = this.players[this.activeIndex]!;
    const lvl = this.level(me);
    return {
      activePlayer: {
        riotId: `${me.r.name}#${me.r.tag}`,
        riotIdGameName: me.r.name,
        riotIdTagLine: me.r.tag,
        summonerName: `${me.r.name}#${me.r.tag}`,
        level: lvl,
        currentGold: Math.round(me.gold * 100) / 100,
        championStats: {
          attackDamage: 59 + lvl * 3.4 + me.bought * 18,
          abilityPower: 0,
          armor: 26 + lvl * 4.7,
          magicResist: 30 + lvl * 1.3,
          maxHealth: 630 + lvl * 105,
          currentHealth: this.t < me.deadUntil ? 0 : 630 + lvl * 105,
          attackSpeed: 0.625 * (1 + lvl * 0.014 + me.bought * 0.1),
          moveSpeed: 325 + (me.bought >= 2 ? 45 : 0),
          abilityHaste: 0,
          critChance: me.bought >= 4 ? 0.25 : 0,
          lifeSteal: 0,
        },
      },
      allPlayers,
      events: { Events: [...this.events] },
      gameData: { gameMode: "CLASSIC", gameTime: Math.round(this.t * 1000) / 1000, mapName: "Map11", mapNumber: 11, mapTerrain: "Default" },
    };
  }
}

function spell(key: string) {
  const names: Record<string, string> = {
    SummonerFlash: "Blitz", SummonerTeleport: "Teleportation", SummonerSmite: "Zerschmettern",
    SummonerDot: "Entzünden", SummonerHeal: "Heilen", SummonerExhaust: "Erschöpfung", SummonerBarrier: "Barriere",
  };
  return { displayName: names[key] ?? key, rawDisplayName: `GeneratedTip_SummonerSpell_${key}_DisplayName` };
}
