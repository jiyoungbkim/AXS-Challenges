import { useMemo, useState } from 'react';
import { buildSourceMap } from '../lib/source-map.ts';
import { CHANNEL_LABEL, RESULT_CHECK_WARNING, senderText, STATUS_LABEL } from '../lib/messages.ts';
import { splitSentences } from '../lib/sentences.ts';
import type { AnalysisItem, AnalysisMeta, AnalysisResult, ItemStatus } from '../types.ts';
import { EmptyResult } from './EmptyResult.tsx';
import { ItemEntry } from './ItemEntry.tsx';
import { QuestionList } from './QuestionList.tsx';
import { ReviewPanel } from './ReviewPanel.tsx';
import { SourceText } from './SourceText.tsx';

// 확인 필요 first: its questions go out before the work starts.
const GROUP_ORDER: ItemStatus[] = ['needs_confirmation', 'actionable'];

interface StatusMarkProps {
  status: ItemStatus;
}

// Mark + words + color, so color is never the only cue.
function StatusMark({ status }: StatusMarkProps) {
  const label = STATUS_LABEL[status];
  return (
    <span className={status === 'needs_confirmation' ? 'status-mark confirm' : 'status-mark actionable'}>
      <span aria-hidden="true">{label.mark}</span> {label.text}
    </span>
  );
}

interface ItemGroupProps {
  status: ItemStatus;
  items: AnalysisItem[];
  sender: string;
  sentencesByItem: Map<number, number[]>;
  selectedItemId: number | null;
  onToggle: (itemId: number) => void;
}

function ItemGroup({ status, items, sender, sentencesByItem, selectedItemId, onToggle }: ItemGroupProps) {
  const titleId = `group-${status}`;
  return (
    <section className="item-group" aria-labelledby={titleId}>
      <h3 id={titleId}>
        <StatusMark status={status} /> <span className="count">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="reason">(없음)</p>
      ) : (
        <ul className="item-list">
          {items.map((item) => (
            <ItemEntry
              key={item.id}
              item={item}
              sender={sender}
              sentenceNumbers={sentencesByItem.get(item.id) ?? []}
              selected={selectedItemId === item.id}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface ResultViewProps {
  // The feedback that was analyzed (not the form's current value).
  feedback: string;
  result: AnalysisResult;
  meta: AnalysisMeta;
  onEdit: () => void;
  onNew: () => void;
}

export function ResultView({ feedback, result, meta, onEdit, onNew }: ResultViewProps) {
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const sourceMap = useMemo(() => buildSourceMap(feedback, result), [feedback, result]);

  const { analysis, feedback_context: context, validation } = result;
  const inputType = analysis.input_type;
  const isEmpty = inputType !== 'revision_feedback';
  // unmatched_text plus any sentence no list mentions, once each.
  const unlinked = [
    ...new Set(sourceMap.sentences.filter((sentence) => sentence.role === 'unlinked').map((sentence) => sentence.text)),
  ];
  const highlighted = selectedItemId === null ? [] : (sourceMap.sentencesByItem.get(selectedItemId) ?? []);

  function handleToggleItem(itemId: number) {
    setSelectedItemId((current) => (current === itemId ? null : itemId));
    setSourceOpen(true);
  }

  // From a "→ 항목 n" link in the original: select and bring the item into view.
  function handleSelectFromSource(itemId: number) {
    setSelectedItemId(itemId);
    document.getElementById(`item-${itemId}`)?.scrollIntoView({ block: 'nearest' });
  }

  return (
    <article className="result" aria-labelledby="result-title">
      {meta.final_errors.length > 0 ? (
        <p className="warning" role="alert">
          <span aria-hidden="true">⚠ </span>
          {RESULT_CHECK_WARNING}
        </p>
      ) : null}

      <header className="result-head">
        <h2 id="result-title">{result.project.name}</h2>
        <dl className="context">
          <div>
            <dt>전달한 사람</dt>
            <dd>{senderText(context.sender)}</dd>
          </div>
          <div>
            <dt>받은 곳</dt>
            <dd>{CHANNEL_LABEL[context.channel]}</dd>
          </div>
        </dl>
        {isEmpty ? null : (
          <>
            <p className="summary">{analysis.summary}</p>
            <p className="tally">
              <StatusMark status="needs_confirmation" /> <span className="count">{analysis.confirmation_count}</span>
              <StatusMark status="actionable" /> <span className="count">{analysis.actionable_count}</span>
            </p>
            {unlinked.length > 0 ? (
              <p className="unlinked-line">
                ⚠ 항목으로 연결하지 못한 문장이 {unlinked.length}개 있어요. <a href="#review">점검</a>에서 확인하세요.
              </p>
            ) : null}
            <div className="actions">
              <button type="button" className="button secondary" onClick={onEdit}>
                입력 고치기
              </button>
              <button type="button" className="button secondary" onClick={onNew}>
                새 피드백 분석
              </button>
            </div>
          </>
        )}
      </header>

      {inputType !== 'revision_feedback' ? (
        <EmptyResult
          inputType={inputType}
          sentences={inputType === 'out_of_scope' ? splitSentences(feedback) : validation.non_request_text}
          onEdit={onEdit}
          onNew={onNew}
        />
      ) : (
        <div className="result-columns">
          <section className="source-column" aria-labelledby="source-title">
            <div className="source-head">
              <h3 id="source-title">원문</h3>
              <button
                type="button"
                className="link-button source-toggle"
                aria-expanded={sourceOpen}
                aria-controls="source-panel"
                onClick={() => setSourceOpen((open) => !open)}
              >
                {sourceOpen ? '원문 접기' : '원문 펼치기'}
              </button>
            </div>
            <div id="source-panel" className={sourceOpen ? 'source-panel' : 'source-panel is-collapsed'}>
              <SourceText
                sentences={sourceMap.sentences}
                highlighted={highlighted}
                selectedItemId={selectedItemId}
                onSelectItem={handleSelectFromSource}
              />
            </div>
          </section>

          <div className="items-column">
            {GROUP_ORDER.map((status) => (
              <ItemGroup
                key={status}
                status={status}
                items={result.items.filter((item) => item.status === status)}
                sender={context.sender}
                sentencesByItem={sourceMap.sentencesByItem}
                selectedItemId={selectedItemId}
                onToggle={handleToggleItem}
              />
            ))}
            <QuestionList
              items={result.items.filter((item) => item.status === 'needs_confirmation')}
              sourceOrder={sourceMap.sentences.map((sentence) => sentence.text)}
            />
            <ReviewPanel validation={validation} unlinked={unlinked} finalErrors={meta.final_errors} />
          </div>
        </div>
      )}
    </article>
  );
}
