"use client";

import type { ShellRouteProps } from "../shell/public.ts";
import { EmptyState, Panel } from "../platform/public.ts";
import { TraceExplorer } from "./TraceExplorer.tsx";
import { getActiveTraceReplayRuntime } from "./runtime.ts";

export function TraceReplayRoute({ query, params, navigate }: ShellRouteProps) {
  const runtime = getActiveTraceReplayRuntime();
  const traceId = typeof query.traceId === "string" ? query.traceId : params.traceId;
  if (!runtime) return <Panel eyebrow="Trace / provenance" title="Trace service unavailable"><EmptyState title="Trace provider is not connected" summary="The shell remains available. Connect the Trace and Replay provider to inspect saved runs." /></Panel>;
  return <TraceExplorer query={runtime.query} replay={runtime.replay} initialTraceId={traceId} navigate={navigate} />;
}
