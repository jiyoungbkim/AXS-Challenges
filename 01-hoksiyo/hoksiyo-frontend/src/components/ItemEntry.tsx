import { CONFIDENCE_LABEL, PRIOR_NOT_PROVIDED_HINT, PRIOR_REFERENCE_LABEL, requesterText } from '../lib/messages.ts';
import type { AnalysisItem } from '../types.ts';

interface ItemEntryProps {
  item: AnalysisItem;
  sender: string;
  sentenceNumbers: number[];
  selected: boolean;
  onToggle: (itemId: number) => void;
}

export function ItemEntry({ item, sender, sentenceNumbers, selected, onToggle }: ItemEntryProps) {
  const confidence = CONFIDENCE_LABEL[item.confidence];
  const prior = PRIOR_REFERENCE_LABEL[item.prior_feedback_reference];
  const needsConfirmation = item.status === 'needs_confirmation';

  return (
    <li
      id={`item-${item.id}`}
      className={`item ${needsConfirmation ? 'item-confirm' : 'item-actionable'}${selected ? ' is-selected' : ''}`}
    >
      <div className="item-top">
        <span className="item-id">항목 {item.id}</span>
        <button type="button" className="link-button" aria-pressed={selected} onClick={() => onToggle(item.id)}>
          {selected ? '원문에서 보는 중' : '원문에서 보기'}
        </button>
      </div>
      <h4 className="item-request">
        <span className="request-text">{item.request}</span>
      </h4>

      <dl className="item-facts">
        <div>
          <dt>확신도</dt>
          <dd>
            <span className="confidence" aria-label={`확신도 ${confidence.text}`}>
              <span className="dots" aria-hidden="true">
                {confidence.dots}
              </span>{' '}
              <span aria-hidden="true">{confidence.text}</span>
            </span>
            <span className="reason">{item.confidence_reason}</span>
          </dd>
        </div>
        <div>
          <dt>요청한 사람</dt>
          <dd>{requesterText(item.requester, sender, item.requester_status === 'identified')}</dd>
        </div>
        <div>
          <dt>근거 문장</dt>
          <dd>{sentenceNumbers.length > 0 ? sentenceNumbers.join(', ') : '원문에서 찾지 못함'}</dd>
        </div>
        {prior !== null ? (
          <div>
            <dt>이전 피드백</dt>
            <dd>
              {item.prior_feedback_reference === 'not_provided' ? (
                <>
                  <span className="tag">{prior}</span>
                  <span className="reason">{PRIOR_NOT_PROVIDED_HINT}</span>
                </>
              ) : (
                prior
              )}
            </dd>
          </div>
        ) : null}
        {item.interpretations.length > 0 ? (
          <div>
            <dt>가능한 해석</dt>
            <dd>
              <ul className="plain-list">
                {item.interpretations.map((interpretation) => (
                  <li key={interpretation}>{interpretation}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : item.confidence === 'low' ? (
          <div>
            <dt>가능한 해석</dt>
            <dd className="reason">원문만으로는 해석안을 만들 수 없어요. 아래 점검의 부족한 정보를 확인하세요.</dd>
          </div>
        ) : null}
        {item.questions.length > 0 ? (
          <div>
            <dt>확인 질문</dt>
            <dd>
              <ol className="question-list">
                {item.questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ol>
            </dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}
