import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { GroupSwitcher, SWITCHER_TEXT } from "./GroupSwitcher";

import type { MyGroupDto } from "@hogaria/shared";

const group = (id: string, name: string, emoji: string): MyGroupDto => ({
  id,
  name,
  emoji,
  timezone: "Europe/Madrid",
  createdById: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  memberCount: 2,
  myLaneColor: "CORAL",
  joinedAt: "2026-11-01T10:00:00.000Z",
});

const CASA = group("0193a0b2-0000-7000-8000-0000000000a1", "Casa Baiges", "🏡");
const PLAYA = group("0193a0b2-0000-7000-8000-0000000000a2", "Apartamento playa", "🌊");
const PUEBLO = group("0193a0b2-0000-7000-8000-0000000000a3", "Casa del pueblo", "🌾");

function renderSwitcher(groups: MyGroupDto[], current: MyGroupDto, path: string) {
  const router = createMemoryRouter([{ path: "*", element: <GroupSwitcher groups={groups} current={current} /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe("GroupSwitcher (RN-15-10, RN-15-11)", () => {
  it("con 1 hogar: sin chevron, y la hoja ofrece crear o unirse", async () => {
    renderSwitcher([CASA], CASA, `/g/${CASA.id}`);
    const trigger = screen.getByRole("button", { name: SWITCHER_TEXT.label("Casa Baiges") });
    expect(screen.queryByTestId("switcher-chevron")).not.toBeInTheDocument();

    await userEvent.click(trigger);
    const sheet = await screen.findByRole("dialog", { name: SWITCHER_TEXT.sheetTitle });
    expect(within(sheet).getByRole("link", { name: SWITCHER_TEXT.createOrJoin })).toHaveAttribute("href", "/grupos");
  });

  it("con 3 hogares: chevron, marca el actual y cambia conservando la sección", async () => {
    const router = renderSwitcher([CASA, PLAYA, PUEBLO], CASA, `/g/${CASA.id}/compra/lista-1`);
    expect(screen.getByTestId("switcher-chevron")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: SWITCHER_TEXT.label("Casa Baiges") }));
    const sheet = await screen.findByRole("dialog", { name: SWITCHER_TEXT.sheetTitle });
    const links = within(sheet).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining("Casa Baiges"),
      expect.stringContaining("Apartamento playa"),
      expect.stringContaining("Casa del pueblo"),
      expect.stringContaining(SWITCHER_TEXT.createOrJoin),
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "true");

    await userEvent.click(within(sheet).getByRole("link", { name: /Apartamento playa/ }));
    expect(router.state.location.pathname).toBe(`/g/${PLAYA.id}/compra`);
  });
});
