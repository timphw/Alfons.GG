/* eslint-disable @next/next/no-img-element -- Data-Dragon-Icons sind bereits optimierte kleine PNGs */
import { ddragonUrl, type StaticData } from "@alfons/shared";
import { cn } from "@/lib/utils";

interface IconProps {
  data: StaticData;
  size?: number;
  className?: string;
}

export function ChampionIcon({
  data,
  championId,
  size = 32,
  className,
}: IconProps & { championId: number | string }) {
  const champ = data.champions[String(championId)];
  if (!champ) return <Placeholder size={size} className={className} />;
  return (
    <img
      src={ddragonUrl.championIcon(data.version, champ.id)}
      alt={champ.name}
      title={champ.name}
      width={size}
      height={size}
      loading="lazy"
      className={cn("rounded-md", className)}
    />
  );
}

export function ItemIcon({ data, itemId, size = 24, className }: IconProps & { itemId: number }) {
  const item = itemId ? data.items[String(itemId)] : undefined;
  if (!item) return <Placeholder size={size} className={className} />;
  return (
    <img
      src={ddragonUrl.itemIcon(data.version, itemId)}
      alt={item.name}
      title={`${item.name} (${item.gold.total}g)`}
      width={size}
      height={size}
      loading="lazy"
      className={cn("rounded", className)}
    />
  );
}

export function SpellIcon({ data, spellId, size = 20, className }: IconProps & { spellId: number }) {
  const spell = data.spells[String(spellId)];
  if (!spell) return <Placeholder size={size} className={className} />;
  return (
    <img
      src={ddragonUrl.spellIcon(data.version, spell.image.full)}
      alt={spell.name}
      title={spell.name}
      width={size}
      height={size}
      loading="lazy"
      className={cn("rounded", className)}
    />
  );
}

/** Rune oder Runen-Stil (Style-IDs wie 8100 liegen in runeStyles). */
export function RuneIcon({ data, runeId, size = 20, className }: IconProps & { runeId?: number }) {
  const rune = runeId ? (data.runes[String(runeId)] ?? data.runeStyles[String(runeId)]) : undefined;
  if (!rune) return <Placeholder size={size} className={className} />;
  return (
    <img
      src={ddragonUrl.runeIcon(rune.icon)}
      alt={rune.name}
      title={rune.name}
      width={size}
      height={size}
      loading="lazy"
      className={cn("rounded-full", className)}
    />
  );
}

export function ProfileIcon({ data, iconId, size = 80, className }: IconProps & { iconId: number }) {
  return (
    <img
      src={ddragonUrl.profileIcon(data.version, iconId)}
      alt="Profil-Icon"
      width={size}
      height={size}
      className={cn("rounded-xl", className)}
    />
  );
}

function Placeholder({ size, className }: { size: number; className?: string }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cn("inline-block rounded bg-muted", className)}
      aria-hidden
    />
  );
}
