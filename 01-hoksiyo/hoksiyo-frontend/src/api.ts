import { CLIENT_TIMEOUT_MS } from './lib/messages.ts';
import type {
  AnalysisMeta,
  AnalysisResult,
  AnalyzeRequest,
  AnalyzeRunBody,
  AnalyzeSubmissionFailedBody,
  ErrorBody,
  SessionStatus,
} from './types.ts';

// Calls to the frontend Worker (worker/index.ts). Every call is same-origin.

// How one /api/analyze call ended.
//   result: a checked analysis (meta.final_errors may still list problems)
//   run_failed: 200 without an analysis; meta.outcome says why
//   submission_failed: 504
//   error: an error body from the Worker or the backend
//   network: fetch threw, or nothing came back within CLIENT_TIMEOUT_MS
export type AnalyzeOutcome =
  | { kind: 'result'; result: AnalysisResult; meta: AnalysisMeta }
  | { kind: 'run_failed'; meta: AnalysisMeta }
  | { kind: 'submission_failed'; body: AnalyzeSubmissionFailedBody }
  | { kind: 'error'; status: number; body: ErrorBody }
  | { kind: 'network'; timedOut: boolean };

const JSON_HEADERS = { 'content-type': 'application/json' };

export async function hasSession(): Promise<boolean> {
  try {
    const response = await fetch('/api/session');
    return response.ok && ((await response.json()) as SessionStatus).ok;
  } catch {
    return false;
  }
}

export type SessionOutcome = 'ok' | 'denied' | 'network';

export async function startSession(code: string): Promise<SessionOutcome> {
  try {
    const response = await fetch('/api/session', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ code }) });
    return response.ok ? 'ok' : 'denied';
  } catch {
    return 'network';
  }
}

export async function analyze(request: AnalyzeRequest): Promise<AnalyzeOutcome> {
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  let response: Response;
  let body: unknown;
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(request),
      signal: timeout,
    });
    body = await response.json();
  } catch {
    return { kind: 'network', timedOut: timeout.aborted };
  }
  if (response.status === 504) return { kind: 'submission_failed', body: body as AnalyzeSubmissionFailedBody };
  if (response.ok) {
    const run = body as AnalyzeRunBody;
    if (run.analysis !== null && run.meta.outcome === 'finished') {
      return { kind: 'result', result: run.analysis, meta: run.meta };
    }
    return { kind: 'run_failed', meta: run.meta };
  }
  return { kind: 'error', status: response.status, body: body as ErrorBody };
}
