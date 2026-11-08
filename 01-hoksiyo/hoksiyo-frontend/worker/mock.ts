import { splitSentences } from '../src/lib/sentences.ts';
import type { AnalyzeRequest } from '../src/types.ts';
import { CASE_FIXTURES } from './fixtures.ts';

// Stand-in for hoksiyo-backend when MOCK_ANALYZE=1 (.dev.vars only): answers
// the way src/app.ts does, without any model call. The feedback picks the answer:
//   - a docs/test-cases.md input (T01, T05, T06, T07, T09, T10): its saved result
//   - mock:daily_limit | mock:too_many | mock:too_long | mock:aborted | mock:no_finish
//     | mock:give_up | mock:timeout | mock:error | mock:final_errors | mock:504
//     | mock:500 | mock:unreachable
//   - anything else: the T01 result
// Real length and sentence limits are applied first, as the backend does.

const DELAY_MS = 1_500;
const MAX_FEEDBACK_LENGTH = 1_000;
const MAX_SENTENCES = 12;

const USAGE = { neurons: 2_200, basis: 'worst_case', daily_used: 4_200, daily_limit: 9_000 };

function failedRun(outcome: string, outcome_detail: string) {
  return {
    analysis: null,
    meta: {
      mode: 'C',
      model: '@cf/zai-org/glm-5.3',
      thinking: 'low',
      outcome,
      outcome_detail,
      attempts: [],
      final_errors: [],
      warnings: [],
      usage_unavailable: true,
      duration_ms: 42_000,
    },
    reply_text: '',
    reply_metadata: null,
    usage: USAGE,
  };
}

function nextUtcMidnight(): string {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

const t01 = CASE_FIXTURES.T01.body;

function tooManySentences(sentences: number): Response {
  return Response.json(
    { error: 'too_many_sentences', message: `한 번에 ${MAX_SENTENCES}문장까지 분석할 수 있습니다. 피드백을 나눠서 보내 주세요.`, max: MAX_SENTENCES, sentences },
    { status: 400 },
  );
}

function feedbackTooLong(length: number): Response {
  return Response.json(
    { error: 'feedback_too_long', message: `피드백 원문은 ${MAX_FEEDBACK_LENGTH}자까지 분석할 수 있습니다.`, max: MAX_FEEDBACK_LENGTH, length },
    { status: 400 },
  );
}

const TRIGGERS: Record<string, () => Response> = {
  'mock:daily_limit': () =>
    Response.json(
      {
        error: 'daily_limit',
        message: '오늘 분석 한도에 도달했습니다.',
        used: 7_800,
        reserved: 0,
        limit: 9_000,
        resets_at: nextUtcMidnight(),
      },
      { status: 429 },
    ),
  'mock:too_many': () => tooManySentences(13),
  'mock:too_long': () => feedbackTooLong(1_042),
  'mock:aborted': () => Response.json(failedRun('aborted', 'finish 검증 실패 4회')),
  'mock:no_finish': () => Response.json(failedRun('no_finish', 'Agent did not call `finish`')),
  'mock:give_up': () => Response.json(failedRun('give_up', 'Agent gave up')),
  'mock:timeout': () => Response.json(failedRun('timeout', 'harness 180초 초과')),
  'mock:error': () => Response.json(failedRun('error', 'Error: Workers AI 429')),
  'mock:final_errors': () =>
    Response.json({
      ...t01,
      meta: {
        ...(t01.meta as object),
        final_errors: [{ cond: 17, message: '항목 2의 원문에 정도 표현("조금")이 있어 confidence는 high일 수 없습니다.' }],
      },
    }),
  'mock:504': () =>
    Response.json(
      {
        analysis: null,
        meta: null,
        error: {
          outcome: 'failed',
          message: '[flue] Agent run failed (submission mock-submission).',
          submissionId: 'mock-submission',
        },
        usage: USAGE,
      },
      { status: 504 },
    ),
  'mock:500': () => new Response('Internal Server Error', { status: 500 }),
  'mock:unreachable': () => {
    throw new Error('mock: service binding unavailable');
  },
};

export async function mockBackend(input: AnalyzeRequest): Promise<Response> {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  const { feedback } = input;
  if (feedback.length > MAX_FEEDBACK_LENGTH) return feedbackTooLong(feedback.length);
  const sentences = splitSentences(feedback).length;
  if (sentences > MAX_SENTENCES) return tooManySentences(sentences);
  const trigger = TRIGGERS[feedback.trim()];
  if (trigger) return trigger();
  const saved = Object.values(CASE_FIXTURES).find((fixture) => fixture.feedback === feedback);
  return Response.json((saved ?? CASE_FIXTURES.T01).body);
}
