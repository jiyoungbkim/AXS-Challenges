import type {
	AnalysisMeta,
	Channel,
	Confidence,
	ErrorBody,
	InputType,
	ItemStatus,
	PriorFeedbackReference,
} from '../types.ts';

// Time limits from hoksiyo-backend/src/agents/analyze-feedback.ts:
// HARNESS_TIMEOUT_MS (meta.outcome 'timeout') and durability.timeoutMs (504).
const HARNESS_TIMEOUT_SECONDS = 180;
const SUBMISSION_TIMEOUT_SECONDS = 240;
// The app gives up waiting a little after the backend's own limit.
export const CLIENT_TIMEOUT_MS = 270_000;

// What the person can do next.
//   retry: send the same input again
//   edit: change the input first
//   wait: try again after resets_at, or with a shorter feedback
//   code: enter the access code again (the input is kept)
export type NextStep = 'retry' | 'edit' | 'wait' | 'code';

export interface Failure {
	message: string;
	next: NextStep;
}

const kstFormat = new Intl.DateTimeFormat('ko-KR', {
	timeZone: 'Asia/Seoul',
	month: 'long',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
});

// resets_at is UTC midnight, i.e. 09:00 in Korea.
export function formatKst(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? '내일 오전 9시' : kstFormat.format(date);
}

const SERVER_ERROR: Failure = { message: '분석 서버에서 오류가 났어요. 잠시 뒤 다시 분석하세요.', next: 'retry' };

export function describeError(body: ErrorBody): Failure {
	switch (body.error) {
		case 'access_denied':
			return { message: '접속 코드가 맞지 않아요. 받은 코드를 다시 확인해 입력하세요.', next: 'code' };
		case 'access_required':
			return { message: '접속 코드를 다시 입력하면 입력한 내용 그대로 분석할 수 있어요.', next: 'code' };
		case 'invalid_input':
			return {
				message: '입력 내용을 확인하지 못했어요. 프로젝트명과 피드백 원문을 확인한 뒤 다시 분석하세요.',
				next: 'edit',
			};
		case 'feedback_too_long':
			return {
				message: `피드백 원문이 ${body.length.toLocaleString('ko-KR')}자예요. ${body.max.toLocaleString('ko-KR')}자까지 분석할 수 있으니 나눠서 분석하세요.`,
				next: 'edit',
			};
		case 'too_many_sentences':
			return {
				message: `피드백 원문이 ${body.sentences}문장이에요. 한 번에 ${body.max}문장까지 분석할 수 있으니 나눠서 분석하세요.`,
				next: 'edit',
			};
		case 'daily_limit':
			return {
				message: `오늘 분석할 수 있는 양을 다 썼어요. ${formatKst(body.resets_at)}부터 다시 분석할 수 있어요. 문장이 적을수록 필요한 양이 적어서, 짧게 나누면 지금 분석될 수도 있어요.`,
				next: 'wait',
			};
		case 'backend_unreachable':
			return { message: '분석 서버에 연결하지 못했어요. 잠시 뒤 다시 분석하세요.', next: 'retry' };
		case 'backend_error':
			return SERVER_ERROR;
	}
}

// A 200 whose analysis is null: the run ended without a checked result.
export function describeOutcome(meta: AnalysisMeta): Failure {
	switch (meta.outcome) {
		case 'aborted':
		case 'no_finish':
		case 'give_up':
			return {
				message: '분석 결과가 형식 검사를 통과하지 못했어요. 다시 분석을 한 번 눌러 보세요. 또 실패하면 피드백을 나눠서 분석하세요.',
				next: 'retry',
			};
		case 'timeout':
			return { message: timeoutMessage(HARNESS_TIMEOUT_SECONDS), next: 'retry' };
		case 'error':
		case 'finished':
			return SERVER_ERROR;
	}
}

function timeoutMessage(seconds: number): string {
	return `분석이 ${seconds / 60}분 안에 끝나지 않았어요. 피드백을 나눠서 다시 분석하세요.`;
}

// 504 from the backend.
export const SUBMISSION_TIMEOUT: Failure = { message: timeoutMessage(SUBMISSION_TIMEOUT_SECONDS), next: 'retry' };

// fetch threw, or nothing came back within CLIENT_TIMEOUT_MS.
export const NETWORK_FAILURE: Failure = {
	message: '결과를 받지 못했어요. 인터넷 연결을 확인한 뒤 다시 분석하세요.',
	next: 'retry',
};

export { SERVER_ERROR };

// Shown above a result whose meta.final_errors is not empty.
export const RESULT_CHECK_WARNING =
	'자동 점검에서 맞지 않는 부분이 있었어요. 원문과 항목을 직접 비교해 확인하세요.';

// Labels. Meaning never rests on color alone: status has a mark, confidence a dot count.

export const STATUS_LABEL: Record<ItemStatus, { mark: string; text: string }> = {
	needs_confirmation: { mark: '?', text: '확인 필요' },
	actionable: { mark: '✓', text: '착수 가능' },
};

export const CONFIDENCE_LABEL: Record<Confidence, { dots: string; text: string }> = {
	high: { dots: '●●●', text: '높음' },
	medium: { dots: '●●○', text: '중간' },
	low: { dots: '●○○', text: '낮음' },
};

// not_applicable shows nothing.
export const PRIOR_REFERENCE_LABEL: Record<PriorFeedbackReference, string | null> = {
	matched: '이전 피드백과 같은 요청',
	not_found: '이전 피드백에서 관련 내용을 찾지 못함',
	not_provided: '이전 요청 확인 필요',
	not_applicable: null,
};

export const PRIOR_NOT_PROVIDED_HINT = '이전 피드백을 붙여넣고 다시 분석하면 대조할 수 있어요.';

export const CHANNEL_LABEL: Record<Channel | 'unknown', string> = {
	email: '이메일',
	messenger: '메신저',
	document: '문서',
	unknown: '알 수 없음',
};

export const EMPTY_RESULT_MESSAGE: Record<Exclude<InputType, 'revision_feedback'>, string> = {
	no_revision_request: '수정 요청이 없는 피드백이에요.',
	out_of_scope: '수정 피드백이 아니라서 분석하지 않았어요. 견적·일정 문의는 직접 답해 주세요.',
};

export function requesterLabel(requester: string, sender: string, identified: boolean): string {
	if (!identified) return '요청한 사람 확인 안 됨';
	if (requester === sender || sender === 'unknown') return `요청한 사람 ${requester}`;
	return `요청한 사람 ${requester} (전달한 사람과 다름)`;
}

// Notes written as "유지 지시: <대상>" (docs/analysis-schema.md 3.5).
const KEEP_NOTE = /^유지 지시\s*[:：]\s*/;

export function splitNotes(notes: string[]): { keep: string[]; other: string[] } {
	const keep: string[] = [];
	const other: string[] = [];
	for (const note of notes) {
		if (KEEP_NOTE.test(note)) keep.push(note.replace(KEEP_NOTE, ''));
		else other.push(note);
	}
	return { keep, other };
}
