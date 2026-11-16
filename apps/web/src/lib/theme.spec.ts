import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyTheme, getStoredTheme, resolveTheme, setTheme } from "./theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.head.innerHTML = '<meta name="theme-color" content="#14A19E" />';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("guarda la preferencia", () => {
    setTheme("dark");
    expect(localStorage.getItem("hogaria-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("localStorage que lanza no rompe", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(getStoredTheme()).toBe("system");
    expect(() => setTheme("light")).not.toThrow();
  });

  it("resolve y aplica meta theme-color", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(resolveTheme("system")).toBe("dark");
    applyTheme("dark");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#115352");
  });
});
