import { describe, expect, it } from "vitest";

import { isSafeReturnTo, isUuid } from "./navigation-utils";

describe("isSafeReturnTo (RN-15-09)", () => {
  it.each(["/g/x", "/g/x/tareas?destacar=1", "/perfil"])("acepta %s", (value) => {
    expect(isSafeReturnTo(value)).toBe(true);
  });

  it.each(["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "/x?u=https://evil.com", "", null, undefined])(
    "rechaza %s",
    (value) => {
      expect(isSafeReturnTo(value)).toBe(false);
    },
  );
});

describe("isUuid", () => {
  it("valida el formato antes de consultar la API", () => {
    expect(isUuid("0193a0b2-0000-7000-8000-0000000000a1")).toBe(true);
    expect(isUuid("no-es-un-id")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
