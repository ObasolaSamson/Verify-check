import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full bg-seal-wash px-2.5 py-1 text-xs font-semibold text-seal-dark", className)}
      {...props}
    />
  );
}
