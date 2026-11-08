import { splitNotes } from '../lib/messages.ts';
import type { AnalysisResult, ValidationError } from '../types.ts';

interface TextListProps {
  items: string[];
  source?: boolean;
}

// source: the strings are original sentences, set like the original.
function TextList({ items, source = false }: TextListProps) {
  return (
    <ul className={source ? 'plain-list source-quote' : 'plain-list'}>
      {items.map((text, index) => (
        <li key={index}>{text}</li>
      ))}
    </ul>
  );
}

interface ReviewPanelProps {
  validation: AnalysisResult['validation'];
  // unmatched_text plus original sentences no list mentions.
  unlinked: string[];
  finalErrors: ValidationError[];
}

// What to check besides the items. Empty parts are left out.
export function ReviewPanel({ validation, unlinked, finalErrors }: ReviewPanelProps) {
  const notes = splitNotes(validation.notes);
  const hasContent =
    unlinked.length > 0 ||
    notes.keep.length > 0 ||
    validation.missing_information.length > 0 ||
    notes.other.length > 0 ||
    validation.non_request_text.length > 0 ||
    finalErrors.length > 0;

  return (
    <section className="review" id="review" aria-labelledby="review-title">
      <h3 id="review-title">점검</h3>
      {hasContent ? null : <p className="reason">더 확인할 내용이 없어요.</p>}

      {unlinked.length > 0 ? (
        <div className="review-part unmatched">
          <h4>⚠ 항목으로 연결하지 못한 문장</h4>
          <p className="reason">요청일 수 있는데 어느 항목에도 넣지 못한 문장이에요. 직접 읽고 판단하세요.</p>
          <TextList items={unlinked} source />
        </div>
      ) : null}

      {notes.keep.length > 0 ? (
        <div className="review-part">
          <h4>그대로 둘 것</h4>
          <TextList items={notes.keep} />
        </div>
      ) : null}

      {validation.missing_information.length > 0 ? (
        <div className="review-part">
          <h4>부족한 정보</h4>
          <TextList items={validation.missing_information} />
        </div>
      ) : null}

      {notes.other.length > 0 ? (
        <div className="review-part">
          <h4>참고</h4>
          <TextList items={notes.other} />
        </div>
      ) : null}

      {validation.non_request_text.length > 0 ? (
        <details className="review-part">
          <summary>요청이 아닌 문장 {validation.non_request_text.length}개</summary>
          <TextList items={validation.non_request_text} source />
        </details>
      ) : null}

      {finalErrors.length > 0 ? (
        <details className="review-part">
          <summary>자동 점검 상세 {finalErrors.length}건</summary>
          <ul className="plain-list">
            {finalErrors.map((error, index) => (
              <li key={index}>
                <code>조건 {error.cond}</code> {error.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
