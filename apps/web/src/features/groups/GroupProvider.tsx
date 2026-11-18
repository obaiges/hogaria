import { createContext, useContext, type ReactNode } from "react";

import type { GroupDto, GroupMemberDto } from "@hogaria/shared";

/** Grupo activo de las rutas `/g/:groupId/*` (spec 02, RN-02-31). */
export interface ActiveGroup {
  group: GroupDto;
  members: GroupMemberDto[];
  /** El miembro del usuario con sesión en este grupo. */
  me: GroupMemberDto;
  /** Zona horaria del grupo: la que usan `lib/dates.ts` y todas las pantallas del grupo. */
  timezone: string;
}

const ActiveGroupContext = createContext<ActiveGroup | null>(null);

export function GroupProvider({ value, children }: { value: ActiveGroup; children: ReactNode }) {
  return <ActiveGroupContext.Provider value={value}>{children}</ActiveGroupContext.Provider>;
}

/** Solo dentro de `GroupLayout`: fuera de `/g/:groupId/*` no hay grupo activo. */
export function useActiveGroup(): ActiveGroup {
  const value = useContext(ActiveGroupContext);
  if (!value) throw new Error("useActiveGroup() solo se puede usar dentro de GroupLayout");
  return value;
}
