import type { CoachResult, LiveSnapshot } from "@alfons/shared";

const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const PRIO_MARK = { high: "❗", medium: "•", info: "·" } as const;

/** Gibt den Coach-Block nur aus, wenn sich Empfehlung oder Tipps geändert haben. */
export class TerminalCoach {
  private lastSignature = "";
  private lastPrint = 0;

  print(s: LiveSnapshot, c: CoachResult | null) {
    if (!c) return;
    const plan = c.build?.nextPurchase;
    const signature = [
      // Komponenten-Vorschläge ändern sich mit jedem Gold-Tick → nicht Teil der Signatur
      c.build?.nextItem?.id,
      plan?.completes,
      c.tips.map((t) => t.id).join(","),
      c.lane?.verdict,
      c.jungle?.advice,
    ].join("|");
    if (signature === this.lastSignature || Date.now() - this.lastPrint < 3000) return;
    this.lastSignature = signature;
    this.lastPrint = Date.now();

    const lines: string[] = [];
    lines.push(`\n── Coach ${fmtTime(s.gameTime)} ${"─".repeat(40)}`);
    if (c.now) lines.push(`  ▶ JETZT: ${c.now.text}`);
    if (c.lane) {
      const v = c.lane.verdictText;
      lines.push(`  ⚔ ${c.lane.role}: ${v}${c.lane.reasons.length ? ` – ${c.lane.reasons.slice(0, 2).join(" · ")}` : ""}`);
    }
    if (c.jungle?.gankTarget) lines.push(`  🎯 Gank-Ziel: ${c.jungle.gankTarget.lane} – ${c.jungle.gankTarget.reason}`);
    if (c.build?.nextItem && plan) {
      const it = c.build.nextItem;
      lines.push(
        plan.completes
          ? `  💰 ${it.name} ist JETZT kaufbar!`
          : `  💰 Nächstes Item: ${it.name} (noch ${plan.goldMissing} g)` +
              (plan.buyNow.length ? ` – jetzt schon: ${plan.buyNow.map((b) => `${b.name} ${b.cost}g`).join(" + ")}` : ""),
      );
      if (it.reasons[0]) lines.push(`     ↳ ${it.reasons[0]}`);
      const next = c.build.items.slice(1, 4).map((i) => i.name);
      if (next.length) lines.push(`     danach: ${next.join(" → ")}`);
    }
    for (const t of c.tips) if (t.id !== c.now?.id) lines.push(`  ${PRIO_MARK[t.priority]} ${t.text}`);
    console.log(lines.join("\n") + "\n");
  }
}
