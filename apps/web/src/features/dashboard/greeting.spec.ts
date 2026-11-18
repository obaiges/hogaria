import { describe, expect, it } from "vitest";

import { msUntilNextDay } from "./api";
import { greetingFor, longDayLabel } from "./components/Greeting";

describe("greetingFor (spec 15 §7.2)", () => {
  // 2026-11-18: Madrid = UTC+1, Canarias = UTC+0.
  it.each([
    ["2026-11-18T05:00:00.000Z", "Buenos días, Ana"], // 06:00 Madrid
    ["2026-11-18T12:59:00.000Z", "Buenos días, Ana"], // 13:59
    ["2026-11-18T13:00:00.000Z", "Buenas tardes, Ana"], // 14:00
    ["2026-11-18T19:59:00.000Z", "Buenas tardes, Ana"], // 20:59
    ["2026-11-18T20:00:00.000Z", "Buenas noches, Ana"], // 21:00
    ["2026-11-18T04:59:00.000Z", "Buenas noches, Ana"], // 05:59
  ])("Madrid %s → %s", (iso, text) => {
    expect(greetingFor("Ana", "Europe/Madrid", new Date(iso))).toBe(text);
  });

  it("usa la zona del grupo: a las 13:30 UTC son tardes en Madrid y días en Canarias", () => {
    const now = new Date("2026-11-18T13:30:00.000Z");
    expect(greetingFor("Ana", "Europe/Madrid", now)).toBe("Buenas tardes, Ana");
    expect(greetingFor("Ana", "Atlantic/Canary", now)).toBe("Buenos días, Ana");
  });
});

describe("longDayLabel", () => {
  it("día de la semana y mes en español, con mayúscula inicial", () => {
    expect(longDayLabel("2026-11-11")).toBe("Miércoles, 11 de noviembre");
  });
});

describe("msUntilNextDay (RN-15-30)", () => {
  it("cuenta hasta la medianoche local (+1 s)", () => {
    expect(msUntilNextDay("Europe/Madrid", new Date("2026-11-18T22:00:00.000Z"))).toBe(60 * 60 * 1000 + 1000);
  });

  it("el día del cambio de hora dura 25 h", () => {
    // 2026-10-25 00:00 Madrid = 2026-10-24T22:00Z; fin = 2026-10-25T23:00Z.
    expect(msUntilNextDay("Europe/Madrid", new Date("2026-10-24T22:00:00.000Z"))).toBe(25 * 60 * 60 * 1000 + 1000);
  });
});
