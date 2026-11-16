import logoHorizontal from "../../assets/logo-horizontal.svg";

const lanes = [
  "--lane-coral",
  "--lane-sea",
  "--lane-sun",
  "--lane-leaf",
  "--lane-violet",
  "--lane-rose",
  "--lane-orange",
  "--lane-slate",
];

const colors = [
  ["--bg", "suelo"],
  ["--surface", "superficie"],
  ["--surface-sunken", "hundido"],
  ["--grout", "junta"],
  ["--ink", "tinta"],
  ["--ink-muted", "tinta muted"],
  ["--shell", "agua shell"],
  ["--primary", "primario"],
  ["--primary-soft", "selección"],
  ["--rope-red", "corchera roja"],
  ["--lifeguard", "socorrista"],
];

export function DevTokensPage() {
  return (
    <main style={{ padding: 16, background: "var(--bg)", color: "var(--ink)", minHeight: "100vh", maxWidth: 375, margin: "0 auto" }}>
      <img src={logoHorizontal} alt="Hogaria" style={{ height: 40, marginBottom: 16 }} />
      <h1 style={{ fontFamily: "var(--font-sign)", fontSize: "var(--text-xl)", letterSpacing: "0.04em" }}>Tokens / Piscina</h1>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontFamily: "var(--font-sign)", fontSize: 14, letterSpacing: "0.06em", color: "var(--ink-muted)" }}>COLORES</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {colors.map(([v, label]) => (
            <div key={v} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: `var(${v})`, border: "1px solid var(--grout)" }} />
              <code style={{ fontSize: 12 }}>{v}</code>
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontFamily: "var(--font-sign)", fontSize: 14, letterSpacing: "0.06em", color: "var(--ink-muted)" }}>CALLES</h2>
        <div style={{ display: "grid", gap: 6 }}>
          {lanes.map((v) => (
            <div key={v} style={{ height: 32, borderLeft: `4px solid var(${v})`, paddingLeft: 8, display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--grout)", borderLeftWidth: 4, borderLeftColor: `var(${v})` }}>
              <code style={{ fontSize: 12 }}>{v}</code>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontFamily: "var(--font-sign)", fontSize: 14, letterSpacing: "0.06em", color: "var(--ink-muted)" }}>TIPOGRAFÍA</h2>
        <p style={{ fontSize: "var(--text-xs)" }}>12 xs — Barlow</p>
        <p style={{ fontSize: "var(--text-sm)" }}>14 sm — Barlow</p>
        <p style={{ fontSize: "var(--text-base)" }}>16 base — Barlow</p>
        <p style={{ fontSize: "var(--text-lg)" }}>18 lg — Barlow</p>
        <p style={{ fontSize: "var(--text-xl)" }}>22 xl — Barlow</p>
        <p style={{ fontSize: "var(--text-2xl)" }}>28 2xl — Barlow</p>
        <p style={{ fontFamily: "var(--font-sign)", fontSize: "var(--text-depth)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>44,00 €</p>
        <p style={{ fontFamily: "var(--font-sign)", fontWeight: 600, letterSpacing: "0.06em" }}>VERSALITAS CONDENSED</p>
      </section>
    </main>
  );
}
