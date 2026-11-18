import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { apiUrl, http, HttpResponse, server } from "@/test/msw";

import { GroupLayout, NOT_FOUND_TEXT } from "./GroupLayout";
import { useActiveGroup } from "./GroupProvider";
import { LAST_GROUP_KEY } from "./landing";

const ME_ID = "0193a0b2-0000-7000-8000-000000000001";
const OTHER_ID = "0193a0b2-0000-7000-8000-000000000002";
const GROUP_ID = "0193a0b2-0000-7000-8000-0000000000a1";
const FOREIGN_ID = "0193a0b2-0000-7000-8000-0000000000ff";

const me = {
  id: ME_ID,
  name: "Ana",
  email: "ana@demo.local",
  emailVerified: true,
  username: "ana",
  displayUsername: "ana",
  image: null,
  isPlatformAdmin: false,
  aiNoticeAcceptedAt: null,
  hasPassword: true,
  hasGoogle: false,
  createdAt: "2026-11-01T10:00:00.000Z",
};

const group = {
  id: GROUP_ID,
  name: "Casa Baiges",
  emoji: "🏡",
  timezone: "Atlantic/Canary",
  createdById: ME_ID,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
};

const member = (id: string, userId: string, name: string, laneColor: string) => ({
  id,
  groupId: GROUP_ID,
  userId,
  name,
  username: null,
  image: null,
  laneColor,
  joinedAt: "2026-11-01T10:00:00.000Z",
});

const members = [
  member("0193a0b2-0000-7000-8000-0000000000b1", ME_ID, "Ana", "CORAL"),
  member("0193a0b2-0000-7000-8000-0000000000b2", OTHER_ID, "Luis", "SEA"),
];

const notFound = () => HttpResponse.json({ status: 404, code: "NOT_FOUND", title: "No encontrado" }, { status: 404 });

function Probe() {
  const { group: g, members: ms, me: mine, timezone } = useActiveGroup();
  return (
    <p data-testid="probe">
      {g.name}|{ms.length}|{mine.name}|{timezone}
    </p>
  );
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}</p>;
}

function renderGroup(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/g/:groupId",
        element: <GroupLayout />,
        children: [{ path: "/g/:groupId/compra", element: <Probe /> }],
      },
      { path: "*", element: <Where /> },
    ],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => localStorage.clear());

describe("GroupLayout (HOG-107, RN-02-31)", () => {
  it("con 200 expone el grupo activo y guarda hogaria:lastGroupId", async () => {
    server.use(
      http.get(apiUrl("/me"), () => HttpResponse.json(me)),
      http.get(apiUrl(`/groups/${GROUP_ID}`), () => HttpResponse.json(group)),
      http.get(apiUrl(`/groups/${GROUP_ID}/members`), () => HttpResponse.json(members)),
    );
    renderGroup(`/g/${GROUP_ID}/compra`);

    expect(await screen.findByTestId("probe")).toHaveTextContent("Casa Baiges|2|Ana|Atlantic/Canary");
    await waitFor(() => expect(localStorage.getItem(LAST_GROUP_KEY)).toBe(GROUP_ID));
  });

  it("con 404 muestra 'No encontrado' y no guarda el grupo", async () => {
    localStorage.setItem(LAST_GROUP_KEY, GROUP_ID);
    server.use(
      http.get(apiUrl("/me"), () => HttpResponse.json(me)),
      http.get(apiUrl(`/groups/${FOREIGN_ID}`), notFound),
      http.get(apiUrl(`/groups/${FOREIGN_ID}/members`), notFound),
    );
    renderGroup(`/g/${FOREIGN_ID}/compra`);

    expect(await screen.findByText(NOT_FOUND_TEXT.title)).toBeInTheDocument();
    expect(screen.getByText(NOT_FOUND_TEXT.body)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(localStorage.getItem(LAST_GROUP_KEY)).toBe(GROUP_ID);

    await userEvent.click(screen.getByRole("button", { name: NOT_FOUND_TEXT.action }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/grupos");
  });

  it("si solo los miembros responden 404 también muestra 'No encontrado'", async () => {
    server.use(
      http.get(apiUrl("/me"), () => HttpResponse.json(me)),
      http.get(apiUrl(`/groups/${GROUP_ID}`), () => HttpResponse.json(group)),
      http.get(apiUrl(`/groups/${GROUP_ID}/members`), notFound),
    );
    renderGroup(`/g/${GROUP_ID}/compra`);

    expect(await screen.findByText(NOT_FOUND_TEXT.title)).toBeInTheDocument();
  });
});
