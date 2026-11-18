import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError, OfflineError } from "@/lib/apiClient";

import { useLeaveGroup } from "../api";

export const LEAVE_TEXT = {
  button: "Salir del hogar",
  buttonLast: "Salir y borrar hogar",
  title: (groupName: string) => `¿Salir de ${groupName}?`,
  body: "Dejarás de ver sus datos y se borrarán tus eventos, gastos y conversaciones de este hogar.",
  lastTitle: "Eres el último miembro",
  lastBody: (groupName: string) => `Si sales, ${groupName} y todos sus datos se borrarán para siempre.`,
  done: (groupName: string) => `Has salido de ${groupName}`,
} as const;

export interface DangerZoneProps {
  groupId: string;
  groupName: string;
  memberCount: number;
}

/** "ZONA DE PELIGRO" (spec 02 §7, RN-02-20 y RN-02-21): salir, o salir y borrar si es el último. */
export function DangerZone({ groupId, groupName, memberCount }: DangerZoneProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const leave = useLeaveGroup(groupId);
  const [open, setOpen] = useState(false);
  const last = memberCount <= 1;

  function confirm() {
    leave.mutate(undefined, {
      onSuccess: () => {
        setOpen(false);
        toast(LEAVE_TEXT.done(groupName));
        void navigate("/grupos", { replace: true });
      },
      onError: (error) => {
        setOpen(false);
        if (error instanceof OfflineError) return; // el apiClient ya ha avisado
        toast(error instanceof ApiError ? (error.detail ?? error.message) : "No se ha podido salir del hogar. Inténtalo de nuevo");
      },
    });
  }

  return (
    <>
      <Button variant="danger" requiresConnection onClick={() => setOpen(true)}>
        {LEAVE_TEXT.button}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={last ? LEAVE_TEXT.lastTitle : LEAVE_TEXT.title(groupName)}>
          <p className="text-[16px] text-[var(--ink)]">
            {last ? (
              <>
                Si sales, {groupName} y <strong>todos sus datos</strong> se borrarán para siempre.
              </>
            ) : (
              LEAVE_TEXT.body
            )}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button variant="danger" requiresConnection loading={leave.isPending} onClick={confirm}>
              {last ? LEAVE_TEXT.buttonLast : LEAVE_TEXT.button}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
