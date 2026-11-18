import { ChevronRight, MoreVertical } from "lucide-react";
import { useState, type ReactNode } from "react";

import { MemberAvatar } from "@/components/pool";

import { DangerZone } from "../components/DangerZone";
import { EditGroupSheet } from "../components/EditGroupSheet";
import { InvitesSection } from "../components/InvitesSection";
import { LaneColorPicker } from "../components/LaneColorPicker";
import { MemberActions, REMOVE_TEXT } from "../components/RemoveMemberDialog";
import { useActiveGroup } from "../GroupProvider";

import type { GroupMemberDto } from "@hogaria/shared";

export const SETTINGS_TEXT = {
  title: "Ajustes del grupo",
  home: "Hogar",
  members: (n: number) => `Miembros (${n})`,
  laneColor: "Tu color de calle",
  invites: "Invitaciones",
  danger: "Zona de peligro",
  editHome: (name: string) => `Editar hogar ${name}`,
} as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-sign text-[14px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * `/g/:groupId/ajustes` (spec 02 §7, secciones 1–4): hogar, miembros, color de calle e
 * invitaciones. El grupo y los miembros los carga `GroupLayout`; las invitaciones, su sección.
 * La zona de peligro (salir) y el menú de miembro (expulsar) son de HOG-106.
 */
export function GroupSettingsPage() {
  const { group, members, me, timezone } = useActiveGroup();
  const [editing, setEditing] = useState(false);
  const [actionsFor, setActionsFor] = useState<GroupMemberDto | null>(null);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 pt-6">
      <h1 className="font-sign text-[28px] font-semibold uppercase tracking-[0.04em] text-[var(--ink)]">{SETTINGS_TEXT.title}</h1>

      <Section id="ajustes-hogar" title={SETTINGS_TEXT.home}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={SETTINGS_TEXT.editHome(group.name)}
          className="flex min-h-[56px] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--grout)] bg-[var(--surface)] px-3 text-left hover:bg-[var(--surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <span className="text-[28px] leading-none" aria-hidden>
            {group.emoji}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[16px] font-semibold text-[var(--ink)]">{group.name}</span>
            <span className="text-[14px] text-[var(--ink-muted)]">{group.timezone}</span>
          </span>
          <ChevronRight className="h-5 w-5 text-[var(--ink-muted)]" strokeWidth={1.75} aria-hidden />
        </button>
        {editing ? <EditGroupSheet group={group} open onOpenChange={setEditing} /> : null}
      </Section>

      <Section id="ajustes-miembros" title={SETTINGS_TEXT.members(members.length)}>
        <ul className="divide-y divide-[var(--grout)] rounded-[var(--radius-md)] border border-[var(--grout)] bg-[var(--surface)]">
          {members.map((member) => (
            <li key={member.id} className="flex min-h-[56px] items-center gap-3 pl-3 pr-1">
              <MemberAvatar member={member} size={36} decorative />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[16px] text-[var(--ink)]">
                  {member.name}
                  {member.userId === me.userId ? <span className="text-[var(--ink-muted)]"> (tú)</span> : null}
                </span>
                {member.username ? <span className="text-[14px] text-[var(--ink-muted)]">@{member.username}</span> : null}
              </span>
              {member.userId !== me.userId ? (
                <button
                  type="button"
                  onClick={() => setActionsFor(member)}
                  aria-label={REMOVE_TEXT.options(member.name)}
                  aria-haspopup="dialog"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <MoreVertical className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {actionsFor ? (
          <MemberActions groupId={group.id} member={actionsFor} onClose={() => setActionsFor(null)} />
        ) : null}
      </Section>

      <Section id="ajustes-color" title={SETTINGS_TEXT.laneColor}>
        <LaneColorPicker groupId={group.id} me={me} members={members} />
      </Section>

      <Section id="ajustes-invitaciones" title={SETTINGS_TEXT.invites}>
        <InvitesSection groupId={group.id} groupName={group.name} myName={me.name} timezone={timezone} />
      </Section>

      <Section id="ajustes-peligro" title={SETTINGS_TEXT.danger}>
        <DangerZone groupId={group.id} groupName={group.name} memberCount={members.length} />
      </Section>
    </div>
  );
}
