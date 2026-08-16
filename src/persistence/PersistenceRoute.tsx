"use client";

import { useRef, useState } from "react";
import { Panel, StatusBadge } from "../platform/public.ts";
import { getActivePersistenceRuntime } from "./runtime.ts";

export function PersistenceRoute() {
  const runtime = getActivePersistenceRuntime();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("Saves are validated and committed atomically on this device.");
  const [messageIsError, setMessageIsError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<NonNullable<typeof runtime>['service']['previewImport']>> | undefined>();
  const [, redraw] = useState(0);
  if (!runtime) return <Panel eyebrow="Save / Recovery" title="Persistence unavailable"><p>The save provider has not initialized. Reload after the feature providers are ready.</p></Panel>;
  const service = runtime.service;
  const report = (next: string, isError = false) => { setMessage(next); setMessageIsError(isError); };
  const save = async (slot: "manual" | "auto") => { const result = await service.save(slot); report(result.ok ? `Committed ${slot} save ${result.saveId ?? ""} (${result.canonicalStateHash ?? "no state"}).` : `${result.error?.code}: ${result.error?.message}`, !result.ok); redraw((value) => value + 1); };
  const load = async (slot: "manual" | "auto") => { const result = await service.load(slot); report(result.ok ? `Loaded ${slot} save ${result.saveId ?? ""}; active session hash ${result.canonicalStateHash ?? "—"}.` : `${result.error?.code}: ${result.error?.message} Current session was retained.`, !result.ok); redraw((value) => value + 1); };
  const chooseFile = async (file: File | undefined) => { if (!file) return; const next = await service.previewImport(file); setPreview(next); report(next.ok ? `Preview ready: ${next.metadata.slot} · ${next.featureIds.length} feature sections. Confirm replacement to import.` : `${next.error.code}: ${next.error.message}`, !next.ok); };
  const confirmImport = async () => { if (!preview?.ok) return; const result = await service.import(new Blob([JSON.stringify(preview.envelope)], { type: "application/json" }), { slot: preview.metadata.slot, confirm: true }); report(result.ok ? `Imported ${result.metadata.slot} after validation.` : `${result.error.code}: ${result.error.message}`, !result.ok); setPreview(undefined); };
  const deleteManualSave = async () => { const result = await service.delete("manual", "DELETE:manual"); report(result.ok ? "Deleted the manual save slot. The autosave and its backup were not changed." : `${result.error?.code}: ${result.error?.message}`, !result.ok); setConfirmDelete(false); redraw((value) => value + 1); };
  return <main aria-labelledby="persistence-heading" style={{ display: "grid", gap: "1rem" }}>
    <Panel eyebrow="Save / Recovery" title="Durable park state"><h1 id="persistence-heading" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Save and recovery controls</h1><p role={messageIsError ? "alert" : "status"} aria-live={messageIsError ? "assertive" : "polite"} aria-atomic="true">{message}</p><p role="status" aria-live="polite"><StatusBadge status={runtime.autosave.status().writing ? "warning" : runtime.autosave.status().pending ? "pending" : "success"} label={runtime.autosave.status().writing ? "Autosave writing" : runtime.autosave.status().pending ? "Autosave queued" : "Autosave ready"} /></p></Panel>
    <Panel eyebrow="Slots" title="Manual and autosave"><div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}><button type="button" onClick={() => void save("manual")}>Save manual slot</button><button type="button" onClick={() => void load("manual")}>Load manual slot</button><button type="button" onClick={() => void save("auto")}>Save autosave slot</button><button type="button" onClick={() => void load("auto")}>Recover autosave</button><button type="button" onClick={() => void service.export("manual").then((blob) => { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "dino-park-save.json"; link.click(); URL.revokeObjectURL(url); }).catch((error) => report(String(error), true))}>Export manual save</button><button type="button" onClick={() => setConfirmDelete(true)}>Delete manual save</button></div>{confirmDelete ? <div role="alertdialog" aria-modal="true" aria-labelledby="delete-save-title" style={{ marginTop: ".8rem" }}><p id="delete-save-title"><strong>Delete the manual save?</strong></p><p>This removes the active manual slot and its manual backup. This cannot be undone.</p><button type="button" onClick={() => void deleteManualSave()}>Yes, delete manual save</button><button type="button" onClick={() => setConfirmDelete(false)}>Cancel</button></div> : null}</Panel>
    <Panel eyebrow="Import" title="Preview before replacement"><input ref={inputRef} type="file" accept="application/json,.json" onChange={(event) => void chooseFile(event.target.files?.[0])} aria-label="Choose a versioned save file" />{preview?.ok ? <div role="status" style={{ marginTop: ".8rem" }}><p>Save {preview.metadata.saveId} · format {preview.envelope.formatVersion} · sections: {preview.featureIds.join(", ") || "none"}</p><button type="button" onClick={() => void confirmImport()}>Confirm import to {preview.metadata.slot}</button><button type="button" onClick={() => { setPreview(undefined); if (inputRef.current) inputRef.current.value = ""; }}>Cancel import</button></div> : null}</Panel>
  </main>;
}
