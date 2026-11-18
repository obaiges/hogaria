import { SecuritySection } from "../components/SecuritySection";

/**
 * `/perfil` mínimo (HOG-056): solo la sección "Seguridad". E16 añade el resto de
 * secciones (cuenta, dieta, notificaciones, datos…) sin mover esta (spec 16 §7).
 */
export function ProfilePage() {
  return (
    <div className="px-4 pt-6">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <h1 className="text-[24px] font-semibold text-[var(--ink)]">Perfil</h1>
        <SecuritySection />
      </div>
    </div>
  );
}
