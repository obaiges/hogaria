import { useMemo, useState, type FormEvent } from "react";

import { updateGroupInput, type GroupDto, type UpdateGroupInput } from "@hogaria/shared";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Sheet, SheetContent } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { ApiError, OfflineError } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

import { useUpdateGroup } from "../api";
import { GROUP_EMOJIS } from "./CreateGroupSheet";

export const EDIT_GROUP_TEXT = {
  title: "Editar hogar",
  saved: "Cambios guardados",
  timezoneNotice: "Las fechas del hogar se interpretarán en la nueva zona horaria.",
} as const;

const PINNED_TIMEZONES = ["Europe/Madrid", "Atlantic/Canary"];

/** `Europe/Madrid` y `Atlantic/Canary` arriba; después el resto de `Intl.supportedValuesOf('timeZone')`. */
export function timezoneOptions(current: string): string[] {
  let all: string[] = [];
  try {
    all = Intl.supportedValuesOf("timeZone");
  } catch {
    all = [];
  }
  const rest = all.filter((tz) => !PINNED_TIMEZONES.includes(tz));
  const options = [...PINNED_TIMEZONES, ...rest];
  return options.includes(current) ? options : [current, ...options];
}

type FieldErrors = Partial<Record<"name" | "emoji" | "timezone", string>>;

export interface EditGroupSheetProps {
  group: GroupDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** `Sheet` "Editar hogar" (spec 02 §7, RN-02-03): nombre, emoji y zona horaria. Guardado optimista. */
export function EditGroupSheet({ group, open, onOpenChange }: EditGroupSheetProps) {
  const { toast } = useToast();
  const update = useUpdateGroup(group.id);
  const presetEmoji = (GROUP_EMOJIS as readonly string[]).includes(group.emoji);

  const [name, setName] = useState(group.name);
  const [emoji, setEmoji] = useState(presetEmoji ? group.emoji : "");
  const [customEmoji, setCustomEmoji] = useState(presetEmoji ? "" : group.emoji);
  const [timezone, setTimezone] = useState(group.timezone);
  const [errors, setErrors] = useState<FieldErrors>({});
  const zones = useMemo(() => timezoneOptions(group.timezone), [group.timezone]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const chosenEmoji = customEmoji.trim() || emoji;
    const changes: UpdateGroupInput = {};
    if (name.trim() !== group.name) changes.name = name;
    if (chosenEmoji !== group.emoji) changes.emoji = chosenEmoji;
    if (timezone !== group.timezone) changes.timezone = timezone;
    if (Object.keys(changes).length === 0) {
      onOpenChange(false);
      return;
    }
    const parsed = updateGroupInput.safeParse(changes);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors | undefined;
        if (key) next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    // Optimista: se cierra al momento; si falla, `useUpdateGroup` deshace y se avisa.
    onOpenChange(false);
    try {
      await update.mutateAsync(parsed.data);
      toast(EDIT_GROUP_TEXT.saved);
    } catch (error) {
      if (error instanceof OfflineError) return;
      toast(error instanceof ApiError ? (error.detail ?? error.message) : "No se han podido guardar los cambios. Inténtalo de nuevo");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={EDIT_GROUP_TEXT.title} className="max-h-[90vh] overflow-y-auto pb-[calc(16px+env(safe-area-inset-bottom))]">
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
          <FormField label="Nombre del hogar" error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />
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

          <FormField label="Zona horaria" error={errors.timezone}>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger aria-label="Zona horaria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {timezone !== group.timezone ? (
            <p role="status" className="text-[14px] text-[var(--ink-muted)]">
              {EDIT_GROUP_TEXT.timezoneNotice}
            </p>
          ) : null}

          <Button type="submit" requiresConnection className="w-full">
            Guardar
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
