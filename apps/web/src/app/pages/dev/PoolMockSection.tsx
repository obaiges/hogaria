import { Square } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { DepthFigure, Lane, LaneRope, MemberAvatar, MemberDot } from "@/components/pool";
import { Button } from "@/components/ui/Button";

/** Reproducción de docs/design/mock-inicio.html con los componentes de la piscina (solo desarrollo). */

function LaneChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-xs)] border border-[var(--grout)] bg-[var(--surface)] px-2 py-1 text-[14px] text-[var(--ink)]">
      {children}
    </span>
  );
}

function TaskChip({ children }: { children: ReactNode }) {
  return (
    <LaneChip>
      <Square className="h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden />
      {children}
    </LaneChip>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="px-4 pb-2 pt-[18px] font-sign text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-muted)]">
      {children}
    </h3>
  );
}

export function PoolMockSection() {
  const [rippleKey, setRippleKey] = useState(1);
  const [rippling, setRippling] = useState(true);

  useEffect(() => {
    if (!rippling) return;
    const t = setTimeout(() => setRippling(false), 1100);
    return () => clearTimeout(t);
  }, [rippling, rippleKey]);

  const replay = () => {
    setRippling(false);
    // Un frame sin la clase para que la animación vuelva a empezar.
    requestAnimationFrame(() => {
      setRippleKey((k) => k + 1);
      setRippling(true);
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-sign text-[14px] font-semibold tracking-[0.06em] text-[var(--ink-muted)]">PISCINA · MOCK DE INICIO</h2>

      <div className="-mx-4 overflow-hidden border-y border-[var(--grout)] bg-[var(--bg)] pb-4">
        <header className="flex h-14 items-center justify-between bg-[var(--shell)] px-4 text-[var(--on-shell)]">
          <b className="text-[18px]">Casa Baiges ▾</b>
          <MemberAvatar member={{ name: "Óscar Baiges", laneColor: "SEA" }} size={28} />
        </header>
        <div className="bg-[var(--shell)] px-4 pb-3.5 text-[var(--on-shell)]">
          <div className="font-sign text-[28px] font-semibold uppercase tracking-[0.04em]">Mié 11 nov</div>
        </div>

        <SectionTitle>Hoy, por calles</SectionTitle>
        <div className="flex flex-col gap-1.5 px-4">
          <Lane member={{ name: "Ana", laneColor: "CORAL" }} onPress={() => {}}>
            <LaneChip>Turno 08:00–15:00</LaneChip>
            <TaskChip>Fregar</TaskChip>
            <LaneChip>Dentista 17:30</LaneChip>
          </Lane>
          <LaneRope />
          <Lane key={rippleKey} member={{ name: "Óscar", laneColor: "SEA" }} highlight={rippling ? "ripple" : undefined} rippleColor="CORAL">
            <LaneChip>Turno 09:00–17:00</LaneChip>
            <TaskChip>Sacar basura</TaskChip>
          </Lane>
          <LaneRope />
          <Lane member={{ name: "Lucía", laneColor: "SUN" }}>
            <LaneChip>Colegio 09:00–16:30</LaneChip>
            <LaneChip>Natación 18:00</LaneChip>
          </Lane>
        </div>

        <SectionTitle>De un vistazo</SectionTitle>
        <div className="mx-4 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-md)] border border-[var(--grout)] bg-[var(--grout)]">
          <DepthFigure className="bg-[var(--surface)] p-3" size="l" value="4" label="Quedan en Mercadona" />
          <DepthFigure className="bg-[var(--surface)] p-3" size="l" variant="limit" value="64,20 €" label="Luz · vencida ayer" />
        </div>

        <SectionTitle>Comidas de hoy</SectionTitle>
        <div className="px-4">
          <Lane member={{ name: "Comida", laneColor: null }}>
            <LaneChip>Lentejas con verduras</LaneChip>
          </Lane>
        </div>
      </div>

      <Button variant="secondary" onClick={replay}>
        Repetir la onda
      </Button>

      <h3 className="font-sign text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-muted)]">Avatares y corcheras</h3>
      <div className="flex flex-wrap items-center gap-3">
        <MemberDot member={{ name: "Ana García", laneColor: "CORAL" }} />
        <MemberAvatar member={{ name: "Ana García", laneColor: "CORAL" }} size={28} />
        <MemberAvatar member={{ name: "Ana García", laneColor: "CORAL" }} size={36} />
        <MemberAvatar member={{ name: "Lucía", laneColor: "SUN" }} size={36} />
        <MemberAvatar member={{ name: "Leo Martín", laneColor: "LEAF" }} size={36} />
        <MemberAvatar member={{ name: "Pablo Ruiz", laneColor: null }} size={36} />
        <MemberAvatar member={null} size={36} />
        <MemberAvatar member={null} size={36} fallbackLabel="Sistema" />
      </div>
      <div className="flex flex-col gap-2">
        <LaneRope />
        <LaneRope variant="limit" />
        <span className="text-[14px] text-[var(--ink-muted)]">Arriba, corchera normal; abajo, límite (“Vencidas”)</span>
      </div>
      <DepthFigure value="7" label="Análisis de IA hoy" />
    </section>
  );
}
