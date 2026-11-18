import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { OFFLINE_TITLE, useCanEdit } from "@/lib/realtime/connection-store";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 text-[16px] font-medium transition-colors duration-[var(--dur-fast)] ease-[var(--ease-water)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)]",
        secondary: "border border-[var(--grout)] bg-transparent text-[var(--ink)] hover:bg-[var(--surface-sunken)]",
        ghost: "bg-transparent text-[var(--ink)] hover:bg-[var(--primary-soft)] hover:text-[var(--on-primary-soft)]",
        danger: "bg-[var(--danger)] text-white hover:opacity-90",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  /** Muta datos: se deshabilita sin conexión (RN-03-23), con `aria-disabled` y `title` "Sin conexión". */
  requiresConnection?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, loading, requiresConnection, disabled, children, type = "button", title, ...props },
  ref,
) {
  const canEdit = useCanEdit();
  const blocked = Boolean(requiresConnection) && !canEdit;
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant }), className)}
      disabled={disabled || loading || blocked}
      aria-disabled={blocked || undefined}
      title={blocked ? OFFLINE_TITLE : title}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" /> : null}
      {children}
    </button>
  );
});
