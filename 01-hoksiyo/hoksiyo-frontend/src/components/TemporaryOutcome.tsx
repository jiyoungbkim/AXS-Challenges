import type { AnalyzeOutcome } from '../api.ts';

// 임시 표시: 3차에서 결과 화면과 오류 화면으로 바꾼다. 지금은 응답 JSON과
// 오류 코드만 보여 준다.

function outcomeCode(outcome: AnalyzeOutcome): string {
  switch (outcome.kind) {
    case 'result':
      return outcome.meta.final_errors.length > 0 ? 'result (final_errors 있음)' : 'result';
    case 'run_failed':
      return `run_failed: ${outcome.meta.outcome}`;
    case 'submission_failed':
      return `submission_failed (504): ${outcome.body.error.outcome}`;
    case 'error':
      return `${outcome.status} ${outcome.body.error}`;
    case 'network':
      return outcome.timedOut ? 'network: client_timeout' : 'network';
  }
}

interface TemporaryOutcomeProps {
  outcome: AnalyzeOutcome;
  onEdit: () => void;
  onRetry: () => void;
  onNew: () => void;
}

export function TemporaryOutcome({ outcome, onEdit, onRetry, onNew }: TemporaryOutcomeProps) {
  const isResult = outcome.kind === 'result';
  return (
    <section className="temporary" aria-labelledby="temporary-title">
      <h2 id="temporary-title">{isResult ? '분석 결과' : '분석하지 못했어요'} (임시 표시)</h2>
      <p>
        코드: <code>{outcomeCode(outcome)}</code>
      </p>
      <div className="actions">
        {isResult ? null : (
          <button className="button" type="button" onClick={onRetry}>
            다시 분석
          </button>
        )}
        <button className="button secondary" type="button" onClick={onEdit}>
          입력 고치기
        </button>
        {isResult ? (
          <button className="button secondary" type="button" onClick={onNew}>
            새 피드백 분석
          </button>
        ) : null}
      </div>
      <pre className="raw">{JSON.stringify(outcome, null, 2)}</pre>
    </section>
  );
}
