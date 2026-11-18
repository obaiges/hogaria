import { LaneRope } from "@/components/pool/LaneRope";
import { OFFLINE_MESSAGE, useConnectionStatus } from "@/lib/realtime/connection-store";

/**
 * Aviso sin conexión (spec 03 §7, RN-03-23): franja con la corchera roja bajo la
 * cabecera. Solo en `offline`: en `reconnecting` no aparece (cortes de menos de 5 s).
 * La región `status` siempre está montada para que los lectores de pantalla anuncien
 * el cambio.
 */
export function OfflineBanner() {
  const status = useConnectionStatus();
  const offline = status === "offline";
  return (
    <div role="status" aria-live="polite">
      {offline ? (
        <div className="bg-[var(--surface)]">
          <p className="px-4 py-2 text-center text-[14px] font-medium text-[var(--ink)]">{OFFLINE_MESSAGE}</p>
          <LaneRope variant="limit" />
        </div>
      ) : null}
    </div>
  );
}
