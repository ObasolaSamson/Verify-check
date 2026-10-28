"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type SubmitButtonProps = Omit<React.ComponentProps<typeof Button>, "loading" | "type" | "asChild"> & {
  /** Text shown while the form's server action is running. Defaults to the normal label. */
  pendingText?: React.ReactNode;
  /** Render as a plain text-style button (no Button styling), for links like "Sign out". */
  plain?: boolean;
};

/**
 * Submit button for forms that use a server action (`<form action={...}>`).
 * It reads the form's pending state itself, so the page can stay a server component.
 */
export function SubmitButton({ children, pendingText, plain = false, className, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const label = pending && pendingText ? pendingText : children;

  if (plain) {
    return (
      <button
        type="submit"
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        className={cn("inline-flex items-center gap-2 disabled:cursor-progress disabled:opacity-70", className)}
      >
        {pending ? <Spinner /> : null}
        {label}
      </button>
    );
  }

  return (
    <Button type="submit" loading={pending} disabled={disabled} className={className} {...props}>
      {label}
    </Button>
  );
}
