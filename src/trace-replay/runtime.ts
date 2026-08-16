import {
  createReplayService,
  createTraceRepository,
  type ReplayPorts,
  type ReplayService,
  type TraceQuery,
  type TraceRepository,
  type TraceSink,
} from "../../trace-replay/index.ts";
import { createContentRegistry } from "../content-registry/public.ts";
import { createContextService } from "../context/public.ts";
import { createInstructionEngine } from "../instruction/public.ts";

export interface TraceReplayRuntime {
  readonly repository: TraceRepository;
  readonly recorder: TraceSink;
  readonly query: TraceQuery;
  readonly replay: ReplayService;
  /** Shared public production ports. Downstream producers may load their
   * authored packs into this registry so saved manifests replay against the
   * same exact versioned content rather than a private duplicate. */
  readonly content: NonNullable<ReplayPorts["content"]>;
  readonly context: NonNullable<ReplayPorts["context"]>;
}

let activeRuntime: TraceReplayRuntime | null = null;

export function createTraceReplayProvider(ports: ReplayPorts = {}): TraceReplayRuntime {
  const repository = createTraceRepository();
  const content = ports.content ?? createContentRegistry();
  const context = ports.context ?? createContextService();
  const runtime: TraceReplayRuntime = {
    repository,
    recorder: repository,
    query: repository,
    replay: createReplayService({ ...ports, content, context, instructionFactory: ports.instructionFactory ?? createInstructionEngine }),
    content,
    context,
  };
  activeRuntime = runtime;
  return runtime;
}

export function getActiveTraceReplayRuntime(): TraceReplayRuntime | null {
  return activeRuntime;
}

export function setActiveTraceReplayRuntime(runtime: TraceReplayRuntime | null): void {
  activeRuntime = runtime;
}
