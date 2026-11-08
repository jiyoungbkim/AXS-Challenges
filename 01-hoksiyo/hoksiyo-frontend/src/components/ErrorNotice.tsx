import type { AnalyzeOutcome } from '../api.ts';
import {
  describeError,
  describeOutcome,
  NETWORK_FAILURE,
  SUBMISSION_FAILED,
  type Failure,
} from '../lib/messages.ts';

export type FailedOutcome = Exclude<AnalyzeOutcome, { kind: 'result' }>;

function failureOf(outcome: FailedOutcome): Failure {
  switch (outcome.kind) {
    case 'run_failed':
      return describeOutcome(outcome.meta);
    case 'submission_failed':
      return SUBMISSION_FAILED;
    case 'error':
      return describeError(outcome.body);
    case 'network':
      return NETWORK_FAILURE;
  }
}

interface ErrorNoticeProps {
  outcome: FailedOutcome;
  onRetry: () => void;
  onEdit: () => void;
}

// An analysis that ended without a result. access_required never gets here:
// App sends it back to the access code screen.
export function ErrorNotice({ outcome, onRetry, onEdit }: ErrorNoticeProps) {
  const failure = failureOf(outcome);
  return (
    <section className="error-notice" aria-labelledby="error-title">
      <h2 id="error-title">분석하지 못했어요</h2>
      <p className="error-message" role="alert">
        {failure.message}
      </p>
      <div className="actions">
        {failure.next === 'retry' ? (
          <button type="button" className="button" onClick={onRetry}>
            다시 분석
          </button>
        ) : null}
        <button type="button" className={failure.next === 'retry' ? 'button secondary' : 'button'} onClick={onEdit}>
          입력 고치기
        </button>
      </div>
    </section>
  );
}
