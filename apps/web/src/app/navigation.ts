import {
  BookOpen,
  CalendarDays,
  ChefHat,
  Clock,
  CookingPot,
  History,
  Home,
  ListChecks,
  Menu,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Registro de navegación (spec 15, RN-15-04 y RN-15-05). Cada épica pone `enabled: true`
 * en el mismo ticket en que crea su pantalla. Una pestaña deshabilitada se muestra y pinta
 * `ComingSoonPage`; una entrada de "Más" deshabilitada no se muestra.
 */
export type NavSection = "Organización" | "Cocina" | "Dinero" | "IA" | "Hogar" | "Tú" | "Plataforma";

export type NavId =
  | "inicio"
  | "compra"
  | "comidas"
  | "tareas"
  | "mas"
  | "calendario"
  | "horarios"
  | "recetas"
  | "nevera"
  | "gastos"
  | "facturas"
  | "asistente"
  | "actividad"
  | "ajustes"
  | "perfil"
  | "admin";

export interface NavEntry {
  id: NavId;
  label: string;
  icon: LucideIcon;
  /** Destino; `null` para "Más", que abre una hoja y no navega. */
  to: ((groupId: string) => string) | null;
  placement: "tab" | "more";
  section?: NavSection;
  enabled: boolean;
  requiresAdmin?: boolean;
}

const g = (path: string) => (groupId: string) => `/g/${groupId}${path}`;

export const NAV_ENTRIES: readonly NavEntry[] = [
  // Barra inferior (RN-15-02), siempre 5 y en este orden.
  { id: "inicio", label: "Inicio", icon: Home, to: g(""), placement: "tab", enabled: true },
  { id: "compra", label: "Compra", icon: ShoppingCart, to: g("/compra"), placement: "tab", enabled: false },
  { id: "comidas", label: "Comidas", icon: CookingPot, to: g("/comidas"), placement: "tab", enabled: false },
  { id: "tareas", label: "Tareas", icon: ListChecks, to: g("/tareas"), placement: "tab", enabled: false },
  { id: "mas", label: "Más", icon: Menu, to: null, placement: "tab", enabled: true },
  // Hoja "Más" (RN-15-04), en este orden.
  { id: "calendario", label: "Calendario", icon: CalendarDays, to: g("/calendario"), placement: "more", section: "Organización", enabled: false },
  { id: "horarios", label: "Horarios", icon: Clock, to: g("/horarios"), placement: "more", section: "Organización", enabled: false },
  { id: "recetas", label: "Recetas", icon: BookOpen, to: g("/recetas"), placement: "more", section: "Cocina", enabled: false },
  { id: "nevera", label: "¿Qué cocino?", icon: ChefHat, to: g("/nevera"), placement: "more", section: "Cocina", enabled: false },
  { id: "gastos", label: "Gastos", icon: Wallet, to: g("/gastos"), placement: "more", section: "Dinero", enabled: false },
  { id: "facturas", label: "Facturas", icon: Receipt, to: g("/facturas"), placement: "more", section: "Dinero", enabled: false },
  { id: "asistente", label: "Asistente", icon: Sparkles, to: g("/asistente"), placement: "more", section: "IA", enabled: false },
  { id: "actividad", label: "Actividad", icon: History, to: g("/actividad"), placement: "more", section: "Hogar", enabled: true },
  { id: "ajustes", label: "Ajustes del grupo", icon: Settings, to: g("/ajustes"), placement: "more", section: "Hogar", enabled: true },
  { id: "perfil", label: "Perfil", icon: User, to: () => "/perfil", placement: "more", section: "Tú", enabled: true },
  {
    id: "admin",
    label: "Administración",
    icon: ShieldCheck,
    to: () => "/admin",
    placement: "more",
    section: "Plataforma",
    enabled: false,
    requiresAdmin: true,
  },
];

export const TAB_ENTRIES = NAV_ENTRIES.filter((e) => e.placement === "tab");

/** Entradas visibles de la hoja "Más": habilitadas y, las de administración, solo para administradores. */
export function visibleMoreEntries(isPlatformAdmin: boolean, entries: readonly NavEntry[] = NAV_ENTRIES): NavEntry[] {
  return entries.filter((e) => e.placement === "more" && e.enabled && (!e.requiresAdmin || isPlatformAdmin));
}

/** RN-15-03: pestaña activa según la ruta. `null` fuera del shell. */
export function activeTabId(pathname: string): NavId | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/perfil" || path.startsWith("/perfil/") || path === "/admin" || path.startsWith("/admin/")) return "mas";
  const match = /^\/g\/[^/]+(\/.*)?$/.exec(path);
  if (!match) return null;
  const rest = match[1] ?? "";
  if (rest === "") return "inicio";
  const section = rest.split("/")[1];
  if (section === "compra" || section === "comidas" || section === "tareas") return section;
  return "mas";
}
