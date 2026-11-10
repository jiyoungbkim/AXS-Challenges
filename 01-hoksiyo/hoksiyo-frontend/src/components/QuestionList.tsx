import { useState } from 'react';
import type { AnalysisItem } from '../types.ts';

const COPY_FAILED = '복사하지 못했어요. 질문을 직접 선택해 복사하세요.';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

interface NumberedQuestion {
  number: number;
  text: string;
}

// Questions numbered across items, so "3번 질문" means the same thing in the
// list and in the copied text.
function numberQuestions(items: AnalysisItem[]): { item: AnalysisItem; questions: NumberedQuestion[] }[] {
  let number = 0;
  return items
    .filter((item) => item.questions.length > 0)
    .map((item) => ({ item, questions: item.questions.map((text) => ({ number: ++number, text })) }));
}

const COPY_HEADER = '보내 주신 피드백 중 확인하고 싶은 부분이 있어요.';

interface QuoteGroup {
  sentences: string[];
  questions: NumberedQuestion[];
}

// Questions gathered under the original sentences they ask about, so the
// recipient sees their own words. Walks the screen order so numbers stay
// 1, 2, 3…: an item joins the group just before it when they share a
// sentence, else starts a new one. Items with no sentence stay in place, unquoted.
function copyAllText(groups: { item: AnalysisItem; questions: NumberedQuestion[] }[], sourceOrder: string[]): string {
  const blocks: QuoteGroup[] = [];
  for (const { item, questions } of groups) {
    const last = blocks.at(-1);
    const joins =
      last !== undefined &&
      (item.original_text.length === 0
        ? last.sentences.length === 0
        : last.sentences.some((text) => item.original_text.includes(text)));
    if (!joins) {
      blocks.push({ sentences: [...item.original_text], questions: [...questions] });
      continue;
    }
    last.sentences = [...new Set([...last.sentences, ...item.original_text])].sort(
      (a, b) => sourceOrder.indexOf(a) - sourceOrder.indexOf(b),
    );
    last.questions.push(...questions);
  }

  const line = (question: NumberedQuestion) => `${question.number}. ${question.text}`;
  const text = blocks.map((group) =>
    [...(group.sentences.length > 0 ? [`"${group.sentences.join(' ')}"`] : []), ...group.questions.map(line)].join('\n'),
  );
  return [COPY_HEADER, ...text].join('\n\n');
}

interface QuestionListProps {
  // Items that need confirmation, in display order.
  items: AnalysisItem[];
  // Sentences of the feedback in source order, for ordering merged quotes.
  sourceOrder: string[];
}

// Every question to send, gathered from the items that need confirmation.
export function QuestionList({ items, sourceOrder }: QuestionListProps) {
  const [status, setStatus] = useState<string | null>(null);
  const groups = numberQuestions(items);
  const all = groups.flatMap((group) => group.questions);

  async function handleCopyAll() {
    setStatus((await copyText(copyAllText(groups, sourceOrder))) ? `질문 ${all.length}개를 모두 복사했어요.` : COPY_FAILED);
  }

  async function handleCopyOne(question: NumberedQuestion) {
    setStatus((await copyText(question.text)) ? `${question.number}번 질문을 복사했어요.` : COPY_FAILED);
  }

  if (all.length === 0) return null;

  return (
    <section className="questions" aria-labelledby="questions-title">
      <div className="section-top">
        <h3 id="questions-title">확인 질문 {all.length}개</h3>
        <button type="button" className="button secondary" onClick={handleCopyAll}>
          질문 전체 복사
        </button>
      </div>
      <p className="copy-status" role="status">
        {status ?? ''}
      </p>
      {groups.map(({ item, questions }) => (
        <div key={item.id} className="question-group">
          <p className="question-about">
            <span className="item-id">항목 {item.id}</span> {item.request}
          </p>
          <ol className="question-list">
            {questions.map((question) => (
              <li key={question.number} value={question.number}>
                <span className="question-text">{question.text}</span>
                <button
                  type="button"
                  className="link-button"
                  aria-label={`${question.number}번 질문 복사`}
                  onClick={() => handleCopyOne(question)}
                >
                  복사
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
