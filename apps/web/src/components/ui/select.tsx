import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
