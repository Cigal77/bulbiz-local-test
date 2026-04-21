import { supabase } from "@/integrations/supabase/client";

let errorQueue: Array<{
  error_message: string;
  error_stack?: string;
  function_name?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let recentErrors = new Set<string>();

function dedupeKey(msg: string): string {
  return msg.slice(0, 100);
}

export function logError(params: {
  error_message: string;
  error_stack?: string;
  function_name?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    // Dedupe: skip if same error logged in last 30s
    const key = dedupeKey(params.error_message);
    if (recentErrors.has(key)) return;
    recentErrors.add(key);
    setTimeout(() => recentErrors.delete(key), 30000);

    // Add common metadata
    const enrichedMetadata = {
      ...params.metadata,
      url: window.location.href,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    errorQueue.push({ ...params, metadata: enrichedMetadata });

    // Batch flush after 1s
    if (!flushTimer) {
      flushTimer = setTimeout(flushErrors, 1000);
    }
  } catch {
    // Never throw from the error logger itself
  }
}

async function flushErrors() {
  flushTimer = null;
  const batch = errorQueue.splice(0, 10);
  if (batch.length === 0) return;

  for (const entry of batch) {
    try {
      await supabase.functions.invoke("log-client-error", {
        body: entry,
      });
    } catch {
      // Silent fail — we don't want error logging to cause more errors
    }
  }

  // If there are remaining errors, schedule another flush
  if (errorQueue.length > 0) {
    flushTimer = setTimeout(flushErrors, 1000);
  }
}

export function logErrorFromCatch(error: unknown, context?: {
  function_name?: string;
  metadata?: Record<string, unknown>;
}) {
  const err = error instanceof Error ? error : new Error(String(error));
  logError({
    error_message: err.message,
    error_stack: err.stack,
    function_name: context?.function_name,
    source: "client",
    metadata: context?.metadata,
  });
}
