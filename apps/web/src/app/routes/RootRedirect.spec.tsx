import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderRoute } from "@/features/auth/test-utils";
import { LAST_GROUP_KEY } from "@/features/groups/landing";
import { apiUrl, http, HttpResponse, server } from "@/test/msw";

import { RootRedirect } from "./RootRedirect";

const groups = (...ids: string[]) =>
  ids.map((id) => ({
    id,
    name: id,
    emoji: "🏠",
    timezone: "Europe/Madrid",
    createdById: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    memberCount: 1,
    myLaneColor: "CORAL",
    joinedAt: "2026-11-01T10:00:00.000Z",
  }));

const A = "0193a0b2-0000-7000-8000-0000000000a1";
const B = "0193a0b2-0000-7000-8000-0000000000a2";

afterEach(() => {
  localStorage.clear();
});

describe("RootRedirect (/)", () => {
  it("va al último hogar si sigue siendo miembro", async () => {
    localStorage.setItem(LAST_GROUP_KEY, B);
    server.use(http.get(apiUrl("/me/groups"), () => HttpResponse.json(groups(A, B))));
    renderRoute(<RootRedirect />, "/", "/");
    expect(await screen.findByTestId("where")).toHaveTextContent(`/g/${B}`);
  });

  it("con lastGroupId obsoleto y varios hogares → /grupos y lo borra", async () => {
    localStorage.setItem(LAST_GROUP_KEY, "0193a0b2-0000-7000-8000-0000000000ff");
    server.use(http.get(apiUrl("/me/groups"), () => HttpResponse.json(groups(A, B))));
    renderRoute(<RootRedirect />, "/", "/");
    expect(await screen.findByTestId("where")).toHaveTextContent("/grupos");
    expect(localStorage.getItem(LAST_GROUP_KEY)).toBeNull();
  });

  it("con un solo hogar → ese hogar", async () => {
    server.use(http.get(apiUrl("/me/groups"), () => HttpResponse.json(groups(A))));
    renderRoute(<RootRedirect />, "/", "/");
    expect(await screen.findByTestId("where")).toHaveTextContent(`/g/${A}`);
  });
});
