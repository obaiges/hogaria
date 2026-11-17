import { User } from "lucide-react";
import { useState, type CSSProperties } from "react";

import { type LaneColor } from "@hogaria/shared";

import { cn } from "@/lib/utils";

import { laneColorVar } from "./lane-colors";

export interface AvatarMember {
  name: string;
  /** `null` para un ex-miembro: se pinta con la variante neutra. */
  laneColor: LaneColor | null;
  image?: string | null;
}

export type MemberAvatarSize = 20 | 28 | 36;

export interface MemberAvatarProps {
  /** `null` = sin miembro (sistema o usuario eliminado): variante neutra con icono. */
  member: AvatarMember | null;
  size?: MemberAvatarSize;
  /** Nombre accesible cuando no hay miembro. */
  fallbackLabel?: string;
  /** Si el nombre ya aparece al lado, el avatar se oculta a los lectores de pantalla. */
  decorative?: boolean;
  className?: string;
}

const FONT_SIZE: Record<MemberAvatarSize, string> = { 20: "9px", 28: "12px", 36: "14px" };

/** "Ana García" → "AG"; "Óscar" → "Ó". */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  const letters = [Array.from(first)[0], last ? Array.from(last)[0] : ""].join("");
  return letters.toLocaleUpperCase("es");
}

export function MemberAvatar({
  member,
  size = 28,
  fallbackLabel = "Usuario eliminado",
  decorative = false,
  className,
}: MemberAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const neutral = !member?.laneColor;
  const label = member?.name ?? fallbackLabel;
  const showImage = Boolean(member?.image) && !imageFailed;
  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize: FONT_SIZE[size],
    background: neutral ? "var(--surface-sunken)" : laneColorVar(member.laneColor as LaneColor),
  };

  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      data-neutral={neutral || undefined}
      className={cn(
        "pool-avatar inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold leading-none",
        neutral && "border border-[var(--grout-strong)]",
        className,
      )}
      style={style}
    >
      {showImage ? (
        <img src={member?.image ?? undefined} alt="" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
      ) : member ? (
        <span aria-hidden>{getInitials(member.name)}</span>
      ) : (
        <User aria-hidden style={{ width: size * 0.6, height: size * 0.6 }} />
      )}
    </span>
  );
}

/** Punto de miembro: `MemberAvatar` de 20 px (por ejemplo, en "le toca a"). */
export function MemberDot(props: Omit<MemberAvatarProps, "size">) {
  return <MemberAvatar {...props} size={20} />;
}
