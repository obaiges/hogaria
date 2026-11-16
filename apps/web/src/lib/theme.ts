export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "hogaria-theme";
const THEME_COLORS: Record<"light" | "dark", string> = {
  light: "#14A19E",
  dark: "#115352",
};

export function getStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(pref: ThemePreference): "light" | "dark" {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  if (pref === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", pref);
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLORS[resolved];
  return resolved;
}

export function setTheme(pref: ThemePreference): "light" | "dark" {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // ignore
  }
  return applyTheme(pref);
}

export function initTheme(): ThemePreference {
  const pref = getStoredTheme();
  applyTheme(pref);
  return pref;
}
