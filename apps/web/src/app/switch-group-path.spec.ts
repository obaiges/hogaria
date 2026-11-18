import { describe, expect, it } from "vitest";

import { switchGroupPath } from "./navigation-utils";

describe("switchGroupPath (RN-15-10)", () => {
  it.each([
    ["/g/A", "/g/B"],
    ["/g/A/", "/g/B"],
    ["/g/A/compra", "/g/B/compra"],
    ["/g/A/compra/LIST", "/g/B/compra"],
    ["/g/A/recetas/ID/editar", "/g/B/recetas"],
    ["/perfil", "/g/B"],
    ["/admin", "/g/B"],
  ])("%s → %s", (from, to) => {
    expect(switchGroupPath(from, "B")).toBe(to);
  });
});
