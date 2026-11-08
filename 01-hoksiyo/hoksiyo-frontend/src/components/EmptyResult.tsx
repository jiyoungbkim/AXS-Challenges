import { EMPTY_RESULT_MESSAGE } from '../lib/messages.ts';
import type { InputType } from '../types.ts';

interface EmptyResultProps {
  inputType: Exclude<InputType, 'revision_feedback'>;
  // no_revision_request: the non-request sentences; out_of_scope: the whole original.
  sentences: string[];
  onEdit: () => void;
  onNew: () => void;
}

export function EmptyResult({ inputType, sentences, onEdit, onNew }: EmptyResultProps) {
  return (
    <section className="empty-result" aria-labelledby="empty-title">
      <h3 id="empty-title">{EMPTY_RESULT_MESSAGE[inputType]}</h3>
      {sentences.length > 0 ? (
        <>
          <p className="list-label">{inputType === 'out_of_scope' ? '받은 원문' : '요청이 아닌 문장'}</p>
          <ul className="plain-list source-quote">
            {sentences.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="actions">
        <button type="button" className="button" onClick={onNew}>
          새 피드백 분석
        </button>
        <button type="button" className="button secondary" onClick={onEdit}>
          입력 고치기
        </button>
      </div>
    </section>
  );
}
