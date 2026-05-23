import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default:
          "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
        active:
          "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900",
        outline:
          "border border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300",
        destructive:
          "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
