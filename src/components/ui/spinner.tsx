import { cn } from "@/lib/utils";

/** Small spinning ring. Inherits the text colour, so it works on any button. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-4 shrink-0 animate-spin", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Centred loader for a whole page or section while its data loads. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-2">
      <Spinner className="size-8 text-seal" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}
