import * as TabsPrimitive from "@radix-ui/react-tabs";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] p-1",
        className,
      )}
      {...props}
    />
  );
});

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center rounded-[4px] px-3 text-[14px] font-medium text-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=active]:bg-[var(--primary-soft)] data-[state=active]:text-[var(--on-primary-soft)]",
        className,
      )}
      {...props}
    />
  );
});

export const TabsContent = TabsPrimitive.Content;

export const SegmentedControl = Tabs;
export const SegmentedControlList = TabsList;
export const SegmentedControlTrigger = TabsTrigger;
