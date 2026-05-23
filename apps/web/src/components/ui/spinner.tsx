import { cn } from "../../lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
    />
  );
}
