"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createDataRequestAction } from "@/features/cases/actions";

export function DataRequestForm() {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function submit(type: "EXPORT" | "DELETE") {
    if (type === "DELETE" && !window.confirm("Ask TitleCheck to delete your account and personal data?")) return;
    await createDataRequestAction({ type, note });
    setNote("");
    setMessage(type === "EXPORT" ? "Export requested. We will email your data." : "Deletion requested. We will confirm by email.");
  }

  return (
    <div className="space-y-3">
      {message ? <p className="rounded-md bg-seal-wash px-3 py-2 text-sm text-seal-dark">{message}</p> : null}
      <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Anything we should know (optional)" />
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => submit("EXPORT")}>Request a copy of my data</Button>
        <Button type="button" variant="destructive" onClick={() => submit("DELETE")}>Request deletion</Button>
      </div>
    </div>
  );
}
