"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createDataRequestAction } from "@/features/cases/actions";

type RequestType = "EXPORT" | "DELETE";

export function DataRequestForm() {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<RequestType | null>(null);

  async function submit(type: RequestType) {
    if (type === "DELETE" && !window.confirm("Ask VerifyTitle Nigeria to delete your account and personal data?")) return;
    setBusy(type);
    setMessage("");
    try {
      await createDataRequestAction({ type, note });
      setNote("");
      setMessage(type === "EXPORT" ? "Export requested. We will email your data." : "Deletion requested. We will confirm by email.");
    } catch {
      setMessage("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {message ? <p className="rounded-md bg-seal-wash px-3 py-2 text-sm text-seal-dark">{message}</p> : null}
      <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Anything we should know (optional)" disabled={busy !== null} />
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" loading={busy === "EXPORT"} disabled={busy !== null} onClick={() => submit("EXPORT")}>
          {busy === "EXPORT" ? "Requesting…" : "Request a copy of my data"}
        </Button>
        <Button type="button" variant="destructive" loading={busy === "DELETE"} disabled={busy !== null} onClick={() => submit("DELETE")}>
          {busy === "DELETE" ? "Requesting…" : "Request deletion"}
        </Button>
      </div>
    </div>
  );
}
