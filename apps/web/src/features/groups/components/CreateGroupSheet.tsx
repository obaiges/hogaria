import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import { createGroupInput, DEFAULT_GROUP_EMOJI } from "@hogaria/shared";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Sheet, SheetContent } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { ApiError, OfflineError } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

import { useCreateGroup } from "../api";

/** Sugerencias de la rejilla (spec 02 §7). */
export const GROUP_EMOJIS = ["🏠", "🏡", "🏘️", "🏢", "🛖", "🏰", "⛺", "🌊", "🌻", "🐱", "🐶", "❤️"] as const;

type FieldErrors = Partial<Record<"name" | "emoji", string>>;

export interface CreateGroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Sheet "Crear hogar": nombre + emoji; la zona horaria no se pide (Europe/Madrid). */
export function CreateGroupSheet({ open, onOpenChange }: CreateGroupSheetProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const create = useCreateGroup();

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>(DEFAULT_GROUP_EMOJI);
  const [customEmoji, setCustomEmoji] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function reset() {
    setName("");
    setEmoji(DEFAULT_GROUP_EMOJI);
    setCustomEmoji("");
    setErrors({});
    setFormError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const chosen = customEmoji.trim() || emoji;
    const parsed = createGroupInput.safeParse({ name, emoji: chosen });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const group = await create.mutateAsync(parsed.data);
      toast("Hogar creado");
      reset();
      onOpenChange(false);
      await navigate(`/g/${group.id}`);
    } catch (error) {
      if (error instanceof OfflineError) return; // el apiClient ya ha mostrado el toast
      setFormError(error instanceof ApiError ? (error.detail ?? error.message) : "No se ha podido crear el hogar. Inténtalo de nuevo");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent title="Crear hogar">
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
          <FormField label="Nombre del hogar" error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Casa Baiges" maxLength={60} autoComplete="off" />
          </FormField>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[14px] font-medium text-[var(--ink)]">Emoji</legend>
            <div role="radiogroup" aria-label="Emoji" className="grid grid-cols-6 gap-2">
              {GROUP_EMOJIS.map((option) => {
                const selected = !customEmoji.trim() && emoji === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option}
                    onClick={() => {
                      setEmoji(option);
                      setCustomEmoji("");
                    }}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-[var(--radius-sm)] border text-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                      selected ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--grout)] bg-[var(--surface)] hover:bg-[var(--surface-sunken)]",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <FormField label="Otro emoji" error={errors.emoji}>
              <Input value={customEmoji} onChange={(e) => setCustomEmoji(e.target.value)} className="w-24 text-center text-[20px]" autoComplete="off" />
            </FormField>
          </fieldset>

          {formError ? (
            <p role="alert" className="text-[14px] text-[var(--danger)]">
              {formError}
            </p>
          ) : null}

          <Button type="submit" requiresConnection loading={create.isPending} className="w-full">
            Crear hogar
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
