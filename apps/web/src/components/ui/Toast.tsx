import { create } from "zustand";

export interface ToastItem {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastState {
  toasts: ToastItem[];
  add: (toast: Omit<ToastItem, "id">) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  const add = useToastStore((s) => s.add);
  return {
    toast: (message: string, opts?: { actionLabel?: string; onAction?: () => void }) =>
      add({ message, actionLabel: opts?.actionLabel, onAction: opts?.onAction }),
  };
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);
  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-[80px] z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--grout)] bg-[var(--surface)] px-4 py-3 text-[14px] text-[var(--ink)] shadow-[var(--shadow-2)]">
          <span>{t.message}</span>
          {t.actionLabel ? (
            <button
              type="button"
              className="min-h-[44px] font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
              onClick={() => {
                t.onAction?.();
                remove(t.id);
              }}
            >
              {t.actionLabel}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
