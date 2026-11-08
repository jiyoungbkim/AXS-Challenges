import type { SourceSentence } from '../lib/source-map.ts';

interface SourceLinksProps {
  sentence: SourceSentence;
  selectedItemId: number | null;
  onSelectItem: (itemId: number) => void;
}

// What each sentence became: the items it supports, or why it supports none.
function SourceLinks({ sentence, selectedItemId, onSelectItem }: SourceLinksProps) {
  if (sentence.role === 'non_request') return <span className="source-note">요청 아님</span>;
  if (sentence.role === 'unlinked') return <span className="source-note unlinked">⚠ 연결 안 됨</span>;
  return (
    <>
      {sentence.itemIds.map((itemId) => (
        <button
          key={itemId}
          type="button"
          className="link-button"
          aria-pressed={selectedItemId === itemId}
          onClick={() => onSelectItem(itemId)}
        >
          → 항목 {itemId}
        </button>
      ))}
    </>
  );
}

interface SourceTextProps {
  sentences: SourceSentence[];
  // Sentence numbers to highlight: those of the selected item.
  highlighted: number[];
  selectedItemId: number | null;
  onSelectItem: (itemId: number) => void;
}

export function SourceText({ sentences, highlighted, selectedItemId, onSelectItem }: SourceTextProps) {
  return (
    <ol className="source-list">
      {sentences.map((sentence) => {
        const isHighlighted = highlighted.includes(sentence.number);
        return (
          <li key={sentence.number} className={isHighlighted ? 'source-sentence is-highlighted' : 'source-sentence'}>
            <span className="source-number" aria-hidden="true">
              {sentence.number}
            </span>
            <div className="source-body">
              <p className="source-text">
                <span className="sr-only">문장 {sentence.number}. </span>
                {sentence.text}
                {isHighlighted ? <span className="sr-only"> (선택한 항목의 근거)</span> : null}
              </p>
              <p className="source-links">
                <SourceLinks sentence={sentence} selectedItemId={selectedItemId} onSelectItem={onSelectItem} />
                {sentence.copies > 1 ? (
                  <span className="source-note">같은 문장이 {sentence.copies}번 있어 함께 표시</span>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
