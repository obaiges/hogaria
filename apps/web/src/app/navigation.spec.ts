import { describe, expect, it } from "vitest";

import { activeTabId, NAV_ENTRIES, TAB_ENTRIES, visibleMoreEntries, type NavEntry } from "./navigation";
import { resolveShellGroupId } from "./navigation-utils";

const G = "0193a0b2-0000-7000-8000-0000000000a1";

describe("activeTabId (RN-15-03)", () => {
  it.each([
    [`/g/${G}`, "inicio"],
    [`/g/${G}/`, "inicio"],
    [`/g/${G}/compra`, "compra"],
    [`/g/${G}/compra/historial`, "compra"],
    [`/g/${G}/compra/abc`, "compra"],
    [`/g/${G}/comidas`, "comidas"],
    [`/g/${G}/tareas`, "tareas"],
    [`/g/${G}/recetas/123/editar`, "mas"],
    [`/g/${G}/ajustes`, "mas"],
    [`/g/${G}/compras`, "mas"],
    ["/perfil", "mas"],
    ["/admin", "mas"],
    ["/grupos", null],
    ["/entrar", null],
  ])("%s → %s", (path, tab) => {
    expect(activeTabId(path)).toBe(tab);
  });
});

describe("registro de navegación (RN-15-02, RN-15-04, RN-15-05)", () => {
  it("la barra tiene 5 pestañas en orden y siempre se muestran, aunque estén deshabilitadas", () => {
    expect(TAB_ENTRIES.map((e) => e.label)).toEqual(["Inicio", "Compra", "Comidas", "Tareas", "Más"]);
  });

  it("'Más' sigue el orden de RN-15-04", () => {
    const more = NAV_ENTRIES.filter((e) => e.placement === "more").map((e) => e.id);
    expect(more).toEqual([
      "calendario",
      "horarios",
      "recetas",
      "nevera",
      "gastos",
      "facturas",
      "asistente",
      "actividad",
      "ajustes",
      "perfil",
      "admin",
    ]);
  });

  it("oculta en 'Más' las entradas deshabilitadas y la administración a quien no es administrador", () => {
    const entries = NAV_ENTRIES.map((e): NavEntry => ({ ...e, enabled: e.id !== "gastos" }));
    const ids = (admin: boolean) => visibleMoreEntries(admin, entries).map((e) => e.id);
    expect(ids(false)).not.toContain("gastos");
    expect(ids(false)).not.toContain("admin");
    expect(ids(true)).toContain("admin");
  });
});

describe("resolveShellGroupId (RN-15-12)", () => {
  const A = "a";
  const B = "b";

  it("en /g/:groupId usa el de la URL si es mío; si no, ninguno", () => {
    expect(resolveShellGroupId(B, [A, B], A)).toBe(B);
    expect(resolveShellGroupId("ajeno", [A, B], A)).toBeNull();
  });

  it("fuera del hogar usa el último abierto, o el primero si ya no es miembro", () => {
    expect(resolveShellGroupId(undefined, [A, B], B)).toBe(B);
    expect(resolveShellGroupId(undefined, [A, B], "viejo")).toBe(A);
    expect(resolveShellGroupId(undefined, [A, B], null)).toBe(A);
  });

  it("sin hogares no hay barra", () => {
    expect(resolveShellGroupId(undefined, [], null)).toBeNull();
  });
});
