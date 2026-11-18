import { UserMinus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Sheet, SheetContent } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { ApiError, OfflineError } from "@/lib/apiClient";
import { useCanEdit } from "@/lib/realtime/connection-store";

import { useRemoveMember } from "../api";

import type { GroupMemberDto } from "@hogaria/shared";

export const REMOVE_TEXT = {
  options: (name: string) => `Opciones de ${name}`,
  action: "Expulsar del hogar",
  title: (name: string) => `¿Expulsar a ${name}?`,
  body: "Dejará de ver el hogar y se borrarán sus eventos, gastos y conversaciones de este hogar. Podrás invitarle de nuevo.",
  confirm: "Expulsar",
  done: (name: string) => `${name} ya no está en el hogar`,
} as const;

export interface MemberActionsProps {
  groupId: string;
  member: GroupMemberDto;
  /** Se ha cerrado todo (la hoja y, si se abrió, la confirmación). */
  onClose: () => void;
}

/**
 * Menú de un miembro (spec 02 §7, RN-02-23): hoja con "Expulsar del hogar" y su `Dialog`
 * de confirmación. No hay roles: cualquier miembro puede expulsar a otro.
 */
export function MemberActions({ groupId, member, onClose }: MemberActionsProps) {
  const { toast } = useToast();
  const canEdit = useCanEdit();
  const remove = useRemoveMember(groupId);
  const [stage, setStage] = useState<"menu" | "confirm">("menu");
  const confirming = stage === "confirm";
  const setConfirming = (open: boolean) => (open ? setStage("confirm") : onClose());

  function confirm() {
    remove.mutate(member.userId, {
      onSuccess: () => {
        setConfirming(false);
        toast(REMOVE_TEXT.done(member.name));
      },
      onError: (error) => {
        setConfirming(false);
        if (error instanceof OfflineError) return;
        toast(error instanceof ApiError ? (error.detail ?? error.message) : "No se ha podido expulsar. Inténtalo de nuevo");
      },
    });
  }

  return (
    <>
      <Sheet open={stage === "menu"} onOpenChange={(open) => (open ? undefined : onClose())}>
        <SheetContent title={REMOVE_TEXT.options(member.name)} className="pb-[calc(16px+env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setStage("confirm")}
            className="flex min-h-[48px] w-full items-center gap-3 rounded-[var(--radius-sm)] px-2 text-[16px] font-semibold text-[var(--danger)] hover:bg-[var(--surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60"
          >
            <UserMinus className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            {REMOVE_TEXT.action}
          </button>
        </SheetContent>
      </Sheet>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent title={REMOVE_TEXT.title(member.name)} description={REMOVE_TEXT.body}>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button variant="danger" requiresConnection loading={remove.isPending} onClick={confirm}>
              {REMOVE_TEXT.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
