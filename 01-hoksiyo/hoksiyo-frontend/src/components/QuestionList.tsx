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

interface QuestionListProps {
  // Items that need confirmation, in display order.
  items: AnalysisItem[];
}

// Every question to send, gathered from the items that need confirmation.
export function QuestionList({ items }: QuestionListProps) {
  const [status, setStatus] = useState<string | null>(null);
  const groups = numberQuestions(items);
  const all = groups.flatMap((group) => group.questions);

  async function handleCopyAll() {
    const text = all.map((question) => `${question.number}. ${question.text}`).join('\n');
    setStatus((await copyText(text)) ? `질문 ${all.length}개를 모두 복사했어요.` : COPY_FAILED);
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
