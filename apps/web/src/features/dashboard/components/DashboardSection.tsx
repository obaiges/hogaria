import { type ReactNode } from "react";

/**
 * Sección opcional del Inicio (RN-15-20): si su clave no viene en la respuesta (su módulo aún
 * no existe), no pinta nada. Base para comidas, compra y facturas (HOG-763/764).
 *
 * ```tsx
 * <DashboardSection data={dashboard.shopping}>{(shopping) => <ShoppingCard data={shopping} />}</DashboardSection>
 * ```
 */
export function DashboardSection<T>({ data, children }: { data: T | undefined; children: (data: T) => ReactNode }) {
  if (data === undefined) return null;
  return <>{children(data)}</>;
}
